import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import Layout from './layout/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Quiz from './pages/Quiz';
import Result from './pages/Result';
import Profile from './pages/Profile';
import CompleteProfile from './pages/CompleteProfile';
import About from './pages/About';
import Documentation from './pages/Documentation';
import Multiplayer from './pages/Multiplayer';
import History from './pages/History';
import SharedQuiz from './pages/SharedQuiz';
import WrongAnswers from './pages/WrongAnswers';
import Bookmarks from './pages/Bookmarks';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Leaderboard from './pages/Leaderboard';
import Flashcards from './pages/Flashcards';
import ExportQuiz from './pages/ExportQuiz';
import Friends from './pages/Friends';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout>
          <Toaster 
            position="top-center"
            toastOptions={{
              style: {
                background: '#1a1a2e',
                color: '#fff',
                border: '1px solid #374151',
                padding: '16px',
                borderRadius: '12px',
              },
              success: {
                iconTheme: {
                  primary: '#39ff14',
                  secondary: 'black',
                },
              },
              error: {
                icon: null,
                style: {
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                },
                iconTheme: {
                  primary: '#ef4444',
                  secondary: 'white',
                },
              },
            }}
          />
          
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<About />} />       {/* Root now shows About */}
            <Route path="/login" element={<Login />} />  {/* Login moved to /login */}
            <Route path="/register" element={<Register />} />
            <Route path="/about" element={<About />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/multiplayer" element={<Multiplayer />} />
            <Route path="/shared/:shareId" element={<SharedQuiz />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes */}
<Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/quiz/:id" element={<Quiz />} />
              <Route path="/result" element={<Result />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/history" element={<History />} />
              <Route path="/wrong-answers" element={<WrongAnswers />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/flashcards/:quizId" element={<Flashcards />} />
              <Route path="/export/:quizId" element={<ExportQuiz />} />
              <Route path="/friends" element={<Friends />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}
