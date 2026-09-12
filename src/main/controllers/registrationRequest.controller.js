import RegistrationRequestService from '../services/registrationRequest.service.js';
import NotificationService from '../services/notification.service.js';
import {asyncHandler} from '../middleware/asyncHandler.middleware.js';
import {BadRequestError} from '../errors/errors.js';

/**
 * Убирает хэш пароля перед отправкой ответа.
 * Заявка на регистрацию и созданный по ней пользователь хранят bcrypt-хэш,
 * который не должен уезжать в браузер.
 */
function stripPassword(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(stripPassword);

  const plain = typeof value.get === 'function' ? value.get({ plain: true }) : value;
  if (typeof plain !== 'object') return plain;

  const result = {};
  for (const [key, val] of Object.entries(plain)) {
    if (key === 'password') continue;
    result[key] = val !== null && typeof val === 'object' ? stripPassword(val) : val;
  }
  return result;
}

class RegistrationRequestController {
  // Создание запроса на регистрацию
  createRequest = asyncHandler(async (req, res) => {
    const request = await RegistrationRequestService.createRequest(req.body);
    // Эндпоинт публичный — хэш пароля из ответа убираем.
    const safeRequest = stripPassword(request);
    res.status(201).json({
      success: true,
      message: 'Запрос на регистрацию успешно создан',
      data: safeRequest
    });
  });

  // Получение списка запросов
  getRequests = asyncHandler(async (req, res) => {
    const { data, meta } = await RegistrationRequestService.getRequests(req.query, req.user);

    res.json({
      success: true,
      data,
      meta
    });
  });

  /** Тест пуша «новая регистрация» — только себе (JWT), тот же payload что в проде на устройство. */
  testRegistrationPush = asyncHandler(async (req, res) => {
    let officeId = req.user.office_id;
    if (req.body?.office_id != null && req.body.office_id !== '') {
      const n = parseInt(String(req.body.office_id), 10);
      if (Number.isInteger(n) && n > 0) {
        officeId = n;
      }
    }
    if (!officeId) {
      throw new BadRequestError('Не удалось определить офис. Укажите office_id в теле запроса.');
    }

    await NotificationService.sendTestNewRegistrationPushToUser(req.user.id, officeId);

    res.json({
      success: true,
      message:
        'Тестовый push отправлен на ваш аккаунт (и запись в ленте уведомлений с префиксом «[Тест]»). Откройте приложение того же пользователя.',
    });
  });

  // Одобрение запроса
  approveRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    const result = await RegistrationRequestService.approveRequest(requestId, req.user);

    res.json({
      success: true,
      message: 'Запрос одобрен, пользователь создан',
      data: stripPassword(result)
    });
  });

  // Удаление отклонённого запроса
  deleteRejectedRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    await RegistrationRequestService.deleteRejectedRequest(requestId, req.user);

    res.json({
      success: true,
      message: 'Отклонённый запрос удалён',
    });
  });

  // Отклонение запроса
  rejectRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const request = await RegistrationRequestService.rejectRequest(requestId, req.user);

    res.json({
      success: true,
      message: 'Запрос отклонен',
      data: stripPassword(request)
    });
  });

  // Обновление данных запроса
  updateRequest = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const request = await RegistrationRequestService.updateRequest(requestId, req.body, req.user);

    res.json({
      success: true,
      message: 'Данные запроса обновлены',
      data: stripPassword(request)
    });
  });
}

export default new RegistrationRequestController();
