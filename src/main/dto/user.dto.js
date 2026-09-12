import { z } from 'zod';

export const UserDto = z.object({
    full_name: z.string().nonempty("Full name is required"),
    role: z.enum(["client", "department-head", "admin-worker", "manager", 'executor']),
    office_id: z.number().gt(0).min(1, "Office ID is required"),
    category_id: z.number().gt(0).min(1, "CategoryId is required").optional(),
    phone: z.string().nonempty("Phone number is required"),
    email: z.string().email("Invalid email format").optional(),
    company_id: z.number().int().positive().nullable().optional(),
});

export const UpdateUserDto = UserDto.partial();

export const UpdateUserRoleDto = z.object({
  role: z.enum(['client', 'department-head', 'admin-worker', 'manager', 'executor']),
  category_ids: z.array(z.number().int().positive()).min(1).optional(),
  specialty: z.string().min(1).optional(),
});

export const UpdateUserProfileDto = z
  .object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters').max(255).optional(),
    phone: z.string().min(1, 'Phone number is required').optional(),
    /** Переназначение офиса — только admin-worker (проверка в сервисе). */
    office_id: z.number().int().positive().optional(),
    /**
     * Вместе со сменой office_id для исполнителя: категории услуг **целевого** офиса.
     * Иначе смена офиса невозможна (старые категории в БД ещё от прежнего офиса).
     */
    category_ids: z.array(z.number().int().positive()).min(1).optional(),
    /**
     * Привязка клиента к компании. null — снять компанию (Не указана).
     * Для других ролей сервер вернёт ошибку.
     */
    company_id: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) =>
      data.full_name !== undefined ||
      data.phone !== undefined ||
      data.office_id !== undefined ||
      data.company_id !== undefined,
    {
      message: 'Укажите хотя бы одно поле для обновления',
    }
  )
  .refine(
    (data) => data.category_ids === undefined || data.office_id !== undefined,
    {
      message: 'category_ids допустимы только вместе с office_id',
    }
  );

export const CreateRequestDto = z
  .object({
    phone: z.string().regex(/^\+7 \d{3} \d{3} \d{2} \d{2}$/, "Invalid phone format"),
    full_name: z.string().min(2, "Full name must be at least 2 characters").max(255, "Full name is too long"),
    office_id: z.number().int().positive("Office ID must be positive"),
    role: z.string().min(1, "Role is required").max(50, "Role is too long"),
    service_category_id: z.number().int().positive("Service category ID must be positive").optional(),
    /** Существующая компания внутри выбранного офиса (только для роли client). */
    company_id: z.number().int().positive().optional(),
    /** Произвольное название компании при выборе варианта «Другое» (только для роли client). */
    company_other_name: z.string().trim().min(1).max(255).optional(),
    password: z.string().min(6, "Password must be at least 6 characters").max(255, "Password is too long"),
  })
  .refine(
    (data) => data.role !== 'client' || !(data.company_id != null && data.company_other_name),
    {
      message: 'Укажите либо company_id, либо company_other_name, но не оба сразу',
      path: ['company_id'],
    },
  )
  .refine(
    (data) => data.role === 'client' || (data.company_id == null && !data.company_other_name),
    {
      message: 'Поля компании доступны только для роли «Клиент»',
      path: ['company_id'],
    },
  );

export const UpdateRequestDto = z
  .object({
    phone: z.string().regex(/^\+7 \d{3} \d{3} \d{2} \d{2}$/, "Invalid phone format").optional(),
    full_name: z.string().min(2, "Full name must be at least 2 characters").max(255, "Full name is too long").optional(),
    office_id: z.number().int().positive("Office ID must be positive").optional(),
    role: z.string().min(1, "Role is required").max(50, "Role is too long").optional(),
    service_category_id: z.number().int().positive("Service category ID must be positive").optional(),
    /** Изменение компании в заявке. null — очистить выбор. */
    company_id: z.number().int().positive().nullable().optional(),
    /** Очистить или заменить произвольное название «Другое». null — очистить. */
    company_other_name: z.string().trim().min(1).max(255).nullable().optional(),
  })
  .refine(
    (data) => !(data.company_id != null && data.company_other_name),
    {
      message: 'Укажите либо company_id, либо company_other_name, но не оба сразу',
      path: ['company_id'],
    },
  );

