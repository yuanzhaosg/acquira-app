'use client'

import { useEffect, useRef, useState } from 'react'

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

interface MapData {
  target: { lat: number; lng: number; address: string; licensed_places: number }
  competitors: Competitor[]
  demand: {
    estimated_kids_0to4: number
    total_licensed_places: number
    kids_per_place: number
    zone: 'undersupplied' | 'balanced' | 'saturated'
  }
  stats: {
    total_competitors: number
    exceeding_nqs: number
    working_towards_nqs: number
    radius_m: number
  }
}

interface CompetitiveMapProps {
  address: string
  suburb: string
  state: string
  postcode: string
  licensed_places: number
  centre_name: string
  overall_score: number   // v2: 0–100
}

const ZONE_COLORS = {
  undersupplied: { fill: 'rgba(34,197,94,0.15)',  stroke: 'rgba(34,197,94,0.5)',  label: 'Undersupplied', color: '#22c55e' },
  balanced:      { fill: 'rgba(245,158,11,0.15)', stroke: 'rgba(245,158,11,0.5)', label: 'Balanced',      color: '#f59e0b' },
  saturated:     { fill: 'rgba(239,68,68,0.15)',  stroke: 'rgba(239,68,68,0.5)',  label: 'Saturated',     color: '#ef4444' },
}

function nqsColor(rating: string): string {
  if (rating === 'Exceeding NQS')       return '#16a34a'
  if (rating === 'Meeting NQS')         return '#00b4a0'
  if (rating === 'Working Towards NQS') return '#ef4444'
  return '#64748b'
}

// v2: score is 0–100
function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 55) return '#00b4a0'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

declare global {
  interface Window {
    google: any
    initAcquiraMap: () => void
  }
}

