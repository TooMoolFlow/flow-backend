# Workflow Service

Backend-сервис для управления рабочими процессами и заявками.

## Технологии

- **Node.js** (ES Modules)
- **Express.js** — веб-фреймворк
- **PostgreSQL** — база данных
- **Sequelize** — ORM
- **Firebase Admin** — push-уведомления
- **JWT** — аутентификация
- **Swagger** — документация API
- **Winston** — логирование

## Основной функционал

- Управление заявками и их жизненным циклом
- Управление пользователями, офисами, отделами
- Система рейтингов для исполнителей и клиентов
- Комментарии к заявкам
- Push-уведомления через Firebase Cloud Messaging
- Повторяющиеся задачи (recurring tasks)
- Группировка заявок
- Аналитика
- Интеграция с AI (Gemini) для обработки запросов
- Загрузка и обработка фотографий (Cloudinary)

## Быстрый старт

### Требования

- Node.js (версия 18+)
- PostgreSQL 15
- Docker и Docker Compose (для локальной разработки)

### Установка

1. Клонируйте репозиторий
2. Установите зависимости:
   ```bash
   npm install
   ```

3. Создайте файл `.env` в корне проекта со следующими переменными:
   ```env
   # База данных
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password

   # Сервер
   PORT=3001
   NODE_ENV=development

   # JWT
   JWT_SECRET=your_jwt_secret

   # Firebase (для push: iOS, Android, Web)
   # Вариант 1: полный JSON ключа сервисного аккаунта (рекомендуется для Render)
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
   # Вариант 2: путь к файлу (локально или GOOGLE_APPLICATION_CREDENTIALS)
   # Вариант 3: Render Secret File — смонтировать как /etc/secrets/serviceAccountKey.json
   # Без валидного ключа ошибка: "Request is missing required authentication credential" при отправке на iOS/Android

   # Gemini AI
   GEMINI_API_KEY=your_gemini_api_key

   # Cloudinary (для загрузки фото)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Яндекс Умный Дом
   YANDEX_CLIENT_ID=your_yandex_client_id
   YANDEX_CLIENT_SECRET=your_yandex_client_secret
   ```

4. Запустите PostgreSQL через Docker Compose:
   ```bash
   docker-compose up -d
   ```

5. Запустите сервер:
   ```bash
   npm run dev
   ```

При запуске автоматически выполняются миграции базы данных из папки `src/main/migrations`.

## API Документация

После запуска сервера Swagger UI доступен по адресу:
```
http://localhost:3001/api-docs
```

## Структура проекта

```
src/main/
├── config/          # Конфигурация (БД, Firebase, Sequelize)
├── controllers/     # Контроллеры для обработки запросов
├── dto/            # Data Transfer Objects
├── middleware/     # Middleware (auth, error handling, validation)
├── migrations/     # SQL миграции базы данных
├── models/         # Sequelize модели
├── routes/         # Маршруты Express
├── services/       # Бизнес-логика
└── utils/          # Утилиты (JWT, bcrypt, logger, AI)
```

## Cron задачи

- **00:00 ежедневно** — проверка и создание экземпляров повторяющихся задач
- **Каждые 30 минут** — очистка висячих фотографий (в production)

## Скрипты

- `npm run dev` — запуск сервера в режиме разработки
- `npm run lint` — проверка кода линтером

## Особенности

- Автоматические миграции при старте приложения
- Логирование всех запросов через Winston
- Централизованная обработка ошибок
- Валидация данных через Zod
- Поддержка CORS для фронтенд-приложений

