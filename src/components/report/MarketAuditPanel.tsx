import type { MarketAudit, PipelineAudit, PipelineProject } from '@/types/workflow'
import type { CSSProperties } from 'react'

function formatNumber(value: number | null | undefined, suffix = ''): string {
  if (value == null) return 'Not available'
  return `${value.toLocaleString('en-AU', { maximumFractionDigits: 2 })}${suffix}`
}

function confidenceColor(confidence: string | null | undefined): string {
  if (confidence === 'high') return '#22c55e'
  if (confidence === 'medium') return '#f59e0b'
  return '#f97316'
}

function investorWarning(message: string): string {
  if (/\b(42703|column .* does not exist|postgres|supabase|rpc|schema cache|PGRST|KeyError|Traceback|Exception|\{.*\})\b/i.test(message)) {
    if (/competitor|acecqa|geospatial|service_approval/i.test(message)) {
      return 'Competitor lookup failed due to market-data configuration. Postcode fallback was used; verify competitor methodology before relying on market score.'
    }
    return 'A data provider lookup failed. Review methodology before relying on this section.'
  }
  const lower = message.toLowerCase()
  if (lower.includes('geospatial competitor supply differs materially')) {
    return 'Supply differs materially from postcode comparison — verify catchment methodology.'
  }
  if (lower.includes('retained postcode fallback')) {
    return 'Scoring source: Postcode fallback because geospatial confidence is not high enough.'
  }
  if (lower.includes('pipeline places are zero')) {
    return 'Pipeline places are shown as zero because no DA intel was provided.'
  }
  if (lower.includes('vendor supplied kids 0-4')) {
    return 'Vendor child-count differs from internal estimate; verify catchment methodology.'
  }
  if (lower.includes('approximated postcode')) {
    return 'Market data appears supportable, but depends on postcode approximation.'
  }
  if (lower.includes('competitor list is empty')) {
    return 'Competitor coverage may be incomplete; verify ACECQA/manual competitor set.'
  }
  if (lower.includes('confidence is high')) {
    return 'Market confidence should be read cautiously because one or more market inputs are missing or approximated.'
  }
  return message
}

function statusLabel(status: string | null | undefined): string {
  return (status ?? 'unknown').replace(/_/g, ' ')
}

function auditStatus(audit?: MarketAudit | null): 'complete' | 'partial' | 'missing' {
  if (audit?.status === 'complete' || audit?.status === 'partial' || audit?.status === 'missing') return audit.status
  if (!audit) return 'missing'
  const hasCoreInput = audit.catchment_radius_km != null
    || audit.kids_0_4?.value != null
    || audit.competitor_count?.value != null
    || audit.competitor_supply?.competitor_count != null
    || audit.edr?.value != null
  return hasCoreInput ? 'partial' : 'missing'
}

// ── Canonical supply resolution ────────────────────────────────────────────
// One geography per figure. Prefer the geospatial radius (the real catchment)
// when present; the postcode count becomes a reconciliation footnote, never a
// co-equal headline. EDR is recomputed once on the canonical denominator using
// the authoritative formula (kids 0-4 × LDC utilisation mid ÷ licensed places).
type ResolvedSupply = {
  count: number | null
  places: number | null
  radiusKm: number | null
  geography: string
  source: string | null
  confidence: string | null
  scoringSource: string | null
  other?: { count: number | null; places: number | null; edr: number | null; label: string }
  materialDifference: boolean
}

