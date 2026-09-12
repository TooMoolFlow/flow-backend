import { v2 as cloudinary } from "cloudinary";
import { RequestPhoto } from "../models/requestPhoto.model.js";

class PhotoCleaner {
    static async cleanOrphanPhotos() {
        try {
            const result = await cloudinary.search
                .expression("folder:request_photos")
                .max_results(100)
                .execute();

            for (const resource of result.resources) {
                const publicId = resource.public_id;

                // Проверяем в БД по photo_url
                const exists = await RequestPhoto.findOne({
                    where: { photo_url: resource.secure_url },
                });

                if (!exists) {
                    console.log(`🧹 Удаляю висячее фото: ${publicId}`);
                    await cloudinary.uploader.destroy(publicId);
                }
            }
        } catch (err) {
            console.error("Ошибка при очистке фото:", err.message);
        }
    }
}

export default PhotoCleaner;