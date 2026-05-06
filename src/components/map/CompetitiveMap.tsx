'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { MarketAudit } from '@/types/workflow'

interface Competitor {
  id: string
  name: string
  suburb: string
  nqs_rating: string
  licensed_places: number
  distance_m: number
  lat: number
  lng: number
}

export interface DaApplication {
  address: string
  description: string
  status: 'approved' | 'lodged' | 'refused' | 'unknown'
  date?: string
  places?: number | null
  distance_km?: number | null
  info_url?: string
}

export interface PipelineIntel {
  approvedDAs?: number
  lodgedDAs?: number
  permitSites?: number
  notes?: string
  applications?: DaApplication[]
}

interface MapData {
  target: { lat: number; lng: number; address: string; licensed_places: number }
  competitors: Competitor[]
  demand: {
    estimated_kids_0to4: number
    demand_detail?: {
      abs2021Raw: number
      growthFactor: number
      growthPct: number
      postcodeAreaKm2: number
      catchmentAreaKm2: number
      areaRatioPct: number
      yearEstimate: number
    } | null
    total_licensed_places: number
    kids_per_place: number
    zone: 'undersupplied' | 'balanced' | 'oversupplied'
    data_source?: string
    census_year?: number
    adj_kids_per_place?: { low: number; mid: number; high: number }
    ldc_util_rate?: { low: number; high: number; mid: number; is_regional: boolean }
    demand_trend?: { trend: string; label: string; gf: number; note: string }
  }
  stats: {
    total_competitors: number
    exceeding_nqs: number
    working_towards_nqs: number
    radius_m: number
    radius_km?: number
    radius_label?: string
  }
}

interface CompetitiveMapProps {
  address: string
  suburb: string
  state: string
  postcode: string
  licensed_places: number
  centre_name: string
  overall_score: number
  pipelineIntel?: PipelineIntel | null
  marketAudit?: MarketAudit | null
  legacyMarket?: LegacyMarketSummary | null
}

interface LegacyMarketSummary {
  competitor_count?: number | null
  total_licensed_places?: number | null
  approved_pipeline_places?: number | null
  edr_mid?: number | null
  confidence?: string | null
  zone?: string | null
  source?: string | null
}

type MapErrorCode =
  | 'missing_provider_token'
  | 'missing_server_map_token'
  | 'geocode_failed'
  | 'invalid_coordinates'
  | 'empty_competitors'
  | 'api_failed'
  | 'malformed_data'

type MapErrorState = {
  code: MapErrorCode
  message: string
  detail?: string
}

type GoogleLatLng = { lat: () => number; lng: () => number }
type GoogleMapInstance = {
  getCenter: () => GoogleLatLng | null
  panTo: (coords: { lat: number; lng: number }) => void
  setZoom: (zoom: number) => void
  addListener: (eventName: string, handler: () => void) => void
}
type GoogleMapObject = { setMap: (map: GoogleMapInstance | null) => void }
type GoogleMarkerObject = GoogleMapObject & {
  addListener: (eventName: string, handler: () => void) => void
}
type GoogleInfoWindowObject = {
  open: (map: GoogleMapInstance, marker: GoogleMarkerObject) => void
}
type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance
    Circle: new (options: Record<string, unknown>) => GoogleMapObject
    Marker: new (options: Record<string, unknown>) => GoogleMarkerObject
    InfoWindow: new (options: Record<string, unknown>) => GoogleInfoWindowObject
    SymbolPath: { CIRCLE: string | number }
  }
}

const ZONE_COLORS = {
  undersupplied: { fill: 'rgba(34,197,94,0.15)',  stroke: 'rgba(34,197,94,0.5)',  label: 'Undersupplied', color: '#22c55e' },
  balanced:      { fill: 'rgba(245,158,11,0.15)', stroke: 'rgba(245,158,11,0.5)', label: 'Balanced',      color: '#f59e0b' },
  oversupplied:  { fill: 'rgba(239,68,68,0.15)',  stroke: 'rgba(239,68,68,0.5)',  label: 'Oversupplied',  color: '#ef4444' },
}

// DA status colours
const DA_COLORS = {
  approved: { fill: '#ef4444', stroke: '#ffffff', label: 'DA Approved' },
  lodged:   { fill: '#f59e0b', stroke: '#ffffff', label: 'DA Lodged'   },
  refused:  { fill: '#64748b', stroke: '#ffffff', label: 'DA Refused'  },
  unknown:  { fill: '#94a3b8', stroke: '#ffffff', label: 'DA Unknown'  },
}

function nqsColor(rating: string): string {
  if (rating === 'Exceeding NQS')       return '#16a34a'
  if (rating === 'Meeting NQS')         return '#00b4a0'
  if (rating === 'Working Towards NQS') return '#ef4444'
  return '#64748b'
}

