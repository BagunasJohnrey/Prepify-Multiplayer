import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-7xl sm:text-8xl font-black text-transparent bg-clip-text bg-linear-to-r from-neon-blue to-neon-purple">404</h1>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Page Not Found</h2>
        </div>

        <p className="text-gray-400 text-sm max-w-xs mx-auto leading-relaxed">
          Oops! Are you lost baby gurl? <br />Bawal pa dito ginagawa pa.
        </p>

        <Button
          onClick={() => navigate('/dashboard')}
          variant="primary"
          className="h-14 px-10 text-base font-bold"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}