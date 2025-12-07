import express from "express";
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit"; 
import path from "path"; 
import { fileURLToPath } from "url"; 
import authRoutes from "./routes/authRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import Quiz from "./models/Quiz.js"; 

dotenv.config();

// Helper to define __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// CRITICAL FIX: Instruct Express to trust the proxy headers from Render/load balancer.
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'; 
const allowedOrigins = [CLIENT_URL, 'http://localhost:5173'];

const QUESTION_TIME_MS = 10000; 
const ANSWER_REVEAL_DELAY_MS = 3000; 

// Initialize Socket.IO with CORS using the CLIENT_URL variable
const io = new SocketIOServer(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
    },
    pingTimeout: 20000, 
    pingInterval: 5000,
    path: '/socket.io/' 
});

// Explicit Socket.IO Polling/Health Check Route
app.get('/socket.io/', (req, res) => {
    res.status(200).send('Socket.IO health check successful.');
});

// Express CORS setup
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: "Too many requests from this IP, please try again later."
});
app.use("/api", limiter);

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10,
  message: "Generation limit reached. Please try again later."
});
app.use("/api/generate", generateLimiter);

app.use(express.json());

// Serve Static Frontend Files
app.use(express.static(path.join(__dirname, "../client/dist")));

app.use("/api/auth", authRoutes); 
app.use("/api", quizRoutes);      

// === SERVER-SIDE ROOM STATE MANAGEMENT & GAME LOGIC ===
const rooms = new Map();

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

            currentRoomState.qTimeout = setTimeout(() => {
                advanceGame(roomCode, currentRoomState);
            }, QUESTION_TIME_MS);
            
            io.to(roomCode).emit('nextQuestion', {
                qIndex: currentRoomState.currentQ,
                question: currentRoomState.quizData[currentRoomState.currentQ],
                players: currentRoomState.players,
                qStartTime: qStartTime,
                qDeadline: qDeadline
            });
        }, ANSWER_REVEAL_DELAY_MS);
    }
};

io.on('connection', (socket) => {
    console.log('A user connected via socket:', socket.id);

    socket.on('createRoom', (data) => {
        const { username, quizId } = data;
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        socket.join(roomCode);
        
        const roomState = {
            roomCode,
            host: username,
            quizId: quizId,
            players: [{ username, id: socket.id, score: 0, answers: [], lastScore: 0, socketId: socket.id }],
            currentQ: 0,
            quizData: null,
            qTimeout: null 
        };
        rooms.set(roomCode, roomState);

        socket.emit('lobbyUpdate', roomState); 
    });

    socket.on('joinRoom', (data) => {
        const { roomCode, username } = data;
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

        socket.emit('lobbyUpdate', roomState);
        socket.to(roomCode).emit('lobbyUpdate', roomState); 
    });

    socket.on('startGame', async (data) => {
        const { roomCode, quizId } = data;
        const roomState = rooms.get(roomCode);
        
        if (!roomState || roomState.host !== roomState.players.find(p => p.socketId === socket.id)?.username) {
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
            
            const startTimestamp = Date.now() + 5000; 
            
            io.to(roomCode).emit('startCountdown', { 
                quizTitle: quiz.title,
                startTimestamp,
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

                io.to(roomCode).emit('nextQuestion', {
                    qIndex: currentRoomState.currentQ,
                    question: currentRoomState.quizData[currentRoomState.currentQ],
                    players: currentRoomState.players,
                    qStartTime: qStartTime,
                    qDeadline: qDeadline
                });
            }, 5000); 
            
        } catch (error) {
            console.error('Fatal Error fetching quiz data:', error);
            io.to(roomCode).emit('roomError', 'Internal server error starting game.');
        }
    });

    socket.on('submitAnswer', (data) => {
        const { selected, time_ms, roomCode } = data;
        const roomState = rooms.get(roomCode);
        
        if (!roomState) return;

        const playerIndex = roomState.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1) return;

        const qIndex = roomState.currentQ;

        if (roomState.players[playerIndex].answers[qIndex] || roomState.qTimeout === null) return;

        const finalTime = Math.min(time_ms, QUESTION_TIME_MS);

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
            const disconnectedUsername = roomState.players[index].username;
            roomState.players.splice(index, 1);
            
            if (roomState.players.length === 0) {
                rooms.delete(roomCode);
                if (roomState.qTimeout) clearTimeout(roomState.qTimeout);
            } else {
                if (disconnectedUsername === roomState.host) {
                    roomState.host = roomState.players[0].username;
                }
                io.to(roomCode).emit('lobbyUpdate', roomState); 
                io.to(roomCode).emit('playerLeft', { username: disconnectedUsername });
            }
        }
    });
});

// ----------------------------------------------------
// FIX 3: SPA Fallback Route (Express 5 Compatible)
// Replaced '*' with '(.*)' to fix "Missing parameter name" error.
// This matches any route not previously handled and serves index.html.
app.get('(.*)', (req, res) => {
    // Safety check: ensure we don't accidentally intercept API calls
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ error: "API endpoint not found" });
    }
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});
// ----------------------------------------------------

// Self-ping function to keep Render instance awake
const RENDER_HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost';
const PING_URL = `https://${RENDER_HOSTNAME}`;
const PING_INTERVAL = 600000; // 10 minutes

function selfPing() {
    if (RENDER_HOSTNAME === 'localhost' || RENDER_HOSTNAME === undefined) {
        return;
    }
    
    fetch(PING_URL + '/api/quizzes', { 
        headers: { 'User-Agent': 'Render-Self-Pinger' }
    })
        .then(response => {
            console.log(`Self-ping successful: Status ${response.status}`);
        })
        .catch(err => {
            console.error(`Self-ping failed: ${err.message}`);
        });
}

// Bind to '0.0.0.0' and the PORT env variable
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Prepify Server running on port ${PORT}`);

  if (RENDER_HOSTNAME !== 'localhost' && RENDER_HOSTNAME !== undefined) {
      console.log(`Self-ping scheduled every ${PING_INTERVAL / 60000} minutes to ${PING_URL}`);
      setInterval(selfPing, PING_INTERVAL);
  }
});