function formatAuditNumber(value: number | null | undefined, suffix = ''): string {
  if (value == null) return 'Not available'
  return `${value.toLocaleString('en-AU', { maximumFractionDigits: 2 })}${suffix}`
}

function statusLabel(value: string | null | undefined): string {
  return value ? value.replace(/_/g, ' ') : 'Not available'
}

function supplySourceLabel(source: string | null | undefined): string {
  if (source === 'geospatial_supabase') return 'Geospatial radius'
  if (source === 'postcode_fallback') return 'Postcode fallback'
  if (source === 'unavailable') return 'Unavailable'
  return statusLabel(source)
}

function investorWarning(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('geospatial competitor supply differs materially')) {
    return 'Supply differs materially from postcode comparison — verify catchment methodology.'
  }
  if (lower.includes('retained postcode fallback')) {
    return 'Scoring source: Postcode fallback because geospatial confidence is not high enough.'
  }
  if (lower.includes('competitor list is empty')) {
    return 'Competitor coverage may be incomplete; verify ACECQA/manual competitor set.'
  }
  return message
}

async function reverseGeocodePostcode(lat: number, lng: number, apiKey: string): Promise<string | null> {
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`)
    const data = await res.json()
    if (data.status !== 'OK') return null
    for (const result of data.results) {
      for (const comp of result.address_components) {
        if (comp.types.includes('postal_code')) return comp.long_name
      }
    }
  } catch { /* swallow */ }
  return null
}

async function geocodeDaAddress(address: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address + ', Australia')}&key=${apiKey}`)
    const data = await res.json()
    if (data.status === 'OK' && data.results?.[0]) {
      const loc = data.results[0].geometry.location
      return { lat: loc.lat, lng: loc.lng }
    }
  } catch { /* swallow */ }
  return null
}

declare global {
  interface Window { google?: GoogleMapsApi; initAcquiraMap: () => void }
}

