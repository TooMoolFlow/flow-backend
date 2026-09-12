import { RegistrationRequest } from '../models/registrationRequest.model.js';
import { User } from '../models/user.model.js';
import { Office } from '../models/office.model.js';
import { ServiceCategory } from '../models/serviceCategory.model.js';
import { Executor } from '../models/executor.model.js';
import { Company } from '../models/company.model.js';
import ExecutorCategoryService from './executorCategory.service.js';
import { Op } from 'sequelize';
import bcrypt from 'bcrypt';
import cron from 'node-cron';
import NotificationService from './notification.service.js';
import { sequelize } from '../config/database.config.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import logger from '../utils/winston/logger.js';

/**
 * Проверить, что компания существует в указанном офисе.
 * Возвращает экземпляр компании.
 */
function assertDepartmentHeadOfficeAccess(request, actor) {
  if (actor?.role !== 'department-head') return;
  if (actor.office_id == null) {
    throw new ForbiddenError('Офис не определён');
  }
  if (Number(request.office_id) !== Number(actor.office_id)) {
    throw new ForbiddenError('Нет доступа к запросу другого офиса');
  }
}

async function assertCompanyBelongsToOffice(companyId, officeId, transaction = null) {
  const cid = Number(companyId);
  const oid = Number(officeId);
  if (!Number.isFinite(cid) || cid < 1) {
    throw new BadRequestError('Некорректный company_id');
  }
  const company = await Company.findByPk(cid, { transaction });
  if (!company || Number(company.office_id) !== oid) {
    throw new BadRequestError('Компания не принадлежит выбранному офису');
  }
  return company;
}

class RegistrationRequestService {
  // Создание нового запроса
  async createRequest(requestData) {
    const tx = await sequelize.transaction();
    let request;
    try {
      // Проверяем, что пользователь с таким телефоном не существует
      const existingUser = await User.findOne({ where: { phone: requestData.phone }, transaction: tx });
      if (existingUser) {
        throw new ConflictError('Пользователь с таким номером телефона уже существует');
      }

      const existingRequest = await RegistrationRequest.findOne({
        where: { phone: requestData.phone },
        transaction: tx
      });
      if (existingRequest) {
        throw new ConflictError('Запрос с таким номером телефона уже существует');
      }

      // Проверяем существование офиса
      const office = await Office.findByPk(requestData.office_id, { transaction: tx });
      if (!office) {
        throw new NotFoundError('Указанный офис не существует');
      }

      // Поля компании актуальны только для роли «client».
      let companyId = null;
      let companyOtherName = null;
      if (requestData.role === 'client') {
        if (requestData.company_id != null && requestData.company_other_name) {
          throw new BadRequestError('Укажите либо company_id, либо company_other_name, но не оба сразу');
        }
        if (requestData.company_id != null) {
          await assertCompanyBelongsToOffice(requestData.company_id, requestData.office_id, tx);
          companyId = Number(requestData.company_id);
        } else if (requestData.company_other_name) {
          companyOtherName = String(requestData.company_other_name).trim() || null;
        }
      }

      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(requestData.password, 10);

      request = await RegistrationRequest.create({
        phone: requestData.phone,
        full_name: requestData.full_name,
        office_id: requestData.office_id,
        role: requestData.role,
        service_category_id: requestData.service_category_id ?? null,
        company_id: companyId,
        company_other_name: companyOtherName,
        password: hashedPassword,
      }, { transaction: tx });

      await tx.commit();
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }

    await NotificationService.notifyNewRegistrationRequest(request);
    return request;
  }

  // Получение запросов с фильтрацией и пагинацией
  async getRequests(filters = {}, actor = null) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const pageSizeRaw = parseInt(filters.page_size, 10) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (actor?.role === 'department-head') {
      if (actor.office_id == null) {
        throw new ForbiddenError('Офис не определён');
      }
      where.office_id = actor.office_id;
    } else {
      const officeIdNum = filters.office_id !== undefined && filters.office_id !== ''
        ? parseInt(filters.office_id, 10)
        : NaN;
      if (Number.isInteger(officeIdNum)) {
        where.office_id = officeIdNum;
      }
    }

    if (filters.date_from) {
      where.created_at = {
        [Op.gte]: new Date(filters.date_from)
      };
    }

    if (filters.date_to) {
      where.created_at = {
        ...where.created_at,
        [Op.lte]: new Date(filters.date_to)
      };
    }

