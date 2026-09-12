import { Router } from "express";
import DepartmentController from "../controllers/department.controller.js";
import {authenticateToken, authorizeRoles} from "../middleware/auth.middleware.js";

const router = Router();

router.get(
  "/me",
  authenticateToken,
  authorizeRoles('executor', 'department-head'),
  DepartmentController.getDepartmentHeads
);

export default router;
