import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, Users, Trash2, Loader, User, MessageCircle, Gamepad2, Search, X, UserCheck, Bell, BellOff } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import socket from '../utils/socket';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ConfirmationModal from '../components/ui/ConfirmationModal';

export default function Friends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [online, setOnline] = useState([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [friendToRemove, setFriendToRemove] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [inviting, setInviting] = useState(null);
  const [incomingInvite, setIncomingInvite] = useState(null);
  const searchTimeoutRef = useRef(null);
  const resultsRef = useRef(null);

  const fetchFriends = async () => {
    try {
      const [{ data: f }, { data: o }] = await Promise.all([
        api.get('/auth/friends'),
        api.get('/auth/friends/online'),
      ]);
      setFriends(f);
      setOnline(o.online);
    } catch {
      toast.error('Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFriends(); }, []);

  // Socket listeners for invites
  useEffect(() => {
    const handleGameInvite = (data) => {
      setIncomingInvite(data);
      toast((t) => (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Gamepad2 size={16} className="text-neon-purple" />
            <span className="font-bold text-white">{data.fromUsername}</span>
            <span className="text-gray-400">invited you to play!</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                socket.emit('respondInvite', { toSocketId: data.fromSocketId, accepted: true });
                setIncomingInvite(null);
                toast.dismiss(t.id);
                navigate('/multiplayer');
              }}
              className="flex-1 py-2 px-3 bg-neon-green/15 text-neon-green border border-neon-green/20 rounded-lg text-xs font-bold hover:bg-neon-green/25 transition"
            >
              Accept
            </button>
            <button
              onClick={() => {
                socket.emit('respondInvite', { toSocketId: data.fromSocketId, accepted: false });
                setIncomingInvite(null);
                toast.dismiss(t.id);
              }}
              className="flex-1 py-2 px-3 bg-white/[0.05] text-gray-400 border border-white/[0.08] rounded-lg text-xs font-bold hover:bg-white/[0.08] transition"
            >
              Decline
            </button>
          </div>
        </div>
      ), { duration: 10000, icon: null });
    };

    const handleInviteSent = (data) => {
      toast.success(`Invite sent to ${data.username}!`);
      setInviting(null);
    };

    const handleInviteError = (data) => {
      toast.error(data.error || 'Failed to send invite');
      setInviting(null);
    };

    const handleInviteResponse = (data) => {
      if (data.accepted) {
        toast.success(`${data.fromUsername} accepted your invite!`);
        navigate('/multiplayer');
      } else {
        toast(`${data.fromUsername} declined your invite`, { icon: '😔' });
      }
    };

    socket.on('gameInvite', handleGameInvite);
    socket.on('inviteSent', handleInviteSent);
    socket.on('inviteError', handleInviteError);
    socket.on('inviteResponse', handleInviteResponse);

    return () => {
      socket.off('gameInvite', handleGameInvite);
      socket.off('inviteSent', handleInviteSent);
      socket.off('inviteError', handleInviteError);
      socket.off('inviteResponse', handleInviteResponse);
    };
  }, [navigate]);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchUsers = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setSearchLoading(true);
    try {
      const { data } = await api.get(`/auth/friends/search?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(data.users);
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setUsernameInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const handleAdd = async (username) => {
    setAdding(username);
    try {
      await api.post('/auth/friends', { username });
      toast.success(`Added ${username} as a friend!`);
      setUsernameInput('');
      setSearchResults([]);
      setShowResults(false);
      fetchFriends();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add friend');
    } finally {
      setAdding(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    handleAdd(usernameInput.trim());
  };

  const sendInvite = (username) => {
    if (!username) return;
    setInviting(username);
    socket.emit('sendInvite', { toUsername: username });
  };

  const confirmRemove = async () => {
    if (!friendToRemove) return;
    setRemoveLoading(true);
    try {
      await api.delete(`/auth/friends/${friendToRemove.id}`);
      toast.success('Friend removed');
      setFriendToRemove(null);
      fetchFriends();
    } catch {
      toast.error('Failed to remove friend');
    } finally {
      setRemoveLoading(false);
    }
  };

  const isFriend = (username) => friends.some(f => f.username === username);
  const isOnline = (username) => online.includes(username);

  return (
    <div className="bg-[#0b0b12] min-h-[calc(100vh-4rem)] relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-blue/10 blur-[100px] rounded-full" />
      </div>
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue shadow-[0_0_30px_rgba(0,243,255,0.15)]">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Friends</h1>
              <p className="text-sm text-gray-400 mt-0.5">Add friends and challenge them to quizzes</p>
            </div>
          </div>
        </header>

        {/* Search + Add friend */}
        <div className="mb-6 relative" ref={resultsRef}>
          <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl shadow-black/20">
            <div className="flex items-center gap-3 p-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search users to add..."
                  value={usernameInput}
                  onChange={handleSearchChange}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-10 pr-10 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/20 transition"
                />
                {usernameInput && (
                  <button
                    onClick={() => { setUsernameInput(''); setSearchResults([]); setShowResults(false); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded-lg transition"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={searchLoading || !usernameInput.trim()}
                className="px-5 py-2.5 bg-neon-blue/15 text-neon-blue border border-neon-blue/20 rounded-xl text-sm font-bold hover:bg-neon-blue/25 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] flex items-center gap-2 shrink-0"
              >
                {adding ? <Loader size={16} className="animate-spin" /> : <UserPlus size={16} />}
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>

            {/* Search results dropdown */}
            {showResults && (
              <div className="border-t border-white/[0.04]">
                {searchLoading ? (
                  <div className="p-4 space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-2">
                        <div className="w-10 h-10 bg-white/[0.06] rounded-full animate-pulse"></div>
                        <div className="flex-1">
                          <div className="h-3 bg-white/[0.06] rounded-lg w-24 mb-1 animate-pulse"></div>
                          <div className="h-2 bg-white/[0.04] rounded-lg w-16 animate-pulse"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-6 text-center">
                    <p className="text-gray-500 text-sm">No users found</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {searchResults.map((result) => {
                      const alreadyFriend = isFriend(result.username);
                      return (
                        <div
                          key={result.id}
                          className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition"
                        >
                          <div className="flex items-center gap-3">
                            {result.avatar_url ? (
                              <img src={result.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-gray-300 border border-white/[0.06]">
                                <User size={18} />
                              </div>
                            )}
                            <span className="text-white font-medium">{result.username}</span>
                          </div>
                          {alreadyFriend ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neon-green bg-neon-green/10 rounded-lg">
                              <UserCheck size={14} /> Friends
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAdd(result.username)}
                              disabled={adding === result.username}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neon-blue bg-neon-blue/10 border border-neon-blue/20 rounded-lg hover:bg-neon-blue/20 transition disabled:opacity-50"
                            >
                              {adding === result.username ? (
                                <Loader size={12} className="animate-spin" />
                              ) : (
                                <UserPlus size={12} />
                              )}
                              Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Friends list */}
        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl shadow-black/30">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-white/[0.06] rounded-full animate-pulse"></div>
                    <div>
                      <div className="h-4 bg-white/[0.06] rounded-lg w-24 mb-1 animate-pulse"></div>
                      <div className="h-3 bg-white/[0.04] rounded-lg w-16 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-9 h-9 bg-white/[0.04] rounded-xl animate-pulse"></div>
                    <div className="w-9 h-9 bg-white/[0.04] rounded-xl animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-20">
              <div className="p-4 rounded-full bg-white/[0.03] text-gray-500 mx-auto mb-4 w-fit"><Users size={40} /></div>
              <h3 className="text-xl font-semibold text-gray-200 mb-2">No friends yet</h3>
              <p className="text-gray-500 mb-6">Search for users above to add them as friends.</p>
              <Button onClick={() => navigate('/leaderboard')} variant="outline" className="w-auto px-6">Find friends on Leaderboard</Button>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {friends.map((friend) => {
                const onlineStatus = online.includes(friend.username);
                return (
                  <div key={friend.id} className="flex items-center justify-between p-5 hover:bg-white/[0.02] transition">
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        {friend.avatar_url ? (
                          <img src={friend.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover border border-white/10" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-white/[0.04] flex items-center justify-center text-gray-300 border border-white/[0.06]">
                            <User size={20} />
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#12121b] ${onlineStatus ? 'bg-neon-green' : 'bg-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{friend.username}</p>
                        <p className={`text-xs flex items-center gap-1.5 ${onlineStatus ? 'text-neon-green' : 'text-gray-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${onlineStatus ? 'bg-neon-green' : 'bg-gray-500'}`} />
                          {onlineStatus ? 'Online' : 'Offline'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => sendInvite(friend.username)}
                        disabled={inviting === friend.username || !isOnline(friend.username)}
                        className={`px-3 py-2 w-auto ${
                          isOnline(friend.username)
                            ? 'text-neon-purple hover:bg-neon-purple/10'
                            : 'text-gray-600 cursor-not-allowed'
                        }`}
                        title={isOnline(friend.username) ? 'Invite to play' : 'User is offline'}
                      >
                        {inviting === friend.username ? (
                          <Loader size={18} className="animate-spin" />
                        ) : (
                          <Gamepad2 size={18} />
                        )}
                      </Button>
                      <Button
                        onClick={() => setFriendToRemove(friend)}
                        variant="ghost"
                        size="icon"
                        className="text-gray-500 hover:text-rose-500 hover:bg-rose-500/10"
                        title="Remove friend"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!friendToRemove}
        onClose={() => setFriendToRemove(null)}
        onConfirm={confirmRemove}
        isLoading={removeLoading}
        title="Remove Friend"
        message={`Are you sure you want to remove ${friendToRemove?.username} from your friends?`}
        confirmText="Remove"
        icon="delete"
        variant="danger"
      />
    </div>
  );
}