function resolveSupply(audit?: MarketAudit | null): ResolvedSupply | null {
  if (!audit) return null
  const cs = audit.competitor_supply
  const radiusKm = cs?.radius_km ?? audit.catchment_radius_km ?? null
  const geoOk = cs?.source === 'geospatial_supabase'
    && (cs?.total_licensed_places != null || cs?.competitor_count != null)
  if (geoOk) {
    return {
      count: cs?.competitor_count ?? null,
      places: cs?.total_licensed_places ?? null,
      radiusKm,
      geography: radiusKm ? `${formatNumber(radiusKm)} km radius` : 'catchment radius',
      source: cs?.source ?? null,
      confidence: cs?.confidence ?? null,
      scoringSource: cs?.scoring_source ?? cs?.source ?? null,
      other: cs?.compared_to_postcode ? {
        count: cs.compared_to_postcode.competitor_count ?? null,
        places: cs.compared_to_postcode.total_licensed_places ?? null,
        edr: cs.compared_to_postcode.edr ?? null,
        label: 'postcode fallback',
      } : undefined,
      materialDifference: Boolean(cs?.material_difference),
    }
  }
  return {
    count: audit.competitor_count?.value ?? cs?.competitor_count ?? null,
    places: audit.licensed_places?.value ?? cs?.total_licensed_places ?? null,
    radiusKm,
    geography: 'postcode catchment',
    source: cs?.source ?? audit.competitor_count?.source ?? 'postcode_fallback',
    confidence: cs?.confidence ?? null,
    scoringSource: cs?.scoring_source ?? cs?.source ?? 'postcode_fallback',
    other: undefined,
    materialDifference: Boolean(cs?.material_difference),
  }
}

function canonicalEdr(
  audit: MarketAudit | null | undefined,
  places: number | null,
): { value: number | null; recomputed: boolean } {
  const kids = audit?.kids_0_4?.value
  const util = audit?.ldc_utilisation_rate?.value
  if (kids != null && util != null && places != null && places > 0) {
    return { value: Math.round((kids * util / places) * 100) / 100, recomputed: true }
  }
  return { value: audit?.edr?.value ?? null, recomputed: false }
}

function edrZone(edr: number | null): { label: string; color: string } {
  if (edr == null) return { label: 'unknown', color: 'rgba(255,255,255,0.5)' }
  if (edr >= 1.0) return { label: 'undersupplied', color: '#22c55e' }
  if (edr >= 0.5) return { label: 'balanced', color: '#f59e0b' }
  return { label: 'oversupplied', color: '#ef4444' }
}

function projectSource(project: PipelineProject): string {
  return project.source_url || project.source_file || project.source_type || 'Manual'
}

function supplySourceLabel(source: string | null | undefined): string {
  if (source === 'geospatial_supabase') return 'Geospatial radius'
  if (source === 'postcode_fallback') return 'Postcode fallback'
  if (source === 'unavailable') return 'Unavailable'
  return source ? statusLabel(source) : 'Not available'
}

function supplySentence(audit?: MarketAudit | null): string | null {
  const supply = audit?.competitor_supply
  if (!supply) return null
  if (supply.source === 'unavailable' && supply.compared_to_postcode) {
    return `Geospatial competitor supply was unavailable. Postcode fallback found ${formatNumber(supply.compared_to_postcode.competitor_count)} centres / ${formatNumber(supply.compared_to_postcode.total_licensed_places)} places. Market score uses postcode fallback and should be reviewed.`
  }
  if (supply.material_difference) return 'Competitor supply mismatch detected — verify methodology.'
  if (supply.source === 'geospatial_supabase') {
    return `Competitor supply: geospatial radius, ${supply.confidence ?? 'low'} confidence, ${formatNumber(supply.competitor_count)} centres / ${formatNumber(supply.total_licensed_places)} places.`
  }
  if (supply.source === 'postcode_fallback') {
    return 'Competitor supply: postcode fallback; geospatial audit unavailable.'
  }
  return 'Competitor supply: not available; verify catchment methodology.'
}

export function CompetitorSupplyCompact({ audit }: { audit?: MarketAudit | null }) {
  const sentence = supplySentence(audit)
  if (!sentence) return null
  const mismatch = Boolean(audit?.competitor_supply?.material_difference)
  return (
    <div style={{
      background: mismatch ? 'rgba(245,158,11,0.08)' : 'rgba(0,180,160,0.055)',
      border: `1px solid ${mismatch ? 'rgba(245,158,11,0.22)' : 'rgba(0,180,160,0.16)'}`,
      borderRadius: 8, padding: '9px 11px', color: 'rgba(255,255,255,0.68)',
      fontSize: 12.5, lineHeight: 1.55,
    }}>
      <strong style={{ color: mismatch ? '#f59e0b' : '#00b4a0' }}>Competitor supply: </strong>
      {sentence.replace(/^Competitor supply:\s*/i, '')}
    </div>
  )
}

