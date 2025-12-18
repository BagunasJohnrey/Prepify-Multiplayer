import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Navbar now accepts an onOpenLogout prop from Layout.jsx
export default function Navbar({ onOpenLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  // Removed unused variables 'logout' and 'navigate' from destructuring/assignment
  const { user } = useAuth(); 
  const location = useLocation();

  // This function is called when the desktop logout button is clicked.
  const handleLogout = () => {
    onOpenLogout();
  };
  
  // This function is for the mobile menu logout button.
  const handleMobileLogout = () => {
    setIsOpen(false); // Close mobile menu first
    onOpenLogout();
  }

  const isActive = (path) => location.pathname === path ? 'text-neon-blue' : 'text-gray-300 hover:text-white';

  return (
    <nav className="sticky top-0 z-50 bg-dark-bg/80 backdrop-blur-md border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between relative">
        
        {/* Logo */}
        <Link to={user ? "/dashboard" : "/"} className="text-2xl font-black tracking-tight text-white flex items-center">
          <span className="text-neon-blue">PREP</span>IFY
        </Link>

        {/* Desktop Navigation - CENTERED ABSOLUTELY */}
        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 font-medium text-sm">
          
          {/* UPDATED: Removed {!user &&} check so everyone sees About */}
          <Link to="/about" className={`${isActive('/about')} transition`}>About</Link>
          
          <Link to="/documentation" className={`${isActive('/documentation')} transition`}>Documentation</Link>
          
          {user && (
            <>
              <Link to="/dashboard" className={`${isActive('/dashboard')} transition`}>Dashboard</Link>
              {/* Multiplayer Link */}
              <Link to="/multiplayer" className={`${isActive('/multiplayer')} transition flex items-center gap-1`}>
                  <Users size={16} /> Friends
              </Link>
            </>
          )}
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-gray-400 text-sm flex items-center gap-2">
                <User size={16} /> {user.username}
              </span>
              <button 
                onClick={handleLogout} 
                className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition border border-gray-700"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              {/* UPDATED: Link points to /login */}
              <Link to="/login" className="text-gray-300 hover:text-white px-4 py-2 text-sm font-bold">Login</Link>
              <Link to="/register" className="bg-neon-blue text-black hover:bg-[#00d4ff] px-5 py-2 rounded-full text-sm font-bold transition shadow-[0_0_15px_rgba(0,243,255,0.3)]">
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button className="md:hidden text-white" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-dark-surface border-b border-gray-800 p-6 flex flex-col gap-4 shadow-2xl animate-fade-in-down">
          
          {/* UPDATED: Removed {!user &&} check */}
          <Link to="/about" className="text-white py-2" onClick={() => setIsOpen(false)}>About</Link>
          
          <Link to="/documentation" className="text-white py-2" onClick={() => setIsOpen(false)}>Documentation</Link>
          
          {user && <Link to="/dashboard" className="text-white py-2" onClick={() => setIsOpen(false)}>Dashboard</Link>}
          {user && <Link to="/multiplayer" className="text-white py-2 flex items-center gap-2" onClick={() => setIsOpen(false)}>
              <Users size={18} /> Play with Friends
          </Link>}
          
          <div className="border-t border-gray-700 pt-4 mt-2">
            {user ? (
              <button onClick={handleMobileLogout} className="flex items-center gap-2 text-red-500 w-full py-2">
                <LogOut size={18} /> Log Out
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                {/* UPDATED: Link points to /login */}
                <Link to="/login" className="text-center text-white border border-gray-700 py-3 rounded-xl" onClick={() => setIsOpen(false)}>Login</Link>
                <Link to="/register" className="text-center bg-neon-blue text-black py-3 rounded-xl font-bold" onClick={() => setIsOpen(false)}>Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
