import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { calculateHearts } from "../utils/heartSystem.js";
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
  role: u.role,
  has_password: !!u.password_hash,
  has_google: !!u.google_id,
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
    }
    res.json(newUser);
  } catch (err) {
    res.status(400).json({ error: "Username likely already exists." });
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
    const stats = calculateHearts(user);
    if (stats.hearts !== user.hearts) {
        await User.updateHearts(user.id, stats.hearts, stats.last_heart_update);
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token, req.secure);

    res.json({ 
        token, 
        user: safeUser({ ...user, hearts: stats.hearts, last_heart_update: stats.last_heart_update })
    });
  } catch (err) {
    console.error("login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const stats = calculateHearts(user);
    
    if (stats.hearts !== user.hearts) {
       await User.updateHearts(user.id, stats.hearts, stats.last_heart_update);
    }

    res.json(safeUser({ ...user, hearts: stats.hearts, last_heart_update: stats.last_heart_update }));
  } catch (err) {
    console.error("getMe error:", err);
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
    console.error("updateProfile error:", err);
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
    console.error("completeProfile error:", err);
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
    } catch (err) {
        console.error("loseHeart error:", err);
        res.status(500).json({ error: "Failed to update hearts" });
    }
};

export const addXp = async (req, res) => {
    const { amount } = req.body;
    try {
        await User.addXp(req.user.id, amount);
        res.json({ success: true });
    } catch (err) {
        console.error("addXp error:", err);
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
    } catch (err) {
        console.error("uploadAvatar error:", err);
        res.status(500).json({ error: "Failed to upload avatar" });
    }
};