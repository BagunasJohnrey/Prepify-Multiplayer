import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, User, Users, History, Bookmark, Trophy, Gamepad2, BookOpen } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

export default function Navbar({ onOpenLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  const handleLogout = () => onOpenLogout();
  const handleMobileLogout = () => { setIsOpen(false); onOpenLogout(); };

  const isActive = (path) => location.pathname === path;

  const desktopLinks = user ? [
    { to: '/dashboard', label: 'Dashboard', icon: BookOpen },
    { to: '/history', label: 'History', icon: History },
    { to: '/leaderboard', label: 'Ranking', icon: Trophy },
    { to: '/multiplayer', label: 'Play', icon: Gamepad2 },
    { to: '/friends', label: 'Friends', icon: Users },
  ] : [];

  const mobileLinks = user ? [
    ...desktopLinks,
    { to: '/bookmarks', label: 'Saved', icon: Bookmark },
    { to: '/profile', label: 'Profile', icon: User },
    { to: '/about', label: 'About', icon: BookOpen },
    { to: '/documentation', label: 'Docs', icon: BookOpen },
  ] : [
    { to: '/about', label: 'About', icon: BookOpen },
    { to: '/documentation', label: 'Docs', icon: BookOpen },
  ];

  const bottomTabs = user ? [
    { to: '/dashboard', label: 'Home', icon: BookOpen },
    { to: '/leaderboard', label: 'Rank', icon: Trophy },
    { to: '/multiplayer', label: 'Play', icon: Gamepad2 },
    { to: '/history', label: 'History', icon: History },
    { to: '/profile', label: 'Me', icon: User },
  ] : [];

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#0b0b12]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

          {/* Logo */}
          <Link to={user ? "/dashboard" : "/"} className="logo-font text-xl font-black tracking-tight text-white flex items-center shrink-0">
            <span className="text-neon-blue">PREP</span>IFY
          </Link>

          {/* Desktop Nav — center */}
          <div className="hidden lg:flex items-center gap-1 ml-8">
            {desktopLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'text-neon-blue bg-neon-blue/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={15} />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Spacer */}
          <div className="hidden lg:block flex-1" />

          {/* Desktop Actions — right */}
          <div className="hidden lg:flex items-center gap-2">
            {user ? (
              <>
                <Link
                  to="/about"
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                    isActive('/about') ? 'text-neon-blue bg-neon-blue/10' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  About
                </Link>
                <Link
                  to="/documentation"
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                    isActive('/documentation') ? 'text-neon-blue bg-neon-blue/10' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  Docs
                </Link>

                <div className="w-px h-5 bg-white/[0.08] mx-1" />

                <Link
                  to="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.04] transition"
                >
                  <div className="w-7 h-7 rounded-lg bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue">
                    <User size={14} />
                  </div>
                  <span className="max-w-[100px] truncate">{user.username}</span>
                </Link>

                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                  title="Logout"
                >
                  <LogOut size={16} />
                </Button>
              </>
            ) : (
              <>
                <Link
                  to="/about"
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                    isActive('/about') ? 'text-neon-blue bg-neon-blue/10' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  About
                </Link>
                <Link
                  to="/documentation"
                  className={`text-sm font-medium px-3 py-1.5 rounded-lg transition ${
                    isActive('/documentation') ? 'text-neon-blue bg-neon-blue/10' : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  Docs
                </Link>

                <div className="w-px h-5 bg-white/[0.08] mx-1" />

                <Link to="/login" className="text-gray-300 hover:text-white px-4 py-2 text-sm font-bold rounded-xl hover:bg-white/5 transition">
                  Login
                </Link>
                <Link to="/register" className="bg-neon-blue text-black px-5 py-2 rounded-xl text-sm font-bold transition hover:bg-[#00d4ff] shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <Button className="lg:hidden text-gray-300 hover:text-white" variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </Button>
        </div>
      </nav>

      {/* Mobile Slide-in Drawer */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsOpen(false)}
          />
          <div className="lg:hidden fixed top-0 right-0 z-50 w-72 h-full bg-[#12121b] border-l border-white/[0.06] shadow-2xl animate-slide-in-right overflow-y-auto">
            <div className="p-5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between">
                <span className="logo-font text-lg font-black text-white">
                  <span className="text-neon-blue">PREP</span>IFY
                </span>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white w-9 h-9">
                  <X size={20} />
                </Button>
              </div>
              {user && (
                <Link to="/profile" onClick={() => setIsOpen(false)} className="mt-4 flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06] hover:bg-white/[0.05] transition">
                  <div className="w-10 h-10 rounded-xl bg-neon-blue/10 border border-neon-blue/20 flex items-center justify-center text-neon-blue">
                    <User size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.username}</p>
                    <p className="text-xs text-gray-500">{user.xp || 0} XP · Level {Math.floor((user.xp || 0) / 100) + 1}</p>
                  </div>
                </Link>
              )}
            </div>

            <div className="p-3">
              <div className="space-y-1">
                {mobileLinks.map((link) => {
                  const Icon = link.icon;
                  const active = isActive(link.to);
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                        active
                          ? 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'
                          : 'text-gray-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <Icon size={18} />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/[0.06] bg-[#12121b]">
              {user ? (
                <Button onClick={handleMobileLogout} variant="ghost" fullWidth className="flex items-center justify-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 py-3">
                  <LogOut size={18} /> Log Out
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link to="/login" onClick={() => setIsOpen(false)} className="text-center text-gray-300 hover:text-white border border-white/[0.08] py-3 rounded-xl text-sm font-bold hover:bg-white/[0.03] transition">
                    Login
                  </Link>
                  <Link to="/register" onClick={() => setIsOpen(false)} className="text-center bg-neon-blue text-black py-3 rounded-xl text-sm font-bold hover:bg-[#00d4ff] transition shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile Bottom Tab Bar */}
      {user && bottomTabs.length > 0 && (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#12121b]/95 backdrop-blur-xl border-t border-white/[0.06] safe-area-pb">
          <div className="flex items-center justify-around h-16 px-2">
            {bottomTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.to);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`flex flex-col items-center justify-center gap-1 w-16 py-1.5 rounded-xl transition ${
                    active ? 'text-neon-blue' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <div className={`p-1 rounded-lg transition ${active ? 'bg-neon-blue/10' : ''}`}>
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  </div>
                  <span className="text-[10px] font-semibold">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
