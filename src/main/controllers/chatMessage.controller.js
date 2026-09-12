import {asyncHandler} from "../middleware/asyncHandler.middleware.js"
import ChatMessageService from "../services/requestComment.service.js"

class ChatMessageController {
  static getAllChatMessages = asyncHandler(async (req, res) => {
    const messages = await ChatMessageService.getAllChatMessages()
    res.json(messages)
  })

  static getChatMessageById = asyncHandler(async (req, res) => {
    const id = req.params.id
    const message = await ChatMessageService.getChatMessageById(id)
    res.json(message)
  })

  static createChatMessage = asyncHandler(async (req, res) => {
    const newMessage = await ChatMessageService.createChatMessage(req.body)
    res.status(201).json(newMessage)
  })

  static updateChatMessage = asyncHandler(async (req, res) => {
    const id = req.params.id
    const updatedMessage = await ChatMessageService.updateChatMessage(id, req.body)
    res.json(updatedMessage)
  })

  static deleteChatMessage = asyncHandler(async (req, res) => {
    const id = req.params.id
    await ChatMessageService.deleteChatMessage(id)
    res.status(204).send()
  })

  static getMessagesByRequestId = asyncHandler(async (req, res) => {
    const id = req.params.requestId
    const messages = await ChatMessageService.getMessagesByRequestId(id)
    res.json(messages)
  })
}

export default ChatMessageController
