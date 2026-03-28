"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, supabase } from "@/lib/useAuth";

interface DealRow {
  id: string;
  created_at: string;
  centre_name: string | null;
  address: string | null;
  total_score: number | null;
  status: string | null;
  tags: string | null;
  scored: unknown;
}

interface DealListProps {
  onOpen: (id: string) => void;
  onNew: () => void;
  onCompare?: (ids: string[], deals: DealRow[]) => void;
}

// Status values (db uses lowercase with underscores)
const STATUS_DB_VALUES  = ['active', 'loi', 'under_dd', 'passed', 'closed'] as const;
const STATUS_LABELS: Record<string, string> = {
  active:   'Active',
  loi:      'LOI',
  under_dd: 'Under DD',
  passed:   'Passed',
  closed:   'Closed',
};
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:   { bg: 'rgba(0,180,160,0.15)',   color: '#00b4a0' },
  loi:      { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  under_dd: { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  passed:   { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  closed:   { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
};

const FILTER_TABS = ['All', 'Active', 'LOI', 'Under DD', 'Passed', 'Closed'] as const;
type FilterTab = typeof FILTER_TABS[number];
const FILTER_TO_DB: Record<FilterTab, string | null> = {
  All:       null,
  Active:    'active',
  LOI:       'loi',
  'Under DD':'under_dd',
  Passed:    'passed',
  Closed:    'closed',
};

export default function DealList({ onOpen, onNew, onCompare }: DealListProps) {
  const { session } = useAuth();
  const [deals, setDeals]                       = useState<DealRow[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus]     = useState<string | null>(null);
  const [filterTab, setFilterTab]               = useState<FilterTab>('All');
  const [compareIds, setCompareIds]             = useState<Set<string>>(new Set());

  const fetchDeals = useCallback(async () => {
    if (!session) { setDeals([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("deals")
        .select("id, created_at, centre_name, address, total_score, status, tags, scored")
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      setDeals((data as DealRow[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, dealId: string) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    setUpdatingStatus(dealId);
    const token = session?.access_token;
    try {
      if (token) {
        await fetch(`/api/deals/${dealId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: newStatus }),
        });
      }
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: newStatus } : d));
    } catch {}
    setUpdatingStatus(null);
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }
      if (next.size >= 3) return prev; // max 3
      next.add(id);
      return next;
    });
  };

  const filteredDeals = deals.filter(d => {
    const dbVal = FILTER_TO_DB[filterTab];
    if (!dbVal) return true;
    const s = (d.status ?? 'active').toLowerCase();
    return s === dbVal;
  });

  const selectedDeals = deals.filter(d => compareIds.has(d.id));

  // ── States ────────────────────────────────────────────────────────────────
  if (!session) return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
      Sign in to see your deals.
    </div>
  );

  if (loading) return (
    <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 12, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />
      ))}
    </div>
  );

  if (error) return (
    <div style={{ textAlign: "center", padding: "48px 24px", color: "#ef4444", fontSize: 13 }}>
      {error}{" "}
      <button onClick={fetchDeals} style={{ color: "#00b4a0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
        Retry
      </button>
    </div>
  );

  if (deals.length === 0) return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>📭</div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>
        No deals yet. Score your first centre.
      </div>
      <button onClick={onNew} style={{ background: "#00b4a0", border: "none", borderRadius: 8, padding: "10px 24px", color: "#0d1b2a", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
        + Upload IM
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 700, color: "#e8edf3", margin: 0 }}>
          Pipeline ({deals.length})
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {compareIds.size >= 2 && (
            <button
              onClick={() => onCompare?.(Array.from(compareIds), selectedDeals)}
              style={{
                background: '#00b4a0', border: 'none', borderRadius: 6,
                padding: '6px 14px', color: '#0d1b2a', fontSize: 12,
                cursor: 'pointer', fontWeight: 700,
              }}
            >
              Compare {compareIds.size} deals →
            </button>
          )}
          <button onClick={onNew} style={{ background: "rgba(0,180,160,0.1)", border: "1px solid rgba(0,180,160,0.25)", borderRadius: 6, padding: "6px 14px", color: "#00b4a0", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
            + New Deal
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="deal-filter-tabs" style={{ display: "flex", gap: 4, marginBottom: 20, overflowX: "auto", flexWrap: "nowrap", WebkitOverflowScrolling: "touch" as any, paddingBottom: 4 }}>
        {FILTER_TABS.map(tab => {
          const isActive = filterTab === tab;
          const dbVal = FILTER_TO_DB[tab];
          const count = dbVal ? deals.filter(d => (d.status ?? 'active').toLowerCase() === dbVal).length : deals.length;
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', border: 'none', fontFamily: "'DM Sans', sans-serif",
                background: isActive ? 'rgba(0,180,160,0.2)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#00b4a0' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {tab} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {filteredDeals.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          No deals in this stage.
        </div>
      )}

      {/* Deal cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filteredDeals.map(deal => {
          const statusKey = (deal.status ?? 'active').toLowerCase();
          const sc = STATUS_COLORS[statusKey] ?? STATUS_COLORS.active;
          const score = deal.total_score;
          const isCompareChecked = compareIds.has(deal.id);
          const tags = deal.tags ? deal.tags.split(',').map(t => t.trim()).filter(Boolean) : [];

          return (
            <div
              key={deal.id}
              onClick={() => onOpen(deal.id)}
              style={{
                cursor: "pointer", borderRadius: 12,
                border: isCompareChecked ? '1.5px solid #00b4a0' : '1px solid rgba(255,255,255,0.08)',
                background: isCompareChecked ? 'rgba(0,180,160,0.06)' : 'rgba(255,255,255,0.02)',
                padding: "14px 16px", transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                if (!isCompareChecked) {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,180,160,0.3)";
                  (e.currentTarget as HTMLDivElement).style.background  = "rgba(0,180,160,0.04)";
                }
              }}
              onMouseLeave={e => {
                if (!isCompareChecked) {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                  (e.currentTarget as HTMLDivElement).style.background  = "rgba(255,255,255,0.02)";
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                {/* Compare checkbox */}
                <div
                  onClick={e => { e.stopPropagation(); toggleCompare(deal.id); }}
                  style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isCompareChecked ? '#00b4a0' : 'rgba(255,255,255,0.2)'}`,
                    background: isCompareChecked ? '#00b4a0' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', marginTop: 2,
                  }}
                >
                  {isCompareChecked && <span style={{ color: '#0d1b2a', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>

                {/* Left content */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "#e8edf3", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {deal.centre_name ?? "Unnamed"}
                    </p>
                    {/* Status badge */}
                    <span style={{
                      flexShrink: 0, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                      background: sc.bg, color: sc.color,
                    }}>
                      {STATUS_LABELS[statusKey] ?? statusKey}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "3px 0 0", fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {deal.address ?? "—"}
                  </p>
                  {/* Tags */}
                  {tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {tags.map(tag => (
                        <span key={tag} style={{
                          padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 500,
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                          border: '1px solid rgba(255,255,255,0.1)',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score badge */}
                {score != null && (
                  <span style={{
                    flexShrink: 0, borderRadius: 6, padding: "2px 8px",
                    fontSize: 13, fontWeight: 700,
                    fontFamily: "'Space Grotesk', sans-serif",
                    background: score >= 70 ? "rgba(34,197,94,0.12)" : score >= 50 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                    color: score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444",
                  }}>
                    {score.toFixed(0)}
                  </span>
                )}
              </div>

              {/* Status dropdown + date row */}
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }} onClick={e => e.stopPropagation()}>
                <select
                  className="deal-status-select"
                  value={statusKey}
                  onChange={e => handleStatusChange(e, deal.id)}
                  disabled={updatingStatus === deal.id}
                  style={{
                    fontSize: 11, fontWeight: 600, borderRadius: 20,
                    padding: "2px 20px 2px 8px", border: `1px solid ${sc.color}44`,
                    outline: "none", cursor: "pointer", appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 5px center",
                    opacity: updatingStatus === deal.id ? 0.5 : 1,
                    background: sc.bg, color: sc.color,
                  }}
                >
                  {STATUS_DB_VALUES.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Mono', monospace" }}>
                  {deal.created_at ? new Date(deal.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" }) : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .deal-filter-tabs { scrollbar-width: none; -ms-overflow-style: none; }
        .deal-filter-tabs::-webkit-scrollbar { display: none; }
        .deal-filter-tabs button { flex-shrink: 0; }
        @media (max-width: 480px) {
          .deal-status-select { min-height: 36px !important; font-size: 13px !important; padding: 4px 24px 4px 10px !important; }
        }
      `}</style>
    </div>
  );
}
