import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Book, CheckCircle, Shield, Database, Heart, Brain, Zap, Code2, FileJson, Lock, Key, ArrowRight, Terminal, Globe, Cpu, Layers } from 'lucide-react';

export default function Documentation() {
  const { hash } = useLocation();

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - headerOffset;
      window.scrollTo({ top: offsetPosition, behavior: "smooth" });
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
    <div className="bg-[#0b0b12] min-h-[calc(100vh-4rem)] relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-neon-purple/8 blur-[100px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-6 sm:pt-6 sm:pb-10">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center text-neon-purple shadow-[0_0_30px_rgba(188,19,254,0.15)] shrink-0">
              <Book size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">System Documentation</h1>
              <p className="text-sm text-gray-400 mt-0.5">Technical references, API documentation, and architecture overview.</p>
            </div>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-3">
            <div className="bg-[#12121b] p-5 rounded-2xl border border-white/[0.06] sticky top-24">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Book size={16} className="text-neon-purple" /> Contents
              </h3>
              <ul className="space-y-1 text-sm">
                <li onClick={() => scrollToSection('overview')} className="text-gray-400 hover:text-neon-blue cursor-pointer transition px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                  Overview
                </li>
                <li onClick={() => scrollToSection('auth')} className="text-gray-400 hover:text-neon-blue cursor-pointer transition px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                  Authentication
                </li>
                <li onClick={() => scrollToSection('ai')} className="text-gray-400 hover:text-neon-blue cursor-pointer transition px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                  AI Quiz Generation
                </li>
                <li onClick={() => scrollToSection('db')} className="text-gray-400 hover:text-neon-blue cursor-pointer transition px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                  Heart System
                </li>
                <li onClick={() => scrollToSection('api')} className="text-gray-400 hover:text-neon-blue cursor-pointer transition px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                  API Endpoints
                </li>
                <li onClick={() => scrollToSection('realtime')} className="text-gray-400 hover:text-neon-blue cursor-pointer transition px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                  Real-time Features
                </li>
                <li onClick={() => scrollToSection('database')} className="text-gray-400 hover:text-neon-blue cursor-pointer transition px-3 py-2 rounded-lg hover:bg-white/[0.03]">
                  Database Schema
                </li>
              </ul>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-9 space-y-8">
            {/* Overview */}
            <section id="overview" className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06]">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Layers className="text-neon-blue" size={20} /> Architecture Overview
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Prepify follows a modern three-tier architecture with a React frontend, Node.js/Express backend, and PostgreSQL database. 
                The system uses JWT authentication, RESTful APIs, and Socket.io for real-time features.
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
                  <div className="text-neon-blue font-bold text-sm mb-1">Frontend</div>
                  <div className="text-gray-500 text-xs">React 19 + Tailwind v4</div>
                </div>
                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
                  <div className="text-neon-purple font-bold text-sm mb-1">Backend</div>
                  <div className="text-gray-500 text-xs">Node.js + Express</div>
                </div>
                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
                  <div className="text-neon-green font-bold text-sm mb-1">Database</div>
                  <div className="text-gray-500 text-xs">PostgreSQL</div>
                </div>
              </div>
            </section>

            {/* Authentication */}
            <section id="auth" className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06]">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Shield className="text-neon-blue" size={20} /> Authentication
              </h2>
              <DocSection
                icon={<Lock size={22} />}
                iconColor="text-neon-blue"
                iconBg="bg-neon-blue/10 border-neon-blue/20"
                title="JWT Authentication"
                text={
                  <>
                    Prepify uses <strong className="text-white">JWT (JSON Web Tokens)</strong> for stateless authentication. 
                    User passwords are securely hashed using <strong className="text-white">Bcrypt</strong> before being stored in the database. 
                    Protected routes ensure data privacy by validating tokens before rendering dashboard components.
                  </>
                }
              />
              <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                <div className="text-xs font-mono text-gray-500 mb-2">// Token Structure</div>
                <code className="text-xs text-neon-green">
{`{
  "userId": "uuid",
  "username": "string",
  "exp": "timestamp"
}`}
                </code>
              </div>
            </section>

            {/* AI Quiz Generation */}
            <section id="ai" className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06]">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Brain className="text-neon-purple" size={20} /> AI Quiz Generation
              </h2>
              <DocSection
                icon={<Cpu size={22} />}
                iconColor="text-neon-purple"
                iconBg="bg-neon-purple/10 border-neon-purple/20"
                title="Multi-Provider AI Engine"
                text={
                  <>
                    We leverage <strong className="text-white">Google Gemini</strong>, <strong className="text-white">Groq</strong>, and <strong className="text-white">OpenAI</strong> with automatic fallback between providers. 
                    When a PDF is uploaded, it is parsed server-side using <code className="text-neon-blue bg-neon-blue/10 px-1.5 py-0.5 rounded text-xs">pdf-parse</code>. 
                    The extracted text is chunked and sent to the AI with a structured prompt to generate a strictly formatted JSON quiz array.
                  </>
                }
              />
              <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                <div className="text-xs font-mono text-gray-500 mb-2">// AI Provider Priority</div>
                <code className="text-xs text-neon-green">
{`1. Gemini Flash (Primary)
2. Groq Llama 3.3 (Fallback)
3. GPT-4o Mini (Emergency)`}
                </code>
              </div>
            </section>

            {/* Heart System */}
            <section id="db" className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06]">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Heart className="text-neon-green" size={20} /> Heart System
              </h2>
              <DocSection
                icon={<Heart size={22} />}
                iconColor="text-neon-green"
                iconBg="bg-neon-green/10 border-neon-green/20"
                title="Gamified Lives System"
                text={
                  <>
                    To gamify learning, Prepify implements a heart system. Users start with <strong className="text-white">3 hearts</strong> and lose one for each incorrect answer. 
                    Hearts regenerate at a rate of <strong className="text-white">1 heart every 2 minutes</strong>. 
                    The server calculates heart regeneration logic on every user request to ensure the frontend state is always synchronized with the backend.
                  </>
                }
              />
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                  <div className="text-white font-bold text-sm mb-1">Starting Hearts</div>
                  <div className="text-neon-green text-xl font-black">3</div>
                </div>
                <div className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                  <div className="text-white font-bold text-sm mb-1">Regen Rate</div>
                  <div className="text-neon-blue text-xl font-black">2 min</div>
                </div>
              </div>
            </section>

            {/* API Endpoints */}
            <section id="api" className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06]">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Terminal className="text-neon-blue" size={20} /> API Endpoints
              </h2>
              
              <div className="space-y-3">
                <ApiEndpoint method="POST" path="/api/auth/register" desc="Create a new user account" />
                <ApiEndpoint method="POST" path="/api/auth/login" desc="Authenticate and receive JWT token" />
                <ApiEndpoint method="GET" path="/api/auth/me" desc="Get current user profile" />
                <ApiEndpoint method="POST" path="/api/auth/add-xp" desc="Add XP to user account" />
                <ApiEndpoint method="POST" path="/api/auth/lose-heart" desc="Deduct a heart from user" />
                <ApiEndpoint method="GET" path="/api/quiz/:id" desc="Get quiz by ID" />
                <ApiEndpoint method="POST" path="/api/quiz/generate" desc="Generate quiz from PDF" />
                <ApiEndpoint method="GET" path="/api/leaderboard" desc="Get top users ranking" />
                <ApiEndpoint method="GET" path="/api/friends" desc="Get user's friends list" />
                <ApiEndpoint method="POST" path="/api/friends/:username/add" desc="Send friend request" />
                <ApiEndpoint method="DELETE" path="/api/friends/:username/remove" desc="Remove friend" />
              </div>
            </section>

            {/* Real-time Features */}
            <section id="realtime" className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06]">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Zap className="text-neon-purple" size={20} /> Real-time Features
              </h2>
              <DocSection
                icon={<Globe size={22} />}
                iconColor="text-neon-purple"
                iconBg="bg-neon-purple/10 border-neon-purple/20"
                title="Socket.io Integration"
                text={
                  <>
                    Prepify uses <strong className="text-white">Socket.io</strong> for real-time multiplayer functionality. 
                    Players can create or join game rooms, answer questions simultaneously, and see live leaderboards. 
                    The system also supports <strong className="text-white">real-time friend invites</strong> and online presence tracking.
                  </>
                }
              />
              <div className="mt-4 p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                <div className="text-xs font-mono text-gray-500 mb-2">// Socket Events</div>
                <code className="text-xs text-neon-green">
{`createRoom → roomCreated
joinRoom → roomJoined, playerJoined
submitAnswer → answerSubmitted
sendInvite → inviteSent, gameInvite
respondInvite → inviteResponse`}
                </code>
              </div>
            </section>

            {/* Database Schema */}
            <section id="database" className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06]">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <Database className="text-neon-green" size={20} /> Database Schema
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                PostgreSQL database with the following core tables and relationships:
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <DbTable 
                  name="users" 
                  columns={[
                    { name: 'id', type: 'UUID', key: true },
                    { name: 'username', type: 'VARCHAR' },
                    { name: 'password', type: 'VARCHAR' },
                    { name: 'hearts', type: 'INTEGER' },
                    { name: 'xp', type: 'INTEGER' },
                    { name: 'level', type: 'INTEGER' },
                  ]} 
                />
                <DbTable 
                  name="quizzes" 
                  columns={[
                    { name: 'id', type: 'UUID', key: true },
                    { name: 'user_id', type: 'UUID', foreign: 'users.id' },
                    { name: 'title', type: 'VARCHAR' },
                    { name: 'questions', type: 'JSONB' },
                    { name: 'created_at', type: 'TIMESTAMP' },
                  ]} 
                />
                <DbTable 
                  name="quiz_attempts" 
                  columns={[
                    { name: 'id', type: 'UUID', key: true },
                    { name: 'user_id', type: 'UUID', foreign: 'users.id' },
                    { name: 'quiz_id', type: 'UUID', foreign: 'quizzes.id' },
                    { name: 'score', type: 'INTEGER' },
                    { name: 'total', type: 'INTEGER' },
                    { name: 'created_at', type: 'TIMESTAMP' },
                  ]} 
                />
                <DbTable 
                  name="friends" 
                  columns={[
                    { name: 'user_id', type: 'UUID', key: true, foreign: 'users.id' },
                    { name: 'friend_id', type: 'UUID', key: true, foreign: 'users.id' },
                    { name: 'created_at', type: 'TIMESTAMP' },
                  ]} 
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocSection({ icon, iconColor, iconBg, title, text }) {
  return (
    <div className="flex gap-4">
      <div className={`${iconBg} p-3 rounded-xl h-fit ${iconColor} border shrink-0`}>
        {icon}
      </div>
      <div>
        <h3 className="text-base font-bold text-white mb-1.5">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function ApiEndpoint({ method, path, desc }) {
  const methodColors = {
    'GET': 'bg-neon-green/20 text-neon-green border-neon-green/30',
    'POST': 'bg-neon-blue/20 text-neon-blue border-neon-blue/30',
    'PUT': 'bg-neon-purple/20 text-neon-purple border-neon-purple/30',
    'DELETE': 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
      <span className={`text-[10px] font-bold px-2 py-1 rounded border ${methodColors[method]}`}>
        {method}
      </span>
      <code className="text-xs text-white font-mono flex-1">{path}</code>
      <span className="text-xs text-gray-500 hidden sm:block">{desc}</span>
    </div>
  );
}

function DbTable({ name, columns }) {
  return (
    <div className="bg-white/[0.02] rounded-xl border border-white/[0.04] overflow-hidden">
      <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.04]">
        <span className="text-sm font-bold text-white">{name}</span>
      </div>
      <div className="p-3 space-y-1">
        {columns.map((col, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${col.key ? 'bg-neon-green' : col.foreign ? 'bg-neon-purple' : 'bg-gray-600'}`} />
            <span className="text-white font-mono">{col.name}</span>
            <span className="text-gray-600">{col.type}</span>
            {col.foreign && <span className="text-neon-purple text-[10px]">FK</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
