import { z } from 'zod';

export const ServiceCategoryDto = z.object({
    name: z.string().min(1).max(255),
});

export const ServiceSubcategoryDto = z.object({
    name: z.string().min(1).max(255),
    category_id: z.number().int().positive(),
});
