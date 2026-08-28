import express from "express";
import multer from "multer";
import * as authController from "../controllers/authController.js";
import { googleAuth, googleCallback } from "../controllers/googleAuth.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  completeProfileSchema,
  addFriendSchema,
  removeFriendSchema,
  buyHeartSchema,
  addXpSchema,
  loseHeartSchema,
  toggleBookmarkSchema,
  getLeaderboardSchema,
  getQuizLeaderboardSchema,
  searchUsersSchema,
  validate
} from "../middleware/validate.js";

const router = express.Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
    }
  },
});

// Email/password auth
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.post("/logout", authController.logout);

// Google OAuth
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

// Protected routes
router.get("/me", verifyToken, authController.getMe);
router.put("/profile", verifyToken, validate(updateProfileSchema), authController.updateProfile);
router.post("/complete-profile", verifyToken, validate(completeProfileSchema), authController.completeProfile);
router.post("/lose-heart", verifyToken, validate(loseHeartSchema), authController.loseHeart); 
router.post("/add-xp", verifyToken, validate(addXpSchema), authController.addXp);
router.post("/buy-heart", verifyToken, validate(buyHeartSchema), authController.buyHeart);
router.post("/avatar", verifyToken, avatarUpload.single("avatar"), authController.uploadAvatar);
router.post("/bookmark", verifyToken, validate(toggleBookmarkSchema), authController.toggleBookmark);
router.get("/bookmarks", verifyToken, authController.getBookmarks);
router.post("/verify-email", validate(verifyEmailSchema), authController.verifyEmail);
router.post("/resend-verification", verifyToken, validate(resendVerificationSchema), authController.resendVerification);
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);
router.get("/leaderboard", verifyToken, validate(getLeaderboardSchema), authController.getLeaderboard);
router.get("/leaderboard/:quizId", validate(getQuizLeaderboardSchema), authController.getQuizLeaderboard);
router.get("/friends", verifyToken, authController.getFriends);
router.get("/friends/search", verifyToken, validate(searchUsersSchema), authController.searchUsers);
router.post("/friends", verifyToken, validate(addFriendSchema), authController.addFriend);
router.delete("/friends/:friendId", verifyToken, validate(removeFriendSchema), authController.removeFriend);
router.get("/friends/online", verifyToken, authController.getOnlineFriends);

export default router;