export function CompetitorSupplySection({ audit }: { audit?: MarketAudit | null }) {
  const supply = audit?.competitor_supply
  if (!supply) return null
  const scoringSource = supplySourceLabel(supply.scoring_source ?? supply.source)
  const warnings = supply.warnings ?? []
  const supplyUnavailable = supply.source === 'unavailable' || (supply.confidence === 'low' && supply.competitor_count == null && Boolean(supply.compared_to_postcode))
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
        <Metric label="Scoring source" value={scoringSource} note={supply.scoring_confidence ? `${supply.scoring_confidence} confidence` : undefined} />
        <Metric label="Supply source" value={supplySourceLabel(supply.source)} note={supply.confidence ? `${supply.confidence} confidence` : undefined} />
        <Metric label="Radius" value={formatNumber(supply.radius_km, 'km')} />
        <Metric label="Competitors" value={supplyUnavailable ? 'Not available' : formatNumber(supply.competitor_count)} />
        <Metric label="Licensed places" value={supplyUnavailable ? 'Not available' : formatNumber(supply.total_licensed_places)} />
        <Metric label="Target geocode" value={supply.target_geocode_method ? statusLabel(supply.target_geocode_method) : 'Not available'} />
        {supply.exclusion_method && <Metric label="Target exclusion" value={statusLabel(supply.exclusion_method)} />}
      </div>
      {supply.compared_to_postcode && (
        <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12, lineHeight: 1.5 }}>
          Postcode comparison: {formatNumber(supply.compared_to_postcode.competitor_count)} competitors · {formatNumber(supply.compared_to_postcode.total_licensed_places)} places · EDR {formatNumber(supply.compared_to_postcode.edr)}
        </div>
      )}
      {supply.material_difference && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
          borderRadius: 8, padding: '9px 11px', color: 'rgba(255,255,255,0.68)',
          fontSize: 12.5, lineHeight: 1.55,
        }}>
          <strong style={{ color: '#f59e0b' }}>Supply mismatch: </strong>
          Supply differs materially from postcode comparison — verify catchment methodology.
        </div>
      )}
      {warnings.slice(0, 3).map((warning, index) => (
        <div key={`${warning}-${index}`} style={{
          color: 'rgba(255,255,255,0.52)', fontSize: 12.5, lineHeight: 1.5,
          borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8,
        }}>
          <span style={{ color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginRight: 8 }}>
            Supply warning
          </span>
          {investorWarning(warning)}
        </div>
      ))}
    </div>
  )
}

