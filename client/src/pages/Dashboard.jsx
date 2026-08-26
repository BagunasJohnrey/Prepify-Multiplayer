import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, BookOpen, Heart, Settings, PlayCircle, Loader, Trash2, Filter, FileText, Plus, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api'; 
import { useAuth } from '../context/AuthContext'; 
import StoreModal from '../components/StoreModal';
import Pagination from '../components/ui/Pagination';
import socket from '../utils/socket';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, refreshUser, setUser, loading: authLoading } = useAuth(); 

  const [file, setFile] = useState(null);
  const [config, setConfig] = useState({ 
    course: 'Major Subject', 
    difficulty: 'Medium',    
    numQuestions: 15, 
    customTitle: '',
    description: ''          
  });

  const [filter, setFilter] = useState('All');
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // NEW: State for tracking generation progress
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Store & Timer State
  const [showStore, setShowStore] = useState(false);
  const [timeUntilRegen, setTimeUntilRegen] = useState(null);

  // Fetch Quizzes
  const fetchQuizzes = useCallback(async () => {
    try {
      const { data } = await api.get(`/quizzes?course=${filter}&page=${page}&limit=5`);
      if (data.quizzes) {
        setQuizzes(data.quizzes);
        setTotalPages(data.totalPages);
      } else {
        setQuizzes(Array.isArray(data) ? data : []);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to fetch quizzes", err);
    }
  }, [filter, page]);

  useEffect(() => { 
    if (user) fetchQuizzes(); 
  }, [fetchQuizzes, user]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // NEW LOGIC: Listen for Socket.io progress events
  useEffect(() => {
    if (!user) return;

    const eventName = `generateProgress_${user.id}`;
    
    socket.on(eventName, (data) => {
      setProgress({ current: data.current, total: data.total });
    });

    return () => socket.off(eventName);
  }, [user]);

  // Heart Timer Logic
  useEffect(() => {
    if (!user || user.hearts >= 3) {
        setTimeUntilRegen(null);
        return;
    }

    const interval = setInterval(() => {
        const lastUpdate = new Date(user.last_heart_update).getTime();
        const now = new Date().getTime();
        const REGEN_TIME = 2 * 60 * 1000; // 2 minutes
        
        const diff = now - lastUpdate;
        const remaining = REGEN_TIME - (diff % REGEN_TIME);
        
        setTimeUntilRegen(remaining);

        if (remaining <= 1000) refreshUser();

    }, 1000);

    return () => clearInterval(interval);
  }, [user, refreshUser]);

  const formatTime = (ms) => {
    if (!ms) return "";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleBuyHeart = async () => {
    const COST = 50;
    
    if (!user || user.xp < COST) {
        toast.error("Not enough XP!");
        return;
    }

    const previousUser = { ...user };

    const optimisticUser = {
        ...user,
        hearts: user.hearts + 1,
        xp: user.xp - COST
    };
    setUser(optimisticUser);

    toast.success("Heart purchased! ❤️ -50 XP");

    try {
        await api.post('/auth/buy-heart');
        refreshUser(); 
    } catch (err) {
        setUser(previousUser);
        toast.error(err.response?.data?.error || "Failed to buy heart");
    }
  };

  const handleGenerate = async () => {
    if (!file) return toast.error("Please upload a PDF file first.");
    if (!config.customTitle.trim()) return toast.error("Please enter a name for this exam.");
    
    setLoading(true);
    // Initialize progress display
    setProgress({ current: 1, total: Math.ceil(config.numQuestions / 10) });

    const formData = new FormData();
    formData.append('pdfFile', file);
    formData.append('course', config.course);
    formData.append('difficulty', config.difficulty);
    formData.append('description', config.description);
    formData.append('numQuestions', config.numQuestions);
    formData.append('customTitle', config.customTitle);

    try {
      const { data } = await api.post('/generate', formData);
      toast.success(`Success! "${data.title}" is ready.`);
      fetchQuizzes(); 
      refreshUser(); 
      setFile(null); 
    } catch (err) {
      console.error(err);
      toast.error("Error generating quiz. Please try again.");
    } finally {
      setLoading(false);
      setProgress({ current: 0, total: 0 }); // Reset progress display
    }
  };

  const handleDelete = async (e, quizId) => {
    e.stopPropagation(); 
    if (!confirm("Are you sure you want to delete this quiz?")) return;

    try {
        await api.delete(`/quiz/${quizId}`);
        toast.success("Quiz deleted");
        fetchQuizzes(); 
    } catch (err) {
        toast.error("Failed to delete. " + (err.response?.data?.error || ""));
    }
  };
  
  const handleQuizClick = (quizId) => {
    if (user.hearts <= 0) {
        toast.error("💔 You need at least one heart to start an exam.", { duration: 3000 });
        return;
    }
    navigate(`/quiz/${quizId}`);
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center text-white">Loading...</div>;
  if (!user) return null; 

  return (
    <>
      <StoreModal 
        isOpen={showStore} 
        onClose={() => setShowStore(false)}
        user={user}
        onBuyHeart={handleBuyHeart}
      />

      <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-8 animate-fade-in relative">
        
        {/* --- DASHBOARD HEADER / STATS --- */}
        <div className="bg-dark-surface p-8 rounded-3xl border border-gray-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-linear-to-b from-neon-blue to-neon-purple"></div>
          
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Welcome back, <span className="text-neon-blue">{user.username}!</span>
            </h1>
            <p className="text-gray-400 text-sm">
               Level <span className="text-white font-bold">{Math.floor((user.xp || 0) / 100) + 1}</span> • <span className="text-neon-green font-bold">{user.xp || 0} XP</span>
            </p>
          </div>

          <div className="flex gap-4">
              <div className="flex items-center gap-4 bg-gray-900/50 px-6 py-4 rounded-2xl border border-gray-700 backdrop-blur-md">
                  <div className="bg-gray-800 p-3 rounded-full relative">
                    <Heart className={`w-6 h-6 ${user.hearts > 0 ? 'text-red-500 fill-red-500' : 'text-gray-600'}`} />
                    <button onClick={() => setShowStore(true)} className="absolute -top-1 -right-1 bg-neon-blue text-black rounded-full p-0.5 hover:scale-110 transition cursor-pointer shadow-lg" title="Open Store">
                      <Plus size={10} strokeWidth={4} />
                    </button>
                  </div>
                  <div>
                    <div className="text-2xl font-black text-white leading-none">{user.hearts} / 3</div>
                    {user.hearts < 3 && timeUntilRegen && (
                        <div className="text-[10px] text-neon-blue font-mono font-bold mt-1 animate-pulse">
                          +1 in {formatTime(timeUntilRegen)}
                        </div>
                    )}
                    {user.hearts >= 3 && (
                        <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mt-1">Full Health</div>
                    )}
                  </div>
              </div>
          </div>
        </div>

        <div className="grid md:grid-cols-12 gap-8">
          
          {/* --- LEFT PANEL: GENERATOR --- */}
          <div className="md:col-span-4 space-y-6">
            <div className="bg-dark-surface p-6 rounded-3xl border border-gray-800 shadow-xl relative">
              <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                <div className="p-2 bg-neon-blue/10 rounded-lg"><Settings className="text-neon-blue" size={20} /></div>
                <h2 className="text-lg font-bold text-white">Exam Configuration</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Exam Title</label>
                  <input type="text" placeholder="e.g. Finals Review" value={config.customTitle}
                    onChange={(e) => setConfig({...config, customTitle: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:border-neon-blue focus:outline-none transition text-sm" />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Focus Area</label>
                  <textarea 
                    rows="2"
                    placeholder="e.g. Chapter 3, boolean algebra" 
                    value={config.description}
                    onChange={(e) => setConfig({...config, description: e.target.value})}
                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:border-neon-blue focus:outline-none transition resize-none" />
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">Questions</label>
                    <span className="text-neon-green font-mono font-bold text-sm">{config.numQuestions}</span>
                  </div>
                  <input type="range" min="5" max="50" step="1" value={config.numQuestions}
                    onChange={(e) => setConfig({...config, numQuestions: e.target.value})}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-neon-green" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Difficulty</label>
                    <select value={config.difficulty} onChange={(e) => setConfig({...config, difficulty: e.target.value})}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:border-neon-purple outline-none cursor-pointer">
                      <option>Easy</option>
                      <option>Medium</option>
                      <option>Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1.5 block">Subject Type</label>
                    <select value={config.course} onChange={(e) => setConfig({...config, course: e.target.value})}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm text-white focus:border-neon-purple outline-none cursor-pointer">
                      <option value="General Education">GED</option>
                      <option value="Minor Subject">Minor</option>
                      <option value="Major Subject">Major</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-dark-surface p-6 rounded-3xl border border-gray-800 shadow-xl group hover:border-neon-green transition-colors duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-neon-green/10 rounded-lg"><Upload className="text-neon-green" size={20} /></div>
                <h2 className="text-lg font-bold text-white">Upload Material</h2>
              </div>
              
              <div className="border-2 border-dashed border-gray-700 rounded-2xl p-6 text-center relative hover:bg-gray-800/50 transition bg-gray-900/30">
                <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <div className="text-gray-400 group-hover:text-white transition">
                  <FileText className="mx-auto mb-2 text-gray-600 group-hover:text-neon-green transition" size={32}/>
                  <p className="text-sm font-medium mb-1">{file ? <span className="text-neon-green">{file.name}</span> : "Drop PDF File Here"}</p>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide">Max size 5MB</p>
                </div>
              </div>

              {/* UPDATED: Loading Button with Progress Bar */}
              <button 
                onClick={handleGenerate} 
                disabled={loading}
                className={`w-full mt-6 font-bold py-4 rounded-xl flex flex-col items-center justify-center transition shadow-lg ${
                  loading 
                    ? 'bg-gray-800 text-gray-400 cursor-not-allowed border border-gray-700' 
                    : 'bg-linear-to-r from-neon-blue to-neon-purple text-black hover:shadow-[0_0_20px_rgba(0,243,255,0.4)] hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <>
                    <div className="flex items-center gap-2 text-sm text-white mb-2">
                      <Loader className="animate-spin" size={16} />
                      <span>Generating Batch {progress.current} of {progress.total}</span>
                    </div>
                    {/* Progress Bar Container */}
                    <div className="w-48 h-1.5 bg-gray-900 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-neon-blue transition-all duration-500 ease-out" 
                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  'Generate Exam'
                )}
              </button>
            </div>
          </div>

          {/* --- RIGHT PANEL: LIBRARY --- */}
          <div className="md:col-span-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="text-neon-purple" /> Recent Exams
                </h2>
              </div>

              {/* FILTER DROPDOWN */}
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-hover:text-neon-blue transition-colors pointer-events-none">
                  <Filter size={18} />
                </div>
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-gray-900 text-white text-sm font-bold pl-10 pr-10 py-3 rounded-xl border border-gray-700 hover:border-neon-blue focus:border-neon-blue outline-none cursor-pointer transition-all appearance-none shadow-lg"
                >
                  <option value="All" className="bg-gray-900">All Subjects</option>
                  <option value="General Education" className="bg-gray-900">GED</option>
                  <option value="Minor Subject" className="bg-gray-900">Minor</option>
                  <option value="Major Subject" className="bg-gray-900">Major</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-white transition-colors">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {quizzes.length === 0 ? (
                <div className="text-center py-20 bg-dark-surface border border-gray-800 rounded-3xl border-dashed flex flex-col items-center justify-center">
                  <div className="bg-gray-800 p-4 rounded-full mb-4">
                      <BookOpen size={32} className="text-gray-600" />
                  </div>
                  <p className="text-gray-300 font-medium mb-1">Your library is empty</p>
                  <p className="text-gray-500 text-sm">Upload a PDF document to generate your first exam.</p>
                </div>
              ) : (
                <>
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} 
                      onClick={() => handleQuizClick(quiz.id)} 
                      className="group bg-dark-surface p-5 rounded-2xl border border-gray-800 hover:border-neon-purple transition-all cursor-pointer flex justify-between items-center shadow-md hover:shadow-lg relative overflow-hidden">
                      
                      <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>

                      <div className="flex-1 mr-4 z-10">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-bold text-lg text-white group-hover:text-neon-purple transition">{quiz.title}</h3>
                          {quiz.items_count && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">{quiz.items_count} Qs</span>
                          )}
                        </div>
                        
                        <p className="text-gray-400 text-sm line-clamp-1 mb-3">{quiz.description || "No description provided."}</p>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 bg-gray-900 px-2 py-1 rounded-md border border-gray-800">
                            {quiz.course}
                          </span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-md border border-gray-800 bg-gray-900 ${
                            quiz.difficulty === 'Hard' ? 'text-red-400' : 
                            quiz.difficulty === 'Medium' ? 'text-yellow-400' : 'text-green-400'
                          }`}>
                            {quiz.difficulty || 'Medium'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 z-10">
                          {user?.role === 'admin' && (
                              <button 
                                onClick={(e) => handleDelete(e, quiz.id)} 
                                className="text-gray-600 hover:text-red-500 p-2 transition hover:bg-red-500/10 rounded-full" 
                                title="Delete Quiz"
                              >
                                  <Trash2 size={18} />
                              </button>
                          )}
                          <button className="bg-white text-black p-3 rounded-full hover:bg-neon-purple hover:text-white transition shadow-lg transform group-hover:scale-110">
                            <PlayCircle size={24} fill="currentColor" />
                          </button>
                      </div>
                    </div>
                  ))}
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