    const { count, rows } = await RegistrationRequest.findAndCountAll({
      // Хэш пароля наружу не отдаём — список уходит в браузер администратора.
      attributes: { exclude: ['password'] },
      where,
      include: [
        {
          model: Office,
          as: 'office',
          attributes: ['id', 'name']
        },
        {
          model: ServiceCategory,
          as: 'service_category',
          attributes: ['name'],
          required: false
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      distinct: true
    });

    const totalPages = Math.max(1, Math.ceil(count / pageSize));

    return {
      data: rows,
      meta: {
        total: count,
        page,
        pageSize,
        totalPages
      }
    };
  }

  // Одобрение запроса
  async approveRequest(requestId, actor = null) {
    const tx = await sequelize.transaction();
    try {
      const request = await RegistrationRequest.findByPk(requestId, { transaction: tx });
      if (!request) {
        throw new NotFoundError('Запрос не найден');
      }

      assertDepartmentHeadOfficeAccess(request, actor);

      if (request.status !== 'pending') {
        throw new BadRequestError('Запрос уже обработан');
      }

      // Если на момент approve компания всё ещё привязана, перепроверяем,
      // что она принадлежит выбранному офису (на случай, если офис меняли позже).
      if (request.role === 'client' && request.company_id != null) {
        await assertCompanyBelongsToOffice(request.company_id, request.office_id, tx);
      }

      // Создаём пользователя. Компания применима только к клиентам.
      const userData = {
        phone: request.phone,
        full_name: request.full_name,
        office_id: request.office_id,
        role: request.role,
        password: request.password, // Пароль уже хеширован
        service_category_id: request.service_category_id,
        company_id: request.role === 'client' ? request.company_id ?? null : null,
      };

      const user = await User.create(userData, { transaction: tx });

      // Если роль - executor, создаем запись в таблице executors
      if (request.role === 'executor' && request.service_category_id) {
        const departmentHead = await User.findOne({
          where: {
            role: 'department-head',
            office_id: request.office_id,
          },
          order: [['id', 'ASC']],
          transaction: tx,
        });

        const serviceCategory = await ServiceCategory.findByPk(request.service_category_id, {
          transaction: tx,
        });

        if (
          serviceCategory &&
          Number(serviceCategory.office_id) !== Number(request.office_id)
        ) {
          throw new BadRequestError('Категория услуг не относится к выбранному офису');
        }

        if (departmentHead && serviceCategory) {
          const executor = await Executor.create({
            user_id: user.id,
            department_id: departmentHead.id,
            specialty: serviceCategory.name,
          }, { transaction: tx });

          await ExecutorCategoryService.addCategory(
            executor.id,
            serviceCategory.id,
            tx
          );
        }
      }

      // Обновляем статус запроса
      request.status = 'approved';
      await request.save({ transaction: tx });

      await tx.commit();
      return { user, request };
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  /**
   * Удаление записи отклонённого запроса (вручную; approved не трогаем — могут нуждаться в аудите).
   */
  async deleteRejectedRequest(requestId, actor = null) {
    const tx = await sequelize.transaction();
    try {
      const request = await RegistrationRequest.findByPk(requestId, { transaction: tx });
      if (!request) {
        throw new NotFoundError('Запрос не найден');
      }

      assertDepartmentHeadOfficeAccess(request, actor);

      if (request.status !== 'rejected') {
        throw new BadRequestError('Удалять можно только отклонённые запросы');
      }
      await request.destroy({ transaction: tx });
      await tx.commit();
      return { deleted: true };
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  // Отклонение запроса
  async rejectRequest(requestId, actor = null) {
    const tx = await sequelize.transaction();
    try {
      const request = await RegistrationRequest.findByPk(requestId, { transaction: tx });
      if (!request) {
        throw new NotFoundError('Запрос не найден');
      }

      assertDepartmentHeadOfficeAccess(request, actor);

      request.status = 'rejected';
      await request.save({ transaction: tx });

      await tx.commit();
      return request;
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  // Обновление данных запроса
  async updateRequest(requestId, updateData, actor = null) {
    const tx = await sequelize.transaction();
    try {
      const request = await RegistrationRequest.findByPk(requestId, { transaction: tx });
      if (!request) {
        throw new NotFoundError('Запрос не найден');
      }

      assertDepartmentHeadOfficeAccess(request, actor);

      if (request.status !== 'pending') {
        throw new BadRequestError('Нельзя изменить уже обработанный запрос');
      }

      // Из обновляемых данных убираем пароль
      const payload = { ...updateData };
      delete payload.password;

      if (actor?.role === 'department-head') {
        delete payload.office_id;
      }

      // Определяем итоговую пару офис/компания после применения изменений.
      const targetOfficeId = payload.office_id !== undefined
        ? Number(payload.office_id)
        : Number(request.office_id);
      if (payload.office_id !== undefined) {
        const office = await Office.findByPk(targetOfficeId, { transaction: tx });
        if (!office) {
          throw new NotFoundError('Указанный офис не существует');
        }
      }

      const targetRole = payload.role !== undefined ? payload.role : request.role;

      const update = { ...payload };

      // Поля компании имеют смысл только для роли «client».
      if (targetRole !== 'client') {
        update.company_id = null;
        update.company_other_name = null;
      } else {
        // Запрет одновременного выбора company_id и company_other_name.
        if (update.company_id != null && update.company_other_name) {
          throw new BadRequestError('Укажите либо company_id, либо company_other_name, но не оба сразу');
        }
        if (update.company_id !== undefined && update.company_id !== null) {
          await assertCompanyBelongsToOffice(update.company_id, targetOfficeId, tx);
          update.company_other_name = null;
        } else if (update.company_id === null) {
          // явный сброс компании
        } else if (payload.office_id !== undefined && request.company_id != null) {
          // Если меняем офис, а старая компания осталась — проверяем, что она принадлежит новому офису.
          await assertCompanyBelongsToOffice(request.company_id, targetOfficeId, tx);
        }
        if (update.company_other_name !== undefined) {
          if (update.company_other_name === null || update.company_other_name === '') {
            update.company_other_name = null;
          } else {
            update.company_other_name = String(update.company_other_name).trim() || null;
            if (update.company_other_name) {
              update.company_id = null;
            }
          }
        }
      }

      await request.update(update, { transaction: tx });
      await tx.commit();
      return request;
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  // Автоматическая очистка обработанных запросов
  startCleanupScheduler() {
    // Каждый день в 00:00
    cron.schedule('0 0 * * *', async () => {
      try {
        const deletedCount = await RegistrationRequest.destroy({
          where: {
            status: {
              [Op.in]: ['approved', 'rejected']
            }
          }
        });
        
        logger.info('Автоматически удалены обработанные запросы на регистрацию', { deletedCount });
      } catch (error) {
        logger.error('Ошибка при автоматической очистке запросов на регистрацию', { error: error?.message });
      }
    });
  }
}

export default new RegistrationRequestService();
