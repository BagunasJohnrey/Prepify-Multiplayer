import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { calculateHearts } from "../utils/heartSystem.js";
import { sendMail, emailVerificationTemplate, passwordResetTemplate } from "../utils/mailer.js";
import { isOnline } from "../utils/presence.js";
import dotenv from "dotenv";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const safeUser = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  avatar_url: u.avatar_url,
  hearts: u.hearts,
  xp: u.xp || 0,
  last_heart_update: u.last_heart_update,
  login_streak: u.login_streak || 0,
  longest_streak: u.longest_streak || 0,
  bookmarked_quizzes: u.bookmarked_quizzes || [],
  role: u.role,
  has_password: !!u.password_hash,
  has_google: !!u.google_id,
  email_verified: !!u.email_verified,
  profile_complete: !!u.profile_complete,
});

const setAuthCookie = (res, token, secure) => {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: TOKEN_MAX_AGE_MS
  });
};

export const register = async (req, res) => {
  const { username, password, email } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create(username, hash);
    if (email) {
      await User.updateProfile(newUser.id, { email });
      // Send verification email
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await User.setVerificationToken(newUser.id, token, expires);
      await sendMail({ to: email, ...emailVerificationTemplate(token) });
    }
    res.status(201).json(newUser);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Username already exists." });
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Token required" });
    const user = await User.findByVerificationToken(token);
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    await User.markEmailVerified(user.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to verify email" });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.email) return res.status(400).json({ error: "No email on file" });
    if (user.email_verified) return res.status(400).json({ error: "Email already verified" });
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await User.setVerificationToken(user.id, token, expires);
    await sendMail({ to: user.email, ...emailVerificationTemplate(token) });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to send email" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const user = await User.findByEmail(email);
    // Always return success to avoid email enumeration
    if (user && user.password_hash) {
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await User.setResetToken(user.id, token, expires);
      await sendMail({ to: email, ...passwordResetTemplate(token) });
    }
    res.json({ success: true, message: "If that email exists, a reset link was sent." });
  } catch {
    res.status(500).json({ error: "Failed to process request" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Token and password required" });
    const user = await User.findByResetToken(token);
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });
    const hash = await bcrypt.hash(password, 10);
    await User.updatePassword(user.id, hash);
    await User.clearResetToken(user.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to reset password" });
  }
};

export const getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const sort = req.query.sort === 'streak' ? 'streak' : 'xp';
    const offset = (page - 1) * limit;
    const leaderboard = await User.getLeaderboard(limit, offset, sort);
    const total = await User.getLeaderboardCount();
    const rank = req.user ? await User.getRank(req.user.id, sort) : null;
    res.json({ leaderboard, userRank: rank, total, page, totalPages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
};

export const getQuizLeaderboard = async (req, res) => {
  try {
    const quizId = req.params.quizId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const leaderboard = await User.getQuizLeaderboard(quizId, limit);
    res.json(leaderboard);
  } catch {
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
};

export const getFriends = async (req, res) => {
  try {
    const friends = await User.getFriends(req.user.id);
    res.json(friends);
  } catch {
    res.status(500).json({ error: "Failed to load friends" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.json({ users: [] });
    }
    const users = await User.searchUsers(q.trim(), req.user.id);
    res.json({ users });
  } catch {
    res.status(500).json({ error: "Failed to search users" });
  }
};

export const addFriend = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "Username required" });
    const friend = await User.findByUsernameExact(username);
    if (!friend) return res.status(404).json({ error: "User not found" });
    const updated = await User.addFriend(req.user.id, friend.id);
    res.json({ friends: updated });
  } catch (err) {
    res.status(500).json({ error: err.message || "Failed to add friend" });
  }
};

export const removeFriend = async (req, res) => {
  try {
    const friendId = parseInt(req.params.friendId);
    const updated = await User.removeFriend(req.user.id, friendId);
    res.json({ friends: updated });
  } catch {
    res.status(500).json({ error: "Failed to remove friend" });
  }
};

