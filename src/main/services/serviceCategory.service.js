import {ServiceCategory, ServiceSubcategory, User, Executor} from "../models/init.model.js"
import ExecutorCategoryService from './executorCategory.service.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/errors.js';
import { sequelize } from '../config/database.config.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import {
  assertCanAccessCategoryOffice,
  getCategoryInOffice,
  getSubcategoryInOffice,
} from '../utils/serviceCategoryOffice.util.js';

const categoryInclude = [
  {
    model: ServiceSubcategory,
    as: 'subcategories',
    attributes: ['id', 'name', 'category_id', 'office_id'],
  },
];

class ServiceCategoryService {

  static async getAllServiceCategories(officeId = null) {
    const where = officeId != null ? { office_id: officeId } : {};
    return await ServiceCategory.findAll({
      where,
      include: categoryInclude,
      order: [
        ['name', 'ASC'],
        [{ model: ServiceSubcategory, as: 'subcategories' }, 'name', 'ASC'],
      ],
    });
  }

  static async getServiceCategoryById(id, officeId = null) {
    const where = { id };
    if (officeId != null) {
      where.office_id = officeId;
    }
    const serviceCategory = await ServiceCategory.findOne({
      where,
      include: categoryInclude,
    });
    if (!serviceCategory) {
      throw new NotFoundError('Service category not found');
    }
    return serviceCategory;
  }

  static async createServiceCategory(categoryData, officeId) {
    const name = categoryData.name?.trim();
    if (!name) {
      throw new BadRequestError('Укажите название категории');
    }
    return await ServiceCategory.create({
      name,
      office_id: officeId,
    });
  }

  static async updateServiceCategory(id, updateData, officeId) {
    await getCategoryInOffice(id, officeId);
    const name = updateData.name?.trim();
    if (!name) {
      throw new BadRequestError('Укажите название категории');
    }
    const updated = await ServiceCategory.update(
      { name },
      { where: { id, office_id: officeId } }
    );
    if (!updated[0]) {
      throw new NotFoundError('Service category not found');
    }
    return await ServiceCategory.findByPk(id, { include: categoryInclude });
  }

  static async deleteServiceCategory(id, officeId) {
    const tx = await sequelize.transaction();

    try {
      const category = await getCategoryInOffice(id, officeId, tx);

      await ServiceCategory.destroy({
        where: { id, office_id: officeId },
        transaction: tx,
      });

      await tx.commit();

      return {
        deleted: true,
        category: { id: category.id, name: category.name },
        message: `Категория "${category.name}" удалена. У связанных заявок категория и подкатегория сброшены.`,
      };
    } catch (error) {
      await rollbackAndRethrow(tx, error);
    }
  }

