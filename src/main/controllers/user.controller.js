import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import UserService from '../services/user.service.js';
import { BadRequestError, ForbiddenError } from '../errors/errors.js';

class UserController {

  static getAllUsers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const { office_id, role, company_id } = req.query;
    const result = await UserService.getAllUsers(
      page,
      limit,
      office_id,
      role,
      req.user,
      company_id,
    );
    res.json({
      success: true,
      total: result.count,
      users: result.rows,
      currentPage: page,
      totalPages: Math.ceil(result.count / limit)
    });
  });

  static searchUsers = asyncHandler(async (req, res) => {
    const { q, role, scope, office_id, company_id } = req.query;
    if (!q || typeof q !== 'string' || !q.trim()) {
      throw new BadRequestError('Пустой запрос');
    }
    const roleFilter = role && typeof role === 'string' ? role : null;
    const users = await UserService.searchUsers(q.trim(), roleFilter, req.user, {
      scope,
      office_id,
      company_id,
    });
    res.json({ success: true, users });
  });

  static getOfficeUsers = asyncHandler(async (req, res) => {
    const officeId = parseInt(req.params.officeId, 10);
    if (
      req.user.role === 'department-head' &&
      Number(req.user.office_id) !== officeId
    ) {
      throw new ForbiddenError('Доступ только к пользователям своего офиса');
    }
    const users = await UserService.getOfficeUsers(officeId);
    res.json(users);
  });

  static getUserById = asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.params.id);
    res.json(user);
  });

  static getUserMe = asyncHandler(async (req, res) => {
    const user = await UserService.getUserById(req.user.id);
    res.json(user);
  });

  static changeNotificationSettings = asyncHandler(async (req, res) => {
    const result = await UserService.changeNotificationSettings(req.user.id, req.body);
    res.json(result);
  });

  static changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      throw new BadRequestError('Все поля обязательны');
    }
    const result = await UserService.changePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  });

  static changeUserPasswordByAdmin = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password) {
      throw new BadRequestError('Новый пароль обязателен');
    }
    if (new_password.length < 6) {
      throw new BadRequestError('Пароль должен содержать минимум 6 символов');
    }
    const result = await UserService.changeUserPasswordByAdmin(
      req.user.id,
      req.user.role,
      parseInt(id, 10),
      new_password
    );
    res.json(result);
  });

  static createUser = asyncHandler(async (req, res) => {
    const newUser = await UserService.createUser(req.body, req.user.role);
    res.status(201).json(newUser);
  });

  static updateUser = asyncHandler(async (req, res) => {
    const targetId = parseInt(req.params.id, 10);
    if (req.body.role !== undefined) {
      if (!['admin-worker', 'department-head'].includes(req.user.role)) {
        throw new ForbiddenError('Недостаточно прав для изменения роли');
      }
      const updatedUser = await UserService.updateUserByManager(
        req.user.id,
        req.user.role,
        targetId,
        req.body
      );
      return res.json(updatedUser);
    }
    if (
      req.body.full_name !== undefined ||
      req.body.phone !== undefined ||
      req.body.office_id !== undefined ||
      req.body.category_ids !== undefined ||
      req.body.company_id !== undefined
    ) {
      if (!['admin-worker', 'department-head'].includes(req.user.role)) {
        throw new ForbiddenError('Недостаточно прав для изменения профиля');
      }
      const updatedUser = await UserService.updateUserProfileByManager(
        req.user.id,
        req.user.role,
        targetId,
        req.body
      );
      return res.json(updatedUser);
    }
    const updatedUser = await UserService.updateUser(targetId, req.body);
    res.json(updatedUser);
  });

  static deleteUser = asyncHandler(async (req, res) => {
    await UserService.deleteUser(req.params.id);
    res.status(204).send();
  });

  static sendEmailVerificationCode = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestError('Email обязателен');
    }
    const result = await UserService.sendEmailVerificationCode(req.user.id, email);
    res.json(result);
  });

  static verifyEmail = asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) {
      throw new BadRequestError('Код верификации обязателен');
    }
    const result = await UserService.verifyEmail(req.user.id, code);
    res.json(result);
  });

  static updateEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestError('Email обязателен');
    }
    const result = await UserService.updateEmail(req.user.id, email);
    res.json(result);
  });
}

export default UserController;
