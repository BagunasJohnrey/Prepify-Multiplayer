import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Book, Server, CheckCircle, Shield, Database, Heart, Brain } from 'lucide-react';

export default function Documentation() {
  const { hash } = useLocation(); 
  
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
    
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    if (hash) {
      const id = hash.replace('#', '');
      setTimeout(() => scrollToSection(id), 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="min-h-screen animate-fade-in p-6 md:p-12 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
          System <span className="text-neon-blue">Documentation</span>
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Technical references, API status, and architecture overview for the Prepify Platform.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8">
        
        {/* Sidebar / Navigation */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-dark-surface p-6 rounded-2xl border border-gray-800 sticky top-24">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Book size={18} className="text-neon-purple" /> Contents
            </h3>
            <ul className="space-y-3 text-sm text-gray-400">
              <li onClick={() => scrollToSection('overview')} className="hover:text-neon-blue cursor-pointer transition flex items-center gap-2">
                Overview
              </li>
              <li onClick={() => scrollToSection('auth')} className="hover:text-neon-blue cursor-pointer transition flex items-center gap-2">
                Authentication
              </li>
              <li onClick={() => scrollToSection('ai')} className="hover:text-neon-blue cursor-pointer transition flex items-center gap-2">
                Quiz Generation
              </li>
              <li onClick={() => scrollToSection('db')} className="hover:text-neon-blue cursor-pointer transition flex items-center gap-2">
                Heart System
              </li>
              <li onClick={() => scrollToSection('status')} className="text-neon-green font-bold flex items-center gap-2 mt-4 pt-4 border-t border-gray-800 cursor-pointer hover:underline">
                <Server size={14} /> API Status
              </li>
            </ul>
          </div>
        </div>

        {/* Main Content */}
        <div className="md:col-span-9 space-y-12">
          
          {/* API Status Section */}
          <section id="status" className="bg-dark-surface p-8 rounded-3xl border border-gray-800 shadow-xl relative overflow-hidden group hover:border-neon-green/50 transition">
            
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Server className="text-neon-green" /> System Status
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatusItem label="API Gateway" status="Operational" />
              <StatusItem label="Database (PostgreSQL)" status="Operational" />
              <StatusItem label="AI Engine (Gemini & Groq)" status="Operational" />
            </div>

            <div className="mt-6 p-4 bg-black/20 rounded-xl border border-gray-800/50 flex justify-between items-center text-xs font-mono text-gray-400">
              <span>Last Updated: {new Date().toLocaleTimeString()}</span>
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-neon-green rounded-full animate-pulse"></span>
                All Systems Normal
              </span>
            </div>
          </section>

          {/* Architecture Section */}
          <section id="overview" className="bg-dark-surface p-8 rounded-3xl border border-gray-800">
            <h2 className="text-2xl font-bold text-white mb-8">Architecture Overview</h2>
            <div className="space-y-10">
              
              {/* Authentication */}
              <div id="auth" className="flex gap-5 scroll-mt-24">
                <div className="bg-blue-500/10 p-3 rounded-xl h-fit text-blue-400 border border-blue-500/20"><Shield size={24} /></div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Secure Authentication</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Prepify uses <strong>JWT (JSON Web Tokens)</strong> for stateless authentication. User passwords are securely hashed using <strong>Bcrypt</strong> before being stored in the database. Protected routes in the frontend (React Router) ensure data privacy by validating tokens before rendering dashboard components.
                  </p>
                </div>
              </div>
              
              {/* Quiz Generation */}
              <div id="ai" className="flex gap-5 scroll-mt-24">
                <div className="bg-purple-500/10 p-3 rounded-xl h-fit text-purple-400 border border-purple-500/20"><Brain size={24} /></div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">AI Quiz Generation</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    We leverage <strong>Google Gemini</strong> and <strong>Groq</strong> to access advanced LLMs like <em>Gemini Flash</em> and <em>Llama 3.3</em>, with automatic fallback between the two. When a PDF is uploaded, it is parsed server-side using <code>pdf2json</code>. The extracted text is chunked and sent to the AI with a structured prompt to generate a strictly formatted JSON quiz array.
                  </p>
                </div>
              </div>

              {/* Heart System */}
              <div id="db" className="flex gap-5 scroll-mt-24">
                <div className="bg-green-500/10 p-3 rounded-xl h-fit text-green-400 border border-green-500/20"><Heart size={24} /></div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Heart System & Persistence</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    To gamify learning, Prepify implements a heart system. User hearts and regeneration timestamps are stored in <strong>PostgreSQL</strong>. The server calculates heart regeneration logic (1 heart every 2 minutes) on every user request to ensure the frontend state is always synchronized with the backend.
                  </p>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

function StatusItem({ label, status }) {
  return (
    <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700 flex items-center justify-between">
      <span className="text-gray-300 font-medium text-sm">{label}</span>
      <div className="flex items-center gap-1.5 text-neon-green text-xs font-bold uppercase tracking-wider">
        <CheckCircle size={14} /> {status}
      </div>
    </div>
  );
}