import ExecutorCategoryService from '../services/executorCategory.service.js';
import { ForbiddenError } from '../errors/errors.js';

/**
 * Validates that a department-head may assign the executor to the request.
 * Requires same office and executor linked to request category (M2M).
 */
export async function assertDepartmentHeadCanAssignExecutor(
  headUser,
  executor,
  request,
  transaction = null
) {
  if (headUser.role !== 'department-head') {
    return;
  }

  const requestGroup = request.requestGroup;
  if (
    !requestGroup ||
    headUser.office_id == null ||
    Number(requestGroup.office_id) !== Number(headUser.office_id)
  ) {
    throw new ForbiddenError('Forbidden');
  }

  if (
    !executor.user ||
    Number(executor.user.office_id) !== Number(headUser.office_id)
  ) {
    throw new ForbiddenError('Forbiddenn');
  }

  const hasCategory = await ExecutorCategoryService.hasCategory(
    executor.id,
    request.category_id,
    transaction
  );
  if (!hasCategory) {
    throw new ForbiddenError('Forbiddennn');
  }
}
