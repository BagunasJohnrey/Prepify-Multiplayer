import express from "express";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import cookie from "cookie";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit"; 
import authRoutes from "./routes/authRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import Quiz from "./models/Quiz.js"; 
import path from "path"; 
import { fileURLToPath } from "url"; 

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const httpServer = createServer(app);

// Helper to define __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CRITICAL FIX: Instruct Express to trust the proxy headers from Render/load balancer.
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'; 
const allowedOrigins = [CLIENT_URL, 'http://localhost:5173'];

const QUESTION_TIME_MS = 20000; 
const ANSWER_REVEAL_DELAY_MS = 5000; 

// Initialize Socket.IO with CORS using the CLIENT_URL variable
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    },
    pingTimeout: 20000, 
    pingInterval: 5000,
    path: '/socket.io/' 
});

app.set('socketio', io);

// Optional auth for sockets: members identified via their httpOnly cookie, guests proceed anonymously.
io.use((socket, next) => {
    try {
        const cookies = cookie.parse(socket.handshake.headers.cookie || "");
        const token = cookies.token || socket.handshake.auth?.token;
        if (token) {
            socket.user = jwt.verify(token, JWT_SECRET);
        }
    } catch {
        // Invalid/expired token → treat as guest, do not reject the connection.
    }
    next();
});

// Explicit Socket.IO Polling/Health Check Route
app.get('/socket.io/', (req, res) => {
    res.status(200).send('Socket.IO health check successful.');
});

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Express CORS setup
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: "Too many requests from this IP, please try again later."
});
app.use("/api", limiter);

// Strict limiter to prevent login brute-force / user enumeration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts, please try again later."
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/google", authLimiter);

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10,
  message: "Generation limit reached. Please try again later."
});
app.use("/api/generate", generateLimiter);

app.use(express.json());

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
        rooms.delete(roomCode); 
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
    console.log('A user connected via socket:', socket.id);

    socket.on('createRoom', (data) => {
        // Members are bound to their account username; guests use the client-supplied name.
        const username = socket.user?.username || data.username;
        const { quizId } = data;

        if (rooms.size >= 1000) {
            socket.emit('roomError', 'Server is at capacity. Please try again later.');
            return;
        }

        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        
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
        const roomCode = data.roomCode;
        const username = socket.user?.username || data.username;
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

    socket.on('startGame', async (data) => {
        const { roomCode, quizId } = data;
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
                 console.error(`Quiz data for ID ${quizId} is not a valid structure.`);
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
            console.error('Fatal Error fetching quiz data:', error);
            io.to(roomCode).emit('roomError', 'Internal server error starting game.');
        }
    });

    socket.on('submitAnswer', (data) => {
        const { selected, roomCode } = data;
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

    socket.on('disconnect', () => {
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
        const { roomCode } = data;
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
        .then(response => console.log(`Self-ping successful: Status ${response.status}`))
        .catch(err => console.error(`Self-ping failed: ${err.message}`));
}

// Only start listening when run directly (not when imported by tests)
if (process.env.NODE_ENV !== "test") {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Prepify Server running on port ${PORT}`);
    if (RENDER_HOSTNAME !== 'localhost' && RENDER_HOSTNAME !== undefined) {
        console.log(`Self-ping scheduled every ${PING_INTERVAL / 60000} minutes to ${PING_URL}`);
        setInterval(selfPing, PING_INTERVAL);
    }
  });
}

export default app;
