import { z } from 'zod';

export const OfficeDto = z.object({
    name: z.string().nonempty("Name is required"),
    address: z.string().nonempty("Address is required"),
    city: z.string().nonempty("City is required"),
    block: z.string().optional(), // Добавлено
    floor: z.number().int().optional(), // Добавлено (целое число)
    lat: z.number().optional(),
    lon: z.number().optional(),
    photo: z.string().nullable().optional(), // Base64 или URL или null
    working_hours_start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(), // Формат HH:mm:ss
    working_hours_end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(), // Формат HH:mm:ss
    auto_track_enabled: z.boolean().optional(),
});

export const UpdateOfficeDto = OfficeDto.partial();
