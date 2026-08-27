import express from "express";
import multer from "multer";
import * as authController from "../controllers/authController.js";
import { googleAuth, googleCallback } from "../controllers/googleAuth.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Email/password auth
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

// Google OAuth
router.get("/google", googleAuth);
router.get("/google/callback", googleCallback);

// Protected routes
router.get("/me", verifyToken, authController.getMe);
router.put("/profile", verifyToken, authController.updateProfile);
router.post("/complete-profile", verifyToken, authController.completeProfile);
router.post("/lose-heart", verifyToken, authController.loseHeart); 
router.post("/add-xp", verifyToken, authController.addXp);
router.post("/buy-heart", verifyToken, authController.buyHeart);
router.post("/avatar", verifyToken, avatarUpload.single("avatar"), authController.uploadAvatar);
router.post("/bookmark", verifyToken, authController.toggleBookmark);
router.get("/bookmarks", verifyToken, authController.getBookmarks);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-verification", verifyToken, authController.resendVerification);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.get("/leaderboard", verifyToken, authController.getLeaderboard);
router.get("/leaderboard/:quizId", authController.getQuizLeaderboard);
router.get("/friends", verifyToken, authController.getFriends);
router.get("/friends/search", verifyToken, authController.searchUsers);
router.post("/friends", verifyToken, authController.addFriend);
router.delete("/friends/:friendId", verifyToken, authController.removeFriend);
router.get("/friends/online", verifyToken, authController.getOnlineFriends);

export default router;