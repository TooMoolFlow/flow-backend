import z from 'zod';

export const AdminWorkerRequestStatus = z.object({
    status: z.enum(['rejected', 'awaiting_assignment']),
    complexity: z.enum(['simple', 'medium', 'complex']).optional(),
    sla: z.string().nonempty().optional(),
    category_id: z.number().gt(0).optional(),
    rejection_reason: z.string().nonempty().optional(),
    request_type: z.string().nonempty().optional(),
});

export const UpdateLongTermStatus = z.object({
    is_long_term: z.boolean(),
});

// Универсальная схема для PATCH запросов Request
export const UpdateRequestSchema = z.object({
    // Основные поля
    title: z.string().min(1, 'Title is required').max(255, 'Title too long').optional(),
    description: z.string().optional(),
    location: z.string().min(1, 'Location is required').max(255, 'Location too long').optional(),
    location_detail: z.string().max(255, 'Location detail too long').optional(),
    
    // Статус и тип
    status: z.enum([
        'in_progress', 
        'execution', 
        'completed', 
        'rejected',
        'awaiting_assignment', 
        'awaiting_sla', 
        'assigned'
    ]).optional(),
    request_type: z.enum(['normal', 'urgent', 'planned']).optional(),
    
    // Связанные сущности
    office_id: z.number().gt(0, 'Invalid office ID').optional(),
    plan_id: z.number().gt(0, 'Invalid plan ID').optional(),
    category_id: z.number().gt(0, 'Invalid category ID').optional(),
    executor_id: z.number().gt(0, 'Invalid executor ID').optional().or(z.null()),
    
    // Дополнительные поля
    complexity: z.enum(['simple', 'medium', 'complex']).optional(),
    sla: z.string().optional(),
    comment: z.string().max(255, 'Comment too long').optional(),
    is_long_term: z.boolean().optional(),
    
    // Даты
    planned_date: z.string().datetime().optional().or(z.date().optional()),
    actual_completion_date: z.string().datetime().optional().or(z.date().optional()).or(z.null()),
    
    // Причина отклонения (только если статус rejected)
    rejection_reason: z.string().optional(),
    
    // Специальный код для идентификации типа патча
    patch_code: z.number().int().positive().optional(),
}).refine((data) => {
    // Если статус rejected, то rejection_reason обязателен
    if (data.status === 'rejected' && (!data.rejection_reason || data.rejection_reason.trim() === '')) {
        return false;
    }
    return true;
}, {
    message: "Rejection reason is required when status is rejected",
    path: ["rejection_reason"]
}).refine((data) => {
    // Если статус awaiting_assignment, то нужны дополнительные поля
    if (data.status === 'awaiting_assignment') {
        return data.complexity || data.sla || data.category_id;
    }
    return true;
}, {
    message: "complexity, sla, or category_id is required when status is awaiting_assignment",
    path: ["status"]
});