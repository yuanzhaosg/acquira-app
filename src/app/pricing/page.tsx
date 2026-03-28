'use client'

import { useState } from 'react'
import { supabase } from '@/lib/useAuth'

interface PlanConfig {
  key: string
  name: string
  priceAud: number
  dealsMax: number | null
  description: string
  features: string[]
  badge?: string
}

const PLANS: PlanConfig[] = [
  {
    key: 'starter',
    name: 'Solo',
    priceAud: 79,
    dealsMax: 5,
    description: 'For individual investors evaluating deals.',
    features: [
      '5 scored deals per month',
      '17-dimension analysis',
      'Deal pipeline & status',
      'PDF export',
      'Email support',
    ],
  },
  {
    key: 'professional',
    name: 'Advisor',
    priceAud: 199,
    dealsMax: 25,
    description: 'For active acquirers and advisors running a live pipeline.',
    features: [
      '25 scored deals per month',
      'Everything in Solo',
      'Deal comparison tool',
      'Notes & tags',
      'Priority support',
    ],
    badge: 'Most Popular',
  },
  {
    key: 'firm',
    name: 'Fund',
    priceAud: 499,
    dealsMax: null,
    description: 'For PE, family offices and aggregators.',
    features: [
      'Unlimited scored deals',
      'Everything in Advisor',
      'Competitor & demographic data',
      'Team access (coming soon)',
      'Dedicated support',
    ],
  },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubscribe(planKey: string) {
    setError(null)
    setLoading(planKey)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token

      if (!token) {
        // Redirect to sign-in; store intent
        if (typeof window !== 'undefined') {
          window.location.href = '/?signin=1&plan=' + planKey
        }
        return
      }

      const res  = await fetch('/api/billing/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan: planKey }),
      })
      const json = await res.json()

      if (!res.ok || !json.url) {
        setError(json.error ?? 'Failed to create checkout session')
        return
      }

      window.location.href = json.url
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#0d1b2a',
    fontFamily: "'DM Sans', sans-serif",
    color: '#ffffff',
    paddingBottom: 80,
  }

  const headerStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '72px 24px 48px',
  }

  const gridStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 24,
    maxWidth: 1040,
    margin: '0 auto',
    padding: '0 24px',
    justifyContent: 'center',
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={{ fontSize: 13, color: '#00b4a0', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>
          Pricing
        </div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, margin: '0 0 16px', letterSpacing: '-0.5px' }}>
          Deal intelligence that pays for itself
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
          Score your first childcare deal in under 3 minutes. Monthly billing in AUD, cancel any time.
        </p>
      </div>

      {error && (
        <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, marginBottom: 24 }}>
          {error}
        </div>
      )}

      <div style={gridStyle}>
        {PLANS.map(plan => {
          const isPopular = !!plan.badge
          return (
            <div
              key={plan.key}
              style={{
                flex: '1 1 300px',
                maxWidth: 320,
                borderRadius: 16,
                border: isPopular ? '1.5px solid #00b4a0' : '1px solid #1e3a5f',
                background: isPopular ? 'rgba(0,180,160,0.06)' : '#112236',
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: isPopular ? '0 0 32px rgba(0,180,160,0.12)' : 'none',
              }}
            >
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: -14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#00b4a0',
                  color: '#0d1b2a',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '4px 16px',
                  borderRadius: 100,
                }}>
                  {plan.badge}
                </div>
              )}

              <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                {plan.name}
              </div>

              <div style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 40, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                  ${plan.priceAud}
                </span>
                <span style={{ color: '#94a3b8', fontSize: 14, marginLeft: 4 }}>AUD / month</span>
              </div>

              <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                {plan.description}
              </div>

              <div style={{ borderTop: '1px solid #1e3a5f', paddingTop: 20, marginBottom: 24, flex: 1 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                    <span style={{ color: '#00b4a0', fontSize: 15, flexShrink: 0, marginTop: 1 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16, textAlign: 'center' }}>
                {plan.dealsMax === null ? 'Unlimited deals/month' : `${plan.dealsMax} deals/month`}
              </div>

              <button
                onClick={() => handleSubscribe(plan.key)}
                disabled={loading === plan.key}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading === plan.key ? 'wait' : 'pointer',
                  border: 'none',
                  background: isPopular ? '#00b4a0' : 'rgba(255,255,255,0.08)',
                  color: isPopular ? '#0d1b2a' : '#ffffff',
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: loading === plan.key ? 0.7 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {loading === plan.key ? 'Redirecting…' : `Get ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 48, color: '#94a3b8', fontSize: 12 }}>
        Prices in AUD · Secure payments via Stripe · Cancel any time
      </div>
    </div>
  )
}
