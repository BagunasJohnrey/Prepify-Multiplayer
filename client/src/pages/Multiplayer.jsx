import { useState, useEffect, useRef } from 'react'; 
import { Users, PlusCircle, LogIn, QrCode, Loader, Clock, Trophy, Zap, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import toast from 'react-hot-toast';
import socket from '../utils/socket'; 
import api from '../utils/api'; 
import Confetti from 'react-confetti'; 

const COUNTDOWN_SECONDS = 5; 
const QUESTION_TIME_MS = 10000; 
const ANSWER_REVEAL_DELAY_MS = 3000; 

export default function Multiplayer() {
    const { user } = useAuth();
    const [view, setView] = useState('menu'); 
    const [roomCode, setRoomCode] = useState('');
    const [lobbyData, setLobbyData] = useState(null); 
    const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
    const [isConnected, setIsConnected] = useState(socket.connected); 
    const [isRoomActionPending, setIsRoomActionPending] = useState(false); 
    
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
    
    // UI State
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    const [availableQuizzes, setAvailableQuizzes] = useState([]);
    const [quizzesLoading, setQuizzesLoading] = useState(true);
    const [selectedQuizId, setSelectedQuizId] = useState(null);

    // --- State Ref Pattern ---
    const stateRef = useRef({
        availableQuizzes,
        currentQIndex,
        user,
        view,
        lobbyData,
        roomCode
    });

    useEffect(() => {
        stateRef.current = {
            availableQuizzes,
            currentQIndex,
            user,
            view,
            lobbyData,
            roomCode
        };
    }, [availableQuizzes, currentQIndex, user, view, lobbyData, roomCode]);

    // --- Window Resize Listener for Confetti ---
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
            } catch (error) {
                toast.error("Failed to load quizzes for multiplayer.", { duration: 3000 });
                console.error("Quiz fetch error:", error);
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
                toast.error("Room action timed out. Please retry.", { duration: 5000 });
                setView('menu');
                setIsRoomActionPending(false);
            }, 15000); 
        } else {
            if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current);
        }
        return () => {
            if (roomActionTimeoutRef.current) clearTimeout(roomActionTimeoutRef.current);
        };
    }, [view, isRoomActionPending]); 

    // --- Core Timer Logic ---
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
    
    // --- Socket Listeners Setup ---
    useEffect(() => {
        let countdownInterval;

        if (socket.connected) setIsConnected(true);

        const onConnect = () => {
            setIsConnected(true);
            const { view, roomCode, user } = stateRef.current;
            if (view === 'loading' && roomCode) {
                 socket.emit('joinRoom', { roomCode, username: user.username });
            }
        };

        const onDisconnect = () => {
            setIsConnected(false);
            const { lobbyData } = stateRef.current;
            if (lobbyData) {
                toast.error("Disconnected from lobby. Reconnecting...", { duration: 3000 });
            }
        };
        
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        const handleLobbyUpdate = (data) => {
            setIsRoomActionPending(false); 
            
            const { availableQuizzes } = stateRef.current;
            const quiz = availableQuizzes.find(q => String(q.id) === String(data.quizId));
            const quizTitle = quiz ? quiz.title : 'Unknown Quiz';
            
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
                 toast(`${data.username} submitted an answer!`);
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
            setLobbyData(prev => ({
                ...prev,
                players: data.players
            }));
            setQAnswer({
                correctAnswer: data.correctAnswer,
                explanation: data.correctExplanation,
                isLastQuestion: data.isLastQuestion,
            });
            setShowAnswerKey(true); 
        };

        const handleNextQuestion = (data) => {
            setLobbyData(prev => ({
                ...prev,
                players: data.players
            }));
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
            toast.success("Game Over! Check the rankings.", { duration: 5000 });
        };
        
        const handleRoomError = (message) => {
            setIsRoomActionPending(false); 
            toast.error(message, { duration: 3000 });
            setView('menu'); 
            setLobbyData(null);
        };

        socket.on('lobbyUpdate', handleLobbyUpdate); 
        socket.on('playerJoined', (data) => toast(`${data.username} joined the lobby!`)); 
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
    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!isConnected || isRoomActionPending) return toast.error("Connection or previous action pending.");
        if (quizzesLoading || availableQuizzes.length === 0) {
            toast.error("Please wait for quizzes to load or generate one.", { duration: 3000 });
            return;
        }

        if (!user || !selectedQuizId) {
            toast.error("Please select a quiz.", { duration: 3000 });
            return;
        }
        setView('loading');
        setIsRoomActionPending(true); 
        socket.emit('createRoom', { username: user.username, quizId: selectedQuizId });
    };

    const handleJoinRoom = (e) => {
        e.preventDefault();
        if (!isConnected || isRoomActionPending) return toast.error("Connection or previous action pending.");

        const code = roomCode.toUpperCase();
        if (!user || code.length !== 4) {
            toast.error("Invalid Room Code format.");
            return;
        }
        
        setView('loading');
        setRoomCode(code);
        setIsRoomActionPending(true); 
        socket.emit('joinRoom', { roomCode: code, username: user.username });
    };

    const handleStartGame = () => {
        if (!lobbyData || lobbyData.host !== user.username) return;
        socket.emit('startGame', { roomCode: lobbyData.roomCode, quizId: lobbyData.quizId });
    };

    const handleGameAnswer = (selectedOption) => {
        if (isAnswered || !lobbyData || showAnswerKey || timeLeft <= 0) return;
        setIsAnswered(true);
        setPlayerAnswerLocal(selectedOption); 
        
        const timeTaken = (QUESTION_TIME_MS / 1000 - timeLeft) * 1000; 
        
        socket.emit('submitAnswer', {
            roomCode: lobbyData.roomCode,
            selected: selectedOption,
            time_ms: timeTaken,
        });

        toast.success("Answer sent!", { duration: 1000 });
    };
    
    const leaveRoom = () => {
        if (lobbyData) {
            socket.emit('leaveRoom', { roomCode: lobbyData.roomCode });
            stateRef.current.lobbyData = null; 
            socket.disconnect(); 
            socket.connect(); 
        }
        setLobbyData(null);
        setView('menu');
    };

    // --- Render Views ---
    const renderMenu = () => (
        <div className="space-y-6">
            <h2 className="text-3xl font-black text-white mb-6">Multiplayer Arena</h2>
            <p className="text-gray-400 mb-8">Compete against your friends in real-time quiz battles. Speed equals score!</p>

            <Button onClick={() => setView('create')} variant="primary" className="w-full justify-center h-16 text-lg" disabled={isRoomActionPending || quizzesLoading || availableQuizzes.length === 0 || !isConnected}>
                <PlusCircle /> Create New Room
            </Button>
            <Button onClick={() => setView('join')} variant="outline" className="w-full justify-center h-16 text-lg" disabled={isRoomActionPending || !isConnected}>
                <LogIn /> Join Room
            </Button>
            
            {!isConnected && (
                 <div className="text-center text-red-500 flex items-center justify-center gap-2">
                    <Loader size={16} className="animate-spin" /> Establishing Connection...
                 </div>
            )}
            {quizzesLoading && isConnected && (
                 <div className="text-center text-neon-blue flex items-center justify-center gap-2">
                    <Loader size={16} className="animate-spin" /> Loading Quizzes...
                 </div>
            )}
            {availableQuizzes.length === 0 && !quizzesLoading && (
                 <p className="text-center text-red-500 text-sm">No quizzes found. Please generate one first.</p>
            )}
        </div>
    );

    const renderCreateRoom = () => (
        <form onSubmit={handleCreateRoom} className="space-y-6">
            <h2 className="text-3xl font-black text-neon-blue mb-6">Create Room</h2>
            <p className="text-gray-400">Select the quiz material for your battle.</p>
            
            {quizzesLoading ? (
                <div className="flex items-center justify-center text-gray-500 p-3 bg-gray-900 rounded-xl border border-gray-700">
                    <Loader size={20} className="animate-spin mr-2" /> Loading...
                </div>
            ) : (
                <>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Quiz Material</label>
                    <select 
                        value={selectedQuizId || ''} 
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:border-neon-purple outline-none cursor-pointer"
                        disabled={availableQuizzes.length === 0}
                    >
                        {availableQuizzes.map(quiz => (
                            <option key={quiz.id} value={String(quiz.id)} className="bg-gray-900">
                                {quiz.title} ({quiz.difficulty})
                            </option>
                        ))}
                    </select>
                </>
            )}

            <Button type="submit" variant="success" className="w-full justify-center" disabled={isRoomActionPending || quizzesLoading || availableQuizzes.length === 0}>
                Create & Start Lobby
            </Button>
            <Button type="button" onClick={() => setView('menu')} variant="outline" className="w-full justify-center" disabled={isRoomActionPending}>
                Back to Menu
            </Button>
        </form>
    );

    const renderJoinRoom = () => (
        <form onSubmit={handleJoinRoom} className="space-y-6">
            <h2 className="text-3xl font-black text-neon-blue mb-6">Join Room</h2>
            <p className="text-gray-400">Enter the 4-digit room code.</p>
            
            <Input 
                label="Room Code"
                type="text"
                placeholder="A3B4"
                value={roomCode}
                onChange={e => setRoomCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="text-center text-xl font-mono uppercase"
            />

            <Button type="submit" variant="primary" className="w-full justify-center" disabled={isRoomActionPending}>
                Join Game
            </Button>
            <Button type="button" onClick={() => setView('menu')} variant="outline" className="w-full justify-center" disabled={isRoomActionPending}>
                Back to Menu
            </Button>
        </form>
    );

    const renderLobby = () => {
        if (!lobbyData) return renderMenu();
        let players = lobbyData.players || [];
        return (
            <div className="space-y-6">
                <h2 className="text-4xl font-black text-neon-green">ROOM: {lobbyData.roomCode}</h2>
                <p className="text-gray-400 flex items-center gap-2">
                    <Users size={20} className="text-neon-blue" />
                    Quiz: <span className="text-white font-bold">{lobbyData.quizTitle || 'Loading...'}</span>
                </p>
                <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 space-y-3">
                    <h3 className="text-sm font-bold uppercase text-gray-500 tracking-wider">Players ({players.length})</h3>
                    {players.map(player => (
                        <div key={player.username} className="flex justify-between items-center text-white">
                            <span>{player.username}</span>
                            {player.isHost && <span className="text-xs text-neon-purple font-bold">HOST</span>}
                            {player.username === user.username && <span className="text-xs text-neon-green font-bold">YOU</span>}
                        </div>
                    ))}
                </div>
                {lobbyData.host === user.username ? (
                    <Button onClick={handleStartGame} variant="success" className="w-full justify-center">
                        Start Game (Host Only)
                    </Button>
                ) : (
                    <p className="text-center text-neon-blue font-bold p-2 bg-gray-900 rounded-lg border border-gray-700">Waiting for Host to Start...</p>
                )}
                <div className="p-4 bg-gray-800 rounded-xl border border-gray-700 text-center">
                    <p className="text-gray-400 text-xs mb-2">Share this code to invite friends:</p>
                    <div className="text-2xl font-mono text-neon-green font-bold flex items-center justify-center gap-3">
                        <QrCode size={24} className="text-neon-green" /> {lobbyData.roomCode}
                    </div>
                </div>
                <Button type="button" onClick={leaveRoom} variant="outline" className="w-full justify-center">
                    Leave Room
                </Button>
            </div>
        );
    };

    // --- REDESIGNED COUNTDOWN START ---
    const renderCountdown = () => {
        if (!lobbyData) return renderMenu();

        // Determine color based on time left
        let colorClass = "text-white";
        if (countdown === 3) colorClass = "text-red-500";
        if (countdown === 2) colorClass = "text-orange-500";
        if (countdown === 1) colorClass = "text-yellow-400";
        if (countdown <= 0) colorClass = "text-neon-green";

        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] animate-fade-in py-10">
                <h3 className="text-gray-500 font-bold uppercase tracking-[0.5em] mb-12 animate-pulse">
                    Get Ready
                </h3>
                
                <div className="relative flex items-center justify-center">
                    {/* Glowing Background Ring */}
                    <div className={`absolute w-64 h-64 rounded-full blur-3xl opacity-20 transition-colors duration-300 ${colorClass.replace('text-', 'bg-')}`}></div>
                    
                    {/* The Number */}
                    <span className={`text-[12rem] font-mono font-black leading-none transition-all duration-300 transform scale-100 ${colorClass} drop-shadow-2xl`}>
                        {countdown > 0 ? countdown : 'GO!'}
                    </span>
                </div>

                <div className="mt-16 text-center space-y-3">
                    <span className="text-neon-blue text-sm font-bold uppercase tracking-wider bg-neon-blue/10 px-3 py-1 rounded-full">Next Up</span>
                    <h2 className="text-2xl md:text-3xl font-black text-white max-w-lg leading-tight">
                        {lobbyData.quizTitle}
                    </h2>
                </div>
            </div>
        );
    };
    // --- REDESIGNED COUNTDOWN END ---

    const renderGame = () => {
        if (!gameQuestions || !lobbyData) return renderMenu();
        const q = gameQuestions[currentQIndex];
        const player = lobbyData.players.find(p => p.username === user.username);
        const playerAnswer = playerAnswerLocal;
        
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-800">
                    <h3 className="text-xl font-mono text-gray-400">
                        Q<span className="text-white font-bold">{currentQIndex + 1}</span>/{gameQuestions.length}
                    </h3>
                    <div className="flex items-center gap-4 text-white">
                        <span className={`font-bold flex items-center gap-1.5 leading-none ${timeLeft <= 3 ? 'text-red-500 animate-pulse' : 'text-neon-blue'}`}>
                            <Clock size={18} className="mb-px" /> {timeLeft > 0 ? timeLeft : 0}s
                        </span>
                        
                        <span className="text-neon-green font-bold flex items-center gap-1">
                            <Zap size={18} /> {player.score}
                        </span>
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
                            <Button 
                                key={idx}
                                onClick={() => handleGameAnswer(opt)}
                                disabled={isAnswered || timeLeft <= 0}
                                variant="game"
                                className={`text-left justify-between ${buttonClass}`}
                            >
                                {opt}
                                {icon}
                            </Button>
                        );
                    })}
                </div>
                {showAnswerKey && (
                    <div className="mt-8 pt-4 border-t border-gray-800 animate-fade-in">
                        <div className="flex items-center justify-between text-lg font-bold">
                            <span className="flex items-center gap-2 text-neon-blue">
                                <AlertCircle size={18} /> Explanation
                            </span>
                            <span className={`text-sm ${player.lastScore > 0 ? 'text-neon-green' : 'text-red-500'}`}>
                                Score: {player.lastScore > 0 ? `+${player.lastScore}` : 0}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm mt-2 leading-relaxed">{qAnswer.explanation}</p>
                    </div>
                )}
                <div className="pt-4 text-center">
                    <p className="text-sm text-gray-500">
                        {isAnswered && !showAnswerKey ? 'Waiting for results...' : 
                         showAnswerKey ? `Next question in ${ANSWER_REVEAL_DELAY_MS / 1000} seconds.` : 'Answer quickly!'}
                    </p>
                </div>
            </div>
        );
    };

    const renderResults = () => {
        if (!playerRanking || !lobbyData) return renderMenu();
        return (
            <div className="space-y-6 text-center relative">
                 {/* --- FIXED CONFETTI DESIGN START --- */}
                 {/* Placed inside a fixed container to ensure full screen coverage regardless of scroll/position */}
                 <div className="fixed inset-0 z-50 pointer-events-none">
                     <Confetti 
                        width={windowSize.width} 
                        height={windowSize.height} 
                        recycle={false} 
                        numberOfPieces={800} 
                        gravity={0.2}
                     />
                 </div>
                 {/* --- FIXED CONFETTI DESIGN END --- */}

                <Trophy size={60} className="text-neon-yellow mx-auto" />
                <h2 className="text-4xl font-black text-white">Final Ranking</h2>
                <p className="text-gray-400">Quiz: {lobbyData.quizTitle}</p>
                <div className="bg-gray-900 p-4 rounded-2xl border border-gray-700 space-y-3">
                    {playerRanking.map((p, index) => (
                        <div key={p.username} className={`p-3 rounded-lg flex justify-between items-center font-bold ${
                            index === 0 ? 'bg-neon-green/20 border-neon-green text-neon-green' : 
                            p.username === user.username ? 'bg-neon-blue/20 border-neon-blue text-white' : 
                            'bg-gray-800 text-gray-300'
                        }`}>
                            <span className="w-1/12">{index + 1}</span>
                            <span className="w-5/12 text-left">{p.username}</span>
                            <span className="w-6/12 text-right">{p.score} Points</span>
                        </div>
                    ))}
                </div>
                <Button onClick={leaveRoom} variant="primary" className="w-full justify-center">
                    Return to Menu
                </Button>
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
        switch (view) {
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
            <div className="bg-dark-surface p-8 rounded-3xl border border-gray-800 w-full max-w-md shadow-2xl">
                {renderContent()}
            </div>
        </div>
    );
}