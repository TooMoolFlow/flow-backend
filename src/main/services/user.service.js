import {
  Office,
  User,
  Executor,
  Request,
  RequestExecutor,
  ServiceCategory,
  ExecutorServiceCategory,
  Company,
} from "../models/init.model.js"
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import { comparePassword, getHashedPassword, randomString } from '../utils/bcrypt/BCryptService.js';
import logger from '../utils/winston/logger.js';
import { sequelize } from '../config/database.config.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import NotificationService from "./notification.service.js";
import ExecutorCategoryService from './executorCategory.service.js';
import {Op} from "sequelize";
import {
  buildCompanyAssignSearchCondition,
  resolveAssignUserSearchFilters,
} from '../utils/assignUserSearch.util.js';

const PRIVILEGED_ROLES = ['admin-worker', 'department-head', 'manager'];
const OFFICE_STAFF_ROLES = ['client', 'executor'];
/** Модуль user-tasks недоступен manager — не показываем в поиске для назначения. */
const TASK_ASSIGN_SEARCH_EXCLUDED_ROLES = ['manager'];

class UserService {
  static async getAllUsers(page = 1, limit = 5, officeFilter, roleFilter, actor = null, companyFilter = null) {
    const offset = (page - 1) * limit;

    const whereConditions = {};

    if (actor?.role === 'department-head') {
      whereConditions.office_id = actor.office_id;
      if (roleFilter && OFFICE_STAFF_ROLES.includes(roleFilter)) {
        whereConditions.role = roleFilter;
      } else {
        whereConditions.role = { [Op.in]: OFFICE_STAFF_ROLES };
      }
    } else {
      if (officeFilter) {
        whereConditions.office_id = officeFilter;
      }
      if (roleFilter) {
        whereConditions.role = roleFilter;
      }
    }

    // Фильтр по компании имеет смысл только для клиентов.
    if (companyFilter !== null && companyFilter !== undefined && companyFilter !== '') {
      const cid = Number(companyFilter);
      if (Number.isFinite(cid) && cid > 0) {
        whereConditions.company_id = cid;
        whereConditions.role = 'client';
      }
    }

    return await User.findAndCountAll({
      // Без exclude список отдавал bcrypt-хэши всех пользователей офиса.
      attributes: { exclude: ['password'] },
      where: whereConditions,
      include: [
        { model: Office, as: 'office', attributes: ['id', 'name'] },
        { model: Company, as: 'company', attributes: ['id', 'name', 'office_id'], required: false },
      ],
      offset,
      limit,
      order: [['created_at', 'DESC']],
    });
  }
  /**
   * Поиск пользователей для назначения (команды, исполнитель задачи).
   * admin-worker — все офисы (опц. office_id, company_id);
   * department-head — свой офис + опц. company_id;
   * client — свой офис, scope company|office (default: company если есть company_id).
   */
  static async searchUsers(query, roleFilter = null, actor = null, options = {}) {
    const actorCompanyId = await UserService._resolveActorCompanyIdForSearch(actor);

    const resolved = resolveAssignUserSearchFilters(
      actor,
      actorCompanyId,
      options,
      roleFilter,
    );
    if (resolved.error) {
      if (resolved.error.type === 'forbidden') {
        throw new ForbiddenError(resolved.error.message);
      }
      throw new BadRequestError(resolved.error.message);
    }

    const { officeId, companyId, roleFilter: effectiveRoleFilter } = resolved;
    const isAdminWorker = actor?.role === 'admin-worker';

    const where = {
      [Op.and]: [
        {
          [Op.or]: [
            { full_name: { [Op.iLike]: `%${query}%` } },
            { phone: { [Op.iLike]: `%${query}%` } },
          ],
        },
      ],
    };

    let resolvedOfficeId = officeId;

    if (companyId != null) {
      resolvedOfficeId = await UserService._resolveCompanyOfficeId(
        companyId,
        resolvedOfficeId,
      );
      where[Op.and].push(buildCompanyAssignSearchCondition(companyId));
    }

    if (resolvedOfficeId != null) {
      where[Op.and].push({ office_id: resolvedOfficeId });
    }

    if (effectiveRoleFilter) {
      where[Op.and].push({ role: effectiveRoleFilter });
    } else if (!isAdminWorker) {
      where[Op.and].push({
        role: { [Op.notIn]: TASK_ASSIGN_SEARCH_EXCLUDED_ROLES },
      });
    }

    return await User.findAll({
      attributes: ['id', 'full_name', 'phone', 'role', 'office_id', 'company_id'],
      where,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name'],
          required: false,
        },
      ],
      limit: 20,
      order: [['full_name', 'ASC']],
    });
  }

  static async _resolveActorCompanyIdForSearch(actor) {
    if (!actor?.id) return null;
    if (actor.role !== 'client') return null;
    const row = await User.findByPk(actor.id, {
      attributes: ['company_id'],
    });
    return row?.company_id ?? null;
  }

  static async _resolveCompanyOfficeId(companyId, officeId) {
    const company = await Company.findByPk(companyId, {
      attributes: ['id', 'office_id'],
    });
    if (!company) {
      throw new NotFoundError('Компания не найдена');
    }
    if (officeId != null && Number(company.office_id) !== Number(officeId)) {
      throw new BadRequestError('Компания не принадлежит выбранному офису');
    }
    return officeId != null ? officeId : Number(company.office_id);
  }

  /** Проверка, что все userIds доступны актору для назначения (команда / задача). */
  static async assertUsersAssignableByActor(actor, userIds) {
    if (!actor || actor.role === 'admin-worker') return;

    const ids = Array.from(
      new Set(
        (Array.isArray(userIds) ? userIds : [])
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    );
    if (ids.length === 0) return;

    const where = {
      id: { [Op.in]: ids },
      role: { [Op.notIn]: TASK_ASSIGN_SEARCH_EXCLUDED_ROLES },
    };
    if (actor.office_id != null) {
      where.office_id = actor.office_id;
    }

    const found = await User.findAll({ where, attributes: ['id'] });
    if (found.length !== ids.length) {
      throw new BadRequestError(
        'Можно назначать только пользователей своего офиса'
      );
    }
  }

  static async getOfficeUsers(officeId) {
    const users = await User.findAll({
      where: { office_id: officeId },
      attributes: ['id', 'full_name', 'phone', 'role', 'company_id'],
      include: [
        { model: Office, as: 'office', attributes: ['id', 'name'] },
        { model: Company, as: 'company', attributes: ['id', 'name'], required: false },
      ],
      order: [['full_name', 'ASC']]
    });

    return users;
  }


  /**
   * Пользователь для отдачи наружу и для проверок прав.
   * Хэш пароля исключён: этот метод питает GET /users/me и GET /users/:id,
   * и без exclude bcrypt-хэш уезжал в браузер и оседал в localStorage.
   * Там, где хэш действительно нужен (смена пароля), используйте
   * {@link UserService.getUserWithPasswordById}.
   */
  static async getUserById(id) {
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [
        { model: Office, as: 'office' },
        { model: Company, as: 'company', attributes: ['id', 'name', 'office_id'], required: false },
      ],
    })
    if (!user) {
      throw new NotFoundError(`User not found`)
    }
    return user
  }

  /** Полная запись пользователя вместе с хэшем пароля — только для внутренних операций. */
  static async getUserWithPasswordById(id) {
    return User.findByPk(id)
  }
  static async changeNotificationSettings(id, body) {
    const {
      emailNotifications,
      securityNotifications,
      marketingNotifications,
    } = body;

    const updatedUser = await User.update({
      email_notifications: emailNotifications,
      security_notifications: securityNotifications,
      marketing_notifications: marketingNotifications,
    }, {
      where: { id },
      returning: true
    });

    if (!updatedUser[0]) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    return {
      success: true,
      message: 'Настройки уведомлений обновлены',
      user: updatedUser[1][0]
    };
  }

  static async sendEmailVerificationCode(id, email) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    // Генерируем 6-значный код
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    await User.update({
      email: email,
      email_verification_code: code,
      email_verification_code_expires_at: expiresAt,
      email_verified: false
    }, {
      where: { id }
    });

    // Отправляем код на email
    try {
      const { sendMail } = await import('../utils/nodemailer/nodemailer.js');
      await sendMail(
        email,
        'Код верификации email',
        `Ваш код верификации: ${code}\n\nКод действителен в течение 10 минут.`
      );
    } catch (error) {
      logger.error('Ошибка отправки email', { error: error?.message });
      // Удаляем код, если не удалось отправить email
      await User.update({
        email_verification_code: null,
        email_verification_code_expires_at: null
      }, {
        where: { id }
      });
      throw new BadRequestError('Не удалось отправить код верификации. Проверьте настройки почтового сервера.');
    }

    return {
      success: true,
      message: 'Код верификации отправлен на email'
    };
  }

  static async verifyEmail(id, code) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    if (!user.email_verification_code || !user.email_verification_code_expires_at) {
      throw new BadRequestError('Код верификации не был отправлен');
    }

    if (user.email_verification_code !== code) {
      throw new BadRequestError('Неверный код верификации');
    }

    if (new Date() > new Date(user.email_verification_code_expires_at)) {
      throw new BadRequestError('Код верификации истек');
    }

    await User.update({
      email_verified: true,
      email_verification_code: null,
      email_verification_code_expires_at: null
    }, {
      where: { id }
    });

    return {
      success: true,
      message: 'Email успешно верифицирован'
    };
  }

  static async updateEmail(id, email) {
    const user = await User.findByPk(id);
    if (!user) {
      throw new NotFoundError(`User with id ${id} not found`);
    }

    // Проверяем, что email не занят другим пользователем
    const existingUser = await User.findOne({
      where: {
        email: email,
        id: { [Op.ne]: id }
      }
    });

    if (existingUser) {
      throw new BadRequestError('Этот email уже используется');
    }

    await User.update({
      email: email,
      email_verified: false
    }, {
      where: { id }
    });

    return {
      success: true,
      message: 'Email обновлен. Требуется верификация.'
    };
  }

  static async createUser(userData, user_role) {
    if (user_role !== 'manager') {
      throw new ForbiddenError('Forbidden');
    }
    const tx = await sequelize.transaction();
    try {
      // Генерация и хэширование пароля
      const rawPassword = randomString(10);
      const hashedPassword = await getHashedPassword(rawPassword);

      const newUser = await User.create({
        ...userData,
        office_id: userData.office_id,
        password: hashedPassword,
        service_category_id:
          userData.role === 'department-head'
            ? null
            : userData.category_id ?? userData.service_category_id ?? null,
      }, {transaction: tx});

      await tx.commit();

      await NotificationService.sendPasswordNotification({
        userId: newUser.id,
        rawPassword
      });
      return {
        id: newUser.id,
        full_name: newUser.full_name,
        phone: newUser.phone,
        office_id: newUser.office_id,
        role: newUser.role,
        category_id: newUser.service_category_id,
      };
    } catch (err) {
      await rollbackAndRethrow(tx, err);
    }
  }

  static async updateUser(id, updateData) {
    const updatedUser = await User.update(updateData, {
      where: {id: id}
    })
    if (!updatedUser) {
      throw new NotFoundError(`User not found`)
    }
    return await User.findByPk(id)
  }

  static async _findDepartmentHeadForOffice(officeId, transaction = null) {
    return User.findOne({
      where: {
        role: 'department-head',
        office_id: officeId,
      },
      order: [['id', 'ASC']],
      transaction,
    });
  }

  static async _assertExecutorHasNoActiveTasks(executorId, transaction = null) {
    const activeTasks = await RequestExecutor.findAll({
      where: { executor_id: executorId },
      include: [{
        model: Request,
        as: 'Request',
        where: {
          status: ['assigned', 'execution'],
        },
      }],
      transaction,
    });

    if (activeTasks.length > 0) {
      const taskIds = activeTasks.map((task) => task.request_id).join(', ');
      throw new BadRequestError(
        `Нельзя снять роль исполнителя. У пользователя есть активные задачи (ID: ${taskIds}). Сначала завершите или переназначьте их.`
      );
    }
  }

  static async _promoteToExecutor(targetUser, officeId, categoryIds, specialty, departmentHeadId, transaction) {
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new BadRequestError('Укажите хотя бы одну категорию услуг (category_ids)');
    }

    const categories = await ServiceCategory.findAll({
      where: {
        id: { [Op.in]: categoryIds },
        office_id: officeId,
      },
      transaction,
    });
    if (categories.length !== categoryIds.length) {
      throw new BadRequestError('Категории должны относиться к офису пользователя');
    }

    const existingExecutor = await Executor.findOne({
      where: { user_id: targetUser.id },
      transaction,
    });
    if (existingExecutor) {
      throw new BadRequestError('Запись исполнителя уже существует');
    }

    const primaryCategory = categories[0];
    const executor = await Executor.create(
      {
        user_id: targetUser.id,
        department_id: departmentHeadId,
        specialty: specialty?.trim() || primaryCategory?.name || '—',
      },
      { transaction }
    );

    await ExecutorCategoryService.setCategories(executor.id, categoryIds, transaction);
    await User.update(
      { role: 'executor' },
      { where: { id: targetUser.id }, transaction }
    );

    return executor;
  }

  static async _demoteToClient(targetUser, transaction) {
    const executor = await Executor.findOne({
      where: { user_id: targetUser.id },
      transaction,
    });

    if (executor) {
      await UserService._assertExecutorHasNoActiveTasks(executor.id, transaction);
      await ExecutorServiceCategory.destroy({
        where: { executor_id: executor.id },
        transaction,
      });
      await Executor.destroy({
        where: { id: executor.id },
        transaction,
      });
    }

    await User.update(
      { role: 'client' },
      { where: { id: targetUser.id }, transaction }
    );
  }

  /**
   * Смена офиса у **клиента** (не исполнитель).
   * Компания привязана к офису, поэтому при смене офиса company_id сбрасывается в null.
   */
  static async _applyUserOfficeChange(targetUserId, targetUser, newOfficeId, transaction = null) {
    const oid = Number(newOfficeId);
    if (!Number.isFinite(oid) || oid < 1) {
      throw new BadRequestError('Некорректный офис');
    }
    const office = await Office.findByPk(oid, { transaction });
    if (!office) {
      throw new BadRequestError('Офис не найден');
    }
    const prevOid = targetUser.office_id != null ? Number(targetUser.office_id) : null;
    if (prevOid === oid) {
      return;
    }

    if (['department-head', 'manager', 'admin-worker'].includes(targetUser.role)) {
      throw new BadRequestError(
        'Перенос в другой офис для этой роли недоступен через редактирование профиля'
      );
    }

    if (targetUser.role === 'executor') {
      throw new BadRequestError(
        'Для исполнителя при смене офиса передайте category_ids целевого офиса в том же запросе, что и office_id'
      );
    }

    await User.update(
      { office_id: oid, company_id: null },
      { where: { id: targetUserId }, transaction }
    );
  }

  /**
   * Смена офиса у **исполнителя**: сначала категории целевого офиса, затем office_id и привязка к офис-менеджеру.
   */
  static async _applyExecutorOfficeChange(
    targetUserId,
    targetUser,
    newOfficeId,
    categoryIds,
    transaction = null
  ) {
    const oid = Number(newOfficeId);
    if (!Number.isFinite(oid) || oid < 1) {
      throw new BadRequestError('Некорректный офис');
    }
    const office = await Office.findByPk(oid, { transaction });
    if (!office) {
      throw new BadRequestError('Офис не найден');
    }
    const prevOid = targetUser.office_id != null ? Number(targetUser.office_id) : null;
    if (prevOid === oid) {
      return;
    }

    if (targetUser.role !== 'executor') {
      throw new BadRequestError('Внутренняя ошибка: ожидалась роль исполнителя');
    }

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new BadRequestError(
        'При переводе исполнителя в другой офис укажите category_ids — категории услуг целевого офиса'
      );
    }

    const categories = await ServiceCategory.findAll({
      where: {
        id: { [Op.in]: categoryIds },
        office_id: oid,
      },
      transaction,
    });
    if (categories.length !== categoryIds.length) {
      throw new BadRequestError('Все категории должны относиться к целевому офису');
    }

    const executor = await Executor.findOne({
      where: { user_id: targetUserId },
      transaction,
    });
    if (!executor) {
      throw new BadRequestError('Запись исполнителя не найдена');
    }

    await ExecutorCategoryService.setCategories(executor.id, categoryIds, transaction);

    const newHead = await UserService._findDepartmentHeadForOffice(oid, transaction);
    if (!newHead) {
      throw new BadRequestError('В целевом офисе не найден офис-менеджер');
    }
    await Executor.update(
      { department_id: newHead.id },
      { where: { id: executor.id }, transaction }
    );

    await User.update(
      { office_id: oid, company_id: null },
      { where: { id: targetUserId }, transaction }
    );
  }

  static async updateUserProfileByManager(actorId, actorRole, targetUserId, payload) {
    if (!['admin-worker', 'department-head'].includes(actorRole)) {
      throw new ForbiddenError('Недостаточно прав для изменения профиля');
    }

    const actor = await UserService.getUserById(actorId);
    const targetUser = await UserService.getUserById(targetUserId);

    if (
      actorRole !== 'admin-worker' &&
      Number(targetUser.office_id) !== Number(actor.office_id)
    ) {
      throw new ForbiddenError('Можно управлять только пользователями своего офиса');
    }

    if (actorRole === 'department-head') {
      if (PRIVILEGED_ROLES.includes(targetUser.role)) {
        throw new ForbiddenError('Недостаточно прав для изменения этого пользователя');
      }
    }

    if (payload.office_id !== undefined && actorRole !== 'admin-worker') {
      throw new ForbiddenError('Только администратор может менять офис пользователя');
    }

    if (payload.company_id !== undefined && targetUser.role !== 'client') {
      throw new BadRequestError('Компания назначается только клиентам');
    }

    const update = {};
    if (payload.full_name !== undefined) {
      const name = String(payload.full_name).trim();
      if (!name) {
        throw new BadRequestError('ФИО обязательно');
      }
      update.full_name = name;
    }
    if (payload.phone !== undefined) {
      const phone = String(payload.phone).trim();
      if (!phone) {
        throw new BadRequestError('Телефон обязателен');
      }
      update.phone = phone;
    }

    const officeChangeRequested = payload.office_id !== undefined;
    const companyChangeRequested = payload.company_id !== undefined;

    if (!officeChangeRequested && !companyChangeRequested && Object.keys(update).length === 0) {
      return targetUser;
    }

    const tx = await sequelize.transaction();
    try {
      if (officeChangeRequested) {
        const newOid = Number(payload.office_id);
        if (targetUser.role === 'executor') {
          await UserService._applyExecutorOfficeChange(
            targetUserId,
            targetUser,
            newOid,
            payload.category_ids,
            tx
          );
        } else {
          await UserService._applyUserOfficeChange(targetUserId, targetUser, newOid, tx);
        }
        await targetUser.reload({ transaction: tx });
      }

      if (companyChangeRequested) {
        if (payload.company_id === null) {
          update.company_id = null;
        } else {
          const cid = Number(payload.company_id);
          if (!Number.isFinite(cid) || cid < 1) {
            throw new BadRequestError('Некорректный company_id');
          }
          const company = await Company.findByPk(cid, { transaction: tx });
          if (!company) {
            throw new NotFoundError('Компания не найдена');
          }
          if (Number(company.office_id) !== Number(targetUser.office_id)) {
            throw new BadRequestError('Компания не принадлежит офису пользователя');
          }
          if (
            actorRole === 'department-head' &&
            Number(company.office_id) !== Number(actor.office_id)
          ) {
            throw new ForbiddenError('Можно назначать только компании своего офиса');
          }
          update.company_id = cid;
        }
      }

      if (Object.keys(update).length > 0) {
        await User.update(update, { where: { id: targetUserId }, transaction: tx });
      }
      await tx.commit();
      return UserService.getUserById(targetUserId);
    } catch (err) {
      await rollbackAndRethrow(tx, err);
    }
  }

  static async updateUserByManager(actorId, actorRole, targetUserId, payload) {
    if (!['admin-worker', 'department-head'].includes(actorRole)) {
      throw new ForbiddenError('Недостаточно прав для изменения роли');
    }

    const actor = await UserService.getUserById(actorId);
    const targetUser = await UserService.getUserById(targetUserId);
    const { role, category_ids: categoryIds, specialty } = payload;

    if (
      actorRole !== 'admin-worker' &&
      Number(targetUser.office_id) !== Number(actor.office_id)
    ) {
      throw new ForbiddenError('Можно управлять только пользователями своего офиса');
    }

    if (actorRole === 'department-head') {
      if (PRIVILEGED_ROLES.includes(targetUser.role)) {
        throw new ForbiddenError('Недостаточно прав для изменения этой роли');
      }
      if (!OFFICE_STAFF_ROLES.includes(role)) {
        throw new ForbiddenError('Можно назначить только роли «Клиент» или «Исполнитель»');
      }
    }

    if (targetUser.role === role) {
      return UserService.getUserById(targetUserId);
    }

    const tx = await sequelize.transaction();
    try {
      if (role === 'executor' && targetUser.role === 'client') {
        const departmentHead =
          actorRole === 'department-head'
            ? actor
            : await UserService._findDepartmentHeadForOffice(targetUser.office_id, tx);

        if (!departmentHead) {
          throw new BadRequestError('В офисе не найден офис-менеджер для привязки исполнителя');
        }

        await UserService._promoteToExecutor(
          targetUser,
          targetUser.office_id,
          categoryIds,
          specialty,
          departmentHead.id,
          tx
        );
      } else if (role === 'client' && targetUser.role === 'executor') {
        await UserService._demoteToClient(targetUser, tx);
      } else if (actorRole === 'admin-worker') {
        await User.update({ role }, { where: { id: targetUser.id }, transaction: tx });
      } else {
        throw new BadRequestError('Недопустимая смена роли');
      }

      // Компания доступна только клиентам — при уходе с роли клиента сбрасываем привязку.
      if (targetUser.role === 'client' && role !== 'client') {
        await User.update(
          { company_id: null },
          { where: { id: targetUser.id }, transaction: tx },
        );
      }

      await tx.commit();
      return UserService.getUserById(targetUserId);
    } catch (err) {
      await rollbackAndRethrow(tx, err);
    }
  }

  static async deleteUser(id) {
    const transaction = await sequelize.transaction();
    
    try {
      // Получаем пользователя с его ролью
      const user = await User.findByPk(id, { transaction });
      if (!user) {
        throw new NotFoundError(`User not found`);
      }

      // Проверяем, является ли пользователь исполнителем
      if (user.role === 'executor') {
        // Находим запись исполнителя
        const executor = await Executor.findOne({ 
          where: { user_id: id },
          transaction 
        });
        
        if (executor) {
          // Проверяем, есть ли у исполнителя активные задачи
          const activeTasks = await RequestExecutor.findAll({
            where: { executor_id: executor.id },
            include: [{
              model: Request,
              as: 'Request',
              where: {
                status: ['assigned', 'execution']
              }
            }],
            transaction
          });

          if (activeTasks.length > 0) {
            const taskIds = activeTasks.map(task => task.request_id).join(', ');
            throw new BadRequestError(`Нельзя удалить исполнителя. У него есть активные задачи (ID: ${taskIds}) со статусом "assigned" или "execution". Сначала завершите или переназначьте эти задачи.`);
          }
        }
      }

      // Проверяем, является ли пользователь руководителем направления
      if (user.role === 'department-head') {
        const executorsUnderHead = await Executor.count({
          where: { department_id: id },
          transaction,
        });
        if (executorsUnderHead > 0) {
          throw new BadRequestError(
            'Нельзя удалить офис-менеджера, пока к нему привязаны исполнители. Переназначьте или удалите исполнителей.'
          );
        }
      }

      // Удаляем пользователя
      const deletedUser = await User.destroy({
        where: { id: id },
        transaction
      });

      await transaction.commit();
      return deletedUser;
    } catch (error) {
      await rollbackAndRethrow(transaction, error);
    }
  }
  static async changePassword(userId, currentPassword, newPassword) {
    // Нужен именно хэш — getUserById его не отдаёт.
    const user = await UserService.getUserWithPasswordById(userId);
    if (!user) throw new NotFoundError('Пользователь не найден');

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) throw new BadRequestError('Текущий пароль неверный');

    const hashedPassword = await getHashedPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return { message: 'Пароль успешно изменён' };
  }

  // Изменение пароля пользователя админом офиса или офис-менеджером
  static async changeUserPasswordByAdmin(adminUserId, adminRole, targetUserId, newPassword) {
    if (!['admin-worker', 'department-head'].includes(adminRole)) {
      throw new ForbiddenError('Недостаточно прав для изменения паролей');
    }

    const admin = await UserService.getUserById(adminUserId);
    if (!admin) {
      throw new NotFoundError('Администратор не найден');
    }

    // Запись с хэшем: ниже пароль перезаписывается и сохраняется.
    const targetUser = await UserService.getUserWithPasswordById(targetUserId);
    if (!targetUser) {
      throw new NotFoundError('Пользователь не найден');
    }

    if (
      adminRole !== 'admin-worker' &&
      Number(targetUser.office_id) !== Number(admin.office_id)
    ) {
      throw new ForbiddenError('Вы можете изменять пароли только пользователей вашего офиса');
    }

    if (PRIVILEGED_ROLES.includes(targetUser.role)) {
      throw new ForbiddenError('Нельзя изменить пароль пользователя с этой ролью');
    }

    const hashedPassword = await getHashedPassword(newPassword);
    targetUser.password = hashedPassword;
    await targetUser.save();

    logger.info(
      `${adminRole} ${admin.full_name} (ID: ${adminUserId}) изменил пароль пользователю ${targetUser.full_name} (ID: ${targetUserId})`
    );

    return {
      success: true,
      message: 'Пароль пользователя успешно изменён',
    };
  }
}

export default UserService
