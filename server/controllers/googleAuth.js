import jwt from "jsonwebtoken";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const setAuthCookie = (res, token, secure) => {
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: TOKEN_MAX_AGE_MS,
  });
};

const safeUser = (u) => ({
  id: u.id,
  username: u.username,
  email: u.email,
  avatar_url: u.avatar_url,
  hearts: u.hearts,
  xp: u.xp || 0,
  last_heart_update: u.last_heart_update,
  role: u.role,
});

// Step 1: Redirect user to Google consent screen
export const googleAuth = (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
  const scope = "openid email profile";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

// Step 2: Handle Google's callback
export const googleCallback = async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`${CLIENT_URL}/login?error=google_denied`);
  }

  if (!code) {
    return res.redirect(`${CLIENT_URL}/login?error=no_code`);
  }

  try {
    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`;

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData);
      return res.redirect(`${CLIENT_URL}/login?error=token_exchange_failed`);
    }

    // Fetch user info from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userRes.json();

    if (!googleUser.id || !googleUser.email) {
      return res.redirect(`${CLIENT_URL}/login?error=no_user_data`);
    }

    const { id: googleId, email, name, picture } = googleUser;

    // Find existing user by google_id or email
    let user = await User.findByGoogleId(googleId);
    if (!user) {
      user = await User.findByEmail(email);
      if (user) {
        // Link Google account to existing email user
        await User.linkGoogleAccount(user.id, googleId, picture);
        user.google_id = googleId;
        user.avatar_url = picture;
      }
    }

    if (!user) {
      // Create new user
      const username = name?.replace(/\s+/g, "").toLowerCase() || email.split("@")[0];
      // Ensure username is unique
      let baseUsername = username;
      let counter = 1;
      while (await User.findByUsername(baseUsername)) {
        baseUsername = `${username}${counter}`;
        counter++;
      }

      user = await User.createGoogleUser(baseUsername, email, picture, googleId);
    }

    // Issue JWT
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    setAuthCookie(res, token, req.secure);

    // Streak + daily bonus XP
    const streakInfo = await User.updateStreak(user.id);

    // New Google users need to pick a username; existing users go to dashboard
    const isNewUser = !user.profile_complete;

    const redirectTarget = isNewUser ? '/complete-profile' : '/dashboard';
    const queryParams = streakInfo && streakInfo.bonusXp > 0
      ? `?streak=${streakInfo.streak}&bonus=${streakInfo.bonusXp}`
      : '';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Signing in...</title></head>
      <body>
        <p>Signing you in...</p>
        <script>
          window.location.href = "${CLIENT_URL}${redirectTarget}${queryParams}";
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${CLIENT_URL}/login?error=server_error`);
  }
};
