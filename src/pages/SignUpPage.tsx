import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Hand, Eye, EyeOff, ArrowRight, AlertCircle,
  CheckCircle, User, Heart, Stethoscope,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { AuthUser } from '@/contexts/AuthContext';

const schema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name is too long'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Enter a valid email address'),
  role: z.enum(['patient', 'caregiver', 'clinician'], {
    error: 'Please select a role',
  }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirm: z.string().min(1, 'Please confirm your password'),
}).refine(data => data.password === data.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type FormData = z.infer<typeof schema>;

const ROLES: { value: AuthUser['role']; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'patient',
    label: 'Patient',
    description: 'Monitor my own symptoms',
    icon: <User size={18} />,
  },
  {
    value: 'caregiver',
    label: 'Caregiver',
    description: 'Support a family member',
    icon: <Heart size={18} />,
  },
  {
    value: 'clinician',
    label: 'Clinician',
    description: 'Clinical research or care',
    icon: <Stethoscope size={18} />,
  },
];

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /[0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const label = score === 0 ? '' : score === 1 ? 'Weak' : score === 2 ? 'Fair' : 'Strong';
  const color = score <= 1 ? 'var(--color-danger-500)' : score === 2 ? 'var(--color-warning-500)' : 'var(--color-success-500)';

  if (!password) return null;

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '0.375rem' }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: '3px',
              flex: 1,
              borderRadius: '2px',
              background: i <= score ? color : 'var(--color-border)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {checks.map(c => (
          <span
            key={c.label}
            style={{
              fontSize: '0.6875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              color: c.ok ? 'var(--color-success-600)' : 'var(--color-text-tertiary)',
            }}
          >
            <CheckCircle size={10} />
            {c.label}
          </span>
        ))}
        {label && (
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color, marginLeft: 'auto' }}>
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

const SignUpPage: React.FC = () => {
  const { signup, isLoading } = useAuth();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const selectedRole = watch('role');
  const passwordValue = watch('password') ?? '';

  const onSubmit = async (data: FormData) => {
    setSubmitError(null);
    try {
      await signup(data.name, data.email, data.password, data.role);
      navigate('/', { replace: true });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
    }
  };

  const busy = isSubmitting || isLoading;

  return (
    <div className="auth-shell">
      {/* ── Left panel: Branding ── */}
      <div className="auth-panel-left">
        <div className="auth-panel-decoration" aria-hidden="true">
          <div className="auth-deco-circle auth-deco-circle-1" />
          <div className="auth-deco-circle auth-deco-circle-2" />
          <div className="auth-deco-circle auth-deco-circle-3" />
        </div>

        <div className="auth-panel-left-inner">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <Hand size={28} />
            </div>
            <div>
              <h1 className="auth-logo-name">NeuroGlove</h1>
              <p className="auth-logo-sub">Motor Symptom Monitor</p>
            </div>
          </div>

          <div className="auth-hero">
            <h2 className="auth-hero-title">
              Join the NeuroGlove monitoring programme
            </h2>
            <p className="auth-hero-body">
              Create your account to access real-time tremor monitoring,
              session history, rehabilitation support, and caregiver alerts.
            </p>
          </div>

          {/* Steps */}
          <ol className="auth-steps" aria-label="Getting started steps">
            {[
              'Create your account below',
              'Pair your NeuroGlove device over Bluetooth',
              'Begin your first monitoring session',
            ].map((step, i) => (
              <li key={step} className="auth-step-item">
                <div className="auth-step-num" aria-hidden="true">{i + 1}</div>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="auth-disclaimer">
            Prototype — not a certified medical device. For research use only.
          </p>
        </div>
      </div>

      {/* ── Right panel: Form ── */}
      <div className="auth-panel-right">
        <div className="auth-form-card auth-form-card-wide">
          <div className="auth-form-header">
            <h2 className="auth-form-title">Create account</h2>
            <p className="auth-form-subtitle">
              All fields are required — demonstration data only
            </p>
          </div>

          {submitError && (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} className="shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Name */}
            <div className="form-group">
              <label htmlFor="signup-name" className="form-label">Full name</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Your display name"
                className={`form-input ${errors.name ? 'form-input-error' : ''}`}
                {...register('name')}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'signup-name-error' : undefined}
              />
              {errors.name && (
                <p className="form-error" id="signup-name-error" role="alert">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="form-group">
              <label htmlFor="signup-email" className="form-label">Email address</label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                {...register('email')}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'signup-email-error' : undefined}
              />
              {errors.email && (
                <p className="form-error" id="signup-email-error" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Role selector */}
            <div className="form-group">
              <p className="form-label" id="role-label">I am a…</p>
              <div
                className="auth-role-grid"
                role="radiogroup"
                aria-labelledby="role-label"
                aria-describedby={errors.role ? 'role-error' : undefined}
              >
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={selectedRole === r.value}
                    onClick={() => setValue('role', r.value, { shouldValidate: true })}
                    className={`auth-role-card ${selectedRole === r.value ? 'selected' : ''}`}
                  >
                    <div className="auth-role-icon">{r.icon}</div>
                    <span className="auth-role-label">{r.label}</span>
                    <span className="auth-role-desc">{r.description}</span>
                  </button>
                ))}
              </div>
              {/* Hidden input to register with react-hook-form */}
              <input type="hidden" {...register('role')} />
              {errors.role && (
                <p className="form-error" id="role-error" role="alert">
                  {errors.role.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="form-group">
              <label htmlFor="signup-password" className="form-label">Password</label>
              <div className="auth-password-wrap">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  className={`form-input ${errors.password ? 'form-input-error' : ''}`}
                  style={{ paddingRight: '3rem' }}
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  aria-describedby="signup-password-error"
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
              <PasswordStrength password={passwordValue} />
              {errors.password && (
                <p className="form-error" id="signup-password-error" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm password */}
            <div className="form-group">
              <label htmlFor="signup-confirm" className="form-label">Confirm password</label>
              <div className="auth-password-wrap">
                <input
                  id="signup-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  className={`form-input ${errors.confirm ? 'form-input-error' : ''}`}
                  style={{ paddingRight: '3rem' }}
                  {...register('confirm')}
                  aria-invalid={!!errors.confirm}
                  aria-describedby={errors.confirm ? 'signup-confirm-error' : undefined}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowConfirm(s => !s)}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirm && (
                <p className="form-error" id="signup-confirm-error" role="alert">
                  {errors.confirm.message}
                </p>
              )}
            </div>

            {/* Disclaimer checkbox */}
            <div className="auth-terms">
              <p>
                By creating an account you acknowledge that NeuroGlove is a{' '}
                <strong>research prototype</strong> and not a certified medical device.
                No real patient data should be entered.
              </p>
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
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch-text">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;