export const getOnlineFriends = async (req, res) => {
  try {
    const friends = await User.getFriends(req.user.id);
    const online = friends.filter(f => isOnline(f.username)).map(f => f.username);
    res.json({ online });
  } catch {
    res.status(500).json({ error: "Failed to load status" });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    const user = await User.findByUsername(username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    if (!user.password_hash) {
      return res.status(401).json({ error: "This account uses Google Sign-In. Please log in with Google." });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    // Handle heart logic
    const raw = await User.getRawHearts(user.id);
    const stats = calculateHearts(raw.hearts, Number(raw.last_ms));
    if (stats.hearts !== raw.hearts) {
        await User.updateHearts(user.id, stats.hearts, new Date(stats.lastMs));
    }

    // Streak + daily bonus XP
    const streakInfo = await User.updateStreak(user.id);

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token, req.secure);

    res.json({ 
        user: safeUser({ ...user, hearts: stats.hearts, last_heart_update: new Date(stats.lastMs), login_streak: streakInfo?.streak, longest_streak: streakInfo?.longest }),
        streakBonus: streakInfo?.bonusXp || 0,
        loginStreak: streakInfo?.streak || 0
    });
  } catch {
    res.status(500).json({ error: "Login failed" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const raw = await User.getRawHearts(req.user.id);
    const stats = calculateHearts(raw.hearts, Number(raw.last_ms));
    
    if (stats.hearts !== raw.hearts) {
       await User.updateHearts(user.id, stats.hearts, new Date(stats.lastMs));
    }

    res.json(safeUser({ ...user, hearts: stats.hearts, last_heart_update: new Date(stats.lastMs) }));
  } catch {
    res.status(500).json({ error: "Failed to load user" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { username, email } = req.body;
    const fields = {};
    if (username) fields.username = username;
    if (email) fields.email = email;

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    await User.updateProfile(req.user.id, fields);
    const user = await User.findById(req.user.id);
    res.json(safeUser(user));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Username or email already taken." });
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const completeProfile = async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length < 2) {
      return res.status(400).json({ error: "Username must be at least 2 characters." });
    }

    const trimmed = username.trim();

    // Check if username is already taken by another user
    const existing = await User.findByUsername(trimmed);
    if (existing && existing.id !== req.user.id) {
      return res.status(400).json({ error: "Username already taken." });
    }

    await User.updateProfile(req.user.id, { username: trimmed });
    await User.markProfileComplete(req.user.id);

    const user = await User.findById(req.user.id);
    res.json(safeUser(user));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Username already taken." });
    }
    res.status(500).json({ error: "Failed to complete profile" });
  }
};

export const loseHeart = async (req, res) => {
    try {
        await User.decrementHeart(req.user.id);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: "Failed to update hearts" });
    }
};

export const addXp = async (req, res) => {
    const XP_PER_QUIZ = 10;
    try {
        await User.addXp(req.user.id, XP_PER_QUIZ);
        res.json({ success: true });
    } catch {
        res.status(500).json({ error: "Failed to update XP" });
    }
};

export const buyHeart = async (req, res) => {
    const HEART_COST = 50; // Cost in XP
    try {
        await User.buyHeart(req.user.id, HEART_COST);
        res.json({ success: true });
    } catch (err) {
        // "Not enough XP" is a user-facing, safe message; keep it, hide others.
        const safe = err.message === "Not enough XP" ? err.message : "Failed to buy heart";
        res.status(400).json({ error: safe });
    }
};

export const logout = (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure,
        path: "/"
    });
    res.json({ success: true });
};

export const uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image uploaded" });
        }

        const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        await User.updateProfile(req.user.id, { avatar_url: base64 });

        const user = await User.findById(req.user.id);
        res.json(safeUser(user));
    } catch {
        res.status(500).json({ error: "Failed to upload avatar" });
    }
};

export const toggleBookmark = async (req, res) => {
  try {
    const { quizId } = req.body;
    if (!quizId) return res.status(400).json({ error: "quizId required" });
    const updated = await User.toggleBookmark(req.user.id, parseInt(quizId));
    res.json({ bookmarked_quizzes: updated });
  } catch {
    res.status(500).json({ error: "Failed to update bookmark" });
  }
};

export const getBookmarks = async (req, res) => {
  try {
    const bookmarks = await User.getBookmarks(req.user.id);
    res.json(bookmarks);
  } catch {
    res.status(500).json({ error: "Failed to load bookmarks" });
  }
};