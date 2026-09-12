import { Router } from "express";
import {
    createClientRating,
    updateClientRating,
    getClientRatingsByExecutor,
    getClientRatingsByClient,
    getClientRatingByRequestGroup,
    getAverageClientRating,
    deleteClientRating
} from "../controllers/clientRating.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware.js";

const router = Router();

// Создание и обновление рейтинга клиента (только для исполнителей)
router.post("/", authenticateToken, authorizeRoles('executor','admin-worker'), createClientRating);
router.put("/", authenticateToken, authorizeRoles('executor','admin-worker'), updateClientRating);

// Получение рейтингов клиентов (для исполнителей)
router.get("/executor", authenticateToken, authorizeRoles('executor'), getClientRatingsByExecutor);

// Получение рейтингов клиента (для клиентов)
router.get("/client", authenticateToken, getClientRatingsByClient);

// Получение рейтинга для конкретной группы заявок
router.get("/request-group/:request_group_id", authenticateToken, getClientRatingByRequestGroup);

// Получение среднего рейтинга клиента
router.get("/average/:client_id", authenticateToken, getAverageClientRating);

// Удаление рейтинга (только для исполнителей)
router.delete("/:id", authenticateToken, authorizeRoles('executor'), deleteClientRating);

export default router;
