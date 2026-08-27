import { Link } from 'react-router-dom';
import { Github, Instagram, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className={`border-t border-white/[0.06] mt-auto ${user ? 'hidden lg:block' : ''}`}>
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">

          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <h2 className="text-xl font-black text-transparent bg-clip-text bg-linear-to-r from-neon-blue to-neon-purple mb-3">
              PREPIFY
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              AI-powered exam preparation platform designed to help students master their subjects through intelligent simulation.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Platform</h3>
            <ul className="space-y-2.5 text-sm text-gray-500">
              <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
              <li><Link to="/multiplayer" className="hover:text-white transition-colors">Multiplayer</Link></li>
              {user ? (
                <li><Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              ) : (
                <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
              )}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Resources</h3>
            <ul className="space-y-2.5 text-sm text-gray-500">
              <li><Link to="/documentation#overview" className="hover:text-white transition-colors">Documentation</Link></li>
              <li><Link to="/documentation#overview" className="hover:text-white transition-colors">Getting Started</Link></li>
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Connect</h3>
            <div className="flex gap-3">
              <a href="https://github.com/BagunasJohnrey" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.1] transition-all">
                <Github size={16} />
              </a>
              <a href="https://www.instagram.com/jarey.xz/?igsh=dGNjcWEyZDhpYjI0#" target="_blank" rel="noopener noreferrer" className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.03] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.06] hover:border-white/[0.1] transition-all">
                <Instagram size={16} />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.06] mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-600">
          <p>&copy; {new Date().getFullYear()} Prepify. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Made with <Heart size={11} className="text-red-500 fill-red-500" /> by John Rey Bagunas
          </p>
        </div>
      </div>
    </footer>
  );
}