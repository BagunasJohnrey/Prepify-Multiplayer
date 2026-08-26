
# 🚀 Prepify - AI-Powered Exam Simulator

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)
![Node](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791)
![Tailwind](https://img.shields.io/badge/Style-TailwindCSS%20v4-38B2AC)

**Prepify** is an intelligent study platform that bridges the gap between passive reading and active testing. By uploading PDF course materials, Prepify uses advanced AI to instantly generate structured quizzes, complete with explanations, difficulty settings, and a gamified "lives" system.

## ✨ Key Features

* **📄 AI Quiz Generation**: Upload any PDF (up to 5MB), and our AI (powered by Google Gemini & Groq) parses the text to create a structured JSON exam.
* **Gamified Learning**:
    * **Heart System**: Users start with 3 hearts. Incorrect answers cost a heart.
    * **Regeneration**: Hearts regenerate automatically over time (2 minutes per heart).
* **PDF Adaptive Configuration**: Choose your subject type (Major, Minor, GED), difficulty level, and number of questions.
* **Interactive Dashboard**: View recent exams, track progress, and manage your quiz library.
* **UI Modern Aesthetics**: A fully responsive Cyberpunk/Neon-Dark interface built with Tailwind CSS v4.
* **Secure Authentication**: JWT-based authentication with Bcrypt password hashing.

## 🛠️ Tech Stack

### Client
* **Framework**: React 19 (Vite)
* **Styling**: Tailwind CSS v4
* **Routing**: React Router DOM v7
* **HTTP Client**: Axios
* **Icons**: Lucide React

### Server
* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: PostgreSQL (`pg`)
* **AI Integration**: Google Gemini & Groq APIs (Gemini Flash and Llama 3.3, with mutual fallback)
* **File Handling**: Multer (Memory Storage) & PDF2JSON
* **Validation**: Zod

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+)
* PostgreSQL installed and running locally or in the cloud (e.g., Neon, Supabase).

### 1. Clone the Repository
```bash
git clone [https://github.com/bagunasjohnrey/prepify.git](https://github.com/bagunasjohnrey/prepify.git)
cd prepify
````

### 2\. Database Setup

Create a PostgreSQL database and run the following SQL commands to set up the necessary tables:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    hearts INTEGER DEFAULT 3,
    xp INTEGER DEFAULT 0,
    last_heart_update TIMESTAMP DEFAULT NOW()
);

CREATE TABLE quizzes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    course VARCHAR(100),
    difficulty VARCHAR(50),
    description TEXT,
    questions JSONB NOT NULL,
    items_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Optional: uncomment if you implement result persistence in the future.
-- CREATE TABLE results (
--     id SERIAL PRIMARY KEY,
--     quiz_id INTEGER REFERENCES quizzes(id),
--     user_id INTEGER REFERENCES users(id),
--     score INTEGER,
--     created_at TIMESTAMP DEFAULT NOW()
-- );
```

### 3\. Backend Setup

Navigate to the root directory, install dependencies, and configure the environment.

```bash
npm install
```

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/your_db_name
JWT_SECRET=your_secure_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
CLIENT_URL=https://your-frontend-domain.com
RENDER_EXTERNAL_HOSTNAME=your-app.onrender.com
# Set to "false" only for local dev with a self-signed DB cert
DB_SSL_REJECT_UNAUTHORIZED=true
# Optional: used by `npm run seed` to create/promote an admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_me
```

Start the server:

```bash
npm run dev
```

### 3b. Database Migrations & Admin

The schema in step 2 is the source of truth, but if you already have a database, apply the required column with the idempotent migration:

```bash
npm run migrate
```

The `deleteQuiz` endpoint is admin-only. Nothing creates admins automatically, so seed one (safe to re-run; an existing user is promoted):

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=strongpassword npm run seed
```

Add `ADMIN_USERNAME` / `ADMIN_PASSWORD` to your `.env` for convenience.

### 4\. Frontend Setup

Open a new terminal, navigate to the client folder, and install dependencies.

```bash
cd client
npm install
```

Create a `.env` file in the `client` directory:

```env
VITE_API_URL=http://localhost:3000/api
```

Start the client:

```bash
npm run dev
```

Visit `http://localhost:5173` to view the app.

## 📂 Project Structure

```
prepify/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/ui/  # Reusable UI components (Buttons, Inputs)
│   │   ├── context/        # Auth Context
│   │   ├── layout/         # Navbar, Footer
│   │   ├── pages/          # Dashboard, Quiz, Login, etc.
│   │   └── utils/          # API configuration
│   └── vite.config.js
├── server/                 # Express Backend
│   ├── config/             # Database connection
│   ├── controllers/        # Logic for Auth and Quizzes
│   ├── middleware/         # Auth verification & File Uploads
│   ├── models/             # DB Queries (User, Quiz)
│   ├── routes/             # API Routes
│   └── utils/              # AI Service, PDF Parser, Heart System
└── package.json
```

## 🤖 AI Model Configuration

Quiz generation calls **Google Gemini** and **Groq** directly. Each generation attempt alternates the primary provider and **falls back to the other** on any failure, so the two back each other up.

- **Gemini**: `gemini-2.5-flash` (fallback `gemini-2.5-flash-lite`) via `GEMINI_API_KEY`.
- **Groq**: `openai/gpt-oss-120b` (fallbacks `qwen/qwen3.8-27b`, `qwen/qwen3.6-27b`, `openai/gpt-oss-20b`, `groq/compound-mini`) via `GROQ_API_KEY`.

Set both keys in your `.env` (see `.env.example`). Each provider tries its candidate model list in order and falls back to the other provider on failure. If only one key is present, the app uses it with no fallback. Override the lists with `GEMINI_MODELS` / `GROQ_MODELS` (comma-separated) if your account lacks the defaults.

## 🚀 Deployment

This app uses **Socket.IO** with in-memory game state, so it requires a **stateful, long-running host**. Deploy the `server` (which also serves the built `client/dist`) on **Render** (or Railway/Fly). The built-in self-ping keeps the free tier awake.

> ⚠️ Do **not** deploy the realtime backend to Vercel — Vercel's serverless functions do not support persistent WebSocket connections or shared in-memory room state, so multiplayer and `/api/generate` will break. `vercel.json` is kept only if you choose to host the static client separately.

Build the client before deploying:

```bash
npm run build
```

Set the environment variables listed above. `CLIENT_URL` / `RENDER_EXTERNAL_HOSTNAME` are used for CORS and the self-ping.

The `xp` migration runs automatically on `npm start` (it is idempotent, so it's safe to run on every deploy). If you prefer to run it manually, use `npm run migrate`. Seed an admin once:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=change_me npm run seed
```

> Note: `vercel.json` was removed — this app is intended for a stateful host (Render), not Vercel.

## 🤝 Contributing

Contributions are welcome\! Please fork the repository and submit a pull request for any enhancements or bug fixes.

## 📝 License

This project is open-source and available under the [MIT License](LICENSE).

-----

*Made with 💙 by [John Rey Bagunas](https://github.com/BagunasJohnrey)*

