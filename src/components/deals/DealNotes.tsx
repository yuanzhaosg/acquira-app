"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/useAuth";

interface DealNotesProps {
  dealId: string;
  initialNotes?: string | null;
}

export default function DealNotes({ dealId, initialNotes }: DealNotesProps) {
  
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset when deal changes
  useEffect(() => {
    setNotes(initialNotes ?? "");
    setSaved(true);
  }, [dealId, initialNotes]);

  const persistNotes = async (value: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("deals")
      .update({ notes: value })
      .eq("id", dealId);

    if (error) {
      console.error("Notes save failed:", error.message);
    } else {
      setSaved(true);
    }
    setSaving(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);
    setSaved(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persistNotes(value), 1200);
  };

  const handleBlur = () => {
    if (!saved) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      persistNotes(notes);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
        <span className="text-xs text-gray-400">
          {saving ? "Saving…" : saved ? "Saved ✓" : "Unsaved"}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Add due-diligence notes, broker contacts, open items…"
        rows={5}
        className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition"
      />
    </div>
  );
}
