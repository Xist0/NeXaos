const router = require("express").Router();
const asyncHandler = require("../utils/async-handler");
const { authGuard } = require("../middleware/auth.middleware");
const {
  login,
  logout,
  getProfile,
} = require("../controllers/auth.controller");

router.post("/login", asyncHandler(login));
router.post("/logout", authGuard, asyncHandler(logout));
router.get("/me", authGuard, asyncHandler(getProfile));

module.exports = router;

