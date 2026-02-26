const Joi = require("joi");
const ApiError = require("../utils/api-error");
const { createUser, resetUserPassword } = require("../services/user.service"); // ← должен быть в user.service.js

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  fullName: Joi.string().required(),
  phone: Joi.string().required().pattern(/^\+7\d{10}$/).message("Phone must be in format +7XXXXXXXXXX"),
});

const register = async (req, res) => {
  const { error, value } = registerSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw ApiError.badRequest("Validation failed", error.details);
  }

  try {
    const user = await createUser(value); // ← создаёт с role_id = "user"
    res.status(201).json({ message: "User registered successfully", user });
  } catch (err) {
    if (err.message?.includes("duplicate key")) {
      throw ApiError.conflict("Email already in use");
    }
    throw err;
  }
};

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).required(),
});

const resetPassword = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw ApiError.badRequest("user id is invalid");
  }

  const { error, value } = resetPasswordSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw ApiError.badRequest("Validation failed", error.details);
  }

  await resetUserPassword({ userId: id, password: value.password });
  res.status(204).send();
};

module.exports = { register, resetPassword };