import {generateToken, setTokenCookie} from "../utils/jwt/JwtService.js";
import {comparePassword, getHashedPassword} from "../utils/bcrypt/BCryptService.js";
import {User, VerificationCode} from "../models/init.model.js";
import {sendVerificationCode as sendMobizonVerificationCode} from "../utils/mobizon/mobizonService.js";
import {Op} from "sequelize";
import logger from "../utils/winston/logger.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
} from "../errors/errors.js";

class AuthService {
  static async login(req, res) {
    const {phone, password} = req.body;
    
    // Валидация формата телефона
    const phoneRegex = /^\+7 \d{3} \d{3} \d{2} \d{2}$/;
    if (!phoneRegex.test(phone)) {
      throw new BadRequestError("Неверный формат номера телефона. Используйте формат: +7 XXX XXX XX XX");
    }

    const user = await User.findOne({
      where: { phone },
      attributes: ['id', 'phone', 'password', 'role', 'full_name', 'office_id']
    });

    if (!user) {
      throw new UnauthorizedError("Неверный номер телефона или пароль");
    }
    if (!await comparePassword(password, user.password)) {
      throw new UnauthorizedError("Неверный номер телефона или пароль");
    }

    user.last_login = Date.now();
    await user.save();

    const token = generateToken(user);
    setTokenCookie(res, token);

    return res.status(200).json({
      success: true,
      role: user.role, 
      token: token,
      user: {
        id: user.id,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        office_id: user.office_id
      }
    });
  }
  /**
   * Генерирует 6-значный код верификации
   */
  static generateVerificationCode(length = 6) {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return code;
  }

