-- Healthy: таймзона в профиле не использовалась в расчётах (инсайты по датам сервера);
-- ключи вида YYYY-MM-DD приходят с клиента уже в локальном календаре пользователя.
ALTER TABLE IF EXISTS public.healthy_profiles
    DROP COLUMN IF EXISTS timezone;
