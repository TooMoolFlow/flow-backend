import {RequestComment, User} from "../models/init.model.js"
import {NotFoundError} from "../errors/errors.js";
import RequestLogger from '../utils/requestLogger.js';
import logger from '../utils/winston/logger.js';

class RequestCommentService {
  static async getAllChatMessages() {
    return await RequestComment.findAll()
  }

  static async getChatMessageById(id) {
    const message = await RequestComment.findByPk(id)
    if (!message) {
      throw new NotFoundError("Message not found")
    }
    return message
  }

  static async createChatMessage(user_id, messageData, req = null) {
    messageData.sender_id = user_id
    const comment = await RequestComment.create(messageData)
    
    // Логируем добавление комментария
    Promise.resolve(
      RequestLogger.logCommentAdded(
        messageData.request_id,
        user_id,
        messageData.comment,
        req ? RequestLogger.getIpAddress(req) : null,
        req ? RequestLogger.getUserAgent(req) : null
      )
    ).catch(err => logger.error('Ошибка при логировании комментария', { error: err?.message }));
    
    return comment
  }

  static async updateChatMessage(id, updateData) {
    const requestComment = await RequestComment.findByPk(id)
    if (!requestComment) {
      throw new NotFoundError("Comment not found")
    }
    requestComment.comment = updateData.comment
    return await requestComment.save()
  }

  static async deleteChatMessage(id) {
    const deleted = await RequestComment.destroy({where: {id}})
    if (!deleted) {
      throw new NotFoundError("chat not found")
    }
    return deleted
  }

  static async getMessagesByRequestId(requestId) {
    return await RequestComment.findAll({
      where: { request_id: requestId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'full_name', 'role']
        }
      ],
      order: [['timestamp', 'ASC']]
    });
  }
}

export default RequestCommentService
