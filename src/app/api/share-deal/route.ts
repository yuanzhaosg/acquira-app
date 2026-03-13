import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { dealId } = await req.json();
  if (!dealId) {
    return NextResponse.json({ error: "dealId required" }, { status: 400 });
  }

  // Verify this deal belongs to the calling user
  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("id, share_token")
    .eq("id", dealId)
    .eq("user_id", session.user.id)
    .single();

  if (fetchErr || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  // Return existing token or mint a new one
  const token = deal.share_token ?? randomBytes(18).toString("base64url");

  if (!deal.share_token) {
    const { error: updateErr } = await supabase
      .from("deals")
      .update({ share_token: token })
      .eq("id", dealId);

    if (updateErr) {
      return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
    }
  }

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/share/${token}`;
  return NextResponse.json({ shareUrl, token });
}

export async function DELETE(req: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { dealId } = await req.json();

  const { error } = await supabase
    .from("deals")
    .update({ share_token: null })
    .eq("id", dealId)
    .eq("user_id", session.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
