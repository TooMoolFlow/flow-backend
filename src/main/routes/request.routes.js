import {Router} from "express"
import RequestController from "../controllers/request.controller.js"
import {authenticateToken, authorizeRoles} from "../middleware/auth.middleware.js"
import {validateBody} from "../middleware/validate.middleware.js";
import {UpdateLongTermStatus} from "../dto/request.dto.js";

const router = Router()

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin-worker", "executor", "manager"),
  RequestController.updateRequest,
)

router.patch(
  "/:id",
  authenticateToken,
  RequestController.patchRequest
)

router.delete("/:id", authenticateToken, RequestController.deleteRequest)

router.patch(
    "/:id/execute",
    authenticateToken,
    authorizeRoles("executor"),
    RequestController.startRequest
)
router.patch(
    "/:id/complete",
    authenticateToken,
    authorizeRoles("executor"),
    RequestController.finishRequest
)

router.patch(
    "/:id/admin-complete",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head"),
    RequestController.adminCompleteRequest
)

router.patch(
    "/:id/long-term",
    authenticateToken,
    authorizeRoles("admin-worker", "department-head", "executor"),
    validateBody(UpdateLongTermStatus),
    RequestController.updateLongTermStatus
)

export default router
