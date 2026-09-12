import { z } from 'zod';

export const ExecutorDto = z.object({
    phone: z.string().regex(/^\+7 \d{3} \d{3} \d{2} \d{2}$/, "Invalid phone format"),
    full_name: z.string().nonempty("Full name is required"),
    category_ids: z.array(z.number().int().positive()).min(1, "At least one category is required"),
});

export const UpdateExecutorDto = z.object({
    phone: z.string().regex(/^\+7 \d{3} \d{3} \d{2} \d{2}$/, "Invalid phone format").optional(),
    full_name: z.string().nonempty("Full name is required").optional(),
    specialty: z.string().min(1).max(100).optional(),
    category_ids: z.array(z.number().int().positive()).min(1).optional(),
}).refine((data) => Object.keys(data).length > 0, { message: "At least one field is required" });

export const UpdateUserDto = ExecutorDto.partial();
