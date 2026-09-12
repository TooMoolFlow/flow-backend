import {Router} from "express"
import RequestCommentController from "../controllers/requestComment.controller.js"
import {authenticateToken} from "../middleware/auth.middleware.js"
import {validateBody} from "../middleware/validate.middleware.js";
import {CommentDto} from "../dto/requestComment.dto.js";

const router = Router()

router.get("/", authenticateToken, RequestCommentController.getAllRequestComments)
router.get("/:id", authenticateToken, RequestCommentController.getRequestCommentById)
router.post(
  "/",
  authenticateToken,
  validateBody(CommentDto),
  RequestCommentController.createRequestComment,
)
router.put(
  "/:id",
  authenticateToken,
  validateBody(CommentDto),
  RequestCommentController.updateRequestComment,
)
router.delete(
  "/:id",
  authenticateToken,
  RequestCommentController.deleteRequestComment,
)
router.get("/request/:requestId", authenticateToken, RequestCommentController.getRequestCommentsByRequestId)

export default router
