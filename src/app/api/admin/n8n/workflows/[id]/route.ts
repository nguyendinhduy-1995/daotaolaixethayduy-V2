import { NextResponse, type NextRequest } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { requireMappedRoutePermissionAuth } from "@/lib/route-auth";
import { requireAdminRole } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-response";

const DOC_DIR = join(process.cwd(), "docs/n8n");
const JSON_DIR = join(process.cwd(), "n8n/workflows");

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await requireMappedRoutePermissionAuth(req);
    if (authResult.error) return authResult.error;
    const adminError = requireAdminRole(authResult.auth.role);
    if (adminError) return adminError;

    const { id } = await params;

    // Sanitize — only allow alphanumeric, dash, underscore
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return jsonError(400, "INVALID_ID", "ID không hợp lệ");
    }

    try {
        const docPath = join(DOC_DIR, `${id}.md`);
        const jsonPath = join(JSON_DIR, `${id}.json`);

        const hasDoc = existsSync(docPath);
        const hasJson = existsSync(jsonPath);

        if (!hasDoc && !hasJson) {
            return jsonError(404, "NOT_FOUND", `Workflow '${id}' không tồn tại`);
        }

        const docMarkdown = hasDoc ? readFileSync(docPath, "utf8") : null;
        let workflowJson: unknown = null;
        let workflowJsonRaw: string | null = null;

        if (hasJson) {
            workflowJsonRaw = readFileSync(jsonPath, "utf8");
            try {
                workflowJson = JSON.parse(workflowJsonRaw);
            } catch {
                workflowJson = null;
            }
        }

        return NextResponse.json({
            ok: true,
            id,
            docMarkdown,
            workflowJson,
            workflowJsonRaw,
        });
    } catch (err) {
        console.error(`[admin.n8n.workflows.${id}]`, err);
        return jsonError(500, "INTERNAL_ERROR", "Internal server error");
    }
}
