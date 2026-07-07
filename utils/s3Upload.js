const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");

const s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "dummy-key",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "dummy-secret"
    }
});

async function uploadToS3(filePath, originalFilename, mimetype) {
    const bucketName = process.env.AWS_S3_BUCKET_NAME || "creator-os-vault";
    const fileStream = fs.createReadStream(filePath);
    
    // Add a unique timestamp to avoid collisions
    const key = `vault/${Date.now()}-${path.basename(originalFilename)}`;
    
    const uploadParams = {
        Bucket: bucketName,
        Key: key,
        Body: fileStream,
        ContentType: mimetype
    };
    
    try {
        await s3Client.send(new PutObjectCommand(uploadParams));
        
        // Build the public URL
        const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${key}`;
        
        return fileUrl;
    } catch (error) {
        console.error("Error uploading to S3:", error);
        throw error;
    }
}

module.exports = { uploadToS3 };
