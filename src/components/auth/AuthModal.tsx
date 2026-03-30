'use client'

import { useState } from 'react'
import { signInWithEmail, signUpWithEmail } from '@/lib/useAuth'

interface AuthModalProps {
  onClose: () => void
  defaultMode?: 'signin' | 'signup'
  reason?: 'upload' | 'map'
}

export default function AuthModal({ onClose, defaultMode = 'signup', reason = 'upload' }: AuthModalProps) {
  const [mode, setMode]         = useState<'signin' | 'signup'>(defaultMode)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState<string | null>(null)

  async function handleEmail() {
    if (!email || !password) { setError('Email and password required'); return }
    setLoading(true); setError(null); setSuccess(null)
    try {
      const { error } = mode === 'signin'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password)
      if (error) {
        setError(error.message)
      } else if (mode === 'signup') {
        setSuccess('Check your email to confirm your account.')
      } else {
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      }} />

      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001, background: '#0d1b2a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '40px 36px',
        width: '100%', maxWidth: 420,
        fontFamily: "'DM Sans', sans-serif",
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>
              Acquira<span style={{ color: '#00b4a0' }}>.</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 20, padding: 4 }}>✕</button>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
            {mode === 'signin'
              ? 'Access your deal pipeline.'
              : reason === 'map'
                ? 'See the full competitive map, DA pipeline, and all nearby centres.'
                : 'Start analysing childcare acquisitions — free.'}
          </p>
        </div>

        {/* Email/password form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="Email address" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '11px 14px', color: '#fff',
              fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none',
              width: '100%', boxSizing: 'border-box',
            }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleEmail()}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '11px 14px', color: '#fff',
              fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: 'none',
              width: '100%', boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{ fontSize: 13, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ fontSize: 13, color: '#22c55e', padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 6 }}>
              {success}
            </div>
          )}

          <button onClick={handleEmail} disabled={loading} style={{
            padding: '12px 16px', borderRadius: 8, border: 'none',
            background: loading ? 'rgba(0,180,160,0.5)' : '#00b4a0',
            color: '#0d1b2a', fontSize: 14, fontWeight: 700,
            cursor: loading ? 'wait' : 'pointer',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {loading ? '…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </div>

        {/* Toggle */}
        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
          {mode === 'signin' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(null); setSuccess(null) }}
                style={{ background: 'none', border: 'none', color: '#00b4a0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('signin'); setError(null); setSuccess(null) }}
                style={{ background: 'none', border: 'none', color: '#00b4a0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
