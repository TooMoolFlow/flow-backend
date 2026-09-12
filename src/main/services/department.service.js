import {ServiceCategory, User} from "../models/init.model.js";
import {NotFoundError} from "../errors/errors.js";

class DepartmentService {
  static async getDepartmentHeadsByUserOffice(userId) {
    // Сначала получаем пользователя, чтобы узнать его office_id
    const user = await User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('Пользователь не найден');
    }

    if (!user.office_id) {
      throw new NotFoundError('Пользователь не привязан к офису');
    }

    // Получаем всех пользователей с ролью department-head из того же офиса
    return await User.findAll({
      where: {
        role: 'department-head',
        office_id: user.office_id
      },
      attributes: ['id', 'full_name', 'office_id'],
      order: [['full_name', 'ASC']]
    });
  }
}

export default DepartmentService;
