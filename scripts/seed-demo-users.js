/**
 * Создаёт демо-пользователей на все роли в одном офисе.
 * Нужен, пока SMS-верификация (Mobizon) недоступна и обычная регистрация не работает.
 *
 * Запуск:  node scripts/seed-demo-users.js
 *
 * Скрипт идемпотентен: пользователь с таким же номером телефона не дублируется,
 * ему только сбрасывается пароль на демо-значение.
 */
import dotenv from 'dotenv';
import { sequelize } from '../src/main/config/database.config.js';
import {
  User,
  Office,
  Company,
  Executor,
  ServiceCategory,
  ExecutorServiceCategory,
} from '../src/main/models/init.model.js';
import { getHashedPassword } from '../src/main/utils/bcrypt/BCryptService.js';

dotenv.config();

const PASSWORD = process.env.SEED_PASSWORD || 'Workflow123';
const OFFICE_ID = Number(process.env.SEED_OFFICE_ID || 1);
const COMPANY_NAME = 'Демо Компания';

/** Порядок важен: executor ссылается на department-head. */
const USERS = [
  { role: 'manager',         full_name: 'Менеджер Демо',        phone: '+7 700 000 00 05' },
  { role: 'admin-worker',    full_name: 'Админ Демо',           phone: '+7 700 000 00 02' },
  { role: 'department-head', full_name: 'Начальник Отдела Демо', phone: '+7 700 000 00 03' },
  { role: 'client',          full_name: 'Клиент Демо',          phone: '+7 700 000 00 01', withCompany: true },
  { role: 'executor',        full_name: 'Исполнитель Демо',     phone: '+7 700 000 00 04', withExecutor: true },
];

async function main() {
  await sequelize.authenticate();

  const office = await Office.findByPk(OFFICE_ID);
  if (!office) {
    throw new Error(`Офис с id=${OFFICE_ID} не найден. Создайте офис или задайте SEED_OFFICE_ID.`);
  }

  const category = await ServiceCategory.findOne({
    where: { office_id: OFFICE_ID },
    order: [['id', 'ASC']],
  });
  if (!category) {
    throw new Error(`В офисе ${OFFICE_ID} нет ни одной категории услуг — исполнителя создать нельзя.`);
  }

  let company = null;
  const tx = await sequelize.transaction();
  try {
    [company] = await Company.findOrCreate({
      where: { name: COMPANY_NAME, office_id: OFFICE_ID },
      defaults: { name: COMPANY_NAME, office_id: OFFICE_ID },
      transaction: tx,
    });

    const hashedPassword = await getHashedPassword(PASSWORD);
    const created = [];
    let departmentHeadId = null;

    for (const spec of USERS) {
      let user = await User.findOne({ where: { phone: spec.phone }, transaction: tx });

      if (user) {
        user.password = hashedPassword;
        await user.save({ transaction: tx });
      } else {
        user = await User.create({
          full_name: spec.full_name,
          phone: spec.phone,
          password: hashedPassword,
          role: spec.role,
          office_id: OFFICE_ID,
          company_id: spec.withCompany ? company.id : null,
          service_category_id: spec.role === 'executor' ? category.id : null,
        }, { transaction: tx });
      }

      if (spec.role === 'department-head') {
        departmentHeadId = user.id;
      }

      if (spec.withExecutor) {
        if (!departmentHeadId) {
          throw new Error('Не найден department-head — запись исполнителя создать нельзя.');
        }
        let executor = await Executor.findOne({ where: { user_id: user.id }, transaction: tx });
        if (!executor) {
          executor = await Executor.create({
            user_id: user.id,
            department_id: departmentHeadId,
            specialty: category.name,
          }, { transaction: tx });
        }
        await ExecutorServiceCategory.findOrCreate({
          where: { executor_id: executor.id, category_id: category.id },
          defaults: { executor_id: executor.id, category_id: category.id },
          transaction: tx,
        });
      }

      created.push({ id: user.id, role: user.role, full_name: user.full_name, phone: user.phone });
    }

    await tx.commit();

    console.log(`\nОфис: ${office.name} (id=${office.id}), компания: ${company.name} (id=${company.id})`);
    console.log(`Пароль у всех: ${PASSWORD}\n`);
    console.table(created);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

main()
  .then(() => sequelize.close())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Ошибка:', err.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
