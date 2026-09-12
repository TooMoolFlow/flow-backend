import OfficeService from "../services/office.service.js"
import OfficeLocationCatalogService from "../services/officeLocationCatalog.service.js"
import {asyncHandler} from "../middleware/asyncHandler.middleware.js";

class OfficeController {
  static getAllOffices = asyncHandler(async (req, res) => {
    const offices = await OfficeService.getAllOffices()
    res.json(offices)
  });

  static getOfficeById = asyncHandler(async (req, res) => {
    const id = req.params.id
    const office = await OfficeService.getOfficeById(id)
    res.json(office)
  });

  static getOfficeRooms = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const rooms = await OfficeService.getOfficeRooms(id);
    res.json(rooms);
  });

  /** Шаблоны локаций офиса (блок / этаж / помещение). Неактивные — только с ?includeInactive=1 для department-head своего офиса или admin-worker (любой офис). */
  static getLocationCatalog = asyncHandler(async (req, res) => {
    const officeId = req.params.id;
    const wantsInactive =
      req.query.includeInactive === "1" || req.query.includeInactive === "true";
    const isDeptHeadOwnOffice =
      req.user?.role === "department-head" &&
      req.user.office_id != null &&
      Number(req.params.id) === Number(req.user.office_id);
    const isAdminOfficeScope = req.user?.role === "admin-worker";
    const includeInactive = wantsInactive && (isDeptHeadOwnOffice || isAdminOfficeScope);
    const items = await OfficeLocationCatalogService.listForOffice(officeId, { includeInactive });
    res.json({ items });
  });

  static createLocationCatalogRow = asyncHandler(async (req, res) => {
    const row = await OfficeLocationCatalogService.createRow(req.params.id, req.body);
    res.status(201).json(row);
  });

  static updateLocationCatalogRow = asyncHandler(async (req, res) => {
    const row = await OfficeLocationCatalogService.updateRow(
      req.params.id,
      Number(req.params.rowId),
      req.body
    );
    res.json(row);
  });

  static deleteLocationCatalogRow = asyncHandler(async (req, res) => {
    await OfficeLocationCatalogService.deleteRow(req.params.id, Number(req.params.rowId));
    res.status(204).send();
  });

  static createOffice = asyncHandler(async (req, res) => {
    const newOffice = await OfficeService.createOffice(req.body, req.file)
    res.status(201).json(newOffice)
  });

  static updateOffice = asyncHandler(async (req, res) => {
    const id = req.params.id
    const updatedOffice = await OfficeService.updateOffice(id, req.body, req.file)
    res.json(updatedOffice)
  });

  static updateWorkingHours = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const updatedOffice = await OfficeService.updateWorkingHours(id, req.body);
    res.json(updatedOffice);
  });

  static deleteOffice = asyncHandler(async (req, res) => {
    const id = req.params.id
    await OfficeService.deleteOffice(id)
    res.status(204).send()
  });
}

export default OfficeController
