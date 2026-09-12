import { Router } from 'express';
import { sendMail } from '../utils/nodemailer/nodemailer.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/errors.js';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Публичный endpoint для отправки заявки с лендинга
router.post('/', asyncHandler(async (req, res) => {
  const { name, company, phone } = req.body;

  if (!name || !company || !phone) {
    throw new BadRequestError('Все поля обязательны для заполнения');
  }

  const recipientEmail = process.env.CONTACT_EMAIL || 'tobayakov.sh@tmk-limited.com';
  const subject = 'Новая заявка с сайта Workflow';
  const formattedDate = new Date().toLocaleString('ru-RU', {
    timeZone: 'Asia/Almaty',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const message = `
Новая заявка с сайта Workflow:

Имя: ${name}
Компания: ${company}
Телефон: ${phone}

Дата: ${formattedDate}
  `.trim();

  await sendMail(recipientEmail, subject, message);

  res.json({
    success: true,
    message: 'Заявка успешно отправлена'
  });
}));

export default router;
