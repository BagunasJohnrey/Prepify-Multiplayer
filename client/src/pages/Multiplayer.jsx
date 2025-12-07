import { useState, useEffect, useRef, useCallback } from 'react'; 
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, PlusCircle, LogIn, Loader, Clock, Trophy, Zap, AlertCircle, CheckCircle, XCircle, Copy, Link as LinkIcon, Share2, User, KeyRound, ArrowRight, UserPlus, ArrowLeft, Gamepad2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import socket from '../utils/socket'; 
import api from '../utils/api'; 
import Confetti from 'react-confetti'; 
import { QRCodeSVG } from 'qrcode.react';

const COUNTDOWN_SECONDS = 5; 
const QUESTION_TIME_MS = 10000; 
const ANSWER_REVEAL_DELAY_MS = 3000; 

export default function Multiplayer() {
    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    // --- GUEST STATE ---
    const [guestName, setGuestName] = useState('');
    const [isGuestSetup, setIsGuestSetup] = useState(false); 

    // Determine the active username
    const currentUsername = user?.username || (isGuestSetup ? guestName : null);

    // View State
    const [view, setView] = useState('loading'); 
    const [roomCode, setRoomCode] = useState('');
    const [lobbyData, setLobbyData] = useState(null); 
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
    const [isConnected, setIsConnected] = useState(socket.connected); 
    const [isRoomActionPending, setIsRoomActionPending] = useState(false); 
    const [copiedField, setCopiedField] = useState(null);
    
    // Game State
    const [gameQuestions, setGameQuestions] = useState(null);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [playerRanking, setPlayerRanking] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [showAnswerKey, setShowAnswerKey] = useState(false); 
    const [qAnswer, setQAnswer] = useState(null); 
    
    // Timer State
    const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS / 1000);
    const qTimerIntervalRef = useRef(null); 
    const roomActionTimeoutRef = useRef(null); 
    const [playerAnswerLocal, setPlayerAnswerLocal] = useState(null); 
    
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [availableQuizzes, setAvailableQuizzes] = useState([]);
    const [quizzesLoading, setQuizzesLoading] = useState(true);
    const [selectedQuizId, setSelectedQuizId] = useState(null);

    // --- State Ref ---
    const stateRef = useRef({
        availableQuizzes,
        currentQIndex,
        user,
        guestName,
        isGuestSetup,
        view,
        lobbyData,
        roomCode
    });

    useEffect(() => {
        stateRef.current = {
            availableQuizzes,
            currentQIndex,
            user,
            guestName,
            isGuestSetup,
            view,
            lobbyData,
            roomCode
        };
    }, [availableQuizzes, currentQIndex, user, guestName, isGuestSetup, view, lobbyData, roomCode]);

    // --- ACTIONS ---
    
    const handleCancel = useCallback(() => {
        setIsRoomActionPending(false);
        setRoomCode(''); 
        setView('menu');
        toast.dismiss();
        navigate('/multiplayer', { replace: true });
    }, [navigate]);

    // --- AUTH & INITIALIZATION ---
    useEffect(() => {
        if (authLoading) return;

        if (user) {
            if (view === 'loading' || view === 'guest_entry') setView('menu');
        } else {
            if (!isGuestSetup && view !== 'guest_entry') {
                setView('guest_entry');
            } else if (isGuestSetup && view === 'loading') {
                setView('menu');
            }
        }
    }, [user, authLoading, isGuestSetup, view]);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const codeParam = searchParams.get('code');
        
        if (codeParam) {
            const cleanCode = codeParam.toUpperCase();
            if (cleanCode !== roomCode) {
                setRoomCode(cleanCode);
            }
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

    // --- Data Fetching ---
    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const { data } = await api.get('/quizzes');
                setAvailableQuizzes(data);
                if (data.length > 0) {
                    setSelectedQuizId(String(data[0].id)); 
                }
            } catch {
                toast.error("Failed to load quizzes.", { duration: 3000 });
            } finally {
                setQuizzesLoading(false);
            }
        };
        fetchQuizzes();
    }, []);

    // Watchdog Timer
    useEffect(() => {
        if (view === 'loading' && isRoomActionPending) {
            roomActionTimeoutRef.current = setTimeout(() => {
                toast.error("Request timed out.", { duration: 4000 });
                handleCancel(); 
            }, 10000); 
        } else {
            if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current);
        }
        return () => {
            if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current);
        };
    }, [view, isRoomActionPending, handleCancel]); 

    // --- Timer Logic ---
    const startQuestionTimer = (durationSeconds) => {
        if (qTimerIntervalRef.current) clearInterval(qTimerIntervalRef.current);
        setTimeLeft(durationSeconds);
        qTimerIntervalRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(qTimerIntervalRef.current);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000); 
    };

    const stopQuestionTimer = () => {
        if (qTimerIntervalRef.current) clearInterval(qTimerIntervalRef.current);
        qTimerIntervalRef.current = null;
    };
    
    // --- Socket Listeners ---
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
                roomCode: data.roomCode,
                quizId: data.quizId,
                quizTitle: quizTitle,
                host: data.host,
                players: data.players.map(p => ({
                    ...p,
                    isHost: p.username === data.host
                }))
            });
            setView('lobby'); 
        };
        
        const handlePlayerAnswered = (data) => {
            const { currentQIndex } = stateRef.current;
            if (data.qIndex === currentQIndex) {
                 toast(`${data.username} submitted an answer!`, { icon: '⚡' });
            }
        };

        const handleStartCountdown = (data) => {
            setGameQuestions(data.quizData);
            setCurrentQIndex(0);
            setIsAnswered(false);
            setShowAnswerKey(false);
            setPlayerAnswerLocal(null); 
            setLobbyData(prev => ({...prev, quizTitle: data.quizTitle}));
            
            const durationSec = data.duration ? (data.duration / 1000) : COUNTDOWN_SECONDS;
            setCountdown(durationSec);
            setView('countdown');
            
            if (countdownInterval) clearInterval(countdownInterval);

            countdownInterval = setInterval(() => {
                setCountdown(c => {
                    if (c <= 1) {
                        clearInterval(countdownInterval);
                        return 0;
                    }
                    return c - 1;
                });
            }, 1000);
        };
        
        const handleShowAnswer = (data) => {
            stopQuestionTimer();
            setLobbyData(prev => ({ ...prev, players: data.players }));
            setQAnswer({
                correctAnswer: data.correctAnswer,
                explanation: data.correctExplanation,
                isLastQuestion: data.isLastQuestion,
            });
            setShowAnswerKey(true); 
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
            toast.error(message, { duration: 3000 });
            if (stateRef.current.view === 'loading') {
                handleCancel();
            }
        };

        socket.on('lobbyUpdate', handleLobbyUpdate); 
        socket.on('playerJoined', (data) => toast.success(`${data.username} joined!`)); 
        socket.on('playerAnswered', handlePlayerAnswered); 
        socket.on('startCountdown', handleStartCountdown); 
        socket.on('showAnswer', handleShowAnswer); 
        socket.on('nextQuestion', handleNextQuestion);
        socket.on('showResults', handleShowResults);
        socket.on('roomError', handleRoomError);

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
            if (countdownInterval) clearInterval(countdownInterval);
            stopQuestionTimer();
        };
    }, [handleCancel, navigate]);

    // --- OTHER ACTIONS ---

    const handleGuestEntry = (e) => {
        e.preventDefault();
        if (!guestName.trim()) return toast.error("Please enter a name.");
        setIsGuestSetup(true);
        setView('menu');
    };

    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!isConnected || isRoomActionPending) return toast.error("Connection or previous action pending.");
        if (quizzesLoading || availableQuizzes.length === 0) return toast.error("Please wait for quizzes to load.");
        if (!currentUsername) return toast.error("Identity error. Please reload.");
        if (!selectedQuizId) return toast.error("Please select a quiz.");
        
        setView('loading');
        setIsRoomActionPending(true); 
        socket.emit('createRoom', { username: currentUsername, quizId: selectedQuizId });
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (!isConnected || isRoomActionPending) return toast.error("Connection or previous action pending.");
        const code = roomCode.toUpperCase();
        if (!currentUsername || code.length !== 4) return toast.error("Invalid Room Code or Username.");
        
        setView('loading');
        setRoomCode(code);
        setIsRoomActionPending(true); 
        socket.emit('joinRoom', { roomCode: code, username: currentUsername });
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
        if (lobbyData) {
            socket.emit('leaveRoom', { roomCode: lobbyData.roomCode });
        }
        setLobbyData(null);
        handleCancel();
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedField(null), 2000);
    };

    // --- RENDERERS ---

    const renderGuestEntry = () => (
        <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in text-center max-w-sm mx-auto w-full">
            <div className="mb-4">
                <div className="w-20 h-20 bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-neon-blue shadow-[0_0_30px_rgba(37,99,235,0.3)] animate-pulse-slow">
                    <UserPlus size={40} className="text-neon-blue" />
                </div>
                <h2 className="text-4xl font-black text-white mb-2">Identify Yourself</h2>
                <p className="text-gray-400 text-sm">Enter a temporary nickname to join the arena.</p>
            </div>

            <div className="w-full space-y-6">
                <form onSubmit={handleGuestEntry} className="space-y-4">
                    <Input 
                        placeholder="e.g. Maverick" 
                        value={guestName} 
                        onChange={(e) => setGuestName(e.target.value)} 
                        className="text-center h-14 text-lg bg-gray-900/50 border-gray-700 focus:border-neon-blue font-bold tracking-wide"
                    />
                    <Button type="submit" variant="primary" className="w-full h-14 text-lg font-bold shadow-lg shadow-blue-500/20">
                        Continue as Guest <ArrowRight size={18} className="ml-2" />
                    </Button>
                </form>

                <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
                    <div className="relative flex justify-center text-xs"><span className="px-4 bg-[#1a1a2e] text-gray-500 font-bold tracking-widest uppercase">Member Access</span></div>
                </div>

                <Button onClick={() => navigate('/')} variant="outline" className="w-full h-12 border-gray-700 hover:bg-gray-800 hover:text-white text-gray-400">
                    <LogIn size={18} className="mr-2" /> Login / Register
                </Button>
            </div>
        </div>
    );

    const renderMenu = () => (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pb-6 border-b border-gray-800/50">
                <div>
                    <h2 className="text-3xl font-black text-white flex items-center gap-3">
                        <Gamepad2 className="text-neon-purple" size={32} /> Multiplayer Arena
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">Challenge friends in real-time battles.</p>
                </div>
                <div className="flex items-center gap-3 bg-black/30 px-5 py-2.5 rounded-full border border-gray-700/50 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse"></div>
                    <span className="text-sm font-bold text-white tracking-wide">{currentUsername}</span>
                </div>
            </div>
            
            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Create Room Card */}
                <button 
                    onClick={() => setView('create')} 
                    disabled={isRoomActionPending || quizzesLoading || availableQuizzes.length === 0 || !isConnected}
                    className="group relative h-64 rounded-3xl overflow-hidden text-left border border-white/5 bg-gray-900/40 hover:bg-gray-800/60 transition-all duration-300 hover:border-neon-blue/50 hover:shadow-[0_0_30px_rgba(0,243,255,0.1)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <div className="absolute top-6 left-6 bg-gray-800/80 p-4 rounded-2xl border border-white/10 text-neon-blue shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <PlusCircle size={32} />
                    </div>

                    <div className="absolute bottom-6 left-6 right-6">
                        <h3 className="text-2xl font-black text-white mb-2 group-hover:text-neon-blue transition-colors">Create Room</h3>
                        <p className="text-sm text-gray-400 font-medium leading-relaxed">Host a new game session. Select your quiz material and invite others to join via code.</p>
                    </div>
                    
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <ArrowRight className="text-gray-500" />
                    </div>
                </button>
                
                {/* Join Room Card */}
                <button 
                    onClick={() => setView('join')} 
                    disabled={isRoomActionPending || !isConnected}
                    className="group relative h-64 rounded-3xl overflow-hidden text-left border border-white/5 bg-gray-900/40 hover:bg-gray-800/60 transition-all duration-300 hover:border-neon-green/50 hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-neon-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    <div className="absolute top-6 left-6 bg-gray-800/80 p-4 rounded-2xl border border-white/10 text-neon-green shadow-lg group-hover:scale-110 transition-transform duration-300">
                        <LogIn size={32} />
                    </div>

                    <div className="absolute bottom-6 left-6 right-6">
                        <h3 className="text-2xl font-black text-white mb-2 group-hover:text-neon-green transition-colors">Join Room</h3>
                        <p className="text-sm text-gray-400 font-medium leading-relaxed">Enter an existing 4-digit room code to jump into a lobby instantly.</p>
                    </div>

                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <ArrowRight className="text-gray-500" />
                    </div>
                </button>
            </div>

            {!isConnected && (
                <div className="flex items-center justify-center gap-2 text-red-500 bg-red-500/10 py-3 rounded-xl border border-red-500/20">
                    <AlertCircle size={16} />
                    <span className="text-xs font-bold uppercase tracking-wide">Disconnected from Server</span>
                </div>
            )}
        </div>
    );

    const renderJoinRoom = () => (
        <form onSubmit={handleJoinRoom} className="flex flex-col h-full justify-between animate-fade-in">
            <div className="text-center space-y-2 mt-4">
                <div className="inline-flex items-center justify-center p-4 bg-gray-800/50 rounded-2xl border border-gray-700/50 mb-4 shadow-xl">
                    <KeyRound size={32} className="text-neon-green" />
                </div>
                <h2 className="text-3xl font-black text-white">Enter Access Code</h2>
                <p className="text-gray-400 text-sm">Ask the host for the 4-character ID.</p>
            </div>

            <div className="flex-1 flex items-center justify-center py-8">
                <div className="relative group w-full max-w-xs mx-auto">
                    {/* Glow effect behind input */}
                    <div className="absolute inset-0 bg-neon-green/20 blur-xl rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
                    
                    <input 
                        type="text" 
                        placeholder="____" 
                        value={roomCode} 
                        onChange={e => setRoomCode(e.target.value.toUpperCase())} 
                        maxLength={4} 
                        className="relative w-full text-center text-5xl font-mono font-bold uppercase tracking-[0.5em] py-6 bg-black/60 border-2 border-gray-700 rounded-2xl text-white focus:border-neon-green focus:outline-none focus:bg-black/80 transition-all placeholder-gray-800 shadow-2xl"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Button type="button" onClick={handleCancel} variant="outline" className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 h-14">
                    Cancel
                </Button>
                <Button type="submit" variant="primary" className="bg-neon-green hover:bg-green-500 text-black font-bold h-14 shadow-[0_0_20px_rgba(34,197,94,0.2)]" disabled={isRoomActionPending || roomCode.length !== 4}>
                    Join Lobby
                </Button>
            </div>
        </form>
    );

    const renderCreateRoom = () => (
        <form onSubmit={handleCreateRoom} className="flex flex-col h-full animate-fade-in">
            <div className="text-center mb-8 mt-4">
                <h2 className="text-3xl font-black text-white mb-2">Configure Lobby</h2>
                <p className="text-gray-400 text-sm">Select the material for this session.</p>
            </div>

            <div className="flex-1">
                {quizzesLoading ? (
                    <div className="h-full flex items-center justify-center text-neon-blue gap-2">
                        <Loader className="animate-spin" /> Loading Library...
                    </div>
                ) : (
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Select Quiz Material</label>
                        <div className="relative group">
                            <select 
                                value={selectedQuizId || ''} 
                                onChange={(e) => setSelectedQuizId(e.target.value)} 
                                className="w-full bg-black/40 border border-gray-700 rounded-2xl p-5 text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue outline-none cursor-pointer text-lg appearance-none shadow-inner transition-all font-medium"
                            >
                                {availableQuizzes.map(quiz => (
                                    <option key={quiz.id} value={String(quiz.id)} className="bg-gray-900">
                                        {quiz.title} • {quiz.difficulty}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-neon-blue transition-colors">
                                <ArrowRight size={20} className="rotate-90" />
                            </div>
                        </div>
                        
                        {selectedQuizId && (
                            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                                <AlertCircle size={18} className="text-blue-400 mt-0.5 shrink-0" />
                                <p className="text-xs text-blue-200 leading-relaxed">
                                    The game will start once all players have joined the lobby. As the host, you control when the questions begin.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
                <Button type="button" onClick={handleCancel} variant="outline" className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 h-14">
                    Cancel
                </Button>
                <Button type="submit" variant="success" className="h-14 font-bold text-lg shadow-[0_0_20px_rgba(0,243,255,0.2)] bg-linear-to-r from-blue-600 to-purple-600 border-none text-white hover:opacity-90" disabled={isRoomActionPending}>
                    Create
                </Button>
            </div>
        </form>
    );

    const renderLobby = () => {
        if (!lobbyData) return renderMenu();
        const players = lobbyData.players || [];
        const inviteLink = `${window.location.origin}/multiplayer?code=${lobbyData.roomCode}`;

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col items-center border-b border-gray-800 pb-6">
                    <span className="text-xs font-bold text-neon-blue uppercase tracking-widest mb-2 bg-neon-blue/10 px-3 py-1 rounded-full border border-neon-blue/20">Lobby Active</span>
                    <h2 className="text-3xl md:text-4xl font-black text-white mt-3 text-center">{lobbyData.quizTitle}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Players List */}
                    <div className="bg-black/30 p-5 rounded-3xl border border-white/5 flex flex-col h-[380px]">
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Users size={16} /> Roster ({players.length})
                            </h3>
                            {lobbyData.host === currentUsername && (
                                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-1 rounded border border-purple-500/30">HOST</span>
                            )}
                        </div>
                        <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                            {players.map(player => (
                                <div key={player.username} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full ${player.isHost ? 'bg-neon-purple shadow-[0_0_10px_#bc13fe]' : 'bg-neon-green shadow-[0_0_8px_#39ff14]'}`}></div>
                                        <span className="text-white font-bold tracking-wide">{player.username}</span>
                                    </div>
                                    {player.username === currentUsername && <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">YOU</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Invite Section */}
                    <div className="bg-black/30 p-5 rounded-3xl border border-white/5 flex flex-col items-center h-[380px]">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2 w-full justify-center border-b border-white/5 pb-4 shrink-0">
                            <Share2 size={16} /> Scan to Join
                        </h3>
                        
                        <div className="flex-1 flex items-center justify-center py-2">
                            <div className="p-4 bg-white rounded-2xl shadow-xl">
                                <QRCodeSVG value={inviteLink} size={140} level={"H"} />
                            </div>
                        </div>
                        
                        <div className="w-full space-y-3 shrink-0">
                            <div className="flex items-center gap-2 bg-gray-900 p-1.5 pr-3 rounded-xl border border-gray-700 group hover:border-neon-blue transition-colors">
                                <div className="bg-gray-800 px-4 py-2 rounded-lg text-neon-green font-mono font-bold text-2xl tracking-widest border border-gray-700 shadow-inner">
                                    {lobbyData.roomCode}
                                </div>
                                <div className="flex-1 text-left pl-2">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase">Room Code</div>
                                </div>
                                <button onClick={() => copyToClipboard(lobbyData.roomCode, 'code')} className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition">
                                    {copiedField === 'code' ? <CheckCircle size={20} className="text-green-500" /> : <Copy size={20} />}
                                </button>
                            </div>
                            
                            <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-xl border border-gray-700 cursor-pointer group hover:border-neon-blue transition-colors" onClick={() => copyToClipboard(inviteLink, 'link')}>
                                <div className="bg-gray-800 p-2 rounded-lg text-neon-blue border border-gray-700"><LinkIcon size={18} /></div>
                                <div className="flex-1 text-left overflow-hidden">
                                    <div className="text-[10px] text-gray-500 font-bold uppercase">Direct Link</div>
                                    <div className="text-xs text-gray-400 truncate w-full opacity-60">{inviteLink}</div>
                                </div>
                                <button className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition">
                                    {copiedField === 'link' ? <CheckCircle size={20} className="text-green-500" /> : <Copy size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-gray-800 flex items-center justify-between gap-4">
                    <Button type="button" onClick={leaveRoom} variant="ghost" className="text-red-500 hover:bg-red-500/10 px-6">
                        Leave Room
                    </Button>
                    
                    {lobbyData.host === currentUsername ? (
                        <Button onClick={handleStartGame} variant="success" className="px-10 h-14 text-lg font-bold shadow-[0_0_20px_rgba(57,255,20,0.3)] bg-neon-green text-black hover:bg-[#32e010]">
                            Start Game <ArrowRight className="ml-2" />
                        </Button>
                    ) : (
                        <div className="flex items-center gap-3 px-6 py-3 bg-gray-900 rounded-xl border border-gray-700/50">
                            <Loader className="animate-spin text-neon-blue" size={20} />
                            <span className="text-sm font-bold text-gray-300">Waiting for Host...</span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ... (Keep Countdown, Game, and Results as they are generally okay, or apply similar styling if desired. 
    // For now, I will focus on the requested screens: Menu, Join, Loading)

    const renderCountdown = () => {
        if (!lobbyData) return renderMenu();
        let colorClass = "text-white";
        if (countdown === 3) colorClass = "text-red-500";
        if (countdown === 2) colorClass = "text-orange-500";
        if (countdown === 1) colorClass = "text-yellow-400";
        if (countdown <= 0) colorClass = "text-neon-green";

        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in py-10">
                <h3 className="text-gray-500 font-bold uppercase tracking-[0.5em] mb-12 animate-pulse">Get Ready</h3>
                <div className="relative flex items-center justify-center">
                    <div className={`absolute w-64 h-64 rounded-full blur-3xl opacity-20 transition-colors duration-300 ${colorClass.replace('text-', 'bg-')}`}></div>
                    <span className={`text-[12rem] font-mono font-black leading-none transition-all duration-300 transform scale-100 ${colorClass} drop-shadow-2xl`}>
                        {countdown > 0 ? countdown : 'GO!'}
                    </span>
                </div>
                <div className="mt-16 text-center space-y-3">
                    <span className="text-neon-blue text-sm font-bold uppercase tracking-wider bg-neon-blue/10 px-3 py-1 rounded-full">Next Up</span>
                    <h2 className="text-2xl md:text-3xl font-black text-white max-w-lg leading-tight">{lobbyData.quizTitle}</h2>
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
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                    <h3 className="text-xl font-mono text-gray-400">Q<span className="text-white font-bold">{currentQIndex + 1}</span>/{gameQuestions.length}</h3>
                    <div className="flex items-center gap-4 text-white">
                        <span className={`font-bold flex items-center gap-1.5 leading-none ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-neon-blue'}`}>
                            <Clock size={18} className="mb-px" /> {timeLeft > 0 ? timeLeft : 0}s
                        </span>
                        <span className="text-neon-green font-bold flex items-center gap-1"><Zap size={18} /> {player?.score || 0}</span>
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-white leading-relaxed">{q.question}</h2>
                <div className="grid gap-4">
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
                    <div className="mt-8 pt-4 border-t border-gray-800 animate-fade-in">
                        <div className="flex items-center justify-between text-lg font-bold">
                            <span className="flex items-center gap-2 text-neon-blue"><AlertCircle size={18} /> Explanation</span>
                            <span className={`text-sm ${player?.lastScore > 0 ? 'text-neon-green' : 'text-red-500'}`}>Score: {player?.lastScore > 0 ? `+${player.lastScore}` : 0}</span>
                        </div>
                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{qAnswer.explanation}</p>
                    </div>
                )}
                <div className="pt-4 text-center">
                    <p className="text-sm text-gray-500">{isAnswered && !showAnswerKey ? 'Waiting for results...' : showAnswerKey ? `Next question in ${ANSWER_REVEAL_DELAY_MS / 1000} seconds.` : 'Answer quickly!'}</p>
                </div>
            </div>
        );
    };

    const renderResults = () => {
        if (!playerRanking || !lobbyData) return renderMenu();
        return (
            <div className="space-y-6 text-center relative animate-fade-in">
                 <div className="fixed inset-0 z-50 pointer-events-none">
                     <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={800} gravity={0.2} />
                 </div>
                <Trophy size={60} className="text-neon-yellow mx-auto" />
                <h2 className="text-4xl font-black text-white">Final Ranking</h2>
                <p className="text-gray-400">Quiz: {lobbyData.quizTitle}</p>
                <div className="bg-gray-900 p-4 rounded-2xl border border-gray-700 space-y-3">
                    {playerRanking.map((p, index) => (
                        <div key={p.username} className={`p-3 rounded-lg flex justify-between items-center font-bold ${
                            index === 0 ? 'bg-neon-green/20 border-neon-green text-neon-green' : 
                            p.username === currentUsername ? 'bg-neon-blue/20 border-neon-blue text-white' : 
                            'bg-gray-800 text-gray-300'
                        }`}>
                            <span className="w-1/12">{index + 1}</span>
                            <span className="w-5/12 text-left">{p.username}</span>
                            <span className="w-6/12 text-right">{p.score} Points</span>
                        </div>
                    ))}
                </div>
                <Button onClick={leaveRoom} variant="primary" className="w-full justify-center">Return to Menu</Button>
            </div>
        );
    };
    
    // UPDATED: Loading screen
    const renderLoading = () => (
        <div className="text-center text-neon-blue flex flex-col items-center justify-center space-y-6 h-80 animate-fade-in">
            <div className="relative">
                <div className="absolute inset-0 bg-neon-blue/20 blur-xl rounded-full"></div>
                <Loader size={64} className="animate-spin relative z-10" />
            </div>
            <div>
                <p className="text-2xl font-black text-white tracking-wide">{isRoomActionPending ? "Establishing Connection..." : "Syncing..."}</p>
                <p className="text-sm text-gray-500 mt-2 font-medium">Securing channel to game server.</p>
            </div>
            <Button 
                type="button" 
                onClick={handleCancel} 
                variant="outline" 
                className="mt-4 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 w-auto px-8 rounded-full"
            >
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

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4 animate-fade-in">
            {/* Main Glassmorphic Container */}
            <div className="bg-[#1a1a2e]/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 w-full max-w-4xl shadow-2xl relative overflow-hidden">
                
                {/* Decorative Top Gradient Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neon-blue via-purple-500 to-neon-green opacity-50"></div>
                
                {renderContent()}
            </div>
        </div>
    );
}