  static async getExecutorsByCategoryId(categoryId, userId) {
    const user = await User.findByPk(userId, { attributes: ['id', 'office_id', 'role'] });
    if (!user) {
      throw new NotFoundError('Пользователь не найден');
    }

    const category = await ServiceCategory.findByPk(categoryId);
    if (!category) {
      throw new NotFoundError('Service category not found');
    }
    assertCanAccessCategoryOffice(user);
    const officeId = category.office_id;

    const executors = await Executor.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'phone', 'role', 'office_id'],
          where: { office_id: officeId },
        },
        {
          model: ServiceCategory,
          as: 'serviceCategories',
          where: { id: categoryId },
          required: true,
          attributes: ['id', 'name'],
          through: { attributes: [] },
        },
      ],
      attributes: ['id', 'specialty', 'department_id'],
    });

    return executors;
  }

  static async assignExecutorToCategory(categoryId, executorId, userId) {
    const transaction = await sequelize.transaction();

    try {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'office_id', 'role'],
        transaction,
      });
      if (!user) {
        throw new NotFoundError('Пользователь не найден');
      }

      const category = await ServiceCategory.findByPk(categoryId, { transaction });
      if (!category) {
        throw new NotFoundError('Service category not found');
      }
      assertCanAccessCategoryOffice(user);
      const officeId = category.office_id;

      const executor = await Executor.findByPk(executorId, {
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'full_name', 'role', 'office_id'],
          },
        ],
        transaction,
      });

      if (!executor) {
        throw new NotFoundError('Executor not found');
      }

      if (executor.user.role !== 'executor') {
        throw new BadRequestError('User must be an executor to be assigned to a category');
      }

      if (Number(executor.user.office_id) !== Number(officeId)) {
        throw new ForbiddenError('Нельзя назначить исполнителя из другого офиса');
      }

      await ExecutorCategoryService.addCategory(executorId, categoryId, transaction);

      await transaction.commit();

      return {
        message: 'Executor assigned to category successfully',
        executor: {
          id: executor.id,
          name: executor.user.full_name,
          specialty: category.name,
        },
        category: {
          id: category.id,
          name: category.name,
        },
        isNewHead: false,
      };
    } catch (error) {
      await rollbackAndRethrow(transaction, error);
    }
  }

  static async changeCategoryHead(categoryId, executorId, userId) {
    return this.assignExecutorToCategory(categoryId, executorId, userId);
  }

  static async getAllSubcategories(officeId = null) {
    const where = officeId != null ? { office_id: officeId } : {};
    return await ServiceSubcategory.findAll({
      where,
      include: [
        {
          model: ServiceCategory,
          as: 'category',
          attributes: ['id', 'name', 'office_id'],
        },
      ],
      order: [
        [{ model: ServiceCategory, as: 'category' }, 'name', 'ASC'],
        ['name', 'ASC'],
      ],
    });
  }

  static async getSubcategoriesByCategoryId(categoryId, officeId) {
    await getCategoryInOffice(categoryId, officeId);
    return await ServiceSubcategory.findAll({
      where: { category_id: categoryId, office_id: officeId },
      include: [
        {
          model: ServiceCategory,
          as: 'category',
          attributes: ['id', 'name', 'office_id'],
        },
      ],
      order: [['name', 'ASC']],
    });
  }

  static async getSubcategoryById(id, officeId) {
    return await getSubcategoryInOffice(id, officeId);
  }

  static async createSubcategory(subcategoryData, officeId) {
    const name = subcategoryData.name?.trim();
    const categoryId = subcategoryData.category_id;
    if (!name || !categoryId) {
      throw new BadRequestError('Укажите название и категорию');
    }
    await getCategoryInOffice(categoryId, officeId);
    return await ServiceSubcategory.create({
      name,
      category_id: categoryId,
      office_id: officeId,
    });
  }

  static async updateSubcategory(id, updateData, officeId) {
    await getSubcategoryInOffice(id, officeId);
    const payload = { ...updateData };
    if (payload.name != null) {
      payload.name = payload.name.trim();
      if (!payload.name) {
        throw new BadRequestError('Укажите название подкатегории');
      }
    }
    if (payload.category_id != null) {
      await getCategoryInOffice(payload.category_id, officeId);
    }
    const updated = await ServiceSubcategory.update(payload, {
      where: { id, office_id: officeId },
    });
    if (!updated[0]) {
      throw new NotFoundError('Service subcategory not found');
    }
    return await ServiceSubcategory.findByPk(id, {
      include: [
        {
          model: ServiceCategory,
          as: 'category',
          attributes: ['id', 'name', 'office_id'],
        },
      ],
    });
  }

  static async deleteSubcategory(id, officeId) {
    const subcategory = await getSubcategoryInOffice(id, officeId);

    await ServiceSubcategory.destroy({
      where: { id, office_id: officeId },
    });

    return {
      deleted: true,
      subcategory: {
        id: subcategory.id,
        name: subcategory.name,
      },
      message: `Подкатегория "${subcategory.name}" удалена. У связанных заявок подкатегория сброшена.`,
    };
  }

}

export default ServiceCategoryService
