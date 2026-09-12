import { Router } from "express"
import OfficeController from "../controllers/office.controller.js"
import CompanyController from "../controllers/company.controller.js"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js"
import { requireLocationCatalogMutationAccess } from "../middleware/departmentHeadOwnOffice.middleware.js"
import { validateBody } from "../middleware/validate.middleware.js"
import { CreateCompanyDto, UpdateCompanyDto } from "../dto/company.dto.js"
import { commonUpload } from "../utils/multerUpload.js"

const router = Router()

router.get("/", OfficeController.getAllOffices)
router.get("/:id/rooms", OfficeController.getOfficeRooms)
router.get(
  "/:id/location-catalog",
  authenticateToken,
  OfficeController.getLocationCatalog,
)

// Companies (арендаторы внутри офиса)
router.get("/:id/companies", CompanyController.getOfficeCompanies)
router.post(
  "/:id/companies",
  authenticateToken,
  authorizeRoles("admin-worker", "department-head"),
  validateBody(CreateCompanyDto),
  CompanyController.createCompany,
)
router.patch(
  "/:id/companies/:companyId",
  authenticateToken,
  authorizeRoles("admin-worker", "department-head"),
  validateBody(UpdateCompanyDto),
  CompanyController.updateCompany,
)
router.delete(
  "/:id/companies/:companyId",
  authenticateToken,
  authorizeRoles("admin-worker", "department-head"),
  CompanyController.deleteCompany,
)
router.post(
  "/:id/location-catalog",
  authenticateToken,
  authorizeRoles("department-head", "admin-worker"),
  requireLocationCatalogMutationAccess,
  OfficeController.createLocationCatalogRow,
)
router.patch(
  "/:id/location-catalog/:rowId",
  authenticateToken,
  authorizeRoles("department-head", "admin-worker"),
  requireLocationCatalogMutationAccess,
  OfficeController.updateLocationCatalogRow,
)
router.delete(
  "/:id/location-catalog/:rowId",
  authenticateToken,
  authorizeRoles("department-head", "admin-worker"),
  requireLocationCatalogMutationAccess,
  OfficeController.deleteLocationCatalogRow,
)
router.get("/:id", OfficeController.getOfficeById)
router.post(
    "/",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    commonUpload.single("photo"),
    OfficeController.createOffice
)
router.put(
    "/:id",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    commonUpload.single("photo"),
    OfficeController.updateOffice
)
router.patch(
    "/:id/working-hours",
    authenticateToken,
    authorizeRoles("admin-worker", "manager"),
    OfficeController.updateWorkingHours)
router.delete("/:id", authenticateToken, authorizeRoles("admin-worker", "manager"), OfficeController.deleteOffice)

export default router
