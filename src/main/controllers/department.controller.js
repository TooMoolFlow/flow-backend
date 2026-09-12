import { asyncHandler } from "../middleware/asyncHandler.middleware.js";
import DepartmentService from "../services/department.service.js";

class DepartmentController {
  static getDepartmentHeads = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const departmentHeads = await DepartmentService.getDepartmentHeadsByUserOffice(userId);

    res.json({
      success: true,
      data: departmentHeads
    });
  });
}

export default DepartmentController;
