import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Award, Heart, Star, ArrowLeft, Save, Check, Camera, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

export default function Profile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
  });

  if (!user) return null;

  const level = Math.floor((user.xp || 0) / 100) + 1;

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      const { data } = await api.put('/auth/profile', formData);
      setUser(data);
      toast.success("Profile updated!");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      return toast.error("Image must be under 2MB.");
    }

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const { data } = await api.post("/auth/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(data);
      toast.success("Profile picture updated!");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload image.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="p-6 md:p-12 max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl border border-gray-700 text-gray-400 hover:border-neon-blue hover:text-white transition"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-white">Profile</h1>
      </div>

      {/* Avatar & Stats Card */}
      <div className="bg-dark-surface p-6 rounded-3xl border border-gray-800 shadow-xl">
        <div className="flex items-center gap-5 mb-6">
          <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-20 h-20 rounded-full border-2 border-gray-700 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
                <User size={32} className="text-gray-500" />
              </div>
            )}
            {/* Camera overlay */}
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              {uploadingAvatar ? (
                <Loader size={20} className="text-white animate-spin" />
              ) : (
                <Camera size={20} className="text-white" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{user.username}</h2>
            <p className="text-gray-400 text-sm">{user.email || "No email set"}</p>
            <div className="flex items-center gap-2 mt-1">
              {user.has_google && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                  Google
                </span>
              )}
              {user.has_password && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">
                  Password
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 text-center">
            <div className="bg-gray-800 p-2 rounded-full w-fit mx-auto mb-2">
              <Star size={18} className="text-yellow-400" />
            </div>
            <div className="text-xl font-black text-white">{level}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Level</div>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 text-center">
            <div className="bg-gray-800 p-2 rounded-full w-fit mx-auto mb-2">
              <Award size={18} className="text-neon-green" />
            </div>
            <div className="text-xl font-black text-white">{user.xp || 0}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">XP</div>
          </div>
          <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800 text-center">
            <div className="bg-gray-800 p-2 rounded-full w-fit mx-auto mb-2">
              <Heart size={18} className="text-red-500" />
            </div>
            <div className="text-xl font-black text-white">{user.hearts} / 3</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Hearts</div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-dark-surface p-6 rounded-3xl border border-gray-800 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4">Edit Profile</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Username"
            placeholder="Your username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <Button type="submit" isLoading={loading} variant="success">
            {saved ? <><Check size={18} /> Saved</> : <><Save size={18} /> Save Changes</>}
          </Button>
        </form>
      </div>
    </div>
  );
}
