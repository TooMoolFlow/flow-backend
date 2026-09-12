import { Request, RequestGroup } from '../models/init.model.js';
import RequestPhotoService from './requestPhoto.service.js';
import AIService from './ai.service.js';
import NotificationService from './notification.service.js';
import { sequelize } from '../config/database.config.js';
import { rollbackAndRethrow } from '../utils/transactionUtils.js';
import logger from '../utils/winston/logger.js';

export async function processRequestsByCron() {
    const requests = await RequestGroup.findAll({
        where: {
            status: "in_progress",
            request_type: "normal"
        }, include: [{model: Request, as: "requests"}]
    });

    for (const request of requests) {
        try {
            const photos = await RequestPhotoService.getPhotosByRequestId(request.id);
            const aiResult = await AIService.analyzeRequest(request, photos);

            if (aiResult.status === "rejected") {
                const tx = await sequelize.transaction();
                try {
                    await RequestGroup.update({status: 'rejected'}, {
                        where: { id: request.id },
                        transaction: tx
                    });

                    await Request.update({status: 'rejected'}, {
                        where: { request_group_id: request.id },
                        transaction: tx
                    })

                    await tx.commit();
                } catch (error) {
                    await rollbackAndRethrow(tx, error);
                }
                await NotificationService.sendNotification({
                    userId: request.client_id,
                    request: request,
                    type: "reject_request",
                    content: aiResult.rejection_reason || "Автоматически отклонено системой"
                });
                logger.info('Request rejected by AI', { requestId: request.id });
            } else if (aiResult.status === "awaiting_assignment") {
                const tx = await sequelize.transaction();
                try {
                    for (const subRequest of request.requests) {
                        await Request.update({
                            status: "awaiting_assignment",
                            complexity: aiResult.complexity,
                            sla: aiResult.sla
                        }, {
                            where: { id: subRequest.id },
                            transaction: tx
                        });
                    }
                    
                    request.status = "awaiting_assignment";
                    await request.save({transaction: tx});
                    
                    await tx.commit();
                } catch (error) {
                    await rollbackAndRethrow(tx, error);
                }

                await NotificationService.sendNotification({
                    userId: request.requestGroup.client_id,
                    request: request,
                    type: "awaiting_assignment"
                });
                logger.info('Request updated by AI', { requestId: request.id });
            }
        } catch (err) {
            logger.error('AI analysis failed for request', { requestId: request.id, error: err?.message });
        }
    }
}
