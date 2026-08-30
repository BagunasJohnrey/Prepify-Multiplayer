import express from "express";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import crypto from "crypto";
import dotenv from "dotenv";
import { connectRedis } from "./services/redisClient.js";
import { 
  apiLimiter, 
  authLimiter, 
  passwordResetLimiter, 
  generateLimiter,
  socketLimiter 
} from "./services/rateLimiter.js";
import { validateSocketEvent, socketSchemas } from "./middleware/validate.js";
import authRoutes from "./routes/authRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import Quiz from "./models/Quiz.js"; 
import { userOnline, userOffline, getSocketIds } from "./utils/presence.js";
import path from "path"; 
import { fileURLToPath } from "url"; 

dotenv.config();

// Validate critical environment variables on startup
if (!process.env.JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET is missing. Set a strong secret (min 32 chars) in .env");
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error("FATAL: JWT_SECRET must be at least 32 characters long");
}
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) {
  throw new Error("FATAL: CLIENT_URL must be set in production");
}

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const httpServer = createServer(app);

// Helper to define __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trust proxy headers from Render/load balancer (use numeric value for exact proxy count)
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 'loopback');

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'; 

// CORS origin validation - strict allowlist in production
const getAllowedOrigins = () => {
  const origins = [CLIENT_URL];
  // Only allow localhost in development
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000');
  }
  return origins;
};

const allowedOrigins = getAllowedOrigins();

// CORS middleware with strict origin checking
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400 // 24 hours
};

const QUESTION_TIME_MS = 20000; 
const ANSWER_REVEAL_DELAY_MS = 5000; 

