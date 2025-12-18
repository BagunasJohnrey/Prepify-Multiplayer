import { useEffect } from 'react'; // UPDATED: Added Import
import { Brain, Zap, Target, ShieldCheck } from 'lucide-react';
import Button from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function About() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // UPDATED: Added Auto-Redirect Effect
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleStartLearning = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="animate-fade-in">
      <section className="relative overflow-hidden py-20 px-6">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            Master Your Exams with <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-neon-blue to-neon-purple">
              AI-Powered Precision
            </span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
            Prepify transforms your static PDF study materials into dynamic, interactive quizzes using advanced Artificial Intelligence.
          </p>
          <div className="flex justify-center gap-4">
             <Button className="max-w-[200px]" onClick={handleStartLearning}>Start Learning</Button>
          </div>
        </div>
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neon-blue/10 rounded-full blur-[100px] z-0"></div>
      </section>

      <section className="bg-dark-surface border-y border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard 
              icon={<Brain className="text-neon-purple" />}
              title="Smart Generation"
              desc="Our AI analyzes your documents to create relevant, challenging questions instantly."
            />
            <FeatureCard 
              icon={<Zap className="text-neon-blue" />}
              title="Instant Feedback"
              desc="Get detailed explanations for every answer to understand the 'why' behind the 'what'."
            />
            <FeatureCard 
              icon={<Target className="text-neon-green" />}
              title="Adaptive Difficulty"
              desc="Configure your exam difficulty from Easy to Hard to match your current proficiency."
            />
             <FeatureCard 
              icon={<ShieldCheck className="text-white" />}
              title="Progress Tracking"
              desc="Monitor your scores and improvement over time with our built-in analytics dashboard."
            />
          </div>
        </div>
      </section>

      <section className="py-20 px-6 max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1">
            <div className="inline-block bg-gray-800 px-3 py-1 rounded-full text-xs font-bold text-gray-400 mb-4 border border-gray-700">OUR MISSION</div>
            <h2 className="text-3xl font-bold mb-4">Empowering Students Everywhere</h2>
            <p className="text-gray-400 leading-relaxed mb-6">
                We believe that education should be interactive, not passive. By leveraging the power of Large Language Models, Prepify bridges the gap between reading notes and actively testing knowledge, ensuring you walk into your exams with confidence.
            </p>
        </div>
        <div className="flex-1 bg-linear-to-br from-gray-800 to-gray-900 p-8 rounded-3xl border border-gray-700 shadow-2xl rotate-2 hover:rotate-0 transition duration-500">
            <div className="space-y-4">
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-5/6"></div>
                <div className="h-32 bg-gray-700/50 rounded-xl border border-gray-600 border-dashed flex items-center justify-center text-gray-500">
                    AI Processing Visualization
                </div>
            </div>
        </div>
      </section>

      
      <section className="py-16 px-6 text-center">
        <div className="max-w-3xl mx-auto p-8 rounded-3xl bg-dark-surface border border-gray-800 transition-all duration-300 hover:border-neon-green hover:shadow-[0_0_30px_rgba(57,255,20,0.1)] relative overflow-hidden group">
            
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-blue/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-neon-green/5 transition-colors duration-500"></div>

            <p className="text-neon-green text-[10px] uppercase tracking-[0.2em] font-bold mb-4">
              Academic Milestone
            </p>
            
            <h3 className="text-2xl md:text-3xl font-black text-white mb-3">
              <span className="text-neon-blue">IT 314</span> | Web Systems and Technologies
            </h3>
            
            <p className="text-gray-400 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
              This system was architected and developed as a final requirement to demonstrate proficiency in 
              <span className="text-white font-bold"> Web Development</span>. 
              It showcases the practical application of modern web technologies, relational database management, and third-party AI integration.
            </p>

            <div className="inline-flex items-center justify-center gap-3 px-5 py-2.5 bg-gray-900/80 rounded-xl border border-gray-700 mb-8 backdrop-blur-sm">
               <span className="text-gray-500 text-xs font-bold uppercase tracking-wide">Instructor</span>
               <div className="w-px h-4 bg-gray-700"></div>
               <span className="text-neon-purple font-bold text-sm">Sir Talaoc, Ivan Gabriel B.</span>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
                {['React 19', 'Node.js', 'Express', 'PostgreSQL', 'Tailwind v4', 'OpenAI API'].map((tech) => (
                    <span key={tech} className="text-[10px] font-bold px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors cursor-default">
                        {tech}
                    </span>
                ))}
            </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="p-6 rounded-2xl bg-dark-bg border border-gray-800 hover:border-neon-blue transition duration-300 group">
      <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
