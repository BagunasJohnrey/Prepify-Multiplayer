import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import Footer from './Footer';
import LogoutModal from '../components/LogoutModal'; // Import the Modal

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  
  const [showLogoutModal, setShowLogoutModal] = useState(false); // State managed here

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const handleConfirmLogout = () => {
      // This is the function called when the user clicks 'Log Out' in the modal
      logout(); 
      setShowLogoutModal(false);
  }

  return (
    <div className="flex flex-col min-h-screen bg-dark-bg text-white font-sans selection:bg-neon-blue selection:text-black">
      
      {/* Navbar receives the handler to open the modal */}
      <Navbar onOpenLogout={() => setShowLogoutModal(true)} />
      
      <main className="grow w-full pb-20 lg:pb-0">
        {children}
      </main>
      
      <Footer />
      
      {/* Global Logout Modal: Rendered here to be correctly viewport-relative */}
      <LogoutModal 
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout} 
      />
    </div>
  );
}