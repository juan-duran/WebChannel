import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, Loader2, MessageCircle, Eye, EyeOff } from 'lucide-react';

type AuthMode = 'login' | 'signup';

export function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message || 'Incorrect email or password');
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            setError('Email already in use. Please login instead.');
          } else {
            setError(error.message || 'Failed to create account');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-dark-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-dark-secondary border border-border-primary rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-accent to-accent-hover rounded-2xl mb-4 shadow-md">
              <MessageCircle className="w-8 h-8 text-dark-primary" />
            </div>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              WebChannel
            </h1>
            <p className="text-text-secondary">
              {mode === 'login' ? 'Welcome back! Sign in to continue' : 'Create your account to get started'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-border-primary bg-dark-tertiary text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-text-muted"
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-border-primary bg-dark-tertiary text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-text-muted"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary p-2 rounded-full hover:bg-dark-elevated active:bg-dark-elevated active:text-text-primary"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="mt-1.5 text-xs text-text-muted">
                  Minimum 6 characters
                </p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-border-primary bg-dark-tertiary text-text-primary rounded-lg focus:ring-2 focus:ring-accent focus:border-transparent transition-all placeholder:text-text-muted"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover text-dark-primary font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? (mode === 'login' ? 'Signing in...' : 'Creating account...') : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              disabled={loading}
              className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
            >
              {mode === 'login' ? (
                <>
                  Don't have an account? <span className="text-accent font-medium">Sign up</span>
                </>
              ) : (
                <>
                  Already have an account? <span className="text-accent font-medium">Sign in</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
