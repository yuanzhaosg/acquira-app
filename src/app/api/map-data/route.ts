import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY!
const RADIUS_M = 3000

// ── Geocode address ──────────────────────────────────────
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', Australia')}&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json()
  if (data.status === 'OK' && data.results?.[0]) {
    const loc = data.results[0].geometry.location
    return { lat: loc.lat, lng: loc.lng }
  }
  return null
}

// ── Supply analysis ──────────────────────────────────────
function analyseSupply(competitors: any[], targetPlaces: number) {
  const totalPlaces = competitors.reduce((sum, c) => sum + (c.licensed_places || 0), 0) + targetPlaces
  const exceeding = competitors.filter(c => c.nqs_rating === 'Exceeding NQS').length
  const workingTowards = competitors.filter(c => c.nqs_rating === 'Working Towards NQS').length
  return { totalPlaces, exceeding, workingTowards }
}

// ── Demand zone ──────────────────────────────────────────
function demandZone(kidsPerPlace: number): 'undersupplied' | 'balanced' | 'saturated' {
  if (kidsPerPlace >= 3.5) return 'undersupplied'
  if (kidsPerPlace >= 2.0) return 'balanced'
  return 'saturated'
}

export async function POST(req: NextRequest) {
  try {
    const { address, suburb, state, postcode, licensed_places } = await req.json()

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 })
    }

    // ── 1. Geocode the target centre ──────────────────────
    const fullAddress = `${address}, ${suburb} ${state} ${postcode}`
    const coords = await geocodeAddress(fullAddress)
    
    if (!coords) {
      return NextResponse.json({ error: 'Could not geocode address' }, { status: 400 })
    }

    // ── 2. Query nearby centres from Supabase ─────────────
    const { data: competitors, error } = await supabase.rpc('get_nearby_centres', {
      target_lat: coords.lat,
      target_lng: coords.lng,
      radius_m: RADIUS_M,
    })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'DB query failed' }, { status: 500 })
    }

    // Filter out the target centre itself (by name match)
    const targetName = address.toLowerCase()
    const filtered = (competitors || []).filter((c: any) => 
      !c.service_name?.toLowerCase().includes(targetName.split(' ')[0]?.toLowerCase() || '__')
    )

    // ── 3. Supply analysis ────────────────────────────────
    const supply = analyseSupply(filtered, licensed_places || 0)

    // ── 4. Demand estimate (ABS proxy by postcode) ────────
    // Approximate kids-per-place using known VIC averages by zone type
    // Full ABS integration is Sprint 3 — for now use a postcode-based estimate
    const postcodeNum = parseInt(postcode || '3000')
    let estimatedKids0to4 = 800 // metro default
    if (postcodeNum >= 3000 && postcodeNum <= 3207) estimatedKids0to4 = 1200 // inner metro
    else if (postcodeNum >= 3800 && postcodeNum <= 3999) estimatedKids0to4 = 900 // outer suburbs
    else if (postcodeNum >= 3500) estimatedKids0to4 = 600 // regional

    const kidsPerPlace = supply.totalPlaces > 0 
      ? parseFloat((estimatedKids0to4 / supply.totalPlaces).toFixed(2))
      : 0

    const zone = demandZone(kidsPerPlace)

    // ── 5. Return ─────────────────────────────────────────
    return NextResponse.json({
      target: {
        lat: coords.lat,
        lng: coords.lng,
        address: fullAddress,
        licensed_places: licensed_places || 0,
      },
      competitors: filtered.map((c: any) => ({
        id: c.service_id,
        name: c.service_name,
        suburb: c.suburb,
        nqs_rating: c.nqs_rating,
        licensed_places: c.licensed_places,
        distance_m: Math.round(c.distance_m),
        lat: c.lat,
        lng: c.lng,
      })),
      demand: {
        estimated_kids_0to4: estimatedKids0to4,
        total_licensed_places: supply.totalPlaces,
        kids_per_place: kidsPerPlace,
        zone,
      },
      stats: {
        total_competitors: filtered.length,
        exceeding_nqs: supply.exceeding,
        working_towards_nqs: supply.workingTowards,
        radius_m: RADIUS_M,
      }
    })

  } catch (err) {
    console.error('map-data error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