// Initialize Socket.IO with CORS using strict origin validation
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: (origin, callback) => {
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Socket.IO CORS: Origin ${origin} not allowed`));
          }
        },
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 20000, 
    pingInterval: 5000,
    path: '/socket.io/' 
});

app.set('socketio', io);

// Socket.IO connection rate limiting - use Redis-backed limiter with in-memory fallback
const socketConnections = new Map();
const SOCKET_MAX_CONNECTIONS = 10;
const SOCKET_MAX_GUEST_CONNECTIONS = 3; // Stricter limit for unauthenticated
const SOCKET_RATE_WINDOW_MS = 60 * 1000;

// Apply Redis-backed rate limiter first
io.use(socketLimiter);

// Socket authentication: required in production, optional in development with strict guest limits
io.use((socket, next) => {
    // Rate limit per IP (in-memory fallback if Redis unavailable)
    const ip = socket.handshake.address;
    const now = Date.now();
    const record = socketConnections.get(ip) || { count: 0, guestCount: 0, resetAt: now + SOCKET_RATE_WINDOW_MS };
    if (now > record.resetAt) {
        record.count = 0;
        record.guestCount = 0;
        record.resetAt = now + SOCKET_RATE_WINDOW_MS;
    }
    record.count++;
    socketConnections.set(ip, record);

    // Determine max connections based on auth status
    const maxConnections = socket.user ? SOCKET_MAX_CONNECTIONS : SOCKET_MAX_GUEST_CONNECTIONS;
    if (record.count > maxConnections) {
        return next(new Error('Too many connections from this IP'));
    }

    try {
        const cookies = cookie.parse(socket.handshake.headers.cookie || "");
        const token = cookies.token || socket.handshake.auth?.token;
        if (token) {
            socket.user = jwt.verify(token, JWT_SECRET);
        }
    } catch {
        // Invalid/expired token → treat as guest
    }

    // In production, require authentication for Socket.IO connections
    const isProduction = process.env.NODE_ENV === 'production';
    const isGuest = !socket.user;
    
    if (isProduction && isGuest) {
        // Track guest connections per IP for stricter rate limiting
        record.guestCount++;
        if (record.guestCount > SOCKET_MAX_GUEST_CONNECTIONS) {
            return next(new Error('Authentication required for Socket.IO connections'));
        }
    }
    
    next();
});

// Periodically clean up stale socket connection records (kept for backwards compat / non-Redis fallback)
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of socketConnections.entries()) {
        if (now > record.resetAt) socketConnections.delete(ip);
    }
}, SOCKET_RATE_WINDOW_MS * 2);

// Explicit Socket.IO Polling/Health Check Route
app.get('/socket.io/', (req, res) => {
    res.status(200).send('Socket.IO health check successful.');
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https://lh3.googleusercontent.com", "https://i.pravatar.cc"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Additional security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"]
    }
  }
}));

// Express CORS setup
app.use(cors(corsOptions));

app.use(cookieParser());

// Redis-backed rate limiters
app.use("/api", apiLimiter);

// Strict limiter to prevent login brute-force / user enumeration
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/google", authLimiter);

app.use("/api/auth/forgot-password", passwordResetLimiter);
app.use("/api/auth/reset-password", passwordResetLimiter);

app.use("/api/generate", generateLimiter);

app.use(express.json({ limit: '100kb' }));

app.use("/api/auth", authRoutes); 
app.use("/api", quizRoutes);      

// === SERVER-SIDE ROOM STATE MANAGEMENT & GAME LOGIC ===
const rooms = new Map();

// HELPER: Sanitize room state to avoid circular reference errors (remove qTimeout)
const getSafeRoomState = (roomState) => {
    const { qTimeout, ...safeState } = roomState;
    return safeState;
};

const checkAllAnswered = (roomState) => {
    const totalPlayers = roomState.players.length;
    const answersReceived = roomState.players.filter(p => p.answers[roomState.currentQ]).length;
    return roomState.players.length > 0 && answersReceived === totalPlayers;
};

const findRoomBySocketId = (socketId) => {
    for (const [code, room] of rooms.entries()) {
        if (room.players.some(p => p.socketId === socketId)) {
            return { code, room };
        }
    }
    return null;
};

const calculatePoints = (roomState) => {
    const qIndex = roomState.currentQ;
    const question = roomState.quizData[qIndex];

    const BASE_SCORE = 100;
    const MAX_SPEED_BONUS = 50; 
    const MAX_TIME = QUESTION_TIME_MS;

    const updatedPlayers = roomState.players.map(player => {
        const answer = player.answers[qIndex];
        let scoreGain = 0;
        player.lastScore = 0;

        if (answer && answer.selected === question.answer) {
            scoreGain = BASE_SCORE;
            
            const timeRatio = Math.min(answer.time_ms, MAX_TIME) / MAX_TIME;
            const bonus = Math.round(MAX_SPEED_BONUS * (1 - timeRatio));
            
            scoreGain += bonus;
        }
        
        return {
            ...player,
            score: player.score + scoreGain,
            lastScore: scoreGain 
        };
    });

    roomState.players = updatedPlayers;
};

const advanceGame = (roomCode, roomState) => {
    if (!rooms.has(roomCode)) return;

    calculatePoints(roomState);
    
    const isLastQuestion = roomState.currentQ === roomState.quizData.length - 1;
    
    const ranking = roomState.players.sort((a, b) => b.score - a.score);

    io.to(roomCode).emit('showAnswer', {
        correctAnswer: roomState.quizData[roomState.currentQ].answer,
        correctExplanation: roomState.quizData[roomState.currentQ].explanation,
        players: ranking,
        qIndex: roomState.currentQ,
        isLastQuestion
    });
    
    if (isLastQuestion) {
        io.to(roomCode).emit('showResults', {
            finalRanking: ranking,
            isFinal: true
        });
        // Reset room to lobby state instead of deleting it
        roomState.currentQ = 0;
        roomState.quizData = null;
        roomState.qStartTime = null;
        if (roomState.qTimeout) { clearTimeout(roomState.qTimeout); roomState.qTimeout = null; }
        for (const player of roomState.players) {
            player.score = 0;
            player.answers = [];
            player.lastScore = 0;
        }
    } else {
        roomState.currentQ++;
        
        if (roomState.qTimeout) clearTimeout(roomState.qTimeout);

        setTimeout(() => {
            const currentRoomState = rooms.get(roomCode);
            if (!currentRoomState) return;

            const qStartTime = Date.now();
            const qDeadline = qStartTime + QUESTION_TIME_MS;

            // This sets a Timeout object which causes the crash if emitted directly
            currentRoomState.qTimeout = setTimeout(() => {
                advanceGame(roomCode, currentRoomState);
            }, QUESTION_TIME_MS);

            currentRoomState.qStartTime = qStartTime;
            
            io.to(roomCode).emit('nextQuestion', {
                qIndex: currentRoomState.currentQ,
                question: currentRoomState.quizData[currentRoomState.currentQ],
                players: currentRoomState.players,
                qStartTime: qStartTime,
                qDeadline: qDeadline,
                duration: QUESTION_TIME_MS 
            });
        }, ANSWER_REVEAL_DELAY_MS);
    }
};

 io.on('connection', (socket) => {
    const connUsername = socket.user?.username;
    if (connUsername) userOnline(connUsername, socket.id);

    socket.on('createRoom', (data) => {
        const validated = validateSocketEvent(socketSchemas.createRoom)(data);
        if (!validated) return;
        const rawUsername = socket.user?.username || validated.username;
        const username = socket.user?.username
          ? rawUsername
          : String(rawUsername || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().substring(0, 20);
        const { quizId } = validated;

        if (rooms.size >= 1000) {
            socket.emit('roomError', 'Server is at capacity. Please try again later.');
            return;
        }

        const roomCode = crypto.randomBytes(4).toString('hex').toUpperCase().substring(0, 6);
        
        socket.join(roomCode);
        
        const roomState = {
            roomCode,
            hostSocketId: socket.id,
            host: username,
            quizId: quizId,
            players: [{ username, id: socket.id, score: 0, answers: [], lastScore: 0, socketId: socket.id }],
            currentQ: 0,
            quizData: null,
            qStartTime: null,
            qTimeout: null 
        };
        rooms.set(roomCode, roomState);

        // SAFE EMIT
        socket.emit('lobbyUpdate', getSafeRoomState(roomState)); 
    });

    socket.on('joinRoom', (data) => {
        const validated = validateSocketEvent(socketSchemas.joinRoom)(data);
        if (!validated) return;
        const roomCode = validated.roomCode;
        const rawUsername = socket.user?.username || validated.username;
        const username = socket.user?.username
          ? rawUsername
          : String(rawUsername || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().substring(0, 20);
        const roomState = rooms.get(roomCode);
        
        if (!roomState) {
            socket.emit('roomError', 'Room not found.');
            return;
        }

        if (roomState.players.some(p => p.username === username)) {
            socket.emit('roomError', 'Already in this room.');
            return;
        }

        socket.join(roomCode);
        roomState.players.push({ username, id: socket.id, score: 0, answers: [], lastScore: 0, socketId: socket.id });

        // SAFE EMIT
        socket.emit('lobbyUpdate', getSafeRoomState(roomState));
        socket.to(roomCode).emit('lobbyUpdate', getSafeRoomState(roomState)); 
    });

    socket.on('lobbyChat', (data) => {
        const validated = validateSocketEvent(socketSchemas.lobbyChat)(data);
        if (!validated) return;
        const roomCode = validated.roomCode;
        const roomState = rooms.get(roomCode);
        if (!roomState) return;
        const rawUsername = socket.user?.username || validated.username;
        const username = socket.user?.username
          ? rawUsername
          : String(rawUsername || '').replace(/[^a-zA-Z0-9_-]/g, '').trim().substring(0, 20);
        const message = String(validated.message || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[c]).slice(0, 500).trim();
        if (!message) return;
        const payload = { username, message, timestamp: Date.now() };
        io.to(roomCode).emit('lobbyChat', payload);
    });

    socket.on('startGame', async (data) => {
        const validated = validateSocketEvent(socketSchemas.startGame)(data);
        if (!validated) return;
        const { roomCode, quizId } = validated;
        const roomState = rooms.get(roomCode);
        
        if (!roomState || roomState.hostSocketId !== socket.id) {
             socket.emit('roomError', 'Access Denied: Only host can start game.');
             return;
        }
        
        try {
            const quiz = await Quiz.findById(quizId); 
            
            if (!quiz || !quiz.questions) {
                io.to(roomCode).emit('roomError', 'Quiz questions not found.');
                return;
            }
            
            if (typeof quiz.questions === 'string' && quiz.questions.startsWith('[')) {
               roomState.quizData = JSON.parse(quiz.questions); 
            } else if (Array.isArray(quiz.questions)) {
                 roomState.quizData = quiz.questions; 
            } else {
                 io.to(roomCode).emit('roomError', 'Quiz data structure is invalid.');
                 return;
            }
            
            roomState.currentQ = 0;
            
            io.to(roomCode).emit('startCountdown', { 
                quizTitle: quiz.title,
                duration: 5000, 
                quizData: roomState.quizData
            });

            setTimeout(() => {
                const currentRoomState = rooms.get(roomCode);
                if (!currentRoomState) return;

                const qStartTime = Date.now();
                const qDeadline = qStartTime + QUESTION_TIME_MS;

                currentRoomState.qTimeout = setTimeout(() => {
                    advanceGame(roomCode, currentRoomState);
                }, QUESTION_TIME_MS);

                currentRoomState.qStartTime = qStartTime;

                io.to(roomCode).emit('nextQuestion', {
                    qIndex: currentRoomState.currentQ,
                    question: currentRoomState.quizData[currentRoomState.currentQ],
                    players: currentRoomState.players,
                    qStartTime: qStartTime,
                    qDeadline: qDeadline,
                    duration: QUESTION_TIME_MS 
                });
            }, 5000); 
            
        } catch (error) {
            io.to(roomCode).emit('roomError', 'Internal server error starting game.');
        }
    });

    socket.on('changeQuiz', (data) => {
        const validated = validateSocketEvent(socketSchemas.changeQuiz)(data);
        if (!validated) return;
        const { roomCode, quizId } = validated;
        const roomState = rooms.get(roomCode);
        if (!roomState) return;
        if (roomState.hostSocketId !== socket.id) {
            socket.emit('roomError', 'Access Denied: Only host can change quiz.');
            return;
        }
        roomState.quizId = quizId;
        io.to(roomCode).emit('lobbyUpdate', getSafeRoomState(roomState));
    });

    socket.on('submitAnswer', (data) => {
        const validated = validateSocketEvent(socketSchemas.submitAnswer)(data);
        if (!validated) return;
        const { selected, roomCode } = validated;
        const roomState = rooms.get(roomCode);
        
        if (!roomState) return;

        const playerIndex = roomState.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1) return;

        const qIndex = roomState.currentQ;

        if (roomState.players[playerIndex].answers[qIndex] || roomState.qTimeout === null) return;

        // Measure answer time on the server to prevent clients from faking speed bonuses
        const elapsed = roomState.qStartTime ? Date.now() - roomState.qStartTime : 0;
        const finalTime = Math.max(0, Math.min(elapsed, QUESTION_TIME_MS));

        roomState.players[playerIndex].answers[qIndex] = { selected, time_ms: finalTime };
        
        socket.to(roomCode).emit('playerAnswered', { 
            username: roomState.players[playerIndex].username, 
            qIndex: qIndex
        });

        if (checkAllAnswered(roomState)) {
            if (roomState.qTimeout) clearTimeout(roomState.qTimeout);
            advanceGame(roomCode, roomState);
        }
    });

    socket.on('sendInvite', (data) => {
        const validated = validateSocketEvent(socketSchemas.sendInvite)(data);
        if (!validated) return;
        const { toUsername } = validated;
        const fromUsername = socket.user?.username;
        if (!fromUsername || !toUsername) return;

        const targetSocketIds = getSocketIds(toUsername);
        if (targetSocketIds.length === 0) {
            socket.emit('inviteError', { username: toUsername, error: 'User is not online' });
            return;
        }

        targetSocketIds.forEach(socketId => {
            io.to(socketId).emit('gameInvite', {
                fromUsername,
                fromSocketId: socket.id
            });
        });

        socket.emit('inviteSent', { username: toUsername });
    });

    socket.on('respondInvite', (data) => {
        const validated = validateSocketEvent(socketSchemas.respondInvite)(data);
        if (!validated) return;
        const { toSocketId, accepted } = validated;
        const fromUsername = socket.user?.username;
        if (!fromUsername || !toSocketId) return;

        io.to(toSocketId).emit('inviteResponse', {
            fromUsername,
            accepted
        });
    });

    socket.on('disconnect', () => {
        if (connUsername) userOffline(connUsername, socket.id);

        const roomInfo = findRoomBySocketId(socket.id);

        if (roomInfo) {
            const { code: roomCode, room: roomState } = roomInfo;
            const index = roomState.players.findIndex(p => p.socketId === socket.id);
            if (index !== -1) {
                const disconnectedUsername = roomState.players[index].username;
                roomState.players.splice(index, 1);
                
                if (roomState.players.length === 0) {
                    rooms.delete(roomCode);
                    if (roomState.qTimeout) clearTimeout(roomState.qTimeout);
                } else {
                    if (disconnectedUsername === roomState.host) {
                        roomState.host = roomState.players[0].username;
                    }
                    // SAFE EMIT
                    io.to(roomCode).emit('lobbyUpdate', getSafeRoomState(roomState)); 
                    io.to(roomCode).emit('playerLeft', { username: disconnectedUsername });
                }
            }
        }
    });

    socket.on('leaveRoom', (data) => {
        const validated = validateSocketEvent(socketSchemas.leaveRoom)(data);
        if (!validated) return;
        const { roomCode } = validated;
        const roomState = rooms.get(roomCode);
        
        if (roomState) {
            const index = roomState.players.findIndex(p => p.socketId === socket.id);
            if (index !== -1) {
                const disconnectedUsername = roomState.players[index].username;
                roomState.players.splice(index, 1);
                
                // Leave the socket room
                socket.leave(roomCode);

                if (roomState.players.length === 0) {
                    rooms.delete(roomCode);
                    if (roomState.qTimeout) clearTimeout(roomState.qTimeout);
                } else {
                    if (disconnectedUsername === roomState.host) {
                        roomState.host = roomState.players[0].username;
                    }
                    // SAFE EMIT
                    io.to(roomCode).emit('lobbyUpdate', getSafeRoomState(roomState)); 
                    io.to(roomCode).emit('playerLeft', { username: disconnectedUsername });
                }
            }
        }
    });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message || 'Internal server error';
    res.status(statusCode).json({ error: message });
});

// ==========================================
// SPA ROUTING FIX
// ==========================================

// 1. Serve Static Assets
app.use(express.static(path.join(__dirname, "../client/dist")));

// 2. SPA Fallback (Wildcard Regex Route for Express 5+)
app.get(/.*/, (req, res) => {
    // Safety check: Don't serve HTML for API/Socket requests
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return res.status(404).json({ error: 'API route not found' });
    }

    // Serve the React Entry Point
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Self-ping function
const RENDER_HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost';
const PING_URL = `https://${RENDER_HOSTNAME}`;
const PING_INTERVAL = 600000; 

function selfPing() {
    if (RENDER_HOSTNAME === 'localhost' || RENDER_HOSTNAME === undefined) return;
    fetch(PING_URL + '/api/quizzes', { headers: { 'User-Agent': 'Render-Self-Pinger' } })
        .catch(() => {});
}

// Only start listening when run directly (not when imported by tests)
if (process.env.NODE_ENV !== "test") {
  // Connect to Redis for rate limiting
  connectRedis().catch(err => {
    console.warn('Redis connection failed, rate limiting will use in-memory fallback:', err.message);
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Prepify Server running on port ${PORT}`);
    if (RENDER_HOSTNAME !== 'localhost' && RENDER_HOSTNAME !== undefined) {
        console.log(`Self-ping scheduled every ${PING_INTERVAL / 60000} minutes to ${PING_URL}`);
        setInterval(selfPing, PING_INTERVAL);
    }
  });
}

export default app;
