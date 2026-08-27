import { Link } from 'react-router-dom';
import { Github, Instagram, Heart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className={`bg-dark-surface border-t border-gray-800 mt-auto ${user ? 'hidden lg:block' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Column */}
          <div className="md:col-span-1">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-linear-to-r from-neon-blue to-neon-purple mb-4">
              PREPIFY
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              AI-powered exam preparation platform designed to help students master their subjects through intelligent simulation.
            </p>
          </div>

          {/* Links Column */}
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Platform</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/about" className="hover:text-neon-blue transition">About</Link></li>
              {user && (
                <li><Link to="/dashboard" className="hover:text-neon-blue transition">Dashboard</Link></li>
              )}
              {!user && (
                 <li><Link to="/" className="hover:text-neon-blue transition">Login</Link></li>
              )}
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Resources</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/documentation#overview" className="hover:text-neon-green transition">Documentation</Link></li>
              <li><Link to="/documentation#status" className="hover:text-neon-green transition">API Status</Link></li>
            </ul>
          </div>

          {/* Social Column */}
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-wider text-sm">Connect</h3>
            <div className="flex gap-4">
              <a href="https://github.com/BagunasJohnrey" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition transform hover:scale-110"><Github size={20} /></a>
              <a href="https://www.instagram.com/jarey.xz/?igsh=dGNjcWEyZDhpYjI0#" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition transform hover:scale-110"><Instagram size={20} /></a>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Prepify. All rights reserved.</p>
          <p className="flex items-center gap-1 mt-2 md:mt-0">
            Made with <Heart size={12} className="text-red-500 fill-red-500" /> by John Rey Bagunas
          </p>
        </div>
      </div>
    </footer>
  );
}