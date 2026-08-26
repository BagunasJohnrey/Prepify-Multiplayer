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
  hearts: u.hearts,
  xp: u.xp || 0,
  last_heart_update: u.last_heart_update,
  role: u.role
});

const setAuthCookie = (res, token) => {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TOKEN_MAX_AGE_MS
  });
};

export const register = async (req, res) => {
  const { username, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const newUser = await User.create(username, hash);
    res.json(newUser);
  } catch (err) {
    res.status(400).json({ error: "Username likely already exists." });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findByUsername(username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    // Handle heart logic
    const stats = calculateHearts(user);
    if (stats.hearts !== user.hearts) {
        await User.updateHearts(user.id, stats.hearts, stats.last_heart_update);
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token);

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
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });
    res.json({ success: true });
};