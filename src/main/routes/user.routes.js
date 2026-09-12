import { Router } from "express"
import UserController from "../controllers/user.controller.js"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js"
import {validateBody} from "../middleware/validate.middleware.js";
import {UpdateUserDto, UpdateUserProfileDto, UpdateUserRoleDto, UserDto} from "../dto/user.dto.js";

const router = Router()

router.get(
  "/",
  authenticateToken,
  authorizeRoles("admin-worker", "department-head", "manager"),
  UserController.getAllUsers,
)
router.get("/me", authenticateToken, UserController.getUserMe)
router.get("/search", authenticateToken, UserController.searchUsers)
router.get(
  "/office/:officeId",
  authenticateToken,
  authorizeRoles("admin-worker", "department-head"),
  UserController.getOfficeUsers,
)
router.post('/change-password', authenticateToken, UserController.changePassword);
router.patch(
  '/:id/change-password',
  authenticateToken,
  authorizeRoles("admin-worker", "department-head"),
  UserController.changeUserPasswordByAdmin,
);
router.get("/:id", authenticateToken, UserController.getUserById)
router.post(
    "/",
    authenticateToken,
    authorizeRoles("manager", "admin-worker"),
    validateBody(UserDto),
    UserController.createUser
)
router.put('/notifications-settings', authenticateToken,UserController.changeNotificationSettings)
router.post('/send-email-verification', authenticateToken, UserController.sendEmailVerificationCode)
router.post('/verify-email', authenticateToken, UserController.verifyEmail)
router.put('/email', authenticateToken, UserController.updateEmail)
router.put(
  "/:id",
  authenticateToken,
  (req, res, next) => {
    if (req.body?.role !== undefined) {
      return validateBody(UpdateUserRoleDto)(req, res, next);
    }
    if (
      req.body?.full_name !== undefined ||
      req.body?.phone !== undefined ||
      req.body?.office_id !== undefined ||
      req.body?.category_ids !== undefined ||
      req.body?.company_id !== undefined
    ) {
      return validateBody(UpdateUserProfileDto)(req, res, next);
    }
    return validateBody(UpdateUserDto)(req, res, next);
  },
  UserController.updateUser,
)
router.delete("/:id", authenticateToken, authorizeRoles("admin-worker", "manager","department-head"), UserController.deleteUser)

export default router
