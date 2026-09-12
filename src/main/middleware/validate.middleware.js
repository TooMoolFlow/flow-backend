import { BadRequestError } from "../errors/errors.js";
import logger from "../utils/winston/logger.js";

export const validateId = (req) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        logger.warn('Invalid ID received', {
            endpoint: req.originalUrl,
            idParam: req.params.id,
        });
        throw new BadRequestError('Invalid ID received');
    }
    return id;
};

function formatValidationErrorDetails(error) {
    return Array.isArray(error?.errors)
        ? error.errors.map((issue) => ({
            field: Array.isArray(issue.path) && issue.path.length
                ? issue.path.join('.')
                : 'unknown',
            message: issue.message ?? 'Invalid input',
          }))
        : [{ field: 'unknown', message: 'Validation failed' }];
}

function normalizeSchemas(schemaOrSchemas, defaultTarget) {
    if (
        schemaOrSchemas &&
        typeof schemaOrSchemas === 'object' &&
        !('safeParse' in schemaOrSchemas) &&
        !('parse' in schemaOrSchemas) &&
        (schemaOrSchemas.body || schemaOrSchemas.query || schemaOrSchemas.params)
    ) {
        return schemaOrSchemas;
    }

    return { [defaultTarget]: schemaOrSchemas };
}

function assignValidatedValue(req, res, target, value) {
    if (target === 'body') {
        req.body = value;
        return;
    }

    if (target === 'params') {
        req.params = value;
        return;
    }

    if (!req.validated) {
        req.validated = {};
    }
    req.validated[target] = value;

    if (res?.locals) {
        res.locals.validated = {
            ...(res.locals.validated ?? {}),
            [target]: value,
        };
    }
}

export const validateRequest = (schemaOrSchemas, options = {}) => {
    const { defaultTarget = 'body' } = options;
    const schemas = normalizeSchemas(schemaOrSchemas, defaultTarget);

    return (req, res, next) => {
        try {
            if (schemas.params) {
                assignValidatedValue(req, res, 'params', schemas.params.parse(req.params ?? {}));
            }

            if (schemas.query) {
                assignValidatedValue(req, res, 'query', schemas.query.parse(req.query ?? {}));
            }

            if (schemas.body) {
                assignValidatedValue(req, res, 'body', schemas.body.parse(req.body ?? {}));
            }

            next();
        } catch (error) {
            logger.error('Request validation failed', {
                endpoint: req.originalUrl,
                method: req.method,
                details: formatValidationErrorDetails(error),
            });

            return res.status(400).json({
                error: 'Validation error',
                details: formatValidationErrorDetails(error),
            });
        }
    };
};

export const validateBody = (schema) => validateRequest({ body: schema });
