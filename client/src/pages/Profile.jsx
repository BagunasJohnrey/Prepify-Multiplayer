import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Award, Heart, Star, ArrowLeft, Save, Check, Camera, Loader, LogOut, Shield, Zap } from 'lucide-react';
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

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB.");
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
    <div className="bg-[#0b0b12] min-h-[calc(100vh-4rem)] relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-blue/10 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-3 pb-6 sm:pt-6 sm:pb-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="text-gray-400 hover:text-white hover:bg-white/5 border border-white/10">
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-start gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Profile Settings</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage your account and preferences</p>
            </div>
          </div>
        </div>

        {/* Avatar & Info Card */}
        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-5">
              <div className="relative group cursor-pointer shrink-0" onClick={handleAvatarClick}>
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.username} className="w-20 h-20 rounded-2xl border border-white/[0.08] object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                    <User size={32} className="text-gray-500" />
                  </div>
                )}
                <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  {uploadingAvatar ? (
                    <Loader size={20} className="text-white animate-spin" />
                  ) : (
                    <Camera size={20} className="text-white" />
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{user.username}</h2>
                <p className="text-gray-400 text-sm">{user.email || "No email set"}</p>
                <div className="flex items-center gap-2 mt-2">
                  {user.has_google && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">Google</span>
                  )}
                  {user.has_password && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white/[0.04] text-gray-400 px-2 py-0.5 rounded border border-white/[0.06]">Password</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 border-t border-white/[0.06]">
            <div className="p-5 text-center border-r border-white/[0.06]">
              <div className="p-2 bg-neon-blue/10 rounded-xl border border-neon-blue/20 w-fit mx-auto mb-2">
                <Zap size={18} className="text-neon-blue" />
              </div>
              <div className="text-xl font-bold text-white">{user.xp || 0}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">XP</div>
            </div>
            <div className="p-5 text-center border-r border-white/[0.06]">
              <div className="p-2 bg-neon-purple/10 rounded-xl border border-neon-purple/20 w-fit mx-auto mb-2">
                <Star size={18} className="text-neon-purple" />
              </div>
              <div className="text-xl font-bold text-white">{level}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Level</div>
            </div>
            <div className="p-5 text-center">
              <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20 w-fit mx-auto mb-2">
                <Heart size={18} className="text-red-400" />
              </div>
              <div className="text-xl font-bold text-white">{user.hearts} / 3</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">Hearts</div>
            </div>
          </div>
        </div>

        {/* Edit Profile */}
        <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden">
          <div className="p-5 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-neon-green/10 rounded-xl border border-neon-green/20">
                <Shield className="text-neon-green" size={18} />
              </div>
              <h3 className="text-base font-bold text-white">Edit Profile</h3>
            </div>
          </div>
          <div className="p-5">
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
              <Button type="submit" isLoading={loading} variant="primary" fullWidth className="h-11">
                {saved ? <><Check size={18} /> Saved</> : <><Save size={18} /> Save Changes</>}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
