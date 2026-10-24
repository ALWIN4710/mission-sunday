import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Leaf, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { getErrorMessage } from '../utils';

const schema = z.object({
  email:    z.string().min(1, 'Please enter your email or username'),
  password: z.string().min(1, 'Password is required'),
});

export default function Login() {
  const { login } = useAuth();
  const { success, error } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      success('Welcome back!');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-950 via-forest-800 to-forest-700 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4">
            <Leaf className="w-8 h-8 text-sand-200" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Mission Sunday</h1>
          <p className="text-forest-300 text-sm mt-1">Sales Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 shadow-modal">
          <h2 className="text-base font-semibold text-white mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-forest-200 mb-1.5">Email or Username</label>
              <input
                id="email"
                type="text"
                autoComplete="username"
                placeholder="admin@missionsunday.church or admin"
                {...register('email')}
                className={`w-full px-3.5 py-2.5 rounded-xl border bg-white/10 backdrop-blur text-white placeholder-forest-400 text-sm
                  focus:outline-none focus:ring-2 focus:ring-sand-300/50 transition-all
                  ${errors.email ? 'border-red-400/60' : 'border-white/20'}`}
              />
              {errors.email && <p className="text-xs text-red-300 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-forest-200 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border bg-white/10 backdrop-blur text-white placeholder-forest-400 text-sm
                    focus:outline-none focus:ring-2 focus:ring-sand-300/50 transition-all
                    ${errors.password ? 'border-red-400/60' : 'border-white/20'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-300 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-300 mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              id="login-btn"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sand-300 text-forest-900 font-semibold text-sm
                hover:bg-sand-200 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-sand-200 disabled:opacity-70"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-xs text-forest-300 font-medium mb-2 text-center">Click to auto-fill credentials:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'admin@missionsunday.church', { shouldValidate: true });
                  setValue('password', 'Admin@123456', { shouldValidate: true });
                }}
                className="px-2.5 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all text-center flex items-center justify-center gap-1.5"
              >
                <span>👑</span> Admin Fill
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('email', 'volunteer@missionsunday.church', { shouldValidate: true });
                  setValue('password', 'Volunteer@123456', { shouldValidate: true });
                }}
                className="px-2.5 py-2 text-xs font-medium rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all text-center flex items-center justify-center gap-1.5"
              >
                <span>🤝</span> Volunteer Fill
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-forest-400 mt-6">
          Mission Sunday · Powered by God's Grace
        </p>
      </div>
    </div>
  );
}
