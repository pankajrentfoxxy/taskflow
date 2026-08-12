import dotenv from "dotenv";
import path from "path";
import Joi from "joi";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid("production", "development", "test").default("development"),
    PORT: Joi.number().default(4000),
    JWT_SECRET: Joi.string().required(),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(43200),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),
    DB_HOST: Joi.string().default("localhost"),
    DB_PORT: Joi.number().default(5432),
    DB_NAME: Joi.string().required(),
    DB_USER: Joi.string().required(),
    DB_PASSWORD: Joi.string().allow("").required(),
    CORS_ORIGIN: Joi.string().default("http://localhost:3001"),
    UPLOAD_DIR: Joi.string().default("uploads"),
    MAX_UPLOAD_BYTES: Joi.number().default(26214400),
    CRON_SECRET: Joi.string().allow("").default(""),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: "key" } }).validate(process.env);
if (error) throw new Error(`Config validation error: ${error.message}`);

export default {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
  },
  db: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    name: envVars.DB_NAME,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
  },
  corsOrigin: envVars.CORS_ORIGIN.split(",").map((o) => o.trim()),
  uploadDir: envVars.UPLOAD_DIR,
  maxUploadBytes: envVars.MAX_UPLOAD_BYTES,
  cronSecret: envVars.CRON_SECRET,
};
