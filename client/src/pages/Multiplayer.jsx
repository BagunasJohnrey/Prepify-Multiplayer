import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, PlusCircle, LogIn, Loader, Clock, Trophy, Zap, AlertCircle, CheckCircle, XCircle, Copy, Link as LinkIcon, ArrowRight, Gamepad2, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import { toastOnce } from '../utils/toast';
import socket from '../utils/socket';
import api from '../utils/api';
import { loadQuizzesWithCache } from '../utils/quizCache';
import Confetti from 'react-confetti';

const COUNTDOWN_SECONDS = 5;
const QUESTION_TIME_MS = 20000;
const ANSWER_REVEAL_DELAY_MS = 5000;

export default function Multiplayer() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [guestName, setGuestName] = useState('');
    const [isGuestSetup, setIsGuestSetup] = useState(false);
    const currentUsername = user?.username || (isGuestSetup ? guestName : null);

    const [view, setView] = useState('loading');
    const [roomCode, setRoomCode] = useState('');
    const [lobbyData, setLobbyData] = useState(null);
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [isRoomActionPending, setIsRoomActionPending] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    const [gameQuestions, setGameQuestions] = useState(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [playerRanking, setPlayerRanking] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [showAnswerKey, setShowAnswerKey] = useState(false);
    const [qAnswer, setQAnswer] = useState(null);
    const [questionResults, setQuestionResults] = useState([]);

    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS / 1000);
    const qTimerIntervalRef = useRef(null);
    const roomActionTimeoutRef = useRef(null);
    const revealTimerRef = useRef(null);
    const [revealCountdown, setRevealCountdown] = useState(ANSWER_REVEAL_DELAY_MS / 1000);
    const [playerAnswerLocal, setPlayerAnswerLocal] = useState(null);

    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [availableQuizzes, setAvailableQuizzes] = useState([]);
    const [quizzesLoading, setQuizzesLoading] = useState(true);
    const [selectedQuizId, setSelectedQuizId] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);

    const stateRef = useRef({
        availableQuizzes, currentQIndex, user, guestName, isGuestSetup, view, lobbyData, roomCode, gameQuestions
    });

    useEffect(() => {
        stateRef.current = { availableQuizzes, currentQIndex, user, guestName, isGuestSetup, view, lobbyData, roomCode, gameQuestions };
    }, [availableQuizzes, currentQIndex, user, guestName, isGuestSetup, view, lobbyData, roomCode, gameQuestions]);

    const handleCancel = useCallback(() => {
        setIsRoomActionPending(false);
        setRoomCode('');
        setView('menu');
        toast.dismiss();
        navigate('/multiplayer', { replace: true });
    }, [navigate]);

    useEffect(() => {
        if (authLoading) return;
        if (user) {
            if (view === 'loading' || view === 'guest_entry') setView('menu');
        } else {
            if (!isGuestSetup && view !== 'guest_entry') setView('guest_entry');
        }
    }, [user, authLoading, isGuestSetup, view]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [view]);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const codeParam = searchParams.get('code');
        if (codeParam) {
            const cleanCode = codeParam.toUpperCase();
            if (cleanCode !== roomCode) setRoomCode(cleanCode);
            if (currentUsername && view === 'menu') {
                setView('join');
                toast.success('Room code found! Click Enter to join.', { icon: '🔗', id: 'join-toast' });
            }
        }
    }, [location, view, currentUsername, roomCode]);

    useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const { data: quizzes } = await loadQuizzesWithCache();
                setAvailableQuizzes(quizzes);
                if (quizzes.length > 0) setSelectedQuizId(String(quizzes[0].id));
            } catch {
                toastOnce.error("Failed to load quizzes.", { duration: 3000 });
            } finally {
                setQuizzesLoading(false);
            }
        };
        fetchQuizzes();
    }, []);

    useEffect(() => {
        if (view === 'loading' && isRoomActionPending) {
            roomActionTimeoutRef.current = setTimeout(() => {
                toast.error("Request timed out.", { duration: 4000 });
                handleCancel();
            }, 10000);
        } else {
            if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current);
        }
        return () => { if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current); };
    }, [view, isRoomActionPending, handleCancel]);

    const startQuestionTimer = (durationSeconds) => {
        if (qTimerIntervalRef.current) clearInterval(qTimerIntervalRef.current);
        setTimeLeft(durationSeconds);
        qTimerIntervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(qTimerIntervalRef.current); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    useEffect(() => {
        if (showAnswerKey && revealCountdown > 0) {
            revealTimerRef.current = setInterval(() => {
                setRevealCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(revealTimerRef.current);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => { if (revealTimerRef.current) clearInterval(revealTimerRef.current); };
    }, [showAnswerKey]);

    const stopQuestionTimer = () => {
        if (qTimerIntervalRef.current) clearInterval(qTimerIntervalRef.current);
        qTimerIntervalRef.current = null;
    };

    useEffect(() => {
        let countdownInterval;
        if (socket.connected) setIsConnected(true);

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        const handleLobbyUpdate = (data) => {
            setIsRoomActionPending(false);
            const { availableQuizzes } = stateRef.current;
            const quiz = availableQuizzes.find(q => String(q.id) === String(data.quizId));
            const quizTitle = quiz ? quiz.title : 'Unknown Quiz';
            navigate('/multiplayer', { replace: true });
            setLobbyData({
                roomCode: data.roomCode, quizId: data.quizId, quizTitle,
                host: data.host,
                players: data.players.map(p => ({ ...p, isHost: p.username === data.host }))
            });
            setView('lobby');
        };

        const handlePlayerAnswered = (data) => {
            const { currentQIndex } = stateRef.current;
            if (data.qIndex === currentQIndex) toast(`${data.username} submitted an answer!`, { icon: '⚡' });
        };

        const handleStartCountdown = (data) => {
            const shuffledQuizData = data.quizData.map(q => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) }));
            setGameQuestions(shuffledQuizData);
            setCurrentQIndex(0);
            setIsAnswered(false);
            setShowAnswerKey(false);
            setPlayerAnswerLocal(null);
            setQuestionResults([]);
            setLobbyData(prev => ({ ...prev, quizTitle: data.quizTitle }));
            const durationSec = data.duration ? (data.duration / 1000) : COUNTDOWN_SECONDS;
            setCountdown(durationSec);
            setView('countdown');
            if (countdownInterval) clearInterval(countdownInterval);
            countdownInterval = setInterval(() => {
                setCountdown(c => { if (c <= 1) { clearInterval(countdownInterval); return 0; } return c - 1; });
            }, 1000);
        };

        const handleShowAnswer = (data) => {
            stopQuestionTimer();
            setLobbyData(prev => ({ ...prev, players: data.players }));
            setQAnswer({ correctAnswer: data.correctAnswer, explanation: data.correctExplanation, isLastQuestion: data.isLastQuestion });
            setShowAnswerKey(true);
            setRevealCountdown(ANSWER_REVEAL_DELAY_MS / 1000);

        const state = stateRef.current;
        const currentUsername = state.user?.username || (state.isGuestSetup ? state.guestName : null);
        const q = state.gameQuestions?.[data.qIndex];
        const me = data.players?.find(p => p.username === currentUsername);
        const myAnswer = me?.answers?.[data.qIndex];
        setQuestionResults(prev => [...prev, {
            qIndex: data.qIndex,
            question: q?.question || '',
            options: q?.options || [],
            correctAnswer: data.correctAnswer,
            explanation: data.correctExplanation,
            playerAnswer: myAnswer?.selected || null,
            isCorrect: myAnswer?.selected === data.correctAnswer,
            points: me?.lastScore || 0,
        }]);
        };

        const handleNextQuestion = (data) => {
            setLobbyData(prev => ({ ...prev, players: data.players }));
            setCurrentQIndex(data.qIndex);
            setIsAnswered(false);
            setShowAnswerKey(false);
            setQAnswer(null);
            setPlayerAnswerLocal(null);
            const durationSec = data.duration ? (data.duration / 1000) : 10;
            startQuestionTimer(durationSec);
            toast.success(`Next Question!`, { duration: 1500 });
            setView('game');
        };

        const handleShowResults = (data) => {
            setPlayerRanking(data.finalRanking);
            setLobbyData(prev => ({ ...prev, players: data.finalRanking }));
            setView('results');
            toast.success("Game Over!", { duration: 5000 });
        };

        const handleRoomError = (message) => {
            setIsRoomActionPending(false);
            toastOnce.error(message, { duration: 3000 });
            if (stateRef.current.view === 'loading') handleCancel();
        };

        const handleLobbyChat = (data) => setChatMessages(prev => [...prev, data]);

        socket.on('lobbyUpdate', handleLobbyUpdate);
        socket.on('playerJoined', (data) => toast.success(`${data.username} joined!`));
        socket.on('playerAnswered', handlePlayerAnswered);
        socket.on('startCountdown', handleStartCountdown);
        socket.on('showAnswer', handleShowAnswer);
        socket.on('nextQuestion', handleNextQuestion);
        socket.on('showResults', handleShowResults);
        socket.on('roomError', handleRoomError);
        socket.on('lobbyChat', handleLobbyChat);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('lobbyUpdate', handleLobbyUpdate);
            socket.off('playerJoined');
            socket.off('playerAnswered', handlePlayerAnswered);
            socket.off('startCountdown', handleStartCountdown);
            socket.off('showAnswer', handleShowAnswer);
            socket.off('nextQuestion', handleNextQuestion);
            socket.off('showResults', handleShowResults);
            socket.off('roomError');
            socket.off('lobbyChat', handleLobbyChat);
            if (countdownInterval) clearInterval(countdownInterval);
            if (revealTimerRef.current) clearInterval(revealTimerRef.current);
            stopQuestionTimer();
        };
    }, [handleCancel, navigate]);

    const handleGuestEntry = (e) => {
        e.preventDefault();
        if (!guestName.trim()) return toastOnce.error("Please enter a name.");
        setIsGuestSetup(true);
        setView('menu');
    };

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (isRoomActionPending) return toastOnce.error("Already connecting...");
        if (quizzesLoading || availableQuizzes.length === 0) return toastOnce.error("Please wait for quizzes to load.");
        if (!currentUsername) return toastOnce.error("Identity error. Please reload.");
        if (!selectedQuizId) return toastOnce.error("Please select a quiz.");

        setChatMessages([]);

        const emitCreate = () => socket.emit('createRoom', { username: currentUsername, quizId: Number(selectedQuizId) });
        if (!socket.connected) {
            socket.connect();
            socket.once('connect', () => {
                setView('loading');
                setIsRoomActionPending(true);
                emitCreate();
            });
            socket.once('connect_error', () => {
                toastOnce.error("Failed to connect to server. Try again.");
            });
        } else {
            setView('loading');
            setIsRoomActionPending(true);
            emitCreate();
        }
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (isRoomActionPending) return toastOnce.error("Already connecting...");
        const code = roomCode.toUpperCase();
        if (!currentUsername || code.length !== 6) return toastOnce.error("Enter a valid 6-letter code and name.");

        setChatMessages([]);
        setRoomCode(code);

        // Ensure socket is connected before emitting
        if (!socket.connected) {
            socket.connect();
            socket.once('connect', () => {
                setView('loading');
                setIsRoomActionPending(true);
                socket.emit('joinRoom', { roomCode: code, username: currentUsername });
            });
            socket.once('connect_error', () => {
                toastOnce.error("Failed to connect to server. Try again.");
                setView('join');
            });
        } else {
            setView('loading');
            setIsRoomActionPending(true);
            socket.emit('joinRoom', { roomCode: code, username: currentUsername });
        }
    };

    const handleStartGame = () => {
        if (!lobbyData || lobbyData.host !== currentUsername) return;
        socket.emit('startGame', { roomCode: lobbyData.roomCode, quizId: lobbyData.quizId });
    };

    const handleGameAnswer = (selectedOption) => {
        if (isAnswered || !lobbyData || showAnswerKey || timeLeft <= 0) return;
        setIsAnswered(true);
        setPlayerAnswerLocal(selectedOption);
        const timeTaken = (QUESTION_TIME_MS / 1000 - timeLeft) * 1000;
        socket.emit('submitAnswer', { roomCode: lobbyData.roomCode, selected: selectedOption, time_ms: timeTaken });
        toast.success("Answer sent!", { duration: 1000 });
    };

    const leaveRoom = () => {
        if (lobbyData) socket.emit('leaveRoom', { roomCode: lobbyData.roomCode });
        setLobbyData(null);
        setChatMessages([]);
        handleCancel();
    };

    const sendChat = (e) => {
        e.preventDefault();
        const message = chatInput.trim();
        if (!message || !lobbyData) return;
        socket.emit('lobbyChat', { roomCode: lobbyData.roomCode, username: currentUsername, message });
        setChatInput('');
    };

    const backToLobby = () => {
        setGameQuestions(null);
        setCurrentQIndex(0);
        setPlayerRanking(null);
        setIsAnswered(false);
        setShowAnswerKey(false);
        setQAnswer(null);
        setQuestionResults([]);
        setPlayerAnswerLocal(null);
        stopQuestionTimer();
        setView('lobby');
    };

    const handleChangeQuiz = (e) => {
        const newQuizId = e.target.value;
        if (!newQuizId || !lobbyData) return;
        setSelectedQuizId(newQuizId);
        const quiz = availableQuizzes.find(q => String(q.id) === String(newQuizId));
        setLobbyData(prev => ({ ...prev, quizId: newQuizId, quizTitle: quiz?.title || prev.quizTitle }));
        socket.emit('changeQuiz', { roomCode: lobbyData.roomCode, quizId: newQuizId });
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedField(null), 2000);
    };

    useEffect(() => {
        if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // --- RENDERERS ---

    const renderGuestEntry = () => (
        <div className="flex items-center justify-center min-h-screen p-4 -mt-16">
            <div className="w-full max-w-sm animate-fade-in space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Identify Yourself</h1>
                    <p className="text-gray-400 text-sm mt-2">Enter a temporary nickname to join the arena.</p>
                </div>

                <form onSubmit={handleGuestEntry} className="space-y-4">
                    <input
                        type="text"
                        placeholder="e.g. Maverick"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        autoFocus
                        className="w-full bg-[#12121b] border border-white/[0.06] rounded-xl p-4 text-white text-center text-lg font-bold tracking-wide focus:border-neon-purple focus:outline-none transition placeholder-gray-600"
                    />
                    <Button type="submit" variant="primary" fullWidth className="h-14 text-base font-bold">
                        Continue as Guest <ArrowRight size={18} />
                    </Button>
                </form>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/[0.06]"></div></div>
                    <div className="relative flex justify-center text-xs"><span className="px-4 bg-[#0b0b12] text-gray-500 font-bold tracking-widest uppercase">or</span></div>
                </div>

                <Button onClick={() => navigate('/')} variant="outline" fullWidth className="h-14 text-base font-bold border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.03]">
                    Login / Register
                </Button>
            </div>
        </div>
    );

    const renderMenu = () => (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_30px_rgba(188,19,254,0.15)]">
                    <Gamepad2 size={24} />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Multiplayer Arena</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Challenge friends in real-time battles.</p>
                </div>
            </div>

            {/* Engagement Banner */}
            <div className="relative overflow-hidden bg-[#12121b] p-5 rounded-2xl border border-white/[0.06]">
                <div className="absolute top-0 right-0 w-40 h-40 bg-neon-purple/8 blur-[80px] rounded-full" />
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center text-neon-purple">
                            <Zap size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Ready to battle?</p>
                            <p className="text-xs text-gray-500">Create a room or join a friend's game</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                            <div className="w-7 h-7 rounded-full bg-neon-blue/20 border-2 border-[#12121b] flex items-center justify-center text-[10px] font-bold text-neon-blue">A</div>
                            <div className="w-7 h-7 rounded-full bg-neon-green/20 border-2 border-[#12121b] flex items-center justify-center text-[10px] font-bold text-neon-green">B</div>
                            <div className="w-7 h-7 rounded-full bg-neon-purple/20 border-2 border-[#12121b] flex items-center justify-center text-[10px] font-bold text-neon-purple">C</div>
                        </div>
                        <span className="text-xs text-gray-500">playing now</span>
                    </div>
                </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create Room */}
                <button
                    onClick={() => setView('create')}
                    disabled={isRoomActionPending || quizzesLoading || availableQuizzes.length === 0 || !isConnected}
                    className="group relative text-left bg-[#12121b] border border-white/[0.06] rounded-2xl p-6 transition-all duration-300 hover:border-neon-blue/30 hover:shadow-[0_0_30px_rgba(0,243,255,0.08)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <div className="absolute inset-0 bg-linear-to-br from-neon-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue mb-4 group-hover:scale-110 transition-transform duration-300">
                            <PlusCircle size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-neon-blue transition-colors">Create Room</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">Host a new game session. Select your quiz and invite others via code.</p>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-gray-500 group-hover:text-neon-blue transition-colors">
                            <span>Get started</span>
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </button>

                {/* Join Room */}
                <button
                    onClick={() => setView('join')}
                    disabled={isRoomActionPending || !isConnected}
                    className="group relative text-left bg-[#12121b] border border-white/[0.06] rounded-2xl p-6 transition-all duration-300 hover:border-neon-green/30 hover:shadow-[0_0_30px_rgba(57,255,20,0.08)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <div className="absolute inset-0 bg-linear-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
                    <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center text-neon-green mb-4 group-hover:scale-110 transition-transform duration-300">
                            <LogIn size={24} />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-neon-green transition-colors">Join Room</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">Enter an existing 6-digit room code to jump into a lobby instantly.</p>
                        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-gray-500 group-hover:text-neon-green transition-colors">
                            <span>Enter code</span>
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>
                </button>
            </div>

            {!isConnected && (
                <div className="flex items-center justify-center gap-2 text-red-400 bg-red-500/10 py-3 rounded-xl border border-red-500/20">
                    <AlertCircle size={16} />
                    <span className="text-xs font-bold uppercase tracking-wide">Disconnected from Server</span>
                </div>
            )}
        </div>
    );

    const CODE_LENGTH = 6;
    const codeInputRefs = useRef([]);

    const handleCodeChange = (index, value) => {
        if (!/^[a-zA-Z0-9]?$/.test(value)) return;
        const upper = value.toUpperCase();
        const chars = roomCode.split('');
        chars[index] = upper;
        const next = chars.join('');
        setRoomCode(next);
        if (upper && index < CODE_LENGTH - 1) {
            codeInputRefs.current[index + 1]?.focus();
        }
    };

    const handleCodeKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !roomCode[index] && index > 0) {
            codeInputRefs.current[index - 1]?.focus();
        }
    };

    const handleCodePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, CODE_LENGTH);
        setRoomCode(pasted);
        const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
        codeInputRefs.current[focusIdx]?.focus();
    };

    const renderJoinRoom = () => (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] -mt-10 px-4 animate-fade-in">
            <form onSubmit={handleJoinRoom} className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Join a Game</h2>
                    <p className="text-gray-400 text-sm mt-2">Enter the room code from your friend</p>
                </div>

                <div className="bg-[#12121b] p-8 rounded-2xl border border-white/[0.06]">
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block text-center mb-6">Room Code</label>
                    <div className="flex items-center justify-center gap-2 sm:gap-3">
                        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                            <input
                                key={i}
                                ref={el => codeInputRefs.current[i] = el}
                                type="text"
                                inputMode="text"
                                maxLength={1}
                                autoFocus={i === 0}
                                value={roomCode[i] || ''}
                                onChange={e => handleCodeChange(i, e.target.value)}
                                onKeyDown={e => handleCodeKeyDown(i, e)}
                                onPaste={i === 0 ? handleCodePaste : undefined}
                                className="w-11 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono font-bold uppercase bg-white/[0.03] border-2 border-white/[0.06] rounded-xl text-white focus:border-neon-green focus:outline-none transition-all placeholder-gray-700"
                            />
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 text-center mt-5">6-character code from the host</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button type="button" onClick={handleCancel} variant="outline" className="h-14 text-base font-bold border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.03]">
                        Cancel
                    </Button>
                    <Button type="submit" variant="success" className="h-14 text-base font-bold" disabled={isRoomActionPending || roomCode.length !== CODE_LENGTH}>
                        Join Game
                    </Button>
                </div>
            </form>
        </div>
    );

    const renderCreateRoom = () => (
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] -mt-10 px-4 animate-fade-in">
            <form onSubmit={handleCreateRoom} className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Create a Game</h2>
                    <p className="text-gray-400 text-sm mt-2">Set up a room and invite your friends</p>
                </div>

                <div className="bg-[#12121b] p-8 rounded-2xl border border-white/[0.06] space-y-6">
                    <div className="text-center space-y-1">
                        <p className="text-sm text-gray-300 font-medium">Quiz selection happens in the lobby</p>
                        <p className="text-xs text-gray-500">You'll pick the quiz material after the room is created</p>
                    </div>
                    <div className="flex items-center justify-center gap-3 p-4 bg-neon-blue/5 border border-neon-blue/15 rounded-xl">
                        <AlertCircle size={16} className="text-neon-blue shrink-0" />
                        <p className="text-xs text-neon-blue/70 leading-relaxed">
                            As the host, you control when the game starts and which quiz to use.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <Button type="button" onClick={handleCancel} variant="outline" className="h-14 text-base font-bold border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.03]">
                        Cancel
                    </Button>
                    <Button type="submit" variant="primary" className="h-14 text-base font-bold" disabled={isRoomActionPending}>
                        Create Room
                    </Button>
                </div>
            </form>
        </div>
    );

    const renderLobby = () => {
        if (!lobbyData) return renderMenu();
        const players = lobbyData.players || [];
        const isHost = lobbyData.host === currentUsername;
        const inviteLink = `${window.location.origin}/multiplayer?code=${lobbyData.roomCode}`;

        return (
            <div className="flex flex-col min-h-[calc(100vh-4rem)] -mt-10 animate-fade-in">
                {/* Header */}
                <div className="text-center pt-12 sm:pt-16 pb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Lobby</h1>
                    <p className="text-gray-400 text-sm mt-1.5">{lobbyData.quizTitle}</p>
                </div>

                {/* Room Code Banner */}
                <div className="mx-4 sm:mx-auto sm:w-full sm:max-w-lg">
                    <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-6 sm:p-8 space-y-5">
                        {/* Top row: label + badges */}
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Room Code</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold bg-neon-green/10 text-neon-green px-2 py-0.5 rounded border border-neon-green/20">{players.length} player{players.length !== 1 ? 's' : ''}</span>
                                {isHost && <span className="text-[10px] font-bold bg-neon-purple/10 text-neon-purple px-2 py-0.5 rounded border border-neon-purple/20">HOST</span>}
                            </div>
                        </div>

                        {/* Code boxes */}
                        <div className="flex items-center justify-center gap-2 sm:gap-3">
                            {lobbyData.roomCode.split('').map((char, i) => (
                                <span key={i} className="w-10 h-12 sm:w-12 sm:h-14 flex items-center justify-center text-xl sm:text-2xl font-mono font-bold text-neon-green bg-white/[0.03] border border-white/[0.06] rounded-xl">{char}</span>
                            ))}
                        </div>

                        {/* Copy code button */}
                        <button
                            type="button"
                            onClick={() => copyToClipboard(lobbyData.roomCode, 'code')}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.1] transition-all text-sm font-medium"
                        >
                            {copiedField === 'code' ? <><CheckCircle size={16} className="text-neon-green" /> Copied!</> : <><Copy size={16} /> Copy Code</>}
                        </button>

                        {/* Invite link */}
                        <div className="flex items-center gap-2 bg-white/[0.03] rounded-xl px-4 py-2.5 border border-white/[0.04] cursor-pointer hover:border-neon-blue/30 transition-colors" onClick={() => copyToClipboard(inviteLink, 'link')}>
                            <LinkIcon size={14} className="text-neon-blue shrink-0" />
                            <span className="text-xs text-gray-400 truncate flex-1">{inviteLink}</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase shrink-0">Copy</span>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 mx-4 sm:mx-auto sm:w-full sm:max-w-lg mt-4 space-y-4">
                    {/* Players */}
                    <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Users size={16} /> Players
                            </h3>
                            <div className="flex -space-x-1.5">
                                {players.slice(0, 5).map(p => (
                                    <div key={p.username} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[#12121b] ${p.username === lobbyData.host ? 'bg-neon-purple/20 text-neon-purple' : 'bg-neon-green/20 text-neon-green'}`}>
                                        {p.username?.charAt(0).toUpperCase()}
                                    </div>
                                ))}
                                {players.length > 5 && <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-[#12121b] bg-white/[0.06] text-gray-400">+{players.length - 5}</div>}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            {players.map(player => (
                                <div key={player.username} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${player.username === lobbyData.host ? 'bg-neon-purple/10 border-neon-purple/20 text-neon-purple' : 'bg-neon-green/10 border-neon-green/20 text-neon-green'}`}>
                                            {player.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white font-medium text-sm">{player.username}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {player.username === currentUsername && <span className="text-[10px] bg-white/[0.06] text-gray-400 px-1.5 py-0.5 rounded font-mono">YOU</span>}
                                        {player.username === lobbyData.host && <span className="text-[10px] bg-neon-purple/10 text-neon-purple px-1.5 py-0.5 rounded font-medium">HOST</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quiz Selection (Host Only) */}
                    {isHost && (
                        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-5 space-y-3">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Quiz Material</label>
                            {quizzesLoading ? (
                                <div className="h-12 bg-white/[0.04] rounded-xl animate-pulse" />
                            ) : (
                                <select
                                    value={lobbyData.quizId || ''}
                                    onChange={handleChangeQuiz}
                                    className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-white focus:border-neon-blue outline-none cursor-pointer text-sm appearance-none transition font-medium"
                                >
                                    {availableQuizzes.map(quiz => (
                                        <option key={quiz.id} value={String(quiz.id)} className="bg-[#1a1a2e]">{quiz.title} • {quiz.difficulty}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                    )}

                    {/* Chat */}
                    <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] flex flex-col h-[280px]">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 p-4 border-b border-white/[0.06]">
                            <MessageCircle size={16} /> Chat
                        </h3>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {chatMessages.length === 0 ? (
                                <p className="text-gray-600 text-sm text-center mt-8">No messages yet. Say hi!</p>
                            ) : (
                                chatMessages.map((msg, i) => (
                                    <div key={i} className="text-sm">
                                        <span className={`font-bold ${msg.username === currentUsername ? 'text-neon-blue' : 'text-neon-purple'}`}>{msg.username}: </span>
                                        <span className="text-gray-300">{msg.message}</span>
                                    </div>
                                ))
                            )}
                            <div ref={chatEndRef} />
                        </div>
                        <form onSubmit={sendChat} className="p-3 border-t border-white/[0.06] flex gap-2">
                            <input
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-white text-sm focus:border-neon-blue outline-none transition"
                            />
                            <Button type="submit" variant="primary" size="sm">Send</Button>
                        </form>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="mx-4 sm:mx-auto sm:w-full sm:max-w-lg py-5">
                    <div className="flex items-center gap-3">
                        <Button onClick={leaveRoom} variant="outline" className="flex-1 h-12 text-sm font-bold border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.03]">
                            Leave
                        </Button>
                        {isHost ? (
                            <Button onClick={handleStartGame} variant="success" className="flex-[2] h-12 text-base font-bold shadow-[0_0_20px_rgba(57,255,20,0.2)]">
                                Start Game <ArrowRight className="ml-2" />
                            </Button>
                        ) : (
                            <div className="flex-[2] flex items-center justify-center gap-2 h-12 bg-white/[0.03] rounded-xl border border-white/[0.06]">
                                <Loader className="animate-spin text-neon-blue" size={18} />
                                <span className="text-sm font-bold text-gray-300">Waiting for host...</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderCountdown = () => {
        if (!lobbyData) return renderMenu();
        let colorClass = "text-white";
        if (countdown === 3) colorClass = "text-red-500";
        if (countdown === 2) colorClass = "text-orange-500";
        if (countdown === 1) colorClass = "text-yellow-400";
        if (countdown <= 0) colorClass = "text-neon-green";

        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] -mt-10 animate-fade-in px-4">
                <div className="text-center space-y-16">
                    <div className="relative flex items-center justify-center">
                        <div className={`absolute w-48 h-48 sm:w-64 sm:h-64 rounded-full blur-3xl opacity-20 transition-colors duration-300 ${colorClass.replace('text-', 'bg-')}`}></div>
                        <span className={`text-[8rem] sm:text-[12rem] font-mono font-black leading-none transition-all duration-300 ${colorClass} drop-shadow-2xl`}>
                            {countdown > 0 ? countdown : 'GO!'}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-[0.3em]">Next Up</p>
                        <h2 className="text-lg sm:text-xl font-bold text-white">{lobbyData.quizTitle}</h2>
                    </div>
                </div>
            </div>
        );
    };

    const renderGame = () => {
        if (!gameQuestions || !lobbyData) return renderMenu();
        const q = gameQuestions[currentQIndex];
        const player = lobbyData.players.find(p => p.username === currentUsername);
        const playerAnswer = playerAnswerLocal;

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center pb-4 border-b border-white/[0.06]">
                    <h3 className="text-lg font-mono text-gray-400">Q<span className="text-white font-bold">{currentQIndex + 1}</span>/{gameQuestions.length}</h3>
                    <div className="flex items-center gap-4 text-white">
                        <span className={`font-bold flex items-center gap-1.5 text-sm ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-neon-blue'}`}>
                            <Clock size={16} /> {timeLeft > 0 ? timeLeft : 0}s
                        </span>
                        <span className="text-neon-green font-bold flex items-center gap-1 text-sm"><Zap size={16} /> {player?.score || 0}</span>
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white leading-relaxed">{q.question}</h2>
                <div className="grid gap-3">
                    {q.options.map((opt, idx) => {
                        let buttonClass = '';
                        let icon = null;
                        if (showAnswerKey) {
                            if (opt === qAnswer.correctAnswer) {
                                buttonClass = 'border-neon-green bg-green-900/20 text-neon-green';
                                icon = <CheckCircle size={20} />;
                            } else if (opt === playerAnswer) {
                                buttonClass = 'border-red-500 bg-red-900/20 text-red-500';
                                icon = <XCircle size={20} />;
                            } else {
                                buttonClass = 'opacity-50';
                            }
                        } else if (isAnswered && opt === playerAnswer) {
                            buttonClass = 'border-neon-blue/50 bg-neon-blue/10 text-neon-blue';
                            icon = <CheckCircle size={20} />;
                        }
                        return (
                            <Button key={idx} onClick={() => handleGameAnswer(opt)} disabled={isAnswered || timeLeft <= 0} variant="game" className={`text-left justify-between ${buttonClass}`}>
                                {opt} {icon}
                            </Button>
                        );
                    })}
                </div>
                {showAnswerKey && (
                    <div className="mt-6 pt-4 border-t border-white/[0.06] animate-fade-in">
                        <div className="flex items-center justify-between text-lg font-bold">
                            <span className="flex items-center gap-2 text-neon-blue"><AlertCircle size={18} /> Explanation</span>
                            <span className={`text-sm ${player?.lastScore > 0 ? 'text-neon-green' : 'text-red-500'}`}>Score: {player?.lastScore > 0 ? `+${player.lastScore}` : 0}</span>
                        </div>
                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{qAnswer.explanation}</p>
                    </div>
                )}
                <div className="pt-2 text-center">
                    <p className="text-sm text-gray-500">{isAnswered && !showAnswerKey ? 'Waiting for results...' : showAnswerKey ? `Next question in ${revealCountdown}s` : 'Answer quickly!'}</p>
                </div>
            </div>
        );
    };

    const renderResults = () => {
        if (!playerRanking || !lobbyData) return renderMenu();
        const totalQuestions = gameQuestions?.length || 0;
        const isWinner = playerRanking[0]?.username === currentUsername;
        const myRank = playerRanking.findIndex(p => p.username === currentUsername) + 1;
        const myScore = playerRanking.find(p => p.username === currentUsername)?.score || 0;
        const podium = playerRanking.slice(0, 3);

        return (
            <div className="space-y-6 text-center relative animate-fade-in">
                <div className="fixed inset-0 z-50 pointer-events-none">
                    <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={isWinner ? 1200 : 400} gravity={0.15} />
                </div>

                <div className="w-16 h-16 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 mx-auto shadow-[0_0_30px_rgba(250,204,21,0.15)]">
                    <Trophy size={32} />
                </div>

                <div>
                    <h2 className="text-3xl font-bold text-white">
                        {isWinner ? 'You Won!' : `You placed #${myRank}`}
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">{lobbyData.quizTitle}</p>
                </div>

                {/* Your Stats Card */}
                <div className={`p-4 rounded-2xl border ${isWinner ? 'bg-yellow-400/5 border-yellow-400/20' : 'bg-neon-blue/5 border-neon-blue/20'}`}>
                    <div className="flex items-center justify-between">
                        <div className="text-left">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Your Result</p>
                            <p className="text-2xl font-bold text-white">{myScore} pts</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Score</p>
                            <p className="text-lg font-bold text-neon-blue">{myRank}/{playerRanking.length}</p>
                        </div>
                    </div>
                    {totalQuestions > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between text-sm">
                            <span className="text-gray-500">Questions</span>
                            <span className="text-white font-medium">{totalQuestions}</span>
                        </div>
                    )}
                </div>

                {/* Podium */}
                {podium.length >= 2 && (
                    <div className="flex items-end justify-center gap-3 pt-2">
                        {/* 2nd Place */}
                        <div className="flex flex-col items-center animate-slide-in-right" style={{ animationDelay: '0.1s' }}>
                            <div className="w-10 h-10 rounded-full bg-gray-400/10 border-2 border-gray-400/30 flex items-center justify-center text-gray-400 text-sm font-bold mb-2">
                                {podium[1]?.username?.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-xs text-gray-400 font-medium truncate max-w-[80px]">{podium[1]?.username}</p>
                            <p className="text-xs text-gray-500 mb-1">{podium[1]?.score} pts</p>
                            <div className="w-20 h-20 bg-gray-400/5 border border-gray-400/15 rounded-t-xl flex items-center justify-center">
                                <span className="text-2xl font-bold text-gray-400">2</span>
                            </div>
                        </div>
                        {/* 1st Place */}
                        <div className="flex flex-col items-center animate-slide-in-right" style={{ animationDelay: '0s' }}>
                            <div className="w-12 h-12 rounded-full bg-yellow-400/10 border-2 border-yellow-400/30 flex items-center justify-center text-yellow-400 text-lg font-bold mb-2 shadow-[0_0_20px_rgba(250,204,21,0.15)]">
                                {podium[0]?.username?.charAt(0).toUpperCase()}
                            </div>
                            <p className="text-xs text-yellow-400 font-bold truncate max-w-[80px]">{podium[0]?.username}</p>
                            <p className="text-xs text-yellow-400/70 mb-1">{podium[0]?.score} pts</p>
                            <div className="w-24 h-28 bg-yellow-400/5 border border-yellow-400/15 rounded-t-xl flex items-center justify-center">
                                <span className="text-3xl font-bold text-yellow-400">1</span>
                            </div>
                        </div>
                        {/* 3rd Place */}
                        {podium[2] && (
                            <div className="flex flex-col items-center animate-slide-in-right" style={{ animationDelay: '0.2s' }}>
                                <div className="w-10 h-10 rounded-full bg-orange-400/10 border-2 border-orange-400/30 flex items-center justify-center text-orange-400 text-sm font-bold mb-2">
                                    {podium[2]?.username?.charAt(0).toUpperCase()}
                                </div>
                                <p className="text-xs text-orange-400 font-medium truncate max-w-[80px]">{podium[2]?.username}</p>
                                <p className="text-xs text-orange-400/70 mb-1">{podium[2]?.score} pts</p>
                                <div className="w-20 h-16 bg-orange-400/5 border border-orange-400/15 rounded-t-xl flex items-center justify-center">
                                    <span className="text-2xl font-bold text-orange-400">3</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Full Rankings */}
                <div className="bg-[#12121b] p-4 rounded-2xl border border-white/[0.06] space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wider text-left mb-3">Full Rankings</p>
                    {playerRanking.map((p, index) => {
                        const medals = ['bg-yellow-400/10 border-yellow-400/20 text-yellow-400', 'bg-gray-400/10 border-gray-400/20 text-gray-400', 'bg-orange-400/10 border-orange-400/20 text-orange-400'];
                        const isMe = p.username === currentUsername;
                        return (
                            <div key={p.username} className={`p-3 rounded-xl flex justify-between items-center font-bold text-sm border ${
                                isMe ? 'bg-neon-blue/10 border-neon-blue/20 text-white' :
                                index < 3 ? medals[index] :
                                'bg-white/[0.02] border-white/[0.06] text-gray-300'
                            }`}>
                                <div className="flex items-center gap-3">
                                    <span className="w-6 text-center text-xs opacity-60">{index + 1}</span>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                                        index === 0 ? 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400' :
                                        index === 1 ? 'bg-gray-400/10 border-gray-400/20 text-gray-400' :
                                        index === 2 ? 'bg-orange-400/10 border-orange-400/20 text-orange-400' :
                                        'bg-white/[0.04] border-white/[0.08] text-gray-400'
                                    }`}>
                                        {p.username?.charAt(0).toUpperCase()}
                                    </div>
                                    <span>{p.username}{isMe && <span className="text-neon-blue ml-1 text-xs">(you)</span>}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-gray-500">+{p.lastScore || 0}</span>
                                    <span className="w-16 text-right">{p.score} pts</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Question Review */}
                {questionResults.length > 0 && (
                    <div className="bg-[#12121b] p-4 rounded-2xl border border-white/[0.06] space-y-3">
                        <p className="text-xs text-gray-500 uppercase tracking-wider text-left mb-3">Question Review</p>
                        {questionResults.map((r, i) => (
                            <div key={i} className={`p-4 rounded-xl border ${r.isCorrect ? 'bg-neon-green/5 border-neon-green/15' : 'bg-red-500/5 border-red-500/15'}`}>
                                <div className="flex items-start justify-between gap-3 mb-2">
                                    <p className="text-sm font-bold text-white text-left leading-relaxed">Q{i + 1}. {r.question}</p>
                                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${r.isCorrect ? 'bg-neon-green/15 text-neon-green' : 'bg-red-500/15 text-red-400'}`}>
                                        {r.isCorrect ? 'Correct' : 'Wrong'}
                                    </span>
                                </div>
                                <div className="space-y-1 mb-2">
                                    {r.options.map((opt, oi) => {
                                        const isCorrect = opt === r.correctAnswer;
                                        const isPlayer = opt === r.playerAnswer;
                                        return (
                                            <div key={oi} className={`text-xs px-3 py-1.5 rounded-lg border ${
                                                isCorrect ? 'bg-neon-green/10 border-neon-green/20 text-neon-green' :
                                                isPlayer && !isCorrect ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                                'bg-white/[0.02] border-white/[0.04] text-gray-400'
                                            }`}>
                                                {isCorrect && '✓ '}{isPlayer && !isCorrect && '✗ '}{opt}
                                            </div>
                                        );
                                    })}
                                </div>
                                {r.explanation && (
                                    <p className="text-xs text-gray-500 leading-relaxed text-left">{r.explanation}</p>
                                )}
                                <div className="mt-2 text-right">
                                    <span className={`text-xs font-bold ${r.points > 0 ? 'text-neon-green' : 'text-gray-500'}`}>+{r.points} pts</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex gap-3">
                    <Button onClick={backToLobby} variant="primary" fullWidth className="h-12 font-bold">Return to Lobby</Button>
                    <Button onClick={leaveRoom} variant="outline" fullWidth className="h-12 font-bold border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.03]">Leave</Button>
                </div>
            </div>
        );
    };

    const renderLoading = () => (
        <div className="text-center flex flex-col items-center justify-center space-y-6 h-80 animate-fade-in">
            <div className="w-16 h-16 bg-neon-blue/10 rounded-2xl flex items-center justify-center animate-pulse">
                <div className="w-8 h-8 bg-neon-blue/20 rounded-lg"></div>
            </div>
            <div>
                <p className="text-xl font-bold text-white">{isRoomActionPending ? "Establishing Connection..." : "Syncing..."}</p>
                <p className="text-sm text-gray-500 mt-1">Securing channel to game server.</p>
            </div>
            <Button type="button" onClick={handleCancel} variant="outline" className="mt-4 border-white/[0.08] text-gray-400 hover:text-white hover:bg-white/[0.03] px-8">
                Cancel Request
            </Button>
        </div>
    );

    const renderContent = () => {
        if (authLoading) return renderLoading();
        switch (view) {
            case 'guest_entry': return renderGuestEntry();
            case 'create': return renderCreateRoom();
            case 'join': return renderJoinRoom();
            case 'lobby': return renderLobby();
            case 'countdown': return renderCountdown();
            case 'game': return renderGame();
            case 'results': return renderResults();
            case 'loading': return renderLoading();
            case 'menu': default: return renderMenu();
        }
    };

    // Guest entry has its own full-page layout
    if (view === 'guest_entry') return renderGuestEntry();

    return (
        <div className="bg-[#0b0b12] min-h-[calc(100vh-4rem)] relative">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-purple/10 blur-[100px] rounded-full" />
            </div>
            <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
                {renderContent()}
            </div>
        </div>
    );
}