export default function CompetitiveMap({
  address, suburb, state, postcode, licensed_places, centre_name, overall_score, pipelineIntel, marketAudit, legacyMarket,
}: CompetitiveMapProps) {
  const mapRef          = useRef<HTMLDivElement>(null)
  const mapInstanceRef  = useRef<GoogleMapInstance | null>(null)
  const markersRef      = useRef<GoogleMarkerObject[]>([])
  const circleRef       = useRef<GoogleMapObject | null>(null)
  const dragDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const originRef       = useRef<{ lat: number; lng: number } | null>(null)

  const [mapData, setMapData]               = useState<MapData | null>(null)
  const [loading, setLoading]               = useState(true)
  const [refreshing, setRefreshing]         = useState(false)
  const [error, setError]                   = useState<MapErrorState | null>(null)
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null)
  const [showList, setShowList]             = useState(false)
  const [showSearchHere, setShowSearchHere] = useState(false)
  const [isExploring, setIsExploring]       = useState(false)

  // Manual DA entry state
  const [showAddDA, setShowAddDA]   = useState(false)
  const [newDAAddr, setNewDAAddr]   = useState('')
  const [newDAPlaces, setNewDAPlaces] = useState('')
  const [newDAStatus, setNewDAStatus] = useState<'approved' | 'lodged'>('approved')
  const [manualDAs, setManualDAs]   = useState<DaApplication[]>([])

  // All DA applications = prop ones + manually added
  const allApplications: DaApplication[] = [
    ...(pipelineIntel?.applications ?? []),
    ...manualDAs,
  ]

  const hasAuditFallback = Boolean(
    marketAudit?.competitor_supply
    || marketAudit?.competitor_count
    || marketAudit?.licensed_places
    || legacyMarket?.competitor_count != null
    || legacyMarket?.total_licensed_places != null
    || legacyMarket?.edr_mid != null
  )

  function fallbackMessageFor(errorState: MapErrorState | null): string {
    if (!errorState) return 'Map unavailable — showing postcode/market audit summary instead.'
    if (errorState.code === 'missing_provider_token' || errorState.code === 'missing_server_map_token') {
      return 'Map unavailable — map provider is not configured.'
    }
    if (errorState.code === 'geocode_failed' || errorState.code === 'invalid_coordinates') {
      return 'Map unavailable — this address could not be geocoded.'
    }
    if (errorState.code === 'empty_competitors') {
      return 'No mapped competitors found within the configured radius.'
    }
    if (hasAuditFallback) return 'Map unavailable — showing postcode/market audit summary instead.'
    return errorState.message
  }

  function renderAuditFallback(errorState: MapErrorState | null) {
    const supply = marketAudit?.competitor_supply
    const warnings = [
      ...(marketAudit?.warnings ?? []),
      ...(supply?.warnings ?? []),
      ...(supply?.material_difference ? ['geospatial competitor supply differs materially from postcode comparison'] : []),
    ]

    return (
      <div style={{ padding: 16, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0d1b2a' }}>{fallbackMessageFor(errorState)}</div>
          {errorState?.detail && <div style={{ marginTop: 4, fontSize: 11, color: '#64748b' }}>{errorState.detail}</div>}
        </div>
        {hasAuditFallback ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
              <AuditMetric label="Competitors" value={formatAuditNumber(supply?.competitor_count ?? marketAudit?.competitor_count?.value ?? legacyMarket?.competitor_count)} />
              <AuditMetric label="Licensed places" value={formatAuditNumber(supply?.total_licensed_places ?? marketAudit?.licensed_places?.value ?? legacyMarket?.total_licensed_places)} />
              <AuditMetric label="Radius" value={formatAuditNumber(supply?.radius_km ?? marketAudit?.catchment_radius_km, 'km')} />
              <AuditMetric label="Source" value={supplySourceLabel(supply?.source ?? marketAudit?.competitor_count?.source ?? legacyMarket?.source ?? 'legacy_score_context')} note={supply?.confidence ? `${supply.confidence} confidence` : legacyMarket?.confidence ? `${legacyMarket.confidence} confidence` : undefined} />
              <AuditMetric label="Geocode method" value={statusLabel(supply?.target_geocode_method)} />
              <AuditMetric label="Exclusion method" value={statusLabel(supply?.exclusion_method)} />
              <AuditMetric label="EDR / demand ratio" value={formatAuditNumber(marketAudit?.edr?.value ?? legacyMarket?.edr_mid)} note={marketAudit?.edr?.interpretation ?? legacyMarket?.zone ?? undefined} />
              <AuditMetric label="Pipeline places" value={formatAuditNumber(marketAudit?.pipeline_places?.value ?? legacyMarket?.approved_pipeline_places)} />
            </div>
            {supply?.compared_to_postcode && (
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                Postcode comparison: {formatAuditNumber(supply.compared_to_postcode.competitor_count)} competitors · {formatAuditNumber(supply.compared_to_postcode.total_licensed_places)} places · EDR {formatAuditNumber(supply.compared_to_postcode.edr)}
              </div>
            )}
            {warnings.length > 0 && (
              <div style={{ display: 'grid', gap: 7 }}>
                {warnings.slice(0, 4).map((warning, index) => (
                  <div key={`${warning}-${index}`} style={{
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
                    borderRadius: 8, padding: '8px 10px', color: '#7c4a03', fontSize: 12, lineHeight: 1.45,
                  }}>
                    {investorWarning(warning)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
            No structured competitor audit summary is available for this report.
          </div>
        )}
      </div>
    )
  }

  // ── Fetch map data ────────────────────────────────────────────────────────
  const fetchMapData = useCallback(async (
    opts: { lat?: number; lng?: number; pcode?: string; isRefresh?: boolean }
  ): Promise<MapData | null> => {
    const { lat, lng, pcode, isRefresh = false } = opts
    try {
      if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
        console.warn('CompetitiveMap unavailable: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured')
        setError({ code: 'missing_provider_token', message: 'Map unavailable — map provider is not configured.' })
        return null
      }
      if (isRefresh) setRefreshing(true)
      else setLoading(true)

      const body: Record<string, unknown> = { address, suburb, state, postcode: pcode ?? postcode, licensed_places }
      if (lat !== undefined && lng !== undefined) { body.lat_override = lat; body.lng_override = lng }

      const res = await fetch('/api/map-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const payload = await res.json().catch(() => null) as (MapData & { error?: string; code?: MapErrorCode }) | null
      if (!res.ok) {
        const code = payload?.code ?? 'api_failed'
        const message = code === 'geocode_failed'
          ? 'Map unavailable — this address could not be geocoded.'
          : code === 'missing_server_map_token'
          ? 'Map unavailable — map provider is not configured.'
          : 'Map unavailable — showing postcode/market audit summary instead.'
        console.warn('CompetitiveMap map-data response failed:', { status: res.status, code, message: payload?.error })
        setError({ code, message, detail: payload?.error })
        return null
      }
      if (!payload?.target || !Number.isFinite(payload.target.lat) || !Number.isFinite(payload.target.lng) || !Array.isArray(payload.competitors)) {
        console.warn('CompetitiveMap malformed map-data payload:', payload)
        setError({ code: 'malformed_data', message: 'Map unavailable — showing postcode/market audit summary instead.' })
        return null
      }
      const data: MapData = payload
      setMapData(data)
      if (data.competitors.length === 0) {
        setError({ code: 'empty_competitors', message: 'No mapped competitors found within the configured radius.' })
      } else {
        setError(null)
      }
      return data
    } catch (err) {
      console.warn('CompetitiveMap map-data fetch failed:', err)
      setError({ code: 'api_failed', message: 'Map unavailable — showing postcode/market audit summary instead.' })
      return null
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [address, suburb, state, postcode, licensed_places])

  useEffect(() => {
    fetchMapData({}).then(data => {
      if (data) originRef.current = { lat: data.target.lat, lng: data.target.lng }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearOverlays() {
    markersRef.current.forEach(m => { try { m.setMap(null) } catch { /* ignore */ } })
    markersRef.current = []
    if (circleRef.current) { try { circleRef.current.setMap(null) } catch { /* ignore */ } circleRef.current = null }
  }

  async function drawOverlays(map: GoogleMapInstance, data: MapData, daApps: DaApplication[] = []) {
    const google = window.google
    if (!google) return
    clearOverlays()

    const zoneStyle = ZONE_COLORS[data.demand.zone]
    const apiKey    = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!

    // Demand zone circle
    circleRef.current = new google.maps.Circle({
      strokeColor: zoneStyle.stroke, strokeOpacity: 1, strokeWeight: 2,
      fillColor: zoneStyle.fill, fillOpacity: 1,
      map,
      center: { lat: data.target.lat, lng: data.target.lng },
      radius: (data.stats.radius_km ?? 3) * 1000,
    })

    // Target centre marker
    const markerScore  = Math.round(overall_score).toString()
    const targetMarker = new google.maps.Marker({
      position: { lat: data.target.lat, lng: data.target.lng },
      map,
      title: centre_name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 22,
        fillColor: '#0d1b2a', fillOpacity: 1,
        strokeColor: '#ffffff', strokeWeight: 3,
      },
      label: { text: markerScore, color: '#ffffff', fontSize: '11px', fontWeight: '700', fontFamily: 'DM Sans' },
      zIndex: 100,
    })
    markersRef.current.push(targetMarker)

    const targetInfo = new google.maps.InfoWindow({
      content: `<div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px">
        <div style="font-weight:700;font-size:13px;color:#0d1b2a;margin-bottom:4px">${centre_name}</div>
        <div style="font-size:11px;color:#5a7a94">${address}, ${suburb}</div>
        <div style="margin-top:8px;display:flex;gap:8px">
          <span style="background:#0d1b2a;color:#fff;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:700">${markerScore}/100</span>
          <span style="background:rgba(0,180,160,0.1);color:#00b4a0;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600">${licensed_places} places</span>
        </div>
      </div>`,
    })
    targetMarker.addListener('click', () => targetInfo.open(map, targetMarker))

    // Existing competitor markers (ACECQA)
    data.competitors.slice(0, 20).forEach((comp, i) => {
      const color  = nqsColor(comp.nqs_rating)
      const marker = new google.maps.Marker({
        position: { lat: comp.lat, lng: comp.lng },
        map,
        title: comp.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: color, fillOpacity: 0.9,
          strokeColor: '#ffffff', strokeWeight: 2,
        },
        label: { text: 'C', color: '#ffffff', fontSize: '10px', fontWeight: '700' },
        zIndex: 50 - i,
      })
      markersRef.current.push(marker)

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px">
          <div style="font-weight:700;font-size:13px;color:#0d1b2a;margin-bottom:2px">${comp.name}</div>
          <div style="font-size:11px;color:#5a7a94;margin-bottom:8px">${comp.suburb} · ${(comp.distance_m / 1000).toFixed(1)}km away</div>
          <div style="display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#5a7a94">Licensed places</span>
              <span style="font-weight:600;color:#0d1b2a">${comp.licensed_places || '—'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#5a7a94">NQS Rating</span>
              <span style="font-weight:600;color:${color}">${comp.nqs_rating || '—'}</span>
            </div>
          </div>
          <div style="margin-top:6px;font-size:10px;color:#94a3b8">Existing centre · ACECQA registered</div>
        </div>`,
      })
      marker.addListener('click', () => { infoWindow.open(map, marker); setSelectedCompetitor(comp) })
    })

    // DA pipeline markers — geocode each address
    for (let i = 0; i < daApps.length; i++) {
      const app    = daApps[i]
      const colors = DA_COLORS[app.status] ?? DA_COLORS.unknown
      const label  = app.status === 'approved' ? 'A' : app.status === 'lodged' ? 'L' : 'R'

      // Try to geocode the DA address
      const coords = await geocodeDaAddress(app.address, apiKey)
      if (!coords) continue

      const daMarker = new google.maps.Marker({
        position: coords,
        map,
        title: app.address,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor: colors.fill, fillOpacity: 0.95,
          strokeColor: colors.stroke, strokeWeight: 2.5,
        },
        label: { text: label, color: '#ffffff', fontSize: '10px', fontWeight: '700' },
        zIndex: 80 - i,
      })
      markersRef.current.push(daMarker)

      const statusBg = app.status === 'approved' ? 'rgba(239,68,68,0.12)' : app.status === 'lodged' ? 'rgba(245,158,11,0.12)' : 'rgba(100,116,139,0.12)'
      const statusColor = colors.fill

      const daInfo = new google.maps.InfoWindow({
        content: `<div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:200px">
          <div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:8px">
            <span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;font-family:'DM Mono',monospace">${app.status.toUpperCase()}</span>
            <span style="font-size:11px;color:#5a7a94">DA Application</span>
          </div>
          <div style="font-weight:700;font-size:13px;color:#0d1b2a;margin-bottom:4px">${app.address}</div>
          <div style="font-size:11px;color:#5a7a94;margin-bottom:8px;line-height:1.5">${app.description.length > 80 ? app.description.slice(0, 80) + '…' : app.description}</div>
          <div style="display:flex;gap:12px;font-size:11px">
            ${app.places ? `<span style="color:#0d1b2a;font-weight:600">${app.places} places</span>` : ''}
            ${app.date ? `<span style="color:#5a7a94">${app.date}</span>` : ''}
            ${app.distance_km ? `<span style="color:#5a7a94">${app.distance_km}km</span>` : ''}
          </div>
          ${app.info_url ? `<a href="${app.info_url}" target="_blank" style="display:inline-block;margin-top:8px;font-size:11px;color:#00b4a0;font-weight:600">View application →</a>` : ''}
        </div>`,
      })
      daMarker.addListener('click', () => daInfo.open(map, daMarker))
    }
  }

  async function refreshForCentre(map: GoogleMapInstance, isManual = false) {
    const centre = map.getCenter()
    if (!centre) return
    const newLat = centre.lat(), newLng = centre.lng()
    if (!isManual && originRef.current) {
      const dx = newLat - originRef.current.lat, dy = newLng - originRef.current.lng
      if (Math.sqrt(dx * dx + dy * dy) < 0.0005) return
    }
    setShowSearchHere(false)
    setIsExploring(true)
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!
    const pcode  = await reverseGeocodePostcode(newLat, newLng, apiKey)
    const newData = await fetchMapData({ lat: newLat, lng: newLng, pcode: pcode ?? postcode, isRefresh: true })
    if (newData) await drawOverlays(map, newData, allApplications)
  }

  // Re-draw DA markers when manual DAs change
  useEffect(() => {
    if (mapInstanceRef.current && mapData) {
      drawOverlays(mapInstanceRef.current, mapData, allApplications)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualDAs])

  useEffect(() => {
    if (!mapData || !mapRef.current) return
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    async function initMap() {
      const google = window.google
      if (!mapRef.current || !google || !mapData) return
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: mapData.target.lat, lng: mapData.target.lng },
        zoom: 14, mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi.business',  stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { elementType: 'geometry',      stylers: [{ color: '#f5f5f5' }] },
          { elementType: 'labels.icon',   stylers: [{ visibility: 'off' }] },
          { featureType: 'road',          elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.highway',  elementType: 'geometry', stylers: [{ color: '#dadada' }] },
          { featureType: 'water',         elementType: 'geometry', stylers: [{ color: '#c9d9e8' }] },
        ],
        disableDefaultUI: false, zoomControl: true, mapTypeControl: false,
        streetViewControl: false, fullscreenControl: true, gestureHandling: 'cooperative',
      })
      mapInstanceRef.current = map
      await drawOverlays(map, mapData, allApplications)
      map.addListener('dragstart', () => setShowSearchHere(true))
      map.addListener('idle', () => {
        if (dragDebounceRef.current) clearTimeout(dragDebounceRef.current)
        dragDebounceRef.current = setTimeout(() => refreshForCentre(map, false), 500)
      })
    }

    if (window.google) {
      initMap()
    } else {
      window.initAcquiraMap = initMap
      const script = document.createElement('script')
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initAcquiraMap`
      script.async = true; script.defer = true
      document.head.appendChild(script)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapData === null ? null : 'loaded'])

  async function handleSearchHere() {
    if (dragDebounceRef.current) clearTimeout(dragDebounceRef.current)
    if (mapInstanceRef.current) await refreshForCentre(mapInstanceRef.current, true)
  }

  async function handleResetLocation() {
    if (dragDebounceRef.current) clearTimeout(dragDebounceRef.current)
    setShowSearchHere(false); setIsExploring(false)
    const newData = await fetchMapData({ isRefresh: true })
    if (newData && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: newData.target.lat, lng: newData.target.lng })
      mapInstanceRef.current.setZoom(14)
      await drawOverlays(mapInstanceRef.current, newData, allApplications)
    }
  }

  function handleAddDA() {
    if (!newDAAddr.trim()) return
    const da: DaApplication = {
      address: newDAAddr.trim(),
      description: `Manually added · ${newDAStatus}`,
      status: newDAStatus,
      places: newDAPlaces ? parseInt(newDAPlaces) : null,
      date: new Date().toISOString().slice(0, 10),
    }
    setManualDAs(prev => [...prev, da])
    setNewDAAddr(''); setNewDAPlaces(''); setShowAddDA(false)
  }

  const zone      = mapData?.demand.zone
  const zoneStyle = zone ? ZONE_COLORS[zone] : null

  // Pipeline summary
  const approvedCount  = allApplications.filter(a => a.status === 'approved').length
  const lodgedCount    = allApplications.filter(a => a.status === 'lodged').length
  const approvedPlaces = allApplications.filter(a => a.status === 'approved').reduce((s, a) => s + (a.places || 0), 0)
  const hasPipeline    = allApplications.length > 0

  return (
    <>
      <style>{`
        .cmap-demand-grid { display: grid; grid-template-columns: repeat(4, 1fr); }
        .cmap-comp-table  { display: table; }
        .cmap-comp-col-suburb, .cmap-comp-col-places { display: table-cell; }
        @media (max-width: 640px) {
          .cmap-header { flex-direction: column; align-items: flex-start !important; gap: 8px !important; }
          .cmap-map    { height: 260px !important; }
          .cmap-demand-grid { grid-template-columns: repeat(2,1fr) !important; }
          .cmap-demand-cell { border-bottom: 1px solid #e2e8f0; }
          .cmap-comp-col-suburb, .cmap-comp-col-places { display: none !important; }
          .cmap-legend { flex-wrap: wrap; }
        }
        .search-here-btn {
          position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
          z-index: 10; background: #0d1b2a; color: #fff; border: none;
          border-radius: 100px; padding: 8px 18px; font-size: 12px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; cursor: pointer;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25);
          display: flex; align-items: center; gap: 6px;
          transition: background 0.15s; white-space: nowrap;
        }
        .search-here-btn:hover { background: #00b4a0; }
        .refresh-overlay {
          position: absolute; inset: 0; background: rgba(255,255,255,0.5);
          display: flex; align-items: center; justify-content: center; z-index: 5; pointer-events: none;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { width: 28px; height: 28px; border: 3px solid rgba(0,180,160,0.2); border-top-color: #00b4a0; border-radius: 50%; animation: spin 0.7s linear infinite; }
      `}</style>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>

        {/* Header */}
        <div className="cmap-header" style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0d1b2a' }}>Competitive Map</div>
            <div style={{ fontSize: 11, color: '#5a7a94', marginTop: 2 }}>
              {mapData?.stats.radius_km ?? 3}km catchment ({mapData?.stats.radius_label ?? 'suburban'}) · Long day care centres + DA pipeline
              {isExploring && <span style={{ color: '#f59e0b', marginLeft: 6, fontWeight: 600 }}>· Exploring new location</span>}
            </div>
            {mapData && (
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }} title="Radius is set based on postcode population density">
                Radius set to {mapData.stats.radius_km ?? 3}km based on postcode density
                {' '}({mapData.stats.radius_label === 'dense urban' ? 'dense urban' : mapData.stats.radius_label === 'outer' ? 'outer/regional' : 'suburban'})
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {isExploring && (
              <button onClick={handleResetLocation} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                ↩ Back to centre
              </button>
            )}
            {mapData && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: zoneStyle?.color }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: zoneStyle?.color, display: 'inline-block' }} />
                  {zoneStyle?.label}
                </div>
                <div style={{ width: 1, height: 16, background: '#e2e8f0' }} />
                <div style={{ fontSize: 12, color: '#5a7a94' }}>
                  <strong style={{ color: '#0d1b2a' }}>{mapData.stats.total_competitors}</strong> existing
                </div>
              </>
            )}
            {hasPipeline && (
              <>
                <div style={{ width: 1, height: 16, background: '#e2e8f0' }} />
                <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                  {approvedCount} approved DA{approvedCount !== 1 ? 's' : ''}
                </div>
                {lodgedCount > 0 && (
                  <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
                    {lodgedCount} lodged
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pipeline risk banner */}
        {hasPipeline && approvedPlaces > 0 && (
          <div style={{
            background: approvedPlaces > licensed_places * 0.5 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
            borderBottom: `1px solid ${approvedPlaces > licensed_places * 0.5 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
            padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          }}>
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
              fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em',
              background: approvedPlaces > licensed_places * 0.5 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
              color: approvedPlaces > licensed_places * 0.5 ? '#ef4444' : '#f59e0b',
            }}>
              {approvedPlaces > licensed_places * 0.5 ? '⚠ HIGH PIPELINE RISK' : '⚡ MEDIUM PIPELINE RISK'}
            </span>
            <span style={{ fontSize: 12, color: '#5a7a94' }}>
              {approvedPlaces} approved DA places within catchment
              {licensed_places > 0 ? ` — ${Math.round(approvedPlaces / licensed_places * 100)}% of this centre's capacity` : ''}
            </span>
            <a href="https://www.planningalerts.org.au" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#00b4a0', textDecoration: 'none', marginLeft: 'auto' }}>
              Check PlanningAlerts →
            </a>
          </div>
        )}

        {/* Map canvas */}
        <div style={{ position: 'relative' }}>
          {loading && (
            <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
              <div style={{ textAlign: 'center', color: '#5a7a94' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
                <div style={{ fontSize: 13 }}>Loading competitive map…</div>
              </div>
            </div>
          )}
          {error && !loading && (
            <div style={{ minHeight: 220, background: '#f8fafc' }}>
              {renderAuditFallback(error)}
            </div>
          )}
          {!loading && !error && showSearchHere && (
            <button className="search-here-btn" onClick={handleSearchHere}>🔍 Search this area</button>
          )}
          {refreshing && (
            <div className="refresh-overlay"><div className="spinner" /></div>
          )}
          <div className="cmap-map" ref={mapRef} style={{ height: 380, display: loading || (error && !mapData) ? 'none' : 'block' }} />
        </div>

        {/* Demand stats strip */}
        {mapData && (
          <div className="cmap-demand-grid" style={{ borderTop: '1px solid #e2e8f0' }}>
            {[
              {
                label: `Kids 0–4 (${mapData.demand.demand_detail?.yearEstimate ?? new Date().getFullYear()} est.)`,
                value: mapData.demand.estimated_kids_0to4.toLocaleString(),
                subtitle: mapData.demand.demand_detail
                  ? `ABS 2021: ${mapData.demand.demand_detail.abs2021Raw.toLocaleString()} · +${mapData.demand.demand_detail.growthPct}% growth · ${mapData.demand.demand_detail.areaRatioPct}% of postcode`
                  : mapData.demand.data_source ?? 'Postcode estimate',
              },
              { label: `Licensed places (${mapData.stats.radius_km ?? 3}km)`, value: mapData.demand.total_licensed_places.toLocaleString(), subtitle: `${mapData.stats.total_competitors} existing centre${mapData.stats.total_competitors !== 1 ? 's' : ''}` },
              {
                label: 'Adj. kids per place',
                value: mapData.demand.adj_kids_per_place
                  ? mapData.demand.adj_kids_per_place.mid.toFixed(2)
                  : mapData.demand.kids_per_place.toFixed(1),
                subtitle: mapData.demand.adj_kids_per_place
                  ? `LDC-adjusted · ${ZONE_COLORS[mapData.demand.zone].label}`
                  : `raw · ${ZONE_COLORS[mapData.demand.zone].label}`,
                color: zoneStyle?.color,
              },
              { label: 'Pipeline places', value: approvedPlaces > 0 ? `+${approvedPlaces}` : '—', subtitle: approvedPlaces > 0 ? `${approvedCount} approved DA${approvedCount !== 1 ? 's' : ''}` : 'No DAs entered', color: approvedPlaces > 0 ? '#ef4444' : undefined },
            ].map((stat, i) => (
              <div key={stat.label} className="cmap-demand-cell" style={{ padding: '10px 14px', borderRight: i < 3 ? '1px solid #e2e8f0' : undefined }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a7a94', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 18, fontWeight: 500, color: stat.color || '#0d1b2a' }}>{stat.value}</div>
                {stat.subtitle && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, lineHeight: 1.4 }}>{stat.subtitle}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Competitor list */}
        {mapData && mapData.competitors.length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0' }}>
            <button onClick={() => setShowList(p => !p)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: showList ? '1px solid #e2e8f0' : 'none' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a7a94' }}>
                Nearby Centres within {mapData.stats.radius_km ?? 3}km ({mapData.competitors.length})
              </span>
              <span style={{ fontSize: 12, color: '#5a7a94' }}>{showList ? '▲' : '▼'}</span>
            </button>
            {showList && (
              <div style={{ maxHeight: 240, overflowY: 'auto', overflowX: 'auto' }}>
                <table className="cmap-comp-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={thStyle}>Centre</th>
                      <th className="cmap-comp-col-suburb" style={thStyle}>Suburb</th>
                      <th className="cmap-comp-col-places" style={thStyle}>Places</th>
                      <th style={thStyle}>NQS</th>
                      <th style={thStyle}>Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapData.competitors.map(c => (
                      <tr key={c.id} style={{ cursor: 'pointer', background: selectedCompetitor?.id === c.id ? 'rgba(0,180,160,0.04)' : 'transparent' }} onClick={() => setSelectedCompetitor(c)}>
                        <td style={tdStyle}>{c.name}</td>
                        <td className="cmap-comp-col-suburb" style={{ ...tdStyle, color: '#5a7a94' }}>{c.suburb}</td>
                        <td className="cmap-comp-col-places" style={{ ...tdStyle, fontFamily: 'IBM Plex Mono, monospace' }}>{c.licensed_places || '—'}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: nqsColor(c.nqs_rating), background: `${nqsColor(c.nqs_rating)}18`, padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                            {c.nqs_rating === 'Exceeding NQS' ? 'Exceeding' : c.nqs_rating === 'Working Towards NQS' ? 'Working Towards' : 'Meeting'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono, monospace', color: '#5a7a94', whiteSpace: 'nowrap' }}>{(c.distance_m / 1000).toFixed(1)}km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* DA Pipeline list */}
        {allApplications.length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0' }}>
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a7a94' }}>
                DA Pipeline ({allApplications.length})
              </span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>Plotted on map above</span>
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto', borderTop: '1px solid #f1f5f9' }}>
              {allApplications.map((app, i) => {
                const colors = DA_COLORS[app.status] ?? DA_COLORS.unknown
                return (
                  <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2a', marginBottom: 2 }}>{app.address}</div>
                      <div style={{ fontSize: 11, color: '#5a7a94' }}>
                        {app.places ? `${app.places} places · ` : ''}{app.date || ''}
                        {app.distance_km ? ` · ${app.distance_km}km` : ''}
                      </div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono', monospace", background: `${colors.fill}20`, color: colors.fill, whiteSpace: 'nowrap' }}>
                      {app.status.toUpperCase()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Add DA manually */}
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '10px 16px' }}>
          {!showAddDA ? (
            <button onClick={() => setShowAddDA(true)} style={{ fontSize: 12, color: '#00b4a0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, padding: 0 }}>
              + Add DA manually
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0d1b2a' }}>Add DA Application</div>
              <input value={newDAAddr} onChange={e => setNewDAAddr(e.target.value)} placeholder="Address (e.g. 12 Sample St, Forest Hill VIC 3131)" style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: "'DM Sans', sans-serif", color: '#0d1b2a' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newDAPlaces} onChange={e => setNewDAPlaces(e.target.value)} placeholder="Places (e.g. 80)" type="number" style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: "'DM Sans', sans-serif", color: '#0d1b2a', width: 120 }} />
                <select value={newDAStatus} onChange={e => setNewDAStatus(e.target.value as 'approved' | 'lodged')} style={{ fontSize: 12, padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontFamily: "'DM Sans', sans-serif", color: '#0d1b2a', flex: 1 }}>
                  <option value="approved">DA Approved</option>
                  <option value="lodged">DA Lodged</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleAddDA} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 6, background: '#00b4a0', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Plot on map</button>
                <button onClick={() => setShowAddDA(false)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, background: 'none', color: '#5a7a94', border: '1px solid #e2e8f0', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="cmap-legend" style={{ display: 'flex', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          {Object.entries(ZONE_COLORS).map(([key, val]) => (
            <div key={key} style={{ flex: '1 1 80px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: val.color, borderRight: '1px solid #e2e8f0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: val.color, display: 'inline-block' }} />
              {val.label}
            </div>
          ))}
          <div style={{ flex: '2 1 160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '8px 12px', fontSize: 11, color: '#5a7a94', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d1b2a', display: 'inline-block' }} /> Target (score)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00b4a0', display: 'inline-block' }} /> Existing (C)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> DA Approved (A)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> DA Lodged (L)</span>
          </div>
        </div>

        {/* Methodology disclaimer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
          <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', lineHeight: 1.5 }}>
            <strong style={{ color: '#64748b' }}>Adjusted kids per place</strong> = ABS 2021 Census 0–4 population (catchment-adjusted, growth-indexed) × LDC utilisation rate (40–55% metro / 35–45% regional, DoE 2024) ÷ ACECQA licensed places within radius.
            Zones: &gt;1.0 Undersupplied · 0.5–1.0 Balanced · &lt;0.5 Oversupplied (LDC-adjusted). Raw ratio shown for reference.
            Indicative only — not a substitute for site-specific due diligence.
          </p>
        </div>

      </div>
    </>
  )
}

function AuditMetric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 8, padding: '10px 12px', minHeight: 74,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ color: '#0d1b2a', fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{value}</div>
      {note && <div style={{ marginTop: 4, color: '#64748b', fontSize: 11, lineHeight: 1.35 }}>{note}</div>}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a7a94',
  borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
}
const tdStyle: React.CSSProperties = {
  padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#0d1b2a',
  borderBottom: '1px solid #f1f5f9', maxWidth: 180,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
