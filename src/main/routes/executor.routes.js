import { Router } from "express"
import ExecutorController from "../controllers/executor.controller.js"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js"
import {ExecutorDto, UpdateExecutorDto} from "../dto/executor.dto.js";
import {validateBody} from "../middleware/validate.middleware.js";

const router = Router()

router.get(
  "/",
  authenticateToken,
  authorizeRoles("department-head","manager","admin-worker"),
  ExecutorController.getAllExecutors,
)
router.get(
  "/all",
  authenticateToken,
  authorizeRoles("manager", "admin-worker"),
  ExecutorController.getAllExecutorsForManager,
)
router.get('/average-rating',authenticateToken, ExecutorController.getAverageRating)
router.get("/:id", authenticateToken, ExecutorController.getExecutorById)
router.get("/:id/user", authenticateToken, ExecutorController.getExecutorByUserId)
router.post("/", authenticateToken, authorizeRoles("department-head"), validateBody(ExecutorDto), ExecutorController.createExecutor)
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("department-head", "admin-worker"),
  validateBody(UpdateExecutorDto),
  ExecutorController.updateExecutor,
)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("department-head", "admin-worker"),
  ExecutorController.deleteExecutor,
)
export default router
