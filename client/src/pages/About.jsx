import { useState, useEffect, useRef } from 'react';
import { Brain, Zap, Target, ShieldCheck, ArrowRight, BookOpen, Trophy, Gamepad2, CheckCircle, Globe, BarChart3, Code2, Database, Server, Cpu } from 'lucide-react';
import Button from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, { threshold: 0.1, ...options });

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, isInView];
}

function AnimatedSection({ children, className = '', delay = 0 }) {
  const [ref, isInView] = useInView();

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${className}`}
      style={{
        opacity: isInView ? 1 : 0,
        transform: isInView ? 'translateY(0)' : 'translateY(30px)',
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}

export default function About() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStart = () => {
    if (user) navigate('/dashboard');
    else navigate('/register');
  };

  return (
    <div className="min-h-screen bg-[#0b0b12]">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 sm:py-32 px-4 sm:px-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-neon-blue/8 blur-[150px] rounded-full" />
          <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-neon-purple/6 blur-[120px] rounded-full" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <AnimatedSection>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
              Study Smarter,{' '}
              <span className="text-white">
                Not Harder
              </span>
            </h1>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <p className="text-gray-400 text-lg sm:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
              Upload any PDF and let AI create personalized quizzes in seconds. 
              Track your progress, challenge friends, and ace every exam.
            </p>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <div className="flex justify-center gap-3">
              <Button onClick={handleStart} size="lg" className="px-8 bg-neon-blue text-black font-bold hover:opacity-90 transition-all duration-300">
                Get Started Free <ArrowRight size={18} />
              </Button>
              <Button onClick={() => navigate('/documentation')} variant="outline" size="lg" className="px-8 border-white/[0.1] text-gray-300 hover:text-white hover:bg-white/[0.03]">
                Learn More
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Stats Bar */}
      <AnimatedSection>
        <section className="py-8 px-4 sm:px-6 border-y border-white/[0.04]">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div className="hover:scale-110 transition-transform duration-300">
                <div className="text-2xl sm:text-3xl font-black text-white mb-1">100%</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">AI Generated</div>
              </div>
              <div className="hover:scale-110 transition-transform duration-300">
                <div className="text-2xl sm:text-3xl font-black text-neon-green mb-1">Instant</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">Feedback</div>
              </div>
              <div className="hover:scale-110 transition-transform duration-300">
                <div className="text-2xl sm:text-3xl font-black text-neon-blue mb-1">Multiplayer</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">Study Battles</div>
              </div>
              <div className="hover:scale-110 transition-transform duration-300">
                <div className="text-2xl sm:text-3xl font-black text-neon-purple mb-1">Free</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">To Use</div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Why Prepify?</h2>
              <p className="text-gray-400 text-sm">Everything you need to ace your exams</p>
              <div className="w-12 h-1 bg-neon-blue mx-auto mt-4 rounded-full"></div>
            </div>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatedSection delay={0}><FeatureCard icon={<Brain size={22} className="text-neon-purple" />} title="Smart Generation" desc="AI analyzes your documents to create relevant, challenging questions instantly." color="neon-purple" /></AnimatedSection>
            <AnimatedSection delay={100}><FeatureCard icon={<Zap size={22} className="text-neon-blue" />} title="Instant Feedback" desc="Get detailed explanations for every answer to understand the why behind the what." color="neon-blue" /></AnimatedSection>
            <AnimatedSection delay={200}><FeatureCard icon={<Target size={22} className="text-neon-green" />} title="Adaptive Difficulty" desc="Configure from Easy to Hard to match your current proficiency level." color="neon-green" /></AnimatedSection>
            <AnimatedSection delay={300}><FeatureCard icon={<Gamepad2 size={22} className="text-neon-purple" />} title="Multiplayer Battles" desc="Challenge friends to real-time quiz competitions and climb the leaderboard." color="neon-purple" /></AnimatedSection>
            <AnimatedSection delay={400}><FeatureCard icon={<BarChart3 size={22} className="text-neon-blue" />} title="Progress Tracking" desc="Monitor scores, streaks, and improvement over time with built-in analytics." color="neon-blue" /></AnimatedSection>
            <AnimatedSection delay={500}><FeatureCard icon={<Globe size={22} className="text-neon-green" />} title="Cross-Platform" desc="Works seamlessly on desktop, tablet, and mobile devices." color="neon-green" /></AnimatedSection>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How It Works</h2>
              <p className="text-gray-400 text-sm">Three simple steps to better grades</p>
              <div className="w-12 h-1 bg-neon-green mx-auto mt-4 rounded-full"></div>
            </div>
          </AnimatedSection>
          <div className="grid sm:grid-cols-3 gap-6">
            <AnimatedSection delay={0}><StepCard number="01" icon={<BookOpen size={24} />} title="Upload PDF" desc="Drop your lecture notes, textbook chapters, or review materials." color="neon-blue" /></AnimatedSection>
            <AnimatedSection delay={150}><StepCard number="02" icon={<Brain size={24} />} title="AI Generates Quiz" desc="Our AI reads, understands, and creates targeted questions for you." color="neon-purple" /></AnimatedSection>
            <AnimatedSection delay={300}><StepCard number="03" icon={<Trophy size={24} />} title="Track & Improve" desc="Review mistakes, earn XP, level up, and watch your knowledge grow." color="neon-green" /></AnimatedSection>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Built With Modern Tech</h2>
              <p className="text-gray-400 text-sm">Powered by industry-leading technologies</p>
              <div className="w-12 h-1 bg-neon-purple mx-auto mt-4 rounded-full"></div>
            </div>
          </AnimatedSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AnimatedSection delay={0}><TechCard icon={<Code2 size={22} />} title="React 19" desc="Modern UI with hooks and context" /></AnimatedSection>
            <AnimatedSection delay={100}><TechCard icon={<Server size={22} />} title="Node.js" desc="Fast, scalable backend runtime" /></AnimatedSection>
            <AnimatedSection delay={200}><TechCard icon={<Database size={22} />} title="PostgreSQL" desc="Robust relational database" /></AnimatedSection>
            <AnimatedSection delay={300}><TechCard icon={<Cpu size={22} />} title="OpenAI API" desc="Advanced AI for quiz generation" /></AnimatedSection>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-20 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <AnimatedSection>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Empowering Students Everywhere</h2>
              <div className="w-12 h-1 bg-neon-green rounded-full mb-6"></div>
              <p className="text-gray-400 leading-relaxed mb-6">
                We believe education should be interactive, not passive. By leveraging Large Language Models, Prepify bridges the gap between reading notes and actively testing knowledge, ensuring you walk into your exams with confidence.
              </p>
              <div className="space-y-3">
                {['AI-powered question generation', 'Detailed answer explanations', 'Gamified learning experience', 'Real-time multiplayer battles'].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-sm text-gray-300 hover:text-neon-green transition-colors duration-300">
                    <CheckCircle size={16} className="text-neon-green shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
          <AnimatedSection delay={200}>
            <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] p-6 space-y-4 hover:border-neon-purple/20 transition-all duration-300">
              <div className="flex items-center gap-3 mb-2">
                <Gamepad2 size={20} className="text-neon-purple" />
                <span className="text-sm font-bold text-white">Platform Preview</span>
              </div>
              <div className="space-y-3">
                <div className="h-3 bg-white/[0.04] rounded-full w-3/4"></div>
                <div className="h-3 bg-white/[0.04] rounded-full w-full"></div>
                <div className="h-3 bg-white/[0.04] rounded-full w-5/6"></div>
                <div className="h-24 bg-white/[0.02] rounded-xl border border-white/[0.06] border-dashed flex items-center justify-center text-gray-600 text-sm hover:border-neon-purple/30 transition-all duration-300">
                  Interactive Quiz Interface
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-10 bg-neon-blue/10 rounded-lg border border-neon-blue/20 hover:bg-neon-blue/20 transition-all duration-300"></div>
                  <div className="h-10 bg-neon-purple/10 rounded-lg border border-neon-purple/20 hover:bg-neon-purple/20 transition-all duration-300"></div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Academic / Creator */}
      <section className="py-20 px-4 sm:px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <div className="bg-[#12121b] rounded-2xl border border-white/[0.06] overflow-hidden hover:border-white/[0.12] transition-all duration-300">
              <div className="p-8 sm:p-10">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                      <span className="text-neon-blue">IT 314</span> | Web Systems and Technologies
                    </h3>
                    <div className="w-12 h-1 bg-neon-blue rounded-full mb-4"></div>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                      This system was architected and developed as a final requirement to demonstrate proficiency in{' '}
                      <span className="text-white font-bold">Web Development</span>. It showcases modern web technologies, relational database management, and AI integration.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['React 19', 'Node.js', 'Express', 'PostgreSQL', 'Tailwind v4', 'OpenAI API'].map((tech) => (
                        <span key={tech} className="text-[10px] font-bold px-3 py-1.5 bg-white/[0.04] text-gray-300 rounded-lg border border-white/[0.06] hover:border-neon-blue/30 hover:text-neon-blue transition-all duration-300 cursor-default">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white/[0.02] rounded-xl border border-white/[0.06] p-6 hover:border-neon-purple/20 transition-all duration-300">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center text-neon-purple font-bold text-lg hover:scale-110 transition-transform duration-300">
                        JR
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">John Rey Bagunas</div>
                        <div className="text-gray-500 text-xs">Full Stack Developer</div>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-400 hover:text-neon-green transition-colors duration-300">
                        <ShieldCheck size={14} className="text-neon-green" />
                        <span>Designed & Developed</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 hover:text-neon-purple transition-colors duration-300">
                        <Brain size={14} className="text-neon-purple" />
                        <span>AI Integration</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-400 hover:text-neon-blue transition-colors duration-300">
                        <Database size={14} className="text-neon-blue" />
                        <span>Database Architecture</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-white/[0.06]">
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Instructor</div>
                      <div className="text-neon-purple font-bold text-sm">Sir Talaoc, Ivan Gabriel B.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc, color }) {
  const colorMap = {
    'neon-purple': 'bg-neon-purple/10 border-neon-purple/20 text-neon-purple',
    'neon-blue': 'bg-neon-blue/10 border-neon-blue/20 text-neon-blue',
    'neon-green': 'bg-neon-green/10 border-neon-green/20 text-neon-green',
  };
  return (
    <div className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-300 group cursor-default">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 ${colorMap[color]}`}>
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-neon-blue transition-colors duration-300">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">{desc}</p>
    </div>
  );
}

