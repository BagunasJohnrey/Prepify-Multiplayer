import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import User from "../models/User.js";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;

if (!username || !password) {
  console.error("Missing ADMIN_USERNAME or ADMIN_PASSWORD. Provide both to seed an admin.");
  process.exit(1);
}

try {
  const existing = await User.findByUsername(username);
  if (existing) {
    await User.setAdmin(username);
    console.log(`Promoted existing user "${username}" to admin.`);
  } else {
    const hash = await bcrypt.hash(password, 10);
    const admin = await User.createAdmin(username, hash);
    console.log(`Created admin user: ${admin.username} (id ${admin.id}).`);
  }
  process.exit(0);
} catch (err) {
  console.error("Admin seed failed:", err.message);
  process.exit(1);
}
