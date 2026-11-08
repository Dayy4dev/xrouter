import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/db/helpers/metaStore";

export const dynamic = "force-dynamic";

// GET /api/theme - fetch public/global theme preference set by instance owner
export async function GET() {
  try {
    const raw = await getMeta("global_theme_settings", null);
    if (!raw) {
      return NextResponse.json({
        ok: true,
        theme: "ember",
        accent: "orange",
        customColor: "#E56A4A",
        topologyBg: null,
        topologyBgDim: 0,
      });
    }
    const parsed = JSON.parse(raw);
    return NextResponse.json({
      ok: true,
      theme: "ember",
      accent: "orange",
      customColor: "#E56A4A",
      topologyBg: null,
      topologyBgDim: 0,
      ...parsed,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      theme: "ember",
      accent: "orange",
      customColor: "#E56A4A",
      topologyBg: null,
      topologyBgDim: 0,
    });
  }
}

// POST /api/theme - update global theme preference
export async function POST(request) {
  try {
    const body = await request.json();
    const currentRaw = await getMeta("global_theme_settings", null);
    const current = currentRaw ? JSON.parse(currentRaw) : {};

    const theme = body.theme !== undefined ? body.theme : current.theme || "ember";
    const accent = body.accent !== undefined ? body.accent : current.accent || "orange";
    const customColor = body.customColor !== undefined ? body.customColor : current.customColor || "#E56A4A";
    const topologyBg = body.topologyBg !== undefined ? body.topologyBg : (current.topologyBg || null);
    const topologyBgDim = body.topologyBgDim !== undefined ? Number(body.topologyBgDim) : (current.topologyBgDim || 0);

    const payload = { theme, accent, customColor, topologyBg, topologyBgDim };
    await setMeta("global_theme_settings", JSON.stringify(payload));
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
