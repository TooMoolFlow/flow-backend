import {asyncHandler} from "../middleware/asyncHandler.middleware.js"
import RequestCommentService from "../services/requestComment.service.js"

class RequestCommentController {
  static getAllRequestComments = asyncHandler(async (req, res) => {
    const messages = await RequestCommentService.getAllChatMessages()
    res.json(messages)
  })

  static getRequestCommentById = asyncHandler(async (req, res) => {
    const id = req.params.id
    const message = await RequestCommentService.getChatMessageById(id)
    res.json(message)
  })

  static createRequestComment = asyncHandler(async (req, res) => {
    const newMessage = await RequestCommentService.createChatMessage(req.user.id, req.body)
    res.status(201).json(newMessage)
  })

  static updateRequestComment = asyncHandler(async (req, res) => {
    const id = req.params.id
    const updatedMessage = await RequestCommentService.updateChatMessage(id, req.body)
    res.json(updatedMessage)
  })

  static deleteRequestComment = asyncHandler(async (req, res) => {
    const id = req.params.id
    await RequestCommentService.deleteChatMessage(id)
    res.status(204).send()
  })

  static getRequestCommentsByRequestId = asyncHandler(async (req, res) => {
    const id = req.params.requestId
    const messages = await RequestCommentService.getMessagesByRequestId(id)
    res.json(messages)
  })
}

export default RequestCommentController
