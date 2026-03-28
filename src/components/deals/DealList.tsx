"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, supabase } from "@/lib/useAuth";

// Using the Deal type from Supabase — not ScoredDeal
interface DealRow {
  id: string;
  created_at: string;
  centre_name: string | null;
  address: string | null;
  total_score: number | null;
  status: string | null;
  extracted: unknown;
  scored: unknown;
}

interface DealListProps {
  onOpen: (id: string) => void;   // matches page.tsx usage
  onNew: () => void;
}

const STATUS_OPTIONS = ["Active", "LOI", "Under DD", "Passed", "Closed"] as const;
type DealStatus = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<DealStatus, string> = {
  Active:     "bg-blue-100 text-blue-700",
  LOI:        "bg-yellow-100 text-yellow-700",
  "Under DD": "bg-purple-100 text-purple-700",
  Passed:     "bg-red-100 text-red-700",
  Closed:     "bg-green-100 text-green-700",
};

export default function DealList({ onOpen, onNew }: DealListProps) {
  const { session } = useAuth()
  const [deals, setDeals]               = useState<DealRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    if (!session) {
      setDeals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // supabase client from useAuth has the session attached —
      // RLS automatically filters to auth.uid() = user_id
      const { data, error: fetchError } = await supabase
        .from("deals")
        .select("id, created_at, centre_name, address, total_score, status")
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

  const handleStatusChange = async (
    e: React.ChangeEvent<HTMLSelectElement>,
    dealId: string
  ) => {
    e.stopPropagation();
    const newStatus = e.target.value as DealStatus;
    setUpdatingStatus(dealId);

    const { error: updateError } = await supabase
      .from("deals")
      .update({ status: newStatus })
      .eq("id", dealId);

    if (updateError) {
      console.error("Status update failed:", updateError.message);
    } else {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, status: newStatus } : d));
    }
    setUpdatingStatus(null);
  };

  // ── States ──────────────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
        Sign in to see your deals.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "32px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 72, borderRadius: 12, background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "#ef4444", fontSize: 13 }}>
        {error}{" "}
        <button onClick={fetchDeals} style={{ color: "#00b4a0", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          Retry
        </button>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>📭</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>
          No deals yet. Score your first centre.
        </div>
        <button
          onClick={onNew}
          style={{
            background: "#00b4a0", border: "none", borderRadius: 8,
            padding: "10px 24px", color: "#0d1b2a", fontWeight: 700,
            fontSize: 13, cursor: "pointer",
          }}
        >
          + Upload IM
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20, fontWeight: 700, color: "#e8edf3" }}>
          Pipeline ({deals.length})
        </h2>
        <button
          onClick={onNew}
          style={{
            background: "rgba(0,180,160,0.1)", border: "1px solid rgba(0,180,160,0.25)",
            borderRadius: 6, padding: "6px 14px", color: "#00b4a0",
            fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}
        >
          + New Deal
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deals.map((deal) => {
          const status = (deal.status as DealStatus) ?? "Active";
          const score  = deal.total_score;

          return (
            <div
              key={deal.id}
              onClick={() => onOpen(deal.id)}
              style={{
                cursor: "pointer",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                padding: "14px 16px",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(0,180,160,0.3)";
                (e.currentTarget as HTMLDivElement).style.background  = "rgba(0,180,160,0.04)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLDivElement).style.background  = "rgba(255,255,255,0.02)";
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                {/* Left */}
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#e8edf3", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {deal.centre_name ?? "Unnamed"}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "3px 0 0", fontFamily: "IBM Plex Mono, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {deal.address ?? "—"}
                  </p>
                </div>

                {/* Score badge */}
                {score != null && (
                  <span style={{
                    flexShrink: 0,
                    borderRadius: 6, padding: "2px 8px",
                    fontSize: 13, fontWeight: 700,
                    fontFamily: "Space Grotesk, sans-serif",
                    background: score >= 70 ? "rgba(34,197,94,0.12)"
                      : score >= 50 ? "rgba(245,158,11,0.12)"
                      : "rgba(239,68,68,0.12)",
                    color: score >= 70 ? "#22c55e"
                      : score >= 50 ? "#f59e0b"
                      : "#ef4444",
                  }}>
                    {score.toFixed(0)}
                  </span>
                )}
              </div>

              {/* Status + date row */}
              <div
                style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}
                onClick={e => e.stopPropagation()}
              >
                <select
                  value={status}
                  onChange={e => handleStatusChange(e, deal.id)}
                  disabled={updatingStatus === deal.id}
                  style={{
                    fontSize: 11, fontWeight: 600, borderRadius: 20,
                    padding: "2px 20px 2px 8px", border: "none", outline: "none",
                    cursor: "pointer", appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 5px center",
                    opacity: updatingStatus === deal.id ? 0.5 : 1,
                    // Inline colour since Tailwind classes aren't available here
                    background: status === "Active"    ? "#dbeafe" :
                                status === "LOI"       ? "#fef9c3" :
                                status === "Under DD"  ? "#f3e8ff" :
                                status === "Passed"    ? "#fee2e2" :
                                                         "#dcfce7",
                    color:      status === "Active"    ? "#1d4ed8" :
                                status === "LOI"       ? "#854d0e" :
                                status === "Under DD"  ? "#6b21a8" :
                                status === "Passed"    ? "#b91c1c" :
                                                         "#15803d",
                  }}
                >
                  {STATUS_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "IBM Plex Mono, monospace" }}>
                  {deal.created_at
                    ? new Date(deal.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "2-digit" })
                    : ""}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @media (max-width: 600px) {
          .deal-list-wrap { padding: 16px 12px !important; }
        }
      `}</style>
    </div>
  );
}
