import express from "express";
import * as authController from "../controllers/authController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", verifyToken, authController.getMe);
router.post("/lose-heart", verifyToken, authController.loseHeart); 
router.post("/add-xp", verifyToken, authController.addXp);
router.post("/buy-heart", verifyToken, authController.buyHeart);
router.post("/logout", authController.logout);

export default router;