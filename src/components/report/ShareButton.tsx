"use client";

import { useState } from "react";

interface ShareButtonProps {
  dealId: string;
  existingToken?: string | null;
}

export default function ShareButton({ dealId, existingToken }: ShareButtonProps) {
  const [token, setToken] = useState(existingToken ?? null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = token
    ? `${window.location.origin}/share/${token}`
    : null;

  const handleCreate = async () => {
    setLoading(true);
    const res = await fetch("/api/share-deal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId }),
    });
    const json = await res.json();
    if (json.token) setToken(json.token);
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    if (!confirm("Revoke this link? Anyone with the old link will lose access.")) return;
    setLoading(true);
    await fetch("/api/share-deal", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId }),
    });
    setToken(null);
    setLoading(false);
  };

  if (!token) {
    return (
      <button
        onClick={handleCreate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition disabled:opacity-50"
      >
        {loading ? "Creating…" : "🔗 Share report"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        readOnly
        value={shareUrl!}
        className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 flex-1 min-w-0 outline-none"
      />
      <button
        onClick={handleCopy}
        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <button
        onClick={handleRevoke}
        disabled={loading}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition disabled:opacity-50"
      >
        Revoke
      </button>
    </div>
  );
}
