import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.GMAIL_HOST,
    port: 587,
    secure: false,
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
    }
});

export async function sendMail(to, title, message) {
    try {
        // Прямая отправка без verify() чтобы избежать таймаутов
        const info = await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: to,
            subject: title,
            text: message,
            html: message.replace(/\n/g, '<br>'), // Преобразуем переносы строк в HTML
        });

        console.log('Message sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error; // Пробрасываем ошибку, чтобы можно было обработать на уровне вызывающего кода
    }
}