import { NextResponse } from "next/server";
import { getCustomModels, addCustomModel, deleteCustomModel, deleteCustomModels } from "@/models";
import { reconcileAllowedModels } from "@/lib/db/repos/apiKeysRepo";
import { CAPACITY_META, isSttTransport } from "@/shared/constants/models";

export const dynamic = "force-dynamic";

// Whitelist capability keys to boolean values — ignore anything else
function sanitizeCaps(caps) {
  if (!caps || typeof caps !== "object") return null;
  const clean = {};
  for (const key of Object.keys(CAPACITY_META)) {
    if (typeof caps[key] === "boolean") clean[key] = caps[key];
  }
  return Object.keys(clean).length ? clean : null;
}

// Accepted STT transport markers live in the shared whitelist
// (src/shared/constants/models STT_TRANSPORT_META) — the dashboard transport
// select and this validator must agree on one set, so neither owns a copy.
// Unknown or mistyped values are silently dropped, the same policy
// sanitizeCaps applies to capability keys.
function sanitizeTransport(transport, type) {
  if (type !== "stt" || !isSttTransport(transport)) return null;
  return transport.trim();
}

// GET /api/models/custom - List all custom models
export async function GET() {
  try {
    const models = await getCustomModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.log("Error fetching custom models:", error);
    return NextResponse.json({ error: "Failed to fetch custom models" }, { status: 500 });
  }
}

// POST /api/models/custom - Add custom model (supports single or batch array)
export async function POST(request) {
  try {
    const body = await request.json();
    if (Array.isArray(body?.models)) {
      const defaultProviderAlias = body.providerAlias;
      let addedCount = 0;
      for (const m of body.models) {
        const targetAlias = (typeof m === "object" && m?.providerAlias) || defaultProviderAlias;
        const id = typeof m === "string" ? m : m?.id;
        if (!targetAlias || !id) continue;
        const type = (typeof m === "object" && m?.type) || "llm";
        const name = (typeof m === "object" && m?.name) || undefined;
        const cleanCaps = sanitizeCaps(typeof m === "object" ? m?.caps : undefined);
        const cleanTransport = sanitizeTransport(typeof m === "object" ? m?.transport : undefined, type);
        const added = await addCustomModel({
          providerAlias: targetAlias,
          id,
          type,
          name,
          ...(cleanCaps ? { caps: cleanCaps } : {}),
          ...(cleanTransport ? { transport: cleanTransport } : {}),
        });
        if (added) addedCount += 1;
      }
      return NextResponse.json({ success: true, count: addedCount });
    }

    const { providerAlias, id, type, name, caps, transport } = body;
    if (!providerAlias || !id) {
      return NextResponse.json({ error: "providerAlias and id required" }, { status: 400 });
    }
    const cleanCaps = sanitizeCaps(caps);
    const cleanTransport = sanitizeTransport(transport, type || "llm");
    const added = await addCustomModel({ providerAlias, id, type: type || "llm", name, ...(cleanCaps ? { caps: cleanCaps } : {}), ...(cleanTransport ? { transport: cleanTransport } : {}) });
    return NextResponse.json({ success: true, added });
  } catch (error) {
    console.log("Error adding custom model:", error);
    return NextResponse.json({ error: "Failed to add custom model" }, { status: 500 });
  }
}

// DELETE /api/models/custom?providerAlias=xxx&id=yyy&type=zzz
// OR body: { providerAlias: "xxx", ids: ["id1", "id2", ...], type: "llm" }
export async function DELETE(request) {
  try {
    let body = null;
    try {
      body = await request.json();
    } catch {}

    const { searchParams } = new URL(request.url);
    const providerAlias = body?.providerAlias || searchParams.get("providerAlias");
    const rawIds = Array.isArray(body?.ids)
      ? body.ids
      : (searchParams.get("id") ? [searchParams.get("id")] : (body?.id ? [body.id] : []));
    const ids = Array.from(new Set(rawIds.filter(Boolean)));
    const type = body?.type || searchParams.get("type") || "llm";

    if (!providerAlias || !ids.length) {
      return NextResponse.json({ error: "providerAlias and id/ids required" }, { status: 400 });
    }

    if (ids.length === 1) {
      await deleteCustomModel({ providerAlias, id: ids[0], type });
    } else {
      await deleteCustomModels(providerAlias, ids);
    }

    // Keys pinned to this model now point at nothing. Keys may hold it either
    // bare or provider-qualified, so both spellings are handed over.
    const removedSpecs = ids.flatMap((id) => [id, `${providerAlias}/${id}`]);
    const { emptied } = await reconcileAllowedModels({ removed: removedSpecs });
    return NextResponse.json({ success: true, count: ids.length, ...(emptied.length ? { keysLeftForReview: emptied } : {}) });
  } catch (error) {
    console.log("Error deleting custom model(s):", error);
    return NextResponse.json({ error: "Failed to delete custom model(s)" }, { status: 500 });
  }
}
