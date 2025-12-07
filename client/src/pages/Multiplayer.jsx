import { useState, useEffect, useRef } from 'react'; 
import { useLocation, useNavigate } from 'react-router-dom';
import { Users, PlusCircle, LogIn, Loader, Clock, Trophy, Zap, AlertCircle, CheckCircle, XCircle, Copy, Link as LinkIcon, Share2, User, KeyRound, ArrowRight, UserPlus, ArrowLeft } from 'lucide-react';
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
    const { user, loading: authLoading } = useAuth(); // Import loading state
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

    // --- AUTH & INITIALIZATION LOGIC ---
    useEffect(() => {
        // Wait for Auth to finish loading before making decisions
        if (authLoading) return;

        if (user) {
            // User is logged in, ready for menu
            if (view === 'loading' || view === 'guest_entry') setView('menu');
        } else {
            // Not logged in: Show guest entry unless already set up
            if (!isGuestSetup && view !== 'guest_entry') {
                setView('guest_entry');
            } else if (isGuestSetup && view === 'loading') {
                setView('menu');
            }
        }
    }, [user, authLoading, isGuestSetup, view]);

    // --- Handle URL Params (Join Link) ---
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const codeParam = searchParams.get('code');
        
        if (codeParam && !roomCode) {
            setRoomCode(codeParam.toUpperCase());
        }

        // Only switch to JOIN view if we are fully authenticated (Guest or User)
        // and currently in the menu (ready to act)
        if (codeParam && currentUsername && view === 'menu') {
            setView('join');
            // Do not clear history yet, let the user confirm joining
            toast.success('Room code found! Click Enter to join.', { icon: '🔗' });
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
                setIsRoomActionPending(false);
                setView('menu');
            }, 10000); 
        } else {
            if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current);
        }
        return () => {
            if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current);
        };
    }, [view, isRoomActionPending]); 

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
            
            // If we successfully joined, clear the URL code to prevent loop
            window.history.replaceState({}, '', '/multiplayer');

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
            
            // If we are stuck in loading, go back to menu
            if (stateRef.current.view === 'loading') {
                setView('menu');
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
    }, []);

    // --- Actions ---
    
    const handleCancel = () => {
        setIsRoomActionPending(false);
        setRoomCode(''); 
        // Reset everything to menu state
        setView('menu');
        toast.dismiss();
    };

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
    
    // FIX: Cleaner Leave Logic
    const leaveRoom = () => {
        if (lobbyData) {
            // Use the new server event instead of disconnect
            socket.emit('leaveRoom', { roomCode: lobbyData.roomCode });
        }
        setLobbyData(null);
        setRoomCode(''); // Clear code so we don't rejoin immediately
        setView('menu');
        setIsRoomActionPending(false);
    };

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedField(null), 2000);
    };

    // --- RENDERERS ---

    const renderGuestEntry = () => (
        <div className="flex flex-col items-center justify-center space-y-8 animate-fade-in text-center">
            <div className="mb-4">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-neon-blue shadow-[0_0_20px_rgba(37,99,235,0.3)]">
                    <UserPlus size={40} className="text-neon-blue" />
                </div>
                <h2 className="text-4xl font-black text-white mb-3">Welcome to Arena</h2>
                <p className="text-gray-400 text-lg">Choose how you want to play today.</p>
            </div>

            <div className="w-full max-w-sm space-y-8">
                <div className="space-y-4">
                    <form onSubmit={handleGuestEntry} className="space-y-3">
                        <Input 
                            label="Play as Guest"
                            placeholder="Enter a nickname..." 
                            value={guestName} 
                            onChange={(e) => setGuestName(e.target.value)} 
                            className="text-center h-12 text-lg bg-gray-900 border-gray-700 focus:border-neon-blue"
                        />
                        <Button type="submit" variant="primary" className="w-full h-12 text-lg font-bold shadow-lg shadow-blue-500/20">
                            Continue as Guest <ArrowRight size={18} className="ml-2" />
                        </Button>
                    </form>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-700"></div></div>
                    <div className="relative flex justify-center text-sm"><span className="px-4 bg-dark-surface text-gray-500 font-bold tracking-wider">OR</span></div>
                </div>

                <Button onClick={() => navigate('/')} variant="outline" className="w-full h-12 border-gray-600 hover:bg-gray-800 text-gray-300">
                    <LogIn size={18} className="mr-2" /> Login / Register
                </Button>
            </div>
        </div>
    );

    const renderMenu = () => (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-center pb-6 border-b border-gray-800">
                <h2 className="text-3xl font-black text-white">Multiplayer Arena</h2>
                <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-full border border-gray-700 shadow-sm">
                    <User size={18} className="text-neon-blue" />
                    <span className="text-sm font-bold text-white tracking-wide">{currentUsername}</span>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                    onClick={() => setView('create')} 
                    className="group relative flex flex-col items-center justify-center h-48 space-y-4 bg-linear-to-br from-blue-900/40 to-purple-900/40 border border-blue-500/30 hover:border-blue-400 rounded-3xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]"
                    disabled={isRoomActionPending || quizzesLoading || availableQuizzes.length === 0 || !isConnected}
                >
                    <div className="absolute inset-0 bg-blue-600/10 group-hover:bg-blue-600/20 transition-all"></div>
                    <div className="bg-blue-600 p-4 rounded-full shadow-lg shadow-blue-500/40 group-hover:scale-110 transition-transform">
                        <PlusCircle size={32} className="text-white" />
                    </div>
                    <div className="text-center z-10">
                        <span className="block text-2xl font-black text-white mb-1">Create Room</span>
                        <span className="block text-sm text-blue-200 font-medium">Host a game for friends</span>
                    </div>
                </Button>
                
                <Button 
                    onClick={() => setView('join')} 
                    className="group relative flex flex-col items-center justify-center h-48 space-y-4 bg-linear-to-br from-gray-900 to-gray-800 border border-gray-700 hover:border-neon-green rounded-3xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                    disabled={isRoomActionPending || !isConnected}
                >
                    <div className="absolute inset-0 bg-green-500/5 group-hover:bg-green-500/10 transition-all"></div>
                    <div className="bg-gray-800 border border-gray-600 group-hover:border-neon-green p-4 rounded-full shadow-lg group-hover:scale-110 transition-transform">
                        <LogIn size={32} className="text-neon-green" />
                    </div>
                    <div className="text-center z-10">
                        <span className="block text-2xl font-black text-white mb-1">Join Room</span>
                        <span className="block text-sm text-gray-400 font-medium group-hover:text-gray-300">Enter a code to play</span>
                    </div>
                </Button>
            </div>
            {!isConnected && <div className="text-center text-red-500 animate-pulse font-mono text-sm mt-4">● Connecting to server...</div>}
        </div>
    );

    const renderJoinRoom = () => (
        <form onSubmit={handleJoinRoom} className="space-y-8 animate-fade-in text-center max-w-sm mx-auto">
            <div className="mb-8">
                <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700 shadow-xl">
                    <KeyRound size={32} className="text-neon-green" />
                </div>
                <h2 className="text-3xl font-black text-white">Join Game</h2>
                <p className="text-gray-400">Enter the 4-character code below.</p>
            </div>

            <div className="relative group">
                <div className="absolute inset-0 bg-neon-green/20 blur-xl rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
                <Input 
                    type="text" 
                    placeholder="CODE" 
                    value={roomCode} 
                    onChange={e => setRoomCode(e.target.value.toUpperCase())} 
                    maxLength={4} 
                    className="relative text-center text-5xl font-mono font-black uppercase tracking-[0.3em] h-24 bg-gray-900/90 border-2 border-gray-700 focus:border-neon-green rounded-2xl placeholder-gray-800 text-white shadow-2xl transition-all"
                />
            </div>

            <div className="space-y-3 pt-6">
                <Button type="submit" variant="primary" className="w-full h-14 text-lg font-bold bg-neon-green hover:bg-green-500 text-black shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all hover:scale-[1.02]" disabled={isRoomActionPending || roomCode.length !== 4}>
                    Enter Room <ArrowRight className="ml-2" />
                </Button>
                {/* Fixed Cancel Button */}
                <Button type="button" onClick={handleCancel} variant="ghost" className="w-full text-gray-500 hover:text-white" disabled={false}>
                    <ArrowLeft size={16} className="mr-2" /> Cancel
                </Button>
            </div>
        </form>
    );

    const renderCreateRoom = () => (
        <form onSubmit={handleCreateRoom} className="space-y-6 animate-fade-in">
            <h2 className="text-3xl font-black text-neon-blue mb-6">Setup Game</h2>
            <p className="text-gray-400">Select the quiz material for your battle.</p>
            {quizzesLoading ? <div className="text-center text-neon-blue">Loading Quizzes...</div> : (
                <>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Quiz Material</label>
                    <div className="relative">
                        <select value={selectedQuizId || ''} onChange={(e) => setSelectedQuizId(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:border-neon-purple outline-none cursor-pointer text-lg appearance-none shadow-sm hover:border-gray-500 transition-colors">
                            {availableQuizzes.map(quiz => (
                                <option key={quiz.id} value={String(quiz.id)}>{quiz.title} ({quiz.difficulty})</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">▼</div>
                    </div>
                </>
            )}
            <div className="pt-6 space-y-3">
                <Button type="submit" variant="success" className="w-full h-14 text-lg font-bold shadow-lg shadow-purple-500/20" disabled={isRoomActionPending}>
                    Create Lobby <ArrowRight className="ml-2" />
                </Button>
                <Button type="button" onClick={handleCancel} variant="outline" className="w-full border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800" disabled={false}>
                    Cancel
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
                    <span className="text-xs font-bold text-neon-blue uppercase tracking-widest mb-2">Lobby Ready</span>
                    <h2 className="text-3xl md:text-4xl font-black text-white">{lobbyData.quizTitle}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <Users size={16} /> Players ({players.length})
                            </h3>
                            {lobbyData.host === currentUsername && (
                                <span className="text-xs bg-neon-purple/20 text-neon-purple px-2 py-0.5 rounded-full border border-neon-purple/50">You are Host</span>
                            )}
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {players.map(player => (
                                <div key={player.username} className="flex justify-between items-center p-3 bg-gray-800 rounded-xl border border-gray-700/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${player.isHost ? 'bg-neon-purple' : 'bg-neon-green'} animate-pulse`}></div>
                                        <span className="text-white font-medium">{player.username}</span>
                                    </div>
                                    {player.username === currentUsername && <span className="text-xs text-gray-500 font-bold">YOU</span>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700 flex flex-col items-center text-center space-y-6">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Share2 size={16} /> Invite Friends
                        </h3>
                        <div className="p-3 bg-white rounded-xl shadow-lg">
                             <QRCodeSVG value={inviteLink} size={120} level={"H"} />
                        </div>
                        <div className="w-full space-y-3">
                            <div className="flex items-center gap-2 bg-black/40 p-1.5 pr-3 rounded-xl border border-gray-700 group hover:border-neon-blue transition-colors">
                                <div className="bg-gray-800 px-3 py-2 rounded-lg text-neon-green font-mono font-bold text-xl tracking-widest border border-gray-700">
                                    {lobbyData.roomCode}
                                </div>
                                <div className="flex-1 text-left text-xs text-gray-500 font-medium">Room Code</div>
                                <button onClick={() => copyToClipboard(lobbyData.roomCode, 'code')} className="text-gray-400 hover:text-white p-2">
                                    {copiedField === 'code' ? <CheckCircle size={20} className="text-green-500" /> : <Copy size={20} />}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-gray-700 cursor-pointer group hover:border-neon-blue transition-colors" onClick={() => copyToClipboard(inviteLink, 'link')}>
                                <div className="bg-gray-800 p-2 rounded-lg text-neon-blue border border-gray-700"><LinkIcon size={18} /></div>
                                <div className="flex-1 text-left">
                                    <div className="text-xs text-gray-500 font-medium">Direct Link</div>
                                    <div className="text-xs text-gray-400 truncate max-w-[120px]">{inviteLink}</div>
                                </div>
                                <button className="text-gray-400 hover:text-white p-2">
                                    {copiedField === 'link' ? <CheckCircle size={20} className="text-green-500" /> : <Copy size={20} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-gray-800 flex flex-col gap-3">
                    {lobbyData.host === currentUsername ? (
                        <Button onClick={handleStartGame} variant="success" className="w-full justify-center h-14 text-lg shadow-lg shadow-green-500/20">Start Game</Button>
                    ) : (
                        <div className="w-full py-4 text-center bg-gray-900 rounded-xl border border-gray-700 text-neon-blue font-bold animate-pulse">Waiting for Host to Start...</div>
                    )}
                    <Button type="button" onClick={leaveRoom} variant="ghost" className="w-full justify-center text-red-500 hover:bg-red-500/10">Leave Room</Button>
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
    
    const renderLoading = () => (
        <div className="text-center text-neon-blue flex flex-col items-center justify-center space-y-4 h-64">
            <Loader size={48} className="animate-spin" /> 
            <p className="text-xl font-bold">{isRoomActionPending ? "Awaiting server response..." : "Connecting to server..."}</p>
            <p className="text-sm text-gray-500">Waiting for room details. (Will time out in 15s if no response)</p>
        </div>
    );

    const renderContent = () => {
        if (authLoading) return renderLoading(); // Wait for Auth

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
            <div className="bg-dark-surface p-8 rounded-3xl border border-gray-800 w-full max-w-4xl shadow-2xl">
                {renderContent()}
            </div>
        </div>
    );
}