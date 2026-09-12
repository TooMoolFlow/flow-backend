/** Базовый класс для всех HTTP-ошибок приложения (централизованная обработка в errorHandler). */
export class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
    }
}

export class BadRequestError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized") {
        super(message, 401);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "Forbidden") {
        super(message, 403);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Not Found") {
        super(message, 404);
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(message, 409);
    }
}

/** Внутренняя ошибка сервера (5xx), когда причина не в запросе клиента. */
export class InternalError extends AppError {
    constructor(message = "Internal Server Error") {
        super(message, 500);
    }
}