export function PipelineSummary({ audit, projects, compact = false }: { audit?: PipelineAudit | null; projects?: PipelineProject[]; compact?: boolean }) {
  const warnings = audit?.warnings ?? []
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 8 }}>
        <Metric label="DA source" value={audit?.source_type ? statusLabel(audit.source_type) : 'Not provided'} note={audit?.search_required ? 'DA search required' : audit?.searched ? 'Manual source provided' : undefined} />
        <Metric label="Approved places" value={formatNumber(audit?.approved_places)} />
        <Metric label="Lodged places" value={formatNumber(audit?.lodged_places)} />
        <Metric label="Risk-adjusted" value={formatNumber(audit?.risk_adjusted_places)} note={audit?.lodged_weight != null ? `Lodged weighted at ${Math.round(audit.lodged_weight * 100)}%` : undefined} />
        <Metric label="Confidence" value={audit?.confidence ?? 'low'} />
      </div>
      {warnings.slice(0, compact ? 2 : 5).map((warning, index) => (
        <div key={`${warning}-${index}`} style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 8, padding: '9px 11px', color: 'rgba(255,255,255,0.66)',
          fontSize: 12.5, lineHeight: 1.55,
        }}>
          <strong style={{ color: '#f59e0b' }}>Pipeline warning: </strong>
          {investorWarning(warning)}
        </div>
      ))}
      {!compact && projects?.length ? (
        <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
                {['Project', 'Status', 'Places', 'Source', 'Confidence'].map(label => (
                  <th key={label} style={tableHeadStyle}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((project, index) => (
                <tr key={project.id ?? `${project.status}-${project.name ?? project.address ?? index}`}>
                  <td style={tableCellStyle}>
                    <strong style={{ color: '#e8edf3' }}>{project.name || project.address || 'Pipeline project'}</strong>
                    {project.address && project.name && <div style={{ color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{project.address}</div>}
                  </td>
                  <td style={tableCellStyle}>{statusLabel(project.status)}</td>
                  <td style={tableCellStyle}>{formatNumber(project.proposed_places)}</td>
                  <td style={tableCellStyle}>
                    {project.source_url ? (
                      <a
                        href={project.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#00b4a0', textDecoration: 'none', overflowWrap: 'anywhere' }}
                      >
                        {project.source_url}
                      </a>
                    ) : projectSource(project)}
                  </td>
                  <td style={tableCellStyle}>{project.confidence ?? 'low'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

export function MarketAuditSummary({ audit, pipelineAudit, pipelineProjects }: { audit?: MarketAudit | null; pipelineAudit?: PipelineAudit | null; pipelineProjects?: PipelineProject[] }) {
  const status = auditStatus(audit)
  const warnings = audit?.warnings ?? []
  const missingFields = audit?.missing_fields ?? [
    'catchment radius',
    'kids 0-4 count',
    'competitor licensed places',
    'geocode method',
    'pipeline projects',
    'EDR formula',
  ]
  const supply = resolveSupply(audit)
  const edr = canonicalEdr(audit, supply?.places ?? null)
  const zone = edrZone(edr.value)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {status !== 'complete' && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.22)',
          borderRadius: 8, padding: '11px 12px', color: 'rgba(255,255,255,0.72)',
          fontSize: 12.8, lineHeight: 1.55,
        }}>
          <strong style={{ color: '#f59e0b' }}>Market evidence {status === 'missing' ? 'unavailable' : 'partial'}: </strong>
          {status === 'missing'
            ? 'Required market inputs were not returned in this workflow. Request demographic source, competitor set, geocode method, and DA/pipeline evidence.'
            : 'Some market inputs are missing or low confidence. Verify the catchment methodology before relying on the EDR.'}
          {missingFields.length > 0 && (
            <div style={{ marginTop: 7, color: 'rgba(255,255,255,0.5)' }}>
              Missing inputs: {missingFields.slice(0, 8).join(', ')}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
        <Metric label="Audit status" value={statusLabel(status)} />
        <Metric label="Radius" value={formatNumber(audit?.catchment_radius_km, 'km')} note={audit?.radius_reason ?? undefined} />
        <Metric
          label="Kids 0-4"
          value={formatNumber(audit?.kids_0_4?.value)}
          note={[audit?.kids_0_4?.source, audit?.kids_0_4?.confidence ? `${audit.kids_0_4.confidence} confidence` : null].filter(Boolean).join(' · ')}
        />
        <Metric
          label="LDC utilisation"
          value={audit?.ldc_utilisation_rate?.value != null ? `${Math.round(audit.ldc_utilisation_rate.value * 100)}%` : 'Not available'}
          note={audit?.ldc_utilisation_rate?.rationale ?? audit?.ldc_utilisation_rate?.source ?? undefined}
        />
        <Metric
          label={`Licensed places (${supply?.geography ?? 'catchment'})`}
          value={supply?.source === 'unavailable' ? 'Not available' : formatNumber(supply?.places)}
          note={[supplySourceLabel(supply?.source), supply?.confidence ? `${supply.confidence} confidence` : null].filter(Boolean).join(' · ') || undefined}
        />
        <Metric
          label="Competitors"
          value={supply?.source === 'unavailable' ? 'Not available' : formatNumber(supply?.count)}
          note={supply?.source === 'unavailable' ? 'Supply unavailable; see footnote F1.' : undefined}
        />
        <Metric
          label="EDR"
          value={formatNumber(edr.value)}
          note={[zone.label, edr.recomputed ? `on ${supply?.geography ?? 'catchment'}` : (audit?.edr?.interpretation ?? null)].filter(Boolean).join(' · ')}
        />
        <Metric label="Geocode method" value={audit?.competitor_supply?.target_geocode_method ? statusLabel(audit.competitor_supply.target_geocode_method) : 'Not available'} />
        <Metric
          label="Pipeline"
          value={formatNumber(audit?.pipeline_places?.value)}
          note={[audit?.pipeline_places?.source, audit?.pipeline_places?.confidence ? `${audit.pipeline_places.confidence} confidence` : null].filter(Boolean).join(' · ')}
        />
      </div>
      {!audit?.competitor_supply && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 8, padding: '9px 11px', color: 'rgba(255,255,255,0.66)',
          fontSize: 12.5, lineHeight: 1.55,
        }}>
          <strong style={{ color: '#f59e0b' }}>Competitor supply warning: </strong>
          Geospatial competitor data is unavailable. Postcode fallback is used only as a temporary comparison until the competitor set and licensed places are verified.
        </div>
      )}
      {warnings.length > 0 && (
        <div style={{ display: 'grid', gap: 7 }}>
          {warnings.slice(0, 3).map((warning, index) => (
            <div key={`${warning}-${index}`} style={{
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 8, padding: '9px 11px', color: 'rgba(255,255,255,0.66)',
              fontSize: 12.5, lineHeight: 1.55,
            }}>
              <strong style={{ color: '#f59e0b' }}>Audit warning: </strong>
              {investorWarning(warning)}
            </div>
          ))}
        </div>
      )}
      {supply && <MarketFootnotes audit={audit ?? null} supply={supply} edr={edr} />}
      <PipelineSummary audit={pipelineAudit} projects={pipelineProjects} compact />
    </div>
  )
}

function MarketFootnotes({ audit, supply, edr }: { audit: MarketAudit | null; supply: ResolvedSupply; edr: { value: number | null; recomputed: boolean } }) {
  const zone = edrZone(edr.value)
  const util = audit?.ldc_utilisation_rate?.value
  const utilPct = util != null ? `${Math.round(util * 100)}%` : 'the LDC utilisation midpoint'
  const other = supply.other
  const dCount = supply.count != null && other?.count != null ? Math.abs(supply.count - other.count) : null
  const dPlaces = supply.places != null && other?.places != null ? Math.abs(supply.places - other.places) : null
  const scoringMismatch = Boolean(supply.scoringSource && supply.source && supply.scoringSource !== supply.source)

  const noteStyle: CSSProperties = { display: 'flex', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55, marginBottom: 8 }
  const idStyle: CSSProperties = { fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, fontWeight: 600, minWidth: 26 }

  return (
    <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(255,255,255,0.36)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Footnotes · how to read market evidence
      </div>

      <div style={{ ...noteStyle, color: supply.materialDifference ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.5)' }}>
        <span style={{ ...idStyle, color: '#f59e0b' }}>F1</span>
        <span>
          <strong style={{ color: 'rgba(255,255,255,0.72)' }}>Supply reconciliation. </strong>
          Headline supply uses the {supply.geography} ({formatNumber(supply.places)} places / {formatNumber(supply.count)} centres) — the canonical catchment geometry.
          {other && (other.places != null || other.count != null) ? (
            <> The {other.label} count is {formatNumber(other.places)} places / {formatNumber(other.count)} centres{dPlaces != null || dCount != null ? <>, a difference of {formatNumber(dPlaces)} places / {formatNumber(dCount)} centres</> : null} — competitors inside the radius but in adjacent postcodes.</>
          ) : null}
          {supply.materialDifference ? ' Flagged as a material difference; verify catchment methodology.' : ''}
          {scoringMismatch ? ` Market score was retained on the ${supplySourceLabel(supply.scoringSource)} denominator because geospatial confidence was ${supply.confidence ?? 'not high'}; the EDR above is recomputed on the ${supply.geography} so the figure matches the map.` : ''}
        </span>
      </div>

      <div style={noteStyle}>
        <span style={{ ...idStyle, color: '#00b4a0' }}>F2</span>
        <span>
          <strong style={{ color: 'rgba(255,255,255,0.72)' }}>EDR definition. </strong>
          {audit?.edr?.formula ?? 'Estimated kids aged 0-4 × LDC utilisation midpoint ÷ licensed places in catchment'} ({utilPct} utilisation).
          Zones: ≥1.0 undersupplied · 0.5–1.0 balanced · &lt;0.5 oversupplied.
          {edr.value != null ? <> At {formatNumber(edr.value)} this catchment reads <span style={{ color: zone.color, fontWeight: 600 }}>{zone.label}</span>.</> : null} A capacity screen, not proof of demand.
        </span>
      </div>

      <div style={noteStyle}>
        <span style={{ ...idStyle, color: '#00b4a0' }}>F3</span>
        <span>
          <strong style={{ color: 'rgba(255,255,255,0.72)' }}>What it is / is not. </strong>
          A supply-pressure screen comparing modelled child demand to licensed supply — not a waitlist, not proof of any centre&apos;s occupancy. The subject&apos;s own enrolment is the only direct demand evidence; area aggregates are market context.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
        <div style={{ background: 'rgba(0,180,160,0.06)', border: '1px solid rgba(0,180,160,0.16)', borderRadius: 8, padding: '9px 11px', fontSize: 11.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          <strong style={{ color: '#00b4a0' }}>Investor read · </strong>capacity screen vs the 1.0 balanced line; verify subject occupancy from centre records.
        </div>
        <div style={{ background: 'rgba(217,180,106,0.06)', border: '1px solid rgba(217,180,106,0.22)', borderRadius: 8, padding: '9px 11px', fontSize: 11.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          <strong style={{ color: '#d9b46a' }}>Agent read · </strong>frame as &ldquo;demand indicators,&rdquo; defensible to a valuer; never &ldquo;undersupplied&rdquo; asserted flat.
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '10px 12px', minHeight: 82,
    }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', color: 'rgba(255,255,255,0.36)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ color: '#fff', fontSize: 17, fontWeight: 800, lineHeight: 1.25 }}>{value}</div>
      {note && (
        <div style={{ marginTop: 5, color: 'rgba(255,255,255,0.48)', fontSize: 11.5, lineHeight: 1.45 }}>
          {note}
        </div>
      )}
    </div>
  )
}

const tableHeadStyle: CSSProperties = {
  padding: '9px 10px', textAlign: 'left', color: 'rgba(255,255,255,0.46)',
  fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em',
  fontFamily: 'IBM Plex Mono, monospace',
}

const tableCellStyle: CSSProperties = {
  padding: '10px', borderTop: '1px solid rgba(255,255,255,0.06)',
  color: 'rgba(255,255,255,0.58)', fontSize: 12.5, lineHeight: 1.45,
  overflowWrap: 'anywhere',
}

export default function MarketAuditPanel({ audit, pipelineAudit, pipelineProjects }: { audit?: MarketAudit | null; pipelineAudit?: PipelineAudit | null; pipelineProjects?: PipelineProject[] }) {
  if (!audit && !pipelineAudit && !pipelineProjects?.length) return null
  const warnings = audit?.warnings ?? []

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 18, color: '#fff', marginBottom: 14, fontFamily: "'Space Grotesk', sans-serif" }}>
        Market Demand Audit
      </h2>
      <div style={{ background: '#152336', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 16 }}>
        {audit && <MarketAuditSummary audit={audit} pipelineAudit={pipelineAudit} pipelineProjects={pipelineProjects} />}
        {!audit && <PipelineSummary audit={pipelineAudit} projects={pipelineProjects} />}
        {audit && (pipelineAudit || pipelineProjects?.length) && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <PipelineSummary audit={pipelineAudit} projects={pipelineProjects} />
          </div>
        )}
        {warnings.length > 3 && (
          <div style={{ marginTop: 10, display: 'grid', gap: 7 }}>
            {warnings.slice(3).map((warning, index) => (
              <div key={`${warning}-${index}`} style={{
                color: 'rgba(255,255,255,0.52)', fontSize: 12.5, lineHeight: 1.5,
                borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8,
              }}>
                <span style={{ color: '#f59e0b', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, textTransform: 'uppercase', marginRight: 8 }}>
                  Warning
                </span>
                {investorWarning(warning)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export { investorWarning, confidenceColor, supplySourceLabel }
