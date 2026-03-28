'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/useAuth'

interface NotificationPrefs {
  weekly_digest: boolean
  competitor_alerts: boolean
  deal_score_updates: boolean
  new_deal_reminders: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  weekly_digest:     true,
  competitor_alerts: false,
  deal_score_updates: true,
  new_deal_reminders: false,
}

const PREF_LABELS: Record<keyof NotificationPrefs, { title: string; description: string }> = {
  weekly_digest:      { title: 'Weekly Digest', description: 'Summary of your pipeline activity and market updates, delivered every Monday.' },
  competitor_alerts:  { title: 'Competitor Alerts', description: 'Get notified when new centres open or NQS ratings change in your watched postcodes.' },
  deal_score_updates: { title: 'Score Updates', description: 'Notify me when scoring model version changes may affect my existing deals.' },
  new_deal_reminders: { title: 'Deal Reminders', description: 'Weekly nudges on deals in Active or LOI status with no recent activity.' },
}

export default function SettingsPage() {
  const [prefs, setPrefs]         = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    // Load from localStorage (stub — replace with Supabase user_preferences when table exists)
    try {
      const stored = localStorage.getItem('notification_prefs')
      if (stored) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) })
    } catch {}
    setLoading(false)
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      // Save to localStorage first (client-side stub)
      localStorage.setItem('notification_prefs', JSON.stringify(prefs))

      // Also POST to API (will store in Supabase user_preferences when wired up)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        await fetch('/api/notifications/preferences', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body:    JSON.stringify(prefs),
        })
      }
      setSaved(true)
    } catch {}
    setSaving(false)
  }

  const toggle = (key: keyof NotificationPrefs) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
    setSaved(false)
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh', background: '#0d1b2a',
    fontFamily: "'DM Sans', sans-serif", color: '#fff',
    padding: '0 0 80px',
  }

  const headerStyle: React.CSSProperties = {
    padding: '48px 32px 32px', maxWidth: 600, margin: '0 auto',
  }

  const cardStyle: React.CSSProperties = {
    maxWidth: 600, margin: '0 auto', padding: '0 32px',
  }

  if (loading) return (
    <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>Loading…</div>
    </div>
  )

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <a href="/" style={{ fontSize: 12, color: '#00b4a0', textDecoration: 'none', fontFamily: "'DM Mono', monospace" }}>← Back to app</a>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Manage your notification preferences</p>
      </div>

      <div style={cardStyle}>
        <div style={{ background: '#112236', border: '1px solid #1e3a5f', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e3a5f', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>
            Notification Preferences
          </div>
          {(Object.keys(PREF_LABELS) as (keyof NotificationPrefs)[]).map((key, i, arr) => (
            <div
              key={key}
              style={{
                padding: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e8edf3', marginBottom: 4 }}>{PREF_LABELS[key].title}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{PREF_LABELS[key].description}</div>
              </div>
              {/* Toggle */}
              <div
                onClick={() => toggle(key)}
                style={{
                  flexShrink: 0,
                  width: 44, height: 24, borderRadius: 100, cursor: 'pointer',
                  background: prefs[key] ? '#00b4a0' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  left: prefs[key] ? 22 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#00b4a0', border: 'none', borderRadius: 8,
              padding: '10px 24px', color: '#0d1b2a', fontSize: 14,
              fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
              fontFamily: "'DM Sans', sans-serif", opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: '#00b4a0', fontFamily: "'DM Mono', monospace" }}>
              ✓ Saved
            </span>
          )}
        </div>

        <div style={{ marginTop: 32, padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
          <strong style={{ color: '#e8edf3' }}>Note:</strong> Email delivery is not yet configured. Preferences are saved and will activate when email integration is enabled.
        </div>
      </div>
    </div>
  )
}
