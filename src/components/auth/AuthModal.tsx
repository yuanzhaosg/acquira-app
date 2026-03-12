'use client'

import { useState } from 'react'
import { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } from '@/lib/useAuth'

interface AuthModalProps {
  onClose: () => void
  defaultMode?: 'signin' | 'signup'
}

export default function AuthModal({ onClose, defaultMode = 'signin' }: AuthModalProps) {
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

  async function handleGoogle() {
    setLoading(true); setError(null)
    const { error } = await signInWithGoogle()
    if (error) { setError(error.message); setLoading(false) }
  }

  async function handleApple() {
    setLoading(true); setError(null)
    const { error } = await signInWithApple()
    if (error) { setError(error.message); setLoading(false) }
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
            {mode === 'signin' ? 'Access your deal pipeline.' : 'Start analysing childcare acquisitions.'}
          </p>
        </div>

        {/* OAuth */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <button onClick={handleGoogle} disabled={loading} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '11px 16px', borderRadius: 8, cursor: 'pointer',
            background: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600, color: '#1a1a1a',
            fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.6 : 1,
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>

          <button onClick={handleApple} disabled={loading} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '11px 16px', borderRadius: 8, cursor: 'pointer',
            background: '#000', border: '1px solid rgba(255,255,255,0.15)',
            fontSize: 14, fontWeight: 600, color: '#fff',
            fontFamily: "'DM Sans', sans-serif", opacity: loading ? 0.6 : 1,
          }}>
            <svg width="16" height="18" viewBox="0 0 814 1000" fill="white">
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.7 0 248.5 0 126.2c0-103.7 35.4-188.1 98.7-253.9 63.2-65.8 143.4-103.8 236.6-103.8 91.6 0 156.7 38.8 209.6 38.8 50.5 0 129.6-40.8 232.4-40.8 37.9 0 136.2 3.7 206 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
            </svg>
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Email/password */}
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
