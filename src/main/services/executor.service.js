import {
  Executor,
  ExecutorServiceCategory,
  Request,
  RequestExecutor,
  ServiceCategory,
  User,
} from '../models/init.model.js';
import { col, fn, literal, Op } from 'sequelize';
import { getRatingsByExecutor } from './requestRating.service.js';
import { sequelize } from '../config/database.config.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import { getHashedPassword, randomString } from '../utils/bcrypt/BCryptService.js';
import NotificationService from './notification.service.js';
import ExecutorCategoryService from './executorCategory.service.js';
import logger from '../utils/winston/logger.js';

const executorListIncludes = [
  {
    model: User,
    as: 'user',
    attributes: ['id', 'full_name', 'phone', 'role', 'office_id'],
    where: { role: 'executor' },
  },
  {
    model: ServiceCategory,
    as: 'serviceCategories',
    attributes: ['id', 'name'],
    through: { attributes: [] },
  },
  {
    model: RequestExecutor,
    as: 'requestExecutors',
    attributes: [],
    include: [
      {
        model: Request,
        as: 'Request',
        attributes: [],
        where: { status: 'execution' },
        required: false,
      },
    ],
  },
];

const executorListAttributes = {
  include: [
    [fn('COUNT', col('requestExecutors.Request.id')), 'workload'],
    [
      literal(`(
            SELECT AVG(rr.rating)
            FROM request_ratings rr
            INNER JOIN requests r ON rr.request_id = r.id
            INNER JOIN request_executors re ON re.request_id = r.id
            WHERE re.executor_id = "Executor"."id"
          )`),
      'rating',
    ],
  ],
};

/** Все поля Executor, участвующие в GROUP BY списка (иначе specialty и др. не возвращаются из PG). */
const executorListGroup = [
  'Executor.id',
  'Executor.user_id',
  'Executor.department_id',
  'Executor.specialty',
  'user.id',
  'serviceCategories.id',
];

class ExecutorService {
  static _assertOfficeStaffCanManageExecutor(actor, executorUser) {
    if (!actor || !executorUser) {
      throw new ForbiddenError('Доступ запрещён');
    }
    if (actor.role === 'admin-worker') {
      return;
    }
    if (actor.role !== 'department-head') {
      throw new ForbiddenError('Доступ запрещён');
    }
    if (Number(executorUser.office_id) !== Number(actor.office_id)) {
      throw new ForbiddenError('Доступ запрещён');
    }
  }

  static async getAllExecutorsForDepartmentHead(headUserId, categoryId = null, officeIdOverride = null) {
    const head = await User.findByPk(headUserId, { attributes: ['id', 'office_id', 'role'] });
    if (!head) {
      throw new NotFoundError('Пользователь не найден');
    }

    let officeId;
    // manager обрабатывается как admin-worker: роут GET /executors его пускает,
    // а без этой ветки сервис отвечал 403 и дашборд руководителя не грузил исполнителей.
    if (head.role === 'admin-worker' || head.role === 'manager') {
      if (officeIdOverride != null && !Number.isNaN(Number(officeIdOverride))) {
        officeId = Number(officeIdOverride);
      } else if (head.office_id) {
        officeId = Number(head.office_id);
      } else {
        throw new BadRequestError('Укажите office_id');
      }
    } else if (head.role === 'department-head') {
      if (!head.office_id) {
        throw new ForbiddenError('Forbidden');
      }
      officeId = Number(head.office_id);
    } else {
      throw new ForbiddenError('Forbidden');
    }

    const include = [...executorListIncludes];
    const where = {};

    if (categoryId) {
      const catId = Number(categoryId);
      where.id = {
        [Op.in]: literal(`(
          SELECT executor_id FROM executor_service_categories
          WHERE category_id = ${catId}
        )`),
      };
    }

    return Executor.findAll({
      where,
      include: [
        ...include.map((inc) =>
          inc.as === 'user'
            ? {
                ...inc,
                where: { role: 'executor', office_id: officeId },
              }
            : inc
        ),
      ],
      attributes: executorListAttributes,
      group: executorListGroup,
      order: [[{ model: User, as: 'user' }, 'full_name', 'ASC']],
    });
  }

  /** @deprecated use getAllExecutorsForDepartmentHead */
  static async getAllExecutors(department_id) {
    return this.getAllExecutorsForDepartmentHead(department_id);
  }

