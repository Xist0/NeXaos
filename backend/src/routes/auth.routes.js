const router = require("express").Router();
const asyncHandler = require("../utils/async-handler");
const { authGuard, optionalAuth } = require("../middleware/auth.middleware");
const {
  login,
  logout,
  refresh,
  getProfile,
} = require("../controllers/auth.controller");
const { register } = require("../controllers/user.controller");

router.post("/login", asyncHandler(login));
router.post("/register", register);
router.post("/refresh", asyncHandler(refresh));
router.post("/logout", optionalAuth, asyncHandler(logout));
router.get("/me", optionalAuth, asyncHandler(getProfile));

module.exports = router;

