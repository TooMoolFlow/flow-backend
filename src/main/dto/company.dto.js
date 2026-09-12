import { z } from 'zod';

export const CompanyNameDto = z
  .string({ required_error: 'Название компании обязательно' })
  .trim()
  .min(1, 'Название компании обязательно')
  .max(255, 'Название компании не длиннее 255 символов');

export const CreateCompanyDto = z.object({
  name: CompanyNameDto,
});

export const UpdateCompanyDto = z.object({
  name: CompanyNameDto.optional(),
});

export default { CreateCompanyDto, UpdateCompanyDto };
