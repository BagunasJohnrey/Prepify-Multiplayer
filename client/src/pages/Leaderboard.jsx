import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, Crown, Star, Loader, TrendingUp, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

const LIMIT = 20;

const getRankStyle = (globalRank) => {
  if (globalRank === 1) return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/40';
  if (globalRank === 2) return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/40';
  if (globalRank === 3) return 'bg-gradient-to-r from-amber-700/20 to-amber-800/10 border-amber-700/40';
  return 'bg-[#16161f] border-white/[0.06]';
};

const getRankIcon = (globalRank) => {
  if (globalRank === 1) return <Crown className="text-yellow-400" size={24} />;
  if (globalRank === 2) return <Medal className="text-gray-300" size={22} />;
  if (globalRank === 3) return <Medal className="text-amber-600" size={22} />;
  return <span className="text-gray-500 font-bold w-6 text-center">{globalRank}</span>;
};

export default function Leaderboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState('xp');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  const fetchLeaderboard = useCallback(async (pageNum, reset = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const { data } = await api.get(`/auth/leaderboard?limit=${LIMIT}&page=${pageNum}&sort=${sort}`);
      if (reset || pageNum === 1) {
        setEntries(data.leaderboard);
      } else {
        setEntries(prev => [...prev, ...data.leaderboard]);
      }
      setUserRank(data.userRank);
      setTotal(data.total || 0);
      setHasMore(data.leaderboard.length === LIMIT);
    } catch {
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [sort]);

  useEffect(() => {
    setPage(1);
    setEntries([]);
    setHasMore(true);
    fetchLeaderboard(1, true);
  }, [sort, fetchLeaderboard]);

  useEffect(() => {
    if (page > 1) {
      fetchLeaderboard(page);
    }
  }, [page, fetchLeaderboard]);

  // Infinite scroll observer
  useEffect(() => {
    if (loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadingMore]);

  const changeSort = (next) => {
    if (next === sort) return;
    setSort(next);
  };

  return (
    <div className="bg-[#0b0b12] relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-yellow-500/10 blur-[100px] rounded-full" />
      </div>
      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.15)]">
                <Trophy size={24} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Global Leaderboard</h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  {sort === 'streak' ? 'Top learners ranked by longest streak' : 'Top learners ranked by XP earned'}
                  {total > 0 && <span className="ml-2 text-gray-500">({total.toLocaleString()} players)</span>}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Sort filter */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={() => changeSort('xp')}
            variant={sort === 'xp' ? 'success' : 'ghost'}
            size="sm"
            className={sort === 'xp' ? 'bg-neon-green/15 border-neon-green/40 text-neon-green' : 'border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800'}
          >
            <TrendingUp size={16} /> Highest XP
          </Button>
          <Button
            onClick={() => changeSort('streak')}
            variant={sort === 'streak' ? 'danger' : 'ghost'}
            size="sm"
            className={sort === 'streak' ? 'bg-orange-500/15 border-orange-500/40 text-orange-400' : 'border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800'}
          >
            <Flame size={16} /> Highest Streak
          </Button>
        </div>

        {userRank && (
          <div className="bg-neon-blue/[0.07] border border-neon-blue/25 rounded-2xl p-4 mb-6 flex items-center justify-between backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Star className="text-neon-blue" size={20} />
              <span className="text-white font-semibold">Your Rank</span>
              <span className="text-xs text-gray-400">({sort === 'streak' ? 'by streak' : 'by XP'})</span>
            </div>
            <span className="text-2xl font-bold text-neon-blue tracking-tight">#{userRank}</span>
          </div>
        )}

        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl shadow-black/30">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <div className="w-8 h-8 bg-white/[0.06] rounded-lg animate-pulse"></div>
                  <div className="w-10 h-10 bg-white/[0.06] rounded-full animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-white/[0.06] rounded-lg w-32 mb-1 animate-pulse"></div>
                    <div className="h-3 bg-white/[0.04] rounded-lg w-20 animate-pulse"></div>
                  </div>
                  <div className="h-6 bg-white/[0.04] rounded-lg w-12 animate-pulse"></div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-20">
              <div className="p-4 rounded-full bg-white/[0.03] text-gray-500 mx-auto mb-4 w-fit"><Trophy size={40} /></div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No rankings yet</h3>
              <p className="text-gray-500">Complete quizzes to earn XP and climb the leaderboard!</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {entries.map((entry, idx) => {
                const globalRank = idx + 1;
                return (
                  <div key={entry.id} className={`flex items-center gap-4 p-4 px-5 sm:px-6 ${getRankStyle(globalRank)} border-l-4`}>
                    <div className="w-8 flex justify-center">{getRankIcon(globalRank)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center text-gray-300 text-sm font-semibold border border-white/[0.06]">
                            {entry.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`font-semibold truncate ${entry.id === user?.id ? 'text-neon-blue' : 'text-white'}`}>
                          {entry.username}{entry.id === user?.id ? ' (You)' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {sort === 'streak' ? (
                        <>
                          <div className="flex items-center gap-1 text-orange-400 font-semibold">
                            <Flame size={16} /> {entry.longest_streak} best
                          </div>
                          <div className="flex items-center gap-1 text-neon-green text-sm">
                            <TrendingUp size={14} /> {entry.xp}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-neon-green font-semibold">
                            <TrendingUp size={16} /> {entry.xp} XP
                          </div>
                          {entry.longest_streak > 0 && (
                            <div className="hidden sm:flex items-center gap-1 text-orange-400 text-sm">
                              <Flame size={14} /> {entry.longest_streak}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Infinite scroll trigger */}
          {hasMore && !loading && (
            <div ref={loadMoreRef} className="p-4 border-t border-white/[0.06]">
              {loadingMore && (
                <div className="flex items-center justify-center py-4 gap-2">
                  <Loader className="animate-spin text-neon-blue" size={20} />
                  <span className="text-sm text-gray-400">Loading more...</span>
                </div>
              )}
            </div>
          )}

          {!hasMore && entries.length > 0 && (
            <div className="p-4 border-t border-white/[0.06] text-center">
              <span className="text-xs text-gray-500">Showing all {entries.length} players</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
