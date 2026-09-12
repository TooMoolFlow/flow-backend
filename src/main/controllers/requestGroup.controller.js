import RequestGroupService from '../services/requestGroup.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { NotFoundError } from '../errors/errors.js';

class RequestGroupController {

    static createRequestGroup = asyncHandler(async (req, res) => {
        const newRequestGroup = await RequestGroupService.createRequestGroup(req);
        res.status(201).json(newRequestGroup);
    });

    static getAllRequestGroups = asyncHandler(async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const status = req.query.status;
        const priority = req.query.priority;
        const officeId = req.query.office_id;

        const result = await RequestGroupService.getAllRequestGroups(page, pageSize, req.user, status, priority, officeId);
        res.json(result);
    });

    static getRequestGroupById = asyncHandler(async (req, res) => {
        const requestGroup = await RequestGroupService.getRequestGroupById(req.params.id);
        if (!requestGroup) {
            throw new NotFoundError('Request group not found');
        }
        res.json(requestGroup);
    });

    static deleteRequestGroup = asyncHandler(async (req, res) => {
        const deleted = await RequestGroupService.deleteRequestGroup(req.params.id);
        if (!deleted) {
            throw new NotFoundError('Request group not found');
        }
        res.status(204).send();
    });

    static patchUpdateRequestGroup = asyncHandler(async (req, res) => {
        const id = req.params.id;
        const result = await RequestGroupService.patchUpdateRequestGroup(id, req);
        res.status(200).json(result);
    })

    static updateRequestGroup = asyncHandler(async (req, res) => {
        const id = req.params.id;
        const result = await RequestGroupService.updateRequestGroup(id, req.body);
        res.status(200).json(result);
    })
}

export default RequestGroupController;
