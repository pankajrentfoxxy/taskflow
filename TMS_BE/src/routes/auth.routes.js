import express from "express";
import Joi from "joi";
import auth from "../middlewares/auth.js";
import validate from "../middlewares/validate.js";
import * as authController from "../controllers/authController.js";

const router = express.Router();

router.post(
  "/login",
  validate({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  }),
  authController.login
);

router.post("/logout", authController.logout);

export default router;
