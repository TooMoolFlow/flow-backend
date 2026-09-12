import logger from './winston/logger.js';

/**
 * Откатывает транзакцию при ошибке, логирует и пробрасывает ошибку дальше.
 * Централизованная обработка для всех сервисов (DRY).
 * @param {import('sequelize').Transaction} tx
 * @param {Error} error
 */
export async function rollbackAndRethrow(tx, error) {
  if (tx && typeof tx.rollback === 'function' && !tx.finished) {
    await tx.rollback();
  }
  logger.error('Transaction failed', { error: error?.message, stack: error?.stack });
  throw error;
}
