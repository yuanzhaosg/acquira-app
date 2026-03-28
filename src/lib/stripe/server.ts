/**
 * Lazy Stripe singleton — throws at access time (not module load time)
 * so that the module can be imported without crashing if STRIPE_SECRET_KEY is not set.
 */

import Stripe from 'stripe'

const API_VERSION = '2026-02-25.clover' as const

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env.local')
  }
  if (!_stripe) {
    // @ts-expect-error – clover version may not be in the types yet
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: API_VERSION })
  }
  return _stripe
}

// Proxy so callers can do: stripe.checkout.sessions.create(...)
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop]
  },
})

// ── Plan definitions ──────────────────────────────────────────────────────────

export const PLANS = {
  starter: {
    name: 'Starter',
    priceAud: 49,
    dealsMax: 5,
    priceId: () => {
      if (!process.env.STRIPE_PRICE_STARTER) throw new Error('STRIPE_PRICE_STARTER not set')
      return process.env.STRIPE_PRICE_STARTER
    },
    description: 'For individual operators evaluating a handful of deals per month.',
  },
  professional: {
    name: 'Professional',
    priceAud: 149,
    dealsMax: 25,
    priceId: () => {
      if (!process.env.STRIPE_PRICE_PROFESSIONAL) throw new Error('STRIPE_PRICE_PROFESSIONAL not set')
      return process.env.STRIPE_PRICE_PROFESSIONAL
    },
    description: 'For active acquirers and boutique brokers running a live pipeline.',
  },
  firm: {
    name: 'Firm',
    priceAud: 399,
    dealsMax: null, // unlimited
    priceId: () => {
      if (!process.env.STRIPE_PRICE_FIRM) throw new Error('STRIPE_PRICE_FIRM not set')
      return process.env.STRIPE_PRICE_FIRM
    },
    description: 'For investment firms and groups with unlimited deal flow.',
  },
} as const

export type PlanKey = keyof typeof PLANS
