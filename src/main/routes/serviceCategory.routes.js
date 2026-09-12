import { Router } from "express"
import ServiceCategoryController from "../controllers/serviceCategory.controller.js"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js"
import { validateBody } from "../middleware/validate.middleware.js";
import { ServiceCategoryDto, ServiceSubcategoryDto } from "../dto/serviceCategory.dto.js";

const router = Router()

const categoryManagers = authorizeRoles("department-head", "admin-worker");

router.get("/public", ServiceCategoryController.getAllServiceCategoriesPublic)
router.get("/", authenticateToken, ServiceCategoryController.getAllServiceCategories)
router.get("/:id", authenticateToken, ServiceCategoryController.getServiceCategoryById)

router.post(
  "/",
  authenticateToken,
  categoryManagers,
  validateBody(ServiceCategoryDto),
  ServiceCategoryController.createServiceCategory,
)
router.put(
  "/:id",
  authenticateToken,
  categoryManagers,
  validateBody(ServiceCategoryDto),
  ServiceCategoryController.updateServiceCategory,
)
router.delete(
  "/:id",
  authenticateToken,
  categoryManagers,
  ServiceCategoryController.deleteServiceCategory,
)

// Чтение списка исполнителей категории доступно и руководителю — его дашборд
// запрашивает этот список (мутации ниже остаются под categoryManagers).
router.get(
  "/:id/executors",
  authenticateToken,
  authorizeRoles("department-head", "admin-worker", "manager"),
  ServiceCategoryController.getExecutorsByCategory,
)

router.post(
  "/:id/assign-executor",
  authenticateToken,
  categoryManagers,
  ServiceCategoryController.assignExecutorToCategory,
)

router.post(
  "/:id/change-head",
  authenticateToken,
  categoryManagers,
  ServiceCategoryController.changeCategoryHead,
)

router.get("/subcategories/all", authenticateToken, ServiceCategoryController.getAllSubcategories)
router.get("/:categoryId/subcategories", authenticateToken, ServiceCategoryController.getSubcategoriesByCategoryId)
router.get("/subcategories/:id", authenticateToken, ServiceCategoryController.getSubcategoryById)
router.post(
  "/subcategories",
  authenticateToken,
  categoryManagers,
  validateBody(ServiceSubcategoryDto),
  ServiceCategoryController.createSubcategory,
)
router.put(
  "/subcategories/:id",
  authenticateToken,
  categoryManagers,
  validateBody(ServiceSubcategoryDto.partial()),
  ServiceCategoryController.updateSubcategory,
)
router.delete(
  "/subcategories/:id",
  authenticateToken,
  categoryManagers,
  ServiceCategoryController.deleteSubcategory,
)

export default router