  static async getAllExecutorsForManager(adminUserId) {
    const adminUser = await User.findByPk(adminUserId, {
      attributes: ['office_id'],
    });

    if (!adminUser) {
      throw new NotFoundError('Администратор не найден');
    }

    const executors = await Executor.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone', 'office_id'],
          where: {
            office_id: adminUser.office_id,
          },
        },
        {
          model: ServiceCategory,
          as: 'serviceCategories',
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
        {
          model: RequestExecutor,
          as: 'requestExecutors',
          attributes: [],
          include: [
            {
              model: Request,
              as: 'Request',
              attributes: [],
              where: { status: 'execution' },
              required: false,
            },
          ],
        },
      ],
      attributes: executorListAttributes,
      group: executorListGroup,
    });

    return executors;
  }

  static async getExecutorById(id) {
    return Executor.findByPk(id, {
      include: [
        {
          model: ServiceCategory,
          as: 'serviceCategories',
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
        { model: User, as: 'user', attributes: ['id', 'full_name', 'phone', 'office_id', 'role'] },
      ],
    });
  }

  static async getExecutorByUserId(id) {
    return Executor.findOne({
      where: { user_id: id },
    });
  }

  static async getAverageRatingByExecutorId(userId) {
    const ratings = await getRatingsByExecutor(userId);
    if (ratings.length === 0) return 0;

    const sum = ratings.reduce((acc, r) => acc + Number(r.rating), 0);
    const average = sum / ratings.length;

    return parseFloat(average.toFixed(2));
  }

  static async createExecutor(depHeadId, executorData) {
    const { category_ids: categoryIds, ...userFields } = executorData;
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new BadRequestError('Укажите хотя бы одну категорию услуг (category_ids)');
    }

    const depHead = await User.findByPk(depHeadId, {
      attributes: ['id', 'office_id', 'role'],
    });
    if (!depHead || depHead.role !== 'department-head' || !depHead.office_id) {
      throw new ForbiddenError('Forbidden');
    }

    const tx = await sequelize.transaction();
    try {
      const rawPassword = randomString(10);
      const hashedPassword = await getHashedPassword(rawPassword);

      const newUser = await User.create(
        {
          ...userFields,
          office_id: depHead.office_id,
          password: hashedPassword,
          role: 'executor',
        },
        { transaction: tx }
      );

      const categories = await ServiceCategory.findAll({
        where: {
          id: { [Op.in]: categoryIds },
          office_id: depHead.office_id,
        },
        transaction: tx,
      });
      if (categories.length !== categoryIds.length) {
        throw new BadRequestError('Категории должны относиться к вашему офису');
      }
      const primaryCategory = categories[0];

      const executor = await Executor.create(
        {
          user_id: newUser.id,
          specialty: primaryCategory?.name ?? '—',
          department_id: depHeadId,
        },
        { transaction: tx }
      );

      await ExecutorCategoryService.setCategories(executor.id, categoryIds, tx);

      await tx.commit();

      await NotificationService.sendPasswordNotification({
        userId: newUser.id,
        rawPassword,
      });
      return { message: 'Successfully created', executorId: executor.id, userId: newUser.id };
    } catch (err) {
      await rollbackAndRethrow(tx, err);
    }
  }

  static async updateExecutor(executorId, updateData, headUserId) {
    const executor = await Executor.findByPk(executorId, {
      include: [{ model: User, as: 'user' }],
    });
    if (!executor) {
      throw new NotFoundError('Executor not found');
    }

    const head = await User.findByPk(headUserId);
    ExecutorService._assertOfficeStaffCanManageExecutor(head, executor.user);

    const { category_ids: categoryIds, phone, full_name, ...rest } = updateData;
    const tx = await sequelize.transaction();
    try {
      if (phone || full_name) {
        await User.update(
          { ...(phone && { phone }), ...(full_name && { full_name }) },
          { where: { id: executor.user_id }, transaction: tx }
        );
      }

      if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
        const categoriesOfficeId =
          head?.role === 'admin-worker' ? executor.user?.office_id : head?.office_id;
        if (categoriesOfficeId) {
          const officeCategories = await ServiceCategory.findAll({
            where: {
              id: { [Op.in]: categoryIds },
              office_id: categoriesOfficeId,
            },
            transaction: tx,
          });
          if (officeCategories.length !== categoryIds.length) {
            throw new BadRequestError('Категории должны относиться к офису исполнителя');
          }
        }
        await ExecutorCategoryService.setCategories(executor.id, categoryIds, tx);
      }

      if (Object.keys(rest).length > 0) {
        await Executor.update(rest, { where: { id: executorId }, transaction: tx });
      }

      await tx.commit();
      return this.getExecutorById(executorId);
    } catch (err) {
      await rollbackAndRethrow(tx, err);
    }
  }

  static async deleteExecutor(executorId, headUserId) {
    const executor = await Executor.findByPk(executorId, {
      include: [{ model: User, as: 'user' }],
    });
    if (!executor) {
      throw new NotFoundError('Executor not found');
    }

    const head = await User.findByPk(headUserId);
    ExecutorService._assertOfficeStaffCanManageExecutor(head, executor.user);

    await ExecutorServiceCategory.destroy({ where: { executor_id: executorId } });
    await User.destroy({ where: { id: executor.user_id } });
    return true;
  }
}

export default ExecutorService;
