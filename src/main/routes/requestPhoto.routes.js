import { Router } from "express"
import RequestPhotoController from "../controllers/requestPhoto.controller.js"
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js"
import multer from "multer";

const upload = multer({ dest: 'tmp/' });
const router = Router()

router.get("/", authenticateToken, RequestPhotoController.getAllRequestPhotos)
router.get("/:id", authenticateToken, RequestPhotoController.getRequestPhotoById)
router.post(
  "/",
  authenticateToken,
  authorizeRoles("client", "admin-worker", "executor", "manager"),
  RequestPhotoController.createRequestPhoto,
)
router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("admin-worker", "manager"),
  RequestPhotoController.updateRequestPhoto,
)
router.delete(
  "/:id",
  authenticateToken,
  RequestPhotoController.deleteRequestPhoto,
)
router.get("/request/:requestId", authenticateToken, RequestPhotoController.getPhotosByRequestId)

router.post(
    "/:id/photos",
    authenticateToken,
    upload.array("photos"),
    RequestPhotoController.uploadPhotos,
)

export default router
