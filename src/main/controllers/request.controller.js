import RequestService from '../services/request.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { validateId } from '../middleware/validate.middleware.js';
import { BadRequestError } from '../errors/errors.js';

class RequestController {

  static updateRequest = asyncHandler(async (req, res) => {
    await RequestService.updateRequest(
        Number.parseInt(req.params.id),
        req.body
    );

    res.sendStatus(204);
  });

  static deleteRequest = asyncHandler(async (req, res) => {
    await RequestService.deleteRequest(Number.parseInt(req.params.id));
    res.status(204).send();
  });

  static startRequest = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const requestId = req.params.id;
    const data = await RequestService.startRequest(requestId, userId, req)
    res.status(200).json(data);
  });

  static finishRequest = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const requestId = req.params.id;
    const data = await RequestService.finishRequest(requestId, userId, req)
    res.status(200).json(data);
  });

  static adminCompleteRequest = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const requestId = req.params.id;
    const data = await RequestService.adminCompleteRequest(requestId, userId, req)
    res.status(200).json(data);
  });

  static updateLongTermStatus = asyncHandler(async (req, res) => {
    const requestId = validateId(req);
    const { is_long_term } = req.body;
    
    if (typeof is_long_term !== 'boolean') {
      throw new BadRequestError('is_long_term must be a boolean value');
    }
    
    const updatedRequest = await RequestService.updateLongTermStatus(requestId, is_long_term, req.user, req);
    res.status(200).json(updatedRequest);
  });

  static patchRequest = asyncHandler(async (req, res) => {
    const requestId = req.params.id;
    const updateData = req.body;
    const user = req.user;

    const updatedRequest = await RequestService.patchRequest(requestId, updateData, user, req);
    
    res.status(200).json({
      message: "Request updated successfully",
      data: updatedRequest
    });
  });
}

export default RequestController;
