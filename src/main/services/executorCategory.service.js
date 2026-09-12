import { Op } from 'sequelize';
import {
  Executor,
  ExecutorServiceCategory,
  ServiceCategory,
} from '../models/init.model.js';
import { BadRequestError, NotFoundError } from '../errors/errors.js';

class ExecutorCategoryService {
  static async getCategoryIdsForExecutor(executorId) {
    const rows = await ExecutorServiceCategory.findAll({
      where: { executor_id: executorId },
      attributes: ['category_id'],
    });
    return rows.map((r) => r.category_id);
  }

  static async hasCategory(executorId, categoryId, transaction = null) {
    if (!executorId || !categoryId) return false;
    const row = await ExecutorServiceCategory.findOne({
      where: { executor_id: executorId, category_id: categoryId },
      transaction,
    });
    return !!row;
  }

  static async setCategories(executorId, categoryIds, transaction = null) {
    const uniqueIds = [...new Set(categoryIds.filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueIds.length === 0) {
      throw new BadRequestError('Укажите хотя бы одну категорию услуг');
    }

    const categories = await ServiceCategory.findAll({
      where: { id: { [Op.in]: uniqueIds } },
      transaction,
    });
    if (categories.length !== uniqueIds.length) {
      throw new NotFoundError('Одна или несколько категорий не найдены');
    }

    await ExecutorServiceCategory.destroy({
      where: { executor_id: executorId },
      transaction,
    });

    await ExecutorServiceCategory.bulkCreate(
      uniqueIds.map((category_id) => ({ executor_id: executorId, category_id })),
      { transaction }
    );

    const primary = categories[0];
    await Executor.update(
      { specialty: primary.name },
      { where: { id: executorId }, transaction }
    );

    return categories;
  }

  static async addCategory(executorId, categoryId, transaction = null) {
    const category = await ServiceCategory.findByPk(categoryId, { transaction });
    if (!category) {
      throw new NotFoundError('Service category not found');
    }

    await ExecutorServiceCategory.findOrCreate({
      where: { executor_id: executorId, category_id: categoryId },
      defaults: { executor_id: executorId, category_id: categoryId },
      transaction,
    });

    const count = await ExecutorServiceCategory.count({
      where: { executor_id: executorId },
      transaction,
    });
    if (count === 1) {
      await Executor.update(
        { specialty: category.name },
        { where: { id: executorId }, transaction }
      );
    }

    return category;
  }

  static executorHasCategoryInclude(categoryId) {
    return {
      model: ExecutorServiceCategory,
      as: 'executorCategories',
      where: categoryId ? { category_id: categoryId } : undefined,
      required: !!categoryId,
      include: [
        {
          model: ServiceCategory,
          as: 'category',
          attributes: ['id', 'name'],
        },
      ],
    };
  }
}

export default ExecutorCategoryService;
