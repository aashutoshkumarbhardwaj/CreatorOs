const cloudinary = require('cloudinary').v2;
const fs = require('fs');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'dummy-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'dummy-secret',
});

async function uploadToFreeStorage(filePath, originalFilename, mimetype) {
    try {
        // We use resource_type 'auto' to support images, videos, and raw files
        const result = await cloudinary.uploader.upload(filePath, {
            folder: 'creator-os-vault',
            resource_type: 'auto',
            use_filename: true,
            unique_filename: true,
        });
        
        return result.secure_url;
    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        throw error;
    }
}

module.exports = { uploadToFreeStorage };
