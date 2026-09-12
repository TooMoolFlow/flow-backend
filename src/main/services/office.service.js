import fs from 'fs/promises';
import { Office } from '../models/init.model.js';
import { BadRequestError, NotFoundError } from '../errors/errors.js';
import MeetingRoomService from './meetingRoom.service.js';
import { uploadToCloudinary, deleteFromCloudinaryByUrl } from '../utils/cloudinaryUpload.js';

class OfficeService {
  static async getAllOffices() {
    return await Office.findAll();
  }

  static async getOfficeById(id) {
    const office = await Office.findByPk(id);
    if (!office) {
      throw new NotFoundError('No Office with id ' + id);
    }
    return office;
  }

  static async getOfficeRooms(id) {
    await this.getOfficeById(id);
    return await MeetingRoomService.getRoomsByOfficeId(id);
  }

  static async createOffice(officeData, file = null) {
    const name = (officeData.name || '').trim();
    const address = (officeData.address || '').trim();
    const city = (officeData.city || '').trim();
    if (!name || !address || !city) {
      throw new BadRequestError('Заполните название, адрес и город');
    }

    let photoUrl = null;
    if (file) {
      try {
        const result = await uploadToCloudinary(file.path, { folder: 'office_photos' });
        photoUrl = result.secure_url;
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('file size too large') || msg.includes('maximum is')) {
          throw new BadRequestError(
            'Размер фотографии превышает допустимый лимит (10 МБ). Выберите фото меньшего размера.',
          );
        }
        throw err;
      } finally {
        await fs.unlink(file.path).catch(() => {});
      }
    } else if (officeData.photo && officeData.photo.startsWith('http')) {
      photoUrl = officeData.photo;
    }

    const blockVal = officeData.block;
    const floorRaw = officeData.floor;
    let floorVal = null;
    if (floorRaw !== undefined && floorRaw !== null && floorRaw !== '') {
      const n = Number(floorRaw);
      if (!Number.isNaN(n)) floorVal = n;
    }

    const office = await Office.create({
      name: officeData.name,
      address: officeData.address,
      city: officeData.city,
      block: blockVal === undefined || blockVal === null || blockVal === '' ? null : String(blockVal).trim() || null,
      floor: floorVal,
      lat: officeData.lat || null,
      lon: officeData.lon || null,
      photo: photoUrl,
    });
    return office;
  }

  static async updateOffice(id, updateData, file = null) {
    const existingOffice = await Office.findByPk(id);
    if (!existingOffice) {
      throw new NotFoundError('No Office with id ' + id);
    }

    const updateFields = {};
    if (updateData.name !== undefined) updateFields.name = updateData.name;
    if (updateData.city !== undefined) updateFields.city = updateData.city;
    if (updateData.address !== undefined) updateFields.address = updateData.address;
    if (updateData.block !== undefined) {
      const b = updateData.block;
      updateFields.block = b === '' || b === null ? null : String(b).trim() || null;
    }
    if (updateData.floor !== undefined) {
      const raw = updateData.floor;
      if (raw === '' || raw === null || raw === 'null') {
        updateFields.floor = null;
      } else {
        const n = Number(raw);
        updateFields.floor = Number.isNaN(n) ? null : n;
      }
    }
    if (updateData.lat !== undefined) updateFields.lat = updateData.lat;
    if (updateData.lon !== undefined) updateFields.lon = updateData.lon;
    if (updateData.working_hours_start !== undefined) updateFields.working_hours_start = updateData.working_hours_start;
    if (updateData.working_hours_end !== undefined) updateFields.working_hours_end = updateData.working_hours_end;
    if (updateData.auto_track_enabled !== undefined) updateFields.auto_track_enabled = updateData.auto_track_enabled;

    if (file) {
      try {
        if (existingOffice.photo && existingOffice.photo.includes('cloudinary.com')) {
          await deleteFromCloudinaryByUrl(existingOffice.photo);
        }
        const result = await uploadToCloudinary(file.path, { folder: 'office_photos' });
        updateFields.photo = result.secure_url;
      } catch (err) {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('file size too large') || msg.includes('maximum is')) {
          throw new BadRequestError(
            'Размер фотографии превышает допустимый лимит (10 МБ). Выберите фото меньшего размера.',
          );
        }
        throw err;
      } finally {
        await fs.unlink(file.path).catch(() => {});
      }
    } else if (updateData.photo === null || updateData.photo === '') {
      if (existingOffice.photo && existingOffice.photo.includes('cloudinary.com')) {
        await deleteFromCloudinaryByUrl(existingOffice.photo);
      }
      updateFields.photo = null;
    }

    const [affectedRows] = await Office.update(updateFields, { where: { id } });
    if (affectedRows === 0) {
      throw new NotFoundError('No Office with id ' + id);
    }
    return await Office.findByPk(id);
  }

  static async updateWorkingHours(id, workingHoursData) {
    const updateData = {};
    if (workingHoursData.working_hours_start !== undefined) updateData.working_hours_start = workingHoursData.working_hours_start;
    if (workingHoursData.working_hours_end !== undefined) updateData.working_hours_end = workingHoursData.working_hours_end;
    if (workingHoursData.auto_track_enabled !== undefined) updateData.auto_track_enabled = workingHoursData.auto_track_enabled;

    await Office.update(updateData, { where: { id } });
    return await this.getOfficeById(id);
  }

  static async deleteOffice(id) {
    const office = await Office.findByPk(id);
    if (!office) {
      throw new NotFoundError('No Office with id ' + id);
    }
    if (office.photo && office.photo.includes('cloudinary.com')) {
      await deleteFromCloudinaryByUrl(office.photo);
    }
    return await Office.destroy({ where: { id } });
  }
}

export default OfficeService;