function StepCard({ number, icon, title, desc, color }) {
  const colorMap = {
    'neon-blue': 'text-neon-blue border-neon-blue/20',
    'neon-purple': 'text-neon-purple border-neon-purple/20',
    'neon-green': 'text-neon-green border-neon-green/20',
  };
  return (
    <div className="bg-[#12121b] p-6 rounded-2xl border border-white/[0.06] relative hover:border-white/[0.12] hover:bg-white/[0.02] transition-all duration-300 group cursor-default">
      <span className={`text-[10px] font-bold uppercase tracking-widest ${colorMap[color]} border px-2 py-0.5 rounded mb-4 inline-block group-hover:scale-110 transition-transform duration-300`}>
        Step {number}
      </span>
      <div className={`mb-3 ${colorMap[color].split(' ')[0]} group-hover:scale-110 transition-transform duration-300`}>{icon}</div>
      <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-neon-blue transition-colors duration-300">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed group-hover:text-gray-300 transition-colors duration-300">{desc}</p>
    </div>
  );
}

function TechCard({ icon, title, desc }) {
  return (
    <div className="bg-[#12121b] p-5 rounded-2xl border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-300 group cursor-default">
      <div className="text-neon-blue mb-3 group-hover:scale-110 group-hover:text-neon-purple transition-all duration-300">{icon}</div>
      <h3 className="text-sm font-bold text-white mb-1 group-hover:text-neon-blue transition-colors duration-300">{title}</h3>
      <p className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors duration-300">{desc}</p>
    </div>
  );
}
