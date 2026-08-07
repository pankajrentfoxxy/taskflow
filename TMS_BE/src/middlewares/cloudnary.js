import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLD_API_KEY,
  api_secret: process.env.CLD_API_SECRET,
});

const uploadImageToCloudinary = async (req, res) => {
  return new Promise((resolve, reject) => {
    if (!req.file) {
      return reject(new Error("No image provided"));
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return reject(new Error("Only JPG, PNG, and JPEG files are allowed"));
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: "Uploads" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(new Error("Failed to upload to Cloudinary"));
        }
        resolve(result.secure_url);
      }
    );

    stream.end(req.file.buffer);
  });
};

export default uploadImageToCloudinary;
