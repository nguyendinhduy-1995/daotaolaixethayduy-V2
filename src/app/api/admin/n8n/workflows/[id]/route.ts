import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-response";

const DOC_DIR = join(process.cwd(), "docs/n8n");
const JSON_DIR = join(process.cwd(), "n8n/workflows");
const MANIFEST_PATH = join(JSON_DIR, "manifest.json");

/**
 * GET /api/admin/n8n/workflows/:key
 * Returns workflow detail: doc markdown + JSON content + manifest data
 * Secrets/passwords are NOT included — only key names.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const { id: key } = await params;

    try {
        // Load doc markdown
        let docMarkdown: string | null = null;
        const docPath = join(DOC_DIR, `${key}.md`);
        if (existsSync(docPath)) {
            docMarkdown = readFileSync(docPath, "utf-8");
        }

        // Load workflow JSON (strip any credential values)
        let workflowJson: unknown = null;
        let workflowJsonRaw: string | null = null;
        const jsonPath = join(JSON_DIR, `${key}.json`);
        if (existsSync(jsonPath)) {
            workflowJsonRaw = readFileSync(jsonPath, "utf-8");
            try {
                const parsed = JSON.parse(workflowJsonRaw);
                // Strip credential data for security
                if (parsed.nodes) {
                    for (const node of parsed.nodes) {
                        if (node.credentials) {
                            for (const credKey of Object.keys(node.credentials)) {
                                node.credentials[credKey] = { name: node.credentials[credKey]?.name || credKey, id: "***" };
                            }
                        }
                    }
                }
                workflowJson = parsed;
            } catch { /* skip parse errors */ }
        }

        // Load manifest entry
        let manifestEntry = null;
        if (existsSync(MANIFEST_PATH)) {
            try {
                const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
                manifestEntry = (manifest.workflows || []).find(
                    (w: { file?: string }) => (w.file || "").endsWith(`${key}.json`)
                ) || null;
            } catch { /* ignore */ }
        }

        if (!docMarkdown && !workflowJson) {
            return jsonError(404, "NOT_FOUND", `Workflow "${key}" not found`);
        }

        // Extract node list for detail view
        const nodes: { name: string; type: string; position: number[] }[] = [];
        if (workflowJson && typeof workflowJson === "object" && "nodes" in workflowJson) {
            const wf = workflowJson as { nodes: Array<{ name: string; type: string; position?: number[] }> };
            for (const n of wf.nodes) {
                nodes.push({
                    name: n.name,
                    type: n.type.split(".").pop() || n.type,
                    position: n.position || [0, 0],
                });
            }
        }

        return NextResponse.json({
            ok: true,
            key,
            docMarkdown,
            workflowJson,
            workflowJsonRaw: workflowJsonRaw,
            manifest: manifestEntry,
            nodes,
        });
    } catch (err) {
        console.error(`[admin.n8n.workflows.${key}]`, err);
        return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
}
