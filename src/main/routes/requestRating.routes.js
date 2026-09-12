import { Router } from "express";
import {
    createRequestRating,
    getAllRequestRatings,
    getRequestRatingById,
    deleteRequestRating, 
    getRequestRatingByUser, 
    getRequestRatingByExecutor,
    updateRequestRating,
    getExecutorRatingsByRequest
} from "../controllers/requestRating.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/", authenticateToken, createRequestRating);
router.put("/", authenticateToken, updateRequestRating);
router.get("/user/:id", authenticateToken, getRequestRatingByUser);
router.get("/executor", authenticateToken, getRequestRatingByExecutor);
router.get("/", authenticateToken, getAllRequestRatings);
router.get("/request/:requestId", authenticateToken, getExecutorRatingsByRequest);

router.get("/:id", authenticateToken, getRequestRatingById);
router.delete("/:id", authenticateToken, deleteRequestRating);

export default router;