  /**
   * Отправляет код подтверждения через SMS
   * POST /api/auth/send-verification-code
   * Body: { phone: string, purpose: 'registration' | 'password_reset' }
   */
  static async sendVerificationCode(req, res) {
    try {
      const { phone, purpose = 'registration' } = req.body;

      // Валидация входных данных
      if (!phone) {
        throw new BadRequestError("Номер телефона обязателен");
      }

      // Валидация формата телефона
      const phoneRegex = /^\+7 \d{3} \d{3} \d{2} \d{2}$/;
      if (!phoneRegex.test(phone)) {
        throw new BadRequestError("Неверный формат номера телефона. Используйте формат: +7 XXX XXX XX XX");
      }

      // Валидация purpose
      if (!['registration', 'password_reset'].includes(purpose)) {
        throw new BadRequestError("Неверное назначение кода. Используйте 'registration' или 'password_reset'");
      }

      // Бизнес-валидация по назначению кода
      // - registration: нельзя отправлять код, если пользователь уже существует
      // - password_reset: нельзя отправлять код, если пользователя не существует
      const existingUser = await User.findOne({
        where: { phone },
        attributes: ['id'],
      });

      if (purpose === 'registration' && existingUser) {
        throw new ConflictError("Пользователь с таким номером телефона уже существует");
      }

      if (purpose === 'password_reset' && !existingUser) {
        throw new NotFoundError("Пользователь с таким номером телефона не найден");
      }

      // Генерируем код на сервере
      const code = AuthService.generateVerificationCode(6);
      
      // Время истечения - 5 минут
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      // Помечаем старые коды как использованные
      await VerificationCode.update(
        { used: true, used_at: new Date() },
        {
          where: {
            phone,
            purpose,
            used: false,
            expires_at: { [Op.gt]: new Date() }
          }
        }
      );

      // Сохраняем код в БД
      await VerificationCode.create({
        phone,
        code,
        purpose,
        expires_at: expiresAt,
        used: false
      });

      // Отправляем SMS через Mobizon API
      const result = await sendMobizonVerificationCode(phone, code);

      if (!result.success) {
        logger.error(`Ошибка отправки SMS на номер ${phone}:`, result.error);
        // Удаляем код из БД, если не удалось отправить SMS
        await VerificationCode.destroy({
          where: { phone, code, purpose }
        });
        throw new InternalError(result.error || "Ошибка при отправке SMS");
      }

      logger.info(`Код подтверждения успешно отправлен на номер ${phone} для ${purpose}`);
      return res.status(200).json({
        success: true,
        message: "Код подтверждения успешно отправлен"
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError("Внутренняя ошибка сервера");
    }
  }

  /**
   * Проверяет код верификации
   * POST /api/auth/verify-code
   * Body: { phone: string, code: string, purpose: 'registration' | 'password_reset' }
   */
  static async verifyCode(req, res) {
    try {
      const { phone, code, purpose = 'registration' } = req.body;

      // Валидация входных данных
      if (!phone || !code) {
        throw new BadRequestError("Номер телефона и код обязательны");
      }

      // Валидация формата телефона
      const phoneRegex = /^\+7 \d{3} \d{3} \d{2} \d{2}$/;
      if (!phoneRegex.test(phone)) {
        throw new BadRequestError("Неверный формат номера телефона");
      }

      // Валидация кода
      if (typeof code !== 'string' || code.length !== 6) {
        throw new BadRequestError("Код должен состоять из 6 цифр");
      }

      // Ищем код в БД
      const verificationCode = await VerificationCode.findOne({
        where: {
          phone,
          code,
          purpose,
          used: false,
          expires_at: { [Op.gt]: new Date() }
        },
        order: [['created_at', 'DESC']]
      });

      if (!verificationCode) {
        throw new BadRequestError("Неверный или истекший код верификации");
      }

      // Для сброса пароля код нельзя «сжигать» здесь: следующий шаг — POST /reset-password,
      // который проверяет тот же код с used: false и помечает его использованным после смены пароля.
      // Для регистрации финальный шаг не перепроверяет код в БД, поэтому помечаем как использованный сразу.
      if (purpose !== 'password_reset') {
        verificationCode.used = true;
        verificationCode.used_at = new Date();
        await verificationCode.save();
      }

      logger.info(`Код верификации успешно подтвержден для номера ${phone} (${purpose})`);
      return res.status(200).json({
        success: true,
        message: "Код верификации подтвержден"
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError("Внутренняя ошибка сервера");
    }
  }

  /**
   * Сбрасывает пароль пользователя
   * POST /api/auth/reset-password
   * Body: { phone: string, newPassword: string, verification_code: string } или { phone: string, new_password: string, verification_code: string }
   */
  static async resetPassword(req, res) {
    try {
      // Поддерживаем оба формата: camelCase и snake_case
      const { phone: rawPhone, newPassword, new_password, verification_code } = req.body;
      const password = newPassword || new_password;

      // Валидация входных данных
      if (!rawPhone || !password || !verification_code) {
        throw new BadRequestError("Номер телефона, новый пароль и код верификации обязательны");
      }

      // Нормализуем номер телефона: если пришёл только цифры, форматируем в +7 XXX XXX XX XX
      let formattedPhone = rawPhone;
      const digitsOnly = rawPhone.replace(/\D/g, '');

      // Если номер пришёл только цифрами, форматируем его
      if (/^\d+$/.test(rawPhone)) {
        let phoneDigits = digitsOnly;
        // Если начинается с 8, заменяем на 7
        if (phoneDigits.startsWith('8')) {
          phoneDigits = '7' + phoneDigits.slice(1);
        }
        // Если не начинается с 7, добавляем 7
        if (!phoneDigits.startsWith('7')) {
          phoneDigits = '7' + phoneDigits;
        }
        // Ограничиваем до 11 цифр
        phoneDigits = phoneDigits.slice(0, 11);
        // Форматируем в +7 XXX XXX XX XX
        if (phoneDigits.length >= 11) {
          formattedPhone = `+7 ${phoneDigits.slice(1, 4)} ${phoneDigits.slice(4, 7)} ${phoneDigits.slice(7, 9)} ${phoneDigits.slice(9, 11)}`;
        } else {
          throw new BadRequestError("Неверный формат номера телефона");
        }
      }

      // Валидация формата телефона (после нормализации)
      const phoneRegex = /^\+7 \d{3} \d{3} \d{2} \d{2}$/;
      if (!phoneRegex.test(formattedPhone)) {
        throw new BadRequestError("Неверный формат номера телефона. Используйте формат: +7 XXX XXX XX XX");
      }

      // Валидация пароля
      if (typeof password !== 'string' || password.length < 6) {
        throw new BadRequestError("Пароль должен содержать минимум 6 символов");
      }

      // Проверяем код верификации
      const verificationCodeRecord = await VerificationCode.findOne({
        where: {
          phone: formattedPhone,
          code: verification_code,
          purpose: 'password_reset',
          used: false,
          expires_at: { [Op.gt]: new Date() }
        },
        order: [['created_at', 'DESC']]
      });

      if (!verificationCodeRecord) {
        throw new BadRequestError("Неверный или истекший код верификации");
      }

      // Ищем пользователя по номеру телефона (используем отформатированный номер)
      const user = await User.findOne({
        where: { phone: formattedPhone },
        attributes: ['id', 'phone', 'password', 'full_name']
      });

      if (!user) {
        throw new NotFoundError("Пользователь с таким номером телефона не найден");
      }

      // Хешируем новый пароль
      const hashedPassword = await getHashedPassword(password);
      user.password = hashedPassword;
      await user.save();

      // Помечаем код верификации как использованный
      verificationCodeRecord.used = true;
      verificationCodeRecord.used_at = new Date();
      await verificationCodeRecord.save();

      logger.info(`Пароль успешно сброшен для пользователя ${user.full_name} (ID: ${user.id}, Phone: ${formattedPhone})`);

      return res.status(200).json({
        success: true,
        message: "Пароль успешно сброшен"
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new InternalError("Внутренняя ошибка сервера");
    }
  }
}
export default AuthService;

