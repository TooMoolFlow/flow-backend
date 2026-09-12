import RequestPhotoService from '../services/requestPhoto.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';

class RequestPhotoController {
  static getAllRequestPhotos = asyncHandler(async (req, res) => {
      const photos = await RequestPhotoService.getAllRequestPhotos()
      res.json(photos)
  })

  static getRequestPhotoById = asyncHandler(async (req, res) => {
    const photo = await RequestPhotoService.getRequestPhotoById(Number.parseInt(req.params.id))
    res.json(photo)
  })

  static createRequestPhoto = asyncHandler(async (req, res) => {
    const newPhoto = await RequestPhotoService.createRequestPhoto(req.body)
    res.status(201).json(newPhoto)
  })

  static updateRequestPhoto = asyncHandler(async (req, res) => {
    const updatedPhoto = await RequestPhotoService.updateRequestPhoto(Number.parseInt(req.params.id), req.body)
    res.json(updatedPhoto)
  })

  static deleteRequestPhoto = asyncHandler(async (req, res) => {
    await RequestPhotoService.deleteRequestPhoto(Number.parseInt(req.params.id))
    res.status(204).send()
  })

  static getPhotosByRequestId = asyncHandler(async (req, res) => {
    const photos = await RequestPhotoService.getPhotosByRequestId(Number.parseInt(req.params.requestId))
    res.json(photos)
  })

  static uploadPhotos = asyncHandler(async (req, res) => {
    const savedPhotos = await RequestPhotoService.uploadPhotos(
      req.params.id,
      req.files,
      req.body.type,
      { userId: req.user?.id, req }
    );
    res.status(201).json({ message: 'Фотографии загружены', photos: savedPhotos });
  })

}

export default RequestPhotoController
