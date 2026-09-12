import ServiceCategoryService from "../services/serviceCategory.service.js"
import {asyncHandler} from "../middleware/asyncHandler.middleware.js";
import {
  resolveListOfficeId,
  resolveManageOfficeId,
  resolvePublicOfficeId,
} from '../utils/serviceCategoryOffice.util.js';

class ServiceCategoryController {
  static getAllServiceCategories = asyncHandler(async (req, res) => {
    const officeId = resolveListOfficeId(req.user, req.query.office_id);
    const categories = await ServiceCategoryService.getAllServiceCategories(officeId);
    res.json(categories);
  });

  static getAllServiceCategoriesPublic = asyncHandler(async (req, res) => {
    const officeId = resolvePublicOfficeId(req.query.office_id);
    const categories = await ServiceCategoryService.getAllServiceCategories(officeId);
    res.json(categories);
  });

  static getServiceCategoryById = asyncHandler(async (req, res) => {
    const officeId = resolveListOfficeId(req.user, req.query.office_id);
    const category = await ServiceCategoryService.getServiceCategoryById(req.params.id, officeId);
    res.json(category);
  });

  static createServiceCategory = asyncHandler(async (req, res) => {
    const officeId = resolveManageOfficeId(req.user, req.query.office_id);
    const newCategory = await ServiceCategoryService.createServiceCategory(req.body, officeId);
    res.status(201).json(newCategory);
  });

  static updateServiceCategory = asyncHandler(async (req, res) => {
    const officeId = resolveManageOfficeId(req.user, req.query.office_id);
    const updatedCategory = await ServiceCategoryService.updateServiceCategory(
      req.params.id,
      req.body,
      officeId
    );
    res.json(updatedCategory);
  });

  static deleteServiceCategory = asyncHandler(async (req, res) => {
    const officeId = resolveManageOfficeId(req.user, req.query.office_id);
    await ServiceCategoryService.deleteServiceCategory(req.params.id, officeId);
    res.status(204).send();
  });

  static getExecutorsByCategory = asyncHandler(async (req, res) => {
    const executors = await ServiceCategoryService.getExecutorsByCategoryId(
      req.params.id,
      req.user.id
    );
    res.json(executors);
  });

  static assignExecutorToCategory = asyncHandler(async (req, res) => {
    const { executorId } = req.body;
    const result = await ServiceCategoryService.assignExecutorToCategory(
      req.params.id,
      executorId,
      req.user.id
    );
    res.json(result);
  });

  static changeCategoryHead = asyncHandler(async (req, res) => {
    const { newHeadUserId } = req.body;
    const result = await ServiceCategoryService.changeCategoryHead(
      req.params.id,
      newHeadUserId,
      req.user.id
    );
    res.json(result);
  });

  static getAllSubcategories = asyncHandler(async (req, res) => {
    const officeId = resolveListOfficeId(req.user, req.query.office_id);
    const subcategories = await ServiceCategoryService.getAllSubcategories(officeId);
    res.json(subcategories);
  });

  static getSubcategoriesByCategoryId = asyncHandler(async (req, res) => {
    const officeId = resolveListOfficeId(req.user, req.query.office_id);
    const subcategories = await ServiceCategoryService.getSubcategoriesByCategoryId(
      req.params.categoryId,
      officeId
    );
    res.json(subcategories);
  });

  static getSubcategoryById = asyncHandler(async (req, res) => {
    const officeId = resolveListOfficeId(req.user, req.query.office_id);
    const subcategory = await ServiceCategoryService.getSubcategoryById(req.params.id, officeId);
    res.json(subcategory);
  });

  static createSubcategory = asyncHandler(async (req, res) => {
    const officeId = resolveManageOfficeId(req.user, req.query.office_id);
    const newSubcategory = await ServiceCategoryService.createSubcategory(req.body, officeId);
    res.status(201).json(newSubcategory);
  });

  static updateSubcategory = asyncHandler(async (req, res) => {
    const officeId = resolveManageOfficeId(req.user, req.query.office_id);
    const updatedSubcategory = await ServiceCategoryService.updateSubcategory(
      req.params.id,
      req.body,
      officeId
    );
    res.json(updatedSubcategory);
  });

  static deleteSubcategory = asyncHandler(async (req, res) => {
    const officeId = resolveManageOfficeId(req.user, req.query.office_id);
    const result = await ServiceCategoryService.deleteSubcategory(req.params.id, officeId);
    res.json(result);
  });
}

export default ServiceCategoryController
