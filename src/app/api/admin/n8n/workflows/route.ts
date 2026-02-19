import { NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-response";

type WorkflowListItem = {
  id: string;
  title: string;
  type: "sub-workflow" | "cron" | "webhook" | "interval";
  docFilename: string | null;
  jsonFilename: string | null;
  order: number;
  schedule: string | null;
  endpoints: string[];
  requiredEnvKeys: string[];
};

const DOC_DIR = join(process.cwd(), "docs/n8n");
const JSON_DIR = join(process.cwd(), "n8n/workflows");
const MANIFEST_PATH = join(JSON_DIR, "manifest.json");

type ManifestEntry = {
  name: string;
  file: string;
  trigger: string;
  schedule: string | null;
  endpoints: string[];
  requiredEnvKeys: string[];
};

function loadManifest(): Map<string, ManifestEntry> {
  const map = new Map<string, ManifestEntry>();
  if (!existsSync(MANIFEST_PATH)) return map;
  try {
    const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    for (const w of raw.workflows || []) {
      // Key by file basename without extension
      const key = (w.file || "").split("/").pop()?.replace(".json", "") || "";
      if (key) map.set(key, w);
    }
  } catch { /* ignore parse errors */ }
  return map;
}

function inferType(id: string, jsonContent?: string): WorkflowListItem["type"] {
  if (id.startsWith("s")) return "sub-workflow";
  if (!jsonContent) return "cron";
  if (jsonContent.includes('"webhook"') || jsonContent.includes("Webhook")) return "webhook";
  if (jsonContent.includes('"minutesInterval"') || jsonContent.includes("Interval")) return "interval";
  return "cron";
}

function parseTitle(id: string, jsonContent?: string): string {
  if (jsonContent) {
    try {
      const parsed = JSON.parse(jsonContent);
      if (parsed.name) return parsed.name;
    } catch { /* skip */ }
  }
  return id;
}

export async function GET(req: Request) {
  const authResult = await requireMappedRoutePermissionAuth(req);
  if (authResult.error) return authResult.error;
  const adminError = requireAdminRole(authResult.auth.role);
  if (adminError) return adminError;

  try {
    const workflows: WorkflowListItem[] = [];
    const seenIds = new Set<string>();
    const manifest = loadManifest();

    // Gather JSON files
    if (existsSync(JSON_DIR)) {
      const jsonFiles = readdirSync(JSON_DIR).filter((f) => f.endsWith(".json") && f !== "manifest.json").sort();
      for (const file of jsonFiles) {
        const id = file.replace(".json", "");
        const content = readFileSync(join(JSON_DIR, file), "utf8");
        const docFilename = existsSync(join(DOC_DIR, `${id}.md`)) ? `${id}.md` : null;
        const m = manifest.get(id);
        seenIds.add(id);
        workflows.push({
          id,
          title: m?.name || parseTitle(id, content),
          type: inferType(id, content),
          docFilename,
          jsonFilename: file,
          order: id.startsWith("s") ? -1 : parseInt(id.slice(0, 2)) || 99,
          schedule: m?.schedule || null,
          endpoints: m?.endpoints || [],
          requiredEnvKeys: m?.requiredEnvKeys || [],
        });
      }
    }

    // Gather doc files without JSON
    if (existsSync(DOC_DIR)) {
      const docFiles = readdirSync(DOC_DIR).filter((f) => f.endsWith(".md") && f !== "api.md" && f !== "overview.md" && f !== "workflows.md").sort();
      for (const file of docFiles) {
        const id = file.replace(".md", "");
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        workflows.push({
          id,
          title: id,
          type: "cron",
          docFilename: file,
          jsonFilename: null,
          order: id === "00-overview" ? -100 : parseInt(id.slice(0, 2)) || 99,
          schedule: null,
          endpoints: [],
          requiredEnvKeys: [],
        });
      }
    }

    workflows.sort((a, b) => a.order - b.order);

    return NextResponse.json({ ok: true, workflows });
  } catch (err) {
    console.error("[admin.n8n.workflows]", err);
    return jsonError(500, "INTERNAL_ERROR", "Internal server error");
  }
}
