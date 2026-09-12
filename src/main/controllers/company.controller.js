import CompanyService from '../services/company.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';

class CompanyController {
  /** Публичный список компаний офиса (используется на регистрации и в админке). */
  static getOfficeCompanies = asyncHandler(async (req, res) => {
    const items = await CompanyService.listForOffice(req.params.id);
    res.json({ items });
  });

  static createCompany = asyncHandler(async (req, res) => {
    CompanyService.assertOfficeMutationAccess(req.user, req.params.id);
    const company = await CompanyService.createCompany(req.params.id, req.body);
    res.status(201).json(company);
  });

  static updateCompany = asyncHandler(async (req, res) => {
    CompanyService.assertOfficeMutationAccess(req.user, req.params.id);
    const company = await CompanyService.updateCompany(
      req.params.id,
      req.params.companyId,
      req.body,
    );
    res.json(company);
  });

  static deleteCompany = asyncHandler(async (req, res) => {
    CompanyService.assertOfficeMutationAccess(req.user, req.params.id);
    await CompanyService.deleteCompany(req.params.id, req.params.companyId);
    res.status(204).send();
  });
}

export default CompanyController;
