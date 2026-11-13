import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Hand, Eye, EyeOff, ArrowRight, AlertCircle, Activity, Shield, Wifi } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

const FEATURES = [
  { icon: Activity, text: 'Real-time differential IMU tremor monitoring' },
  { icon: Shield, text: 'Caregiver alerts & grasp rehabilitation support' },
  { icon: Wifi, text: 'Live sensor data from NeuroGlove device' },
];

const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await login(data.email, data.password);
      navigate(from, { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  const fillDemo = () => {
    setValue('email', 'demo@neuroglove.app');
    setValue('password', 'Demo1234!');
  };

  const busy = isSubmitting || isLoading;

  return (
    <div className="auth-shell">
      {/* ── Left panel: Branding ── */}
      <div className="auth-panel-left">
        {/* Background decoration */}
        <div className="auth-panel-decoration" aria-hidden="true">
          <div className="auth-deco-circle auth-deco-circle-1" />
          <div className="auth-deco-circle auth-deco-circle-2" />
          <div className="auth-deco-circle auth-deco-circle-3" />
        </div>

        <div className="auth-panel-left-inner">
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <Hand size={28} />
            </div>
            <div>
              <h1 className="auth-logo-name">NeuroGlove</h1>
              <p className="auth-logo-sub">Motor Symptom Monitor</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="auth-hero">
            <h2 className="auth-hero-title">
              Intelligent hand‑tremor monitoring for Parkinson's care
            </h2>
            <p className="auth-hero-body">
              A differential inertial glove system that tracks, analyses,
              and supports rehabilitation — all in one interface.
            </p>
          </div>

          {/* Feature list */}
          <ul className="auth-features" aria-label="Key features">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="auth-feature-item">
                <div className="auth-feature-icon" aria-hidden="true">
                  <Icon size={16} />
                </div>
                <span>{text}</span>
              </li>
            ))}
          </ul>

          {/* Disclaimer */}
          <p className="auth-disclaimer">
            Prototype — not a certified medical device. For research use only.
          </p>
        </div>
      </div>

      {/* ── Right panel: Form ── */}
      <div className="auth-panel-right">
        <div className="auth-form-card">
          {/* Header */}
          <div className="auth-form-header">
            <h2 className="auth-form-title">Welcome back</h2>
            <p className="auth-form-subtitle">
              Sign in to your NeuroGlove account
            </p>
          </div>

          {/* Demo quick-fill */}
          <button
            type="button"
            className="auth-demo-pill"
            onClick={fillDemo}
            aria-label="Fill in demo credentials"
          >
            <span className="auth-demo-dot" aria-hidden="true" />
            Try demo account — click to auto-fill
            <ArrowRight size={14} />
          </button>

          {/* Error */}
          {submitError && (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} className="shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="form-group">
              <label htmlFor="login-email" className="form-label">Email address</label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                {...register('email')}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
              />
              {errors.email && (
                <p className="form-error" id="login-email-error" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="form-group">
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="form-label" style={{ margin: 0 }}>
                  Password
                </label>
              </div>
              <div className="auth-password-wrap">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`form-input ${errors.password ? 'form-input-error' : ''}`}
                  style={{ paddingRight: '3rem' }}
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <p className="form-error" id="login-password-error" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-teal auth-submit-btn"
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <span className="auth-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="auth-switch-text">
            Don't have an account?{' '}
            <Link to="/signup" className="auth-link">
              Create one
            </Link>
          </p>

          {/* Demo credentials hint */}
          <div className="auth-credentials-hint">
            <p className="font-medium text-text-secondary mb-1">Demo credentials</p>
            <div className="font-mono text-xs text-text-tertiary space-y-0.5">
              <p>Email: demo@neuroglove.app</p>
              <p>Password: Demo1234!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
