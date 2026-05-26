import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LoginForm } from '../components/auth/LoginForm';
import { SignUpForm } from '../components/auth/SignUpForm';
import { useAuth } from '../hooks/useAuth';
import { enablePreviewMode, isSupabaseConfigured } from '../lib/supabase';

export function LoginPage() {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  if (!isSupabaseConfigured) {
    return <Navigate to="/calculator" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="text-brand-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-brand-accent text-sm font-semibold tracking-widest uppercase mb-2">
            SkybrookAI
          </p>
          <h1 className="text-brand-text text-2xl font-bold">
            QuickScreen BOM Generator
          </h1>
          <p className="text-brand-muted text-sm mt-1">The Glass Outlet</p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-lg p-6">
          <div className="flex mb-6 gap-1 bg-brand-bg rounded-md p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${
                mode === 'login'
                  ? 'bg-brand-accent text-white'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-1.5 text-sm font-medium rounded transition-colors ${
                mode === 'signup'
                  ? 'bg-brand-accent text-white'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              Create account
            </button>
          </div>

          {mode === 'login' ? <LoginForm /> : <SignUpForm />}

          <div className="mt-6 border-t border-brand-border pt-5">
            <button
              type="button"
              onClick={() => {
                enablePreviewMode();
                window.location.assign('/fence-calculator');
              }}
              className="w-full rounded-lg border border-brand-accent/50 bg-brand-accent/10 px-4 py-3 text-sm font-bold text-brand-accent transition-colors hover:border-brand-accent hover:bg-brand-accent/15"
            >
              Continue without backend
            </button>
            <p className="mt-2 text-center text-xs leading-relaxed text-brand-muted">
              Preview mode uses local seed data. Login, saved quotes, and Supabase pricing stay off.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