export default function CompetitiveMap({
  address, suburb, state, postcode, licensed_places, centre_name, overall_score
}: CompetitiveMapProps) {
  const mapRef          = useRef<HTMLDivElement>(null)
  const mapInstanceRef  = useRef<any>(null)
  const [mapData, setMapData]                   = useState<MapData | null>(null)
  const [loading, setLoading]                   = useState(true)
  const [error, setError]                       = useState<string | null>(null)
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null)
  const [showList, setShowList]                 = useState(false)  // mobile: toggle competitor list

  // ── Fetch map data ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchMapData() {
      try {
        const res = await fetch('/api/map-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, suburb, state, postcode, licensed_places }),
        })
        if (!res.ok) throw new Error('Failed to fetch map data')
        setMapData(await res.json())
      } catch {
        setError('Could not load competitive map data')
      } finally {
        setLoading(false)
      }
    }
    fetchMapData()
  }, [address, suburb, state, postcode, licensed_places])

  // ── Init Google Maps ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapData || !mapRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    function initMap() {
      if (!mapRef.current || !window.google || !mapData) return

      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: mapData.target.lat, lng: mapData.target.lng },
        zoom: 14,
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
          { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
          { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d9e8' }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        // Better touch on mobile
        gestureHandling: 'cooperative',
      })

      mapInstanceRef.current = map

      // Demand zone circle
      const zoneStyle = ZONE_COLORS[mapData.demand.zone]
      new window.google.maps.Circle({
        strokeColor: zoneStyle.stroke,
        strokeOpacity: 1, strokeWeight: 2,
        fillColor: zoneStyle.fill, fillOpacity: 1,
        map,
        center: { lat: mapData.target.lat, lng: mapData.target.lng },
        radius: 3000,
      })

      // Target centre marker — show compact score on marker (e.g. "75" not "75.0")
      const markerScore = Math.round(overall_score).toString()
      const targetMarker = new window.google.maps.Marker({
        position: { lat: mapData.target.lat, lng: mapData.target.lng },
        map,
        title: centre_name,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 22,
          fillColor: '#0d1b2a',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        label: {
          text: markerScore,
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: '700',
          fontFamily: 'DM Sans',
        },
        zIndex: 100,
      })

      const targetInfo = new window.google.maps.InfoWindow({
        content: `
          <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#0d1b2a;margin-bottom:4px">${centre_name}</div>
            <div style="font-size:11px;color:#5a7a94">${address}, ${suburb}</div>
            <div style="margin-top:8px;display:flex;gap:8px">
              <span style="background:#0d1b2a;color:#fff;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:700">${markerScore}/100</span>
              <span style="background:rgba(0,180,160,0.1);color:#00b4a0;padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600">${licensed_places} places</span>
            </div>
          </div>
        `,
      })
      targetMarker.addListener('click', () => targetInfo.open(map, targetMarker))

      // Competitor markers
      mapData.competitors.slice(0, 20).forEach((comp, i) => {
        const color = nqsColor(comp.nqs_rating)
        const marker = new window.google.maps.Marker({
          position: { lat: comp.lat, lng: comp.lng },
          map,
          title: comp.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 16,
            fillColor: color, fillOpacity: 0.9,
            strokeColor: '#ffffff', strokeWeight: 2,
          },
          label: { text: 'C', color: '#ffffff', fontSize: '10px', fontWeight: '700' },
          zIndex: 50 - i,
        })

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="font-family:'DM Sans',sans-serif;padding:8px;min-width:180px">
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
            </div>
          `,
        })
        marker.addListener('click', () => { infoWindow.open(map, marker); setSelectedCompetitor(comp) })
      })
    }

    if (window.google) {
      initMap()
    } else {
      window.initAcquiraMap = initMap
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initAcquiraMap`
      script.async = true; script.defer = true
      document.head.appendChild(script)
    }
  }, [mapData])

  const zone      = mapData?.demand.zone
  const zoneStyle = zone ? ZONE_COLORS[zone] : null

  return (
    <>
      <style>{`
        .cmap-demand-grid { display: grid; grid-template-columns: repeat(4,1fr); }
        .cmap-comp-table  { display: table; }
        .cmap-comp-col-suburb,
        .cmap-comp-col-places { display: table-cell; }

        @media (max-width: 640px) {
          .cmap-header        { flex-direction: column; align-items: flex-start !important; gap: 8px !important; }
          .cmap-map           { height: 260px !important; }
          .cmap-demand-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .cmap-demand-cell   { border-bottom: 1px solid #e2e8f0; }
          .cmap-comp-col-suburb,
          .cmap-comp-col-places { display: none !important; }
          .cmap-legend        { flex-wrap: wrap; }
        }
      `}</style>

      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div className="cmap-header" style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0d1b2a' }}>Competitive Map</div>
            <div style={{ fontSize: 11, color: '#5a7a94', marginTop: 2 }}>3km catchment · Long day care centres only</div>
          </div>
          {mapData && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: zoneStyle?.color }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: zoneStyle?.color, display: 'inline-block' }} />
                {zoneStyle?.label}
              </div>
              <div style={{ width: 1, height: 16, background: '#e2e8f0' }} />
              <div style={{ fontSize: 12, color: '#5a7a94' }}>
                <strong style={{ color: '#0d1b2a' }}>{mapData.stats.total_competitors}</strong> competitors
              </div>
            </div>
          )}
        </div>

        {/* ── Map canvas ── */}
        <div style={{ position: 'relative' }}>
          {loading && (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
              <div style={{ textAlign: 'center', color: '#5a7a94' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🗺️</div>
                <div style={{ fontSize: 13 }}>Loading competitive map…</div>
              </div>
            </div>
          )}
          {error && (
            <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
              <div style={{ textAlign: 'center', color: '#ef4444' }}>
                <div style={{ fontSize: 13 }}>{error}</div>
              </div>
            </div>
          )}
          <div
            className="cmap-map"
            ref={mapRef}
            style={{ height: 380, display: loading || error ? 'none' : 'block' }}
          />
        </div>

        {/* ── Demand stats strip ── */}
        {mapData && (
          <div className="cmap-demand-grid" style={{ borderTop: '1px solid #e2e8f0' }}>
            {[
              { label: 'Kids 0–4 (est.)',       value: mapData.demand.estimated_kids_0to4.toLocaleString() },
              { label: 'Total licensed places',  value: mapData.demand.total_licensed_places.toLocaleString() },
              { label: 'Kids per place',         value: mapData.demand.kids_per_place.toFixed(1), color: zoneStyle?.color },
              { label: 'Exceeding NQS nearby',   value: mapData.stats.exceeding_nqs.toString() },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="cmap-demand-cell"
                style={{
                  padding: '10px 14px',
                  borderRight: i < 3 ? '1px solid #e2e8f0' : undefined,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a7a94', marginBottom: 4 }}>
                  {stat.label}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 18, fontWeight: 500, color: stat.color || '#0d1b2a' }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Competitor list ── */}
        {mapData && mapData.competitors.length > 0 && (
          <div style={{ borderTop: '1px solid #e2e8f0' }}>
            {/* Toggle header — tappable on mobile */}
            <button
              onClick={() => setShowList(p => !p)}
              style={{
                width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: showList ? '1px solid #e2e8f0' : 'none',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#5a7a94' }}>
                Nearby Centres ({mapData.competitors.length})
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
                      <tr
                        key={c.id}
                        style={{ cursor: 'pointer', background: selectedCompetitor?.id === c.id ? 'rgba(0,180,160,0.04)' : 'transparent' }}
                        onClick={() => setSelectedCompetitor(c)}
                      >
                        <td style={tdStyle}>{c.name}</td>
                        <td className="cmap-comp-col-suburb" style={{ ...tdStyle, color: '#5a7a94' }}>{c.suburb}</td>
                        <td className="cmap-comp-col-places" style={{ ...tdStyle, fontFamily: 'IBM Plex Mono, monospace' }}>{c.licensed_places || '—'}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: nqsColor(c.nqs_rating), background: `${nqsColor(c.nqs_rating)}18`, padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>
                            {c.nqs_rating === 'Exceeding NQS' ? 'Exceeding' : c.nqs_rating === 'Working Towards NQS' ? 'Working Towards' : 'Meeting'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'IBM Plex Mono, monospace', color: '#5a7a94', whiteSpace: 'nowrap' }}>
                          {(c.distance_m / 1000).toFixed(1)}km
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Legend ── */}
        <div className="cmap-legend" style={{ display: 'flex', borderTop: '1px solid #e2e8f0' }}>
          {Object.entries(ZONE_COLORS).map(([key, val]) => (
            <div key={key} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', fontSize: 11, fontWeight: 600, color: val.color, borderRight: '1px solid #e2e8f0' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: val.color, display: 'inline-block' }} />
              {val.label}
            </div>
          ))}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 12px', fontSize: 11, color: '#5a7a94', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d1b2a', display: 'inline-block' }} /> Target
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00b4a0', display: 'inline-block' }} /> Competitor
            </span>
          </div>
        </div>

      </div>
    </>
  )
}

// ── Table styles ──────────────────────────────────────────────────────────────
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
