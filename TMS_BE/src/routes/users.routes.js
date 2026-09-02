import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as usersController from "../controllers/usersController.js";
import { USER_ROLES } from "../lib/roles.js";

const router = express.Router();

const phoneSchema = Joi.string()
  .allow("", null)
  .custom((value, helpers) => {
    if (value == null || String(value).trim() === "") return null;
    let digits = String(value).replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
    if (digits.length !== 10) return helpers.error("phone.invalid");
    return digits;
  })
  .messages({ "phone.invalid": "Phone must be a 10-digit number" });

router.use(auth());

router.get("/", usersController.listUsers);

router.post(
  "/",
  auth("ADMIN"),
  validate({
    body: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      phone: phoneSchema.optional(),
      role: Joi.string().valid(...USER_ROLES),
      teamId: Joi.number().integer().allow(null),
    }),
  }),
  usersController.createUser
);

router.patch(
  "/",
  auth("ADMIN"),
  validate({
    body: Joi.object({
      id: Joi.number().integer().required(),
      role: Joi.string().valid(...USER_ROLES),
      teamId: Joi.number().integer().allow(null),
      isActive: Joi.boolean(),
      password: Joi.string().min(6),
      phone: phoneSchema,
    }),
  }),
  usersController.updateUser
);

router.delete(
  "/",
  auth("ADMIN"),
  validate({
    query: Joi.object({
      id: Joi.number().integer().required(),
    }),
  }),
  usersController.deleteUser
);

export default router;
