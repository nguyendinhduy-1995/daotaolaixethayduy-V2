/**
 * GET /api/docs — OpenAPI/Swagger documentation
 *
 * Returns OpenAPI 3.0 spec as JSON.
 * Navigate to /api/docs in browser with Swagger UI redirect.
 */
import { NextResponse } from "next/server";

const OPENAPI_SPEC = {
    openapi: "3.0.3",
    info: {
        title: "Đào Tạo Lái Xe Thầy Duy — CRM API",
        version: "2.0.0",
        description: "CRM API for lead management, receipts, students, N8N integration, and internal operations.",
        contact: { email: "admin@thayduydaotaolaixe.com" },
    },
    servers: [
        { url: "https://crm.thayduydaotaolaixe.com", description: "Production" },
        { url: "http://localhost:3000", description: "Local development" },
    ],
    tags: [
        { name: "Auth", description: "Authentication & authorization" },
        { name: "Leads", description: "Lead management" },
        { name: "Receipts", description: "Payment receipts" },
        { name: "Students", description: "Student management" },
        { name: "Dashboard", description: "KPI & analytics" },
        { name: "N8N", description: "N8N workflow integration (admin)" },
        { name: "Webhooks", description: "External webhook endpoints" },
        { name: "Notifications", description: "Notification system & push" },
        { name: "Reports", description: "KPI export & reports" },
        { name: "Events", description: "Server-Sent Events" },
    ],
    paths: {
        "/api/auth/login": {
            post: {
                tags: ["Auth"],
                summary: "Login with email/password",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object", properties: { email: { type: "string" }, password: { type: "string" } }, required: ["email", "password"] } } },
                },
                responses: {
                    "200": { description: "JWT token returned in cookie" },
                    "401": { description: "Invalid credentials" },
                },
            },
        },
        "/api/auth/me": {
            get: {
                tags: ["Auth"],
                summary: "Get current user info",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "User profile" } },
            },
        },
        "/api/leads": {
            get: {
                tags: ["Leads"],
                summary: "List leads with pagination & filters",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "page", in: "query", schema: { type: "integer", default: 1 } },
                    { name: "pageSize", in: "query", schema: { type: "integer", default: 20 } },
                    { name: "q", in: "query", schema: { type: "string" }, description: "Search by name/phone" },
                    { name: "status", in: "query", schema: { type: "string" }, description: "Filter by LeadStatus" },
                    { name: "ownerId", in: "query", schema: { type: "string" } },
                ],
                responses: { "200": { description: "Paginated lead list" } },
            },
            post: {
                tags: ["Leads"],
                summary: "Create a new lead",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { fullName: { type: "string" }, phone: { type: "string" }, source: { type: "string" }, channel: { type: "string" } } } } },
                },
                responses: { "201": { description: "Lead created" } },
            },
        },
        "/api/leads/{id}": {
            get: {
                tags: ["Leads"],
                summary: "Get lead by ID",
                security: [{ bearerAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Lead detail" }, "404": { description: "Not found" } },
            },
            patch: {
                tags: ["Leads"],
                summary: "Update lead fields",
                security: [{ bearerAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Lead updated" } },
            },
        },
        "/api/receipts": {
            get: {
                tags: ["Receipts"],
                summary: "List receipts",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Paginated receipt list" } },
            },
        },
        "/api/students": {
            get: {
                tags: ["Students"],
                summary: "List students",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Paginated student list" } },
            },
        },
        "/api/dashboard/kpi": {
            get: {
                tags: ["Dashboard"],
                summary: "Get KPI metrics",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { "200": { description: "KPI data" } },
            },
        },
        "/api/reports/kpi/export": {
            get: {
                tags: ["Reports"],
                summary: "Export KPI report as Excel/CSV",
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: "format", in: "query", schema: { type: "string", enum: ["xlsx", "csv"] } },
                    { name: "from", in: "query", schema: { type: "string", format: "date" } },
                    { name: "to", in: "query", schema: { type: "string", format: "date" } },
                ],
                responses: { "200": { description: "File download" } },
            },
        },
        "/api/webhooks/lead-ingest": {
            post: {
                tags: ["Webhooks"],
                summary: "Ingest lead from N8N/Facebook/Zalo",
                parameters: [{ name: "x-webhook-secret", in: "header", required: true, schema: { type: "string" } }],
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { phone: { type: "string" }, fullName: { type: "string" }, source: { type: "string" } }, required: ["phone"] } } },
                },
                responses: { "200": { description: "Lead processed" }, "401": { description: "Invalid secret" } },
            },
        },
        "/api/events": {
            get: {
                tags: ["Events"],
                summary: "SSE stream for real-time updates",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "SSE event stream", content: { "text/event-stream": {} } } },
            },
        },
        "/api/admin/n8n/workflows": {
            get: {
                tags: ["N8N"],
                summary: "List all N8N workflows (admin only)",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Workflow list with metadata" } },
            },
        },
        "/api/admin/n8n/workflows/{id}": {
            get: {
                tags: ["N8N"],
                summary: "Get workflow detail + sanitized JSON (admin only)",
                security: [{ bearerAuth: [] }],
                parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
                responses: { "200": { description: "Workflow detail" }, "404": { description: "Not found" } },
            },
        },
        "/api/notifications/push/subscribe": {
            post: {
                tags: ["Notifications"],
                summary: "Register Web Push subscription",
                security: [{ bearerAuth: [] }],
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { endpoint: { type: "string" }, keys: { type: "object", properties: { p256dh: { type: "string" }, auth: { type: "string" } } } } } } },
                },
                responses: { "200": { description: "Subscription saved" } },
            },
            delete: {
                tags: ["Notifications"],
                summary: "Remove Web Push subscription",
                security: [{ bearerAuth: [] }],
                responses: { "200": { description: "Subscription removed" } },
            },
        },
        "/api/health": {
            get: {
                tags: ["Auth"],
                summary: "Health check",
                responses: { "200": { description: "Server healthy" } },
            },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
        },
        schemas: {
            LeadStatus: {
                type: "string",
                enum: ["NEW", "HAS_PHONE", "APPOINTED", "ARRIVED", "SIGNED", "STUDYING", "EXAMED", "RESULT", "LOST"],
            },
            Role: {
                type: "string",
                enum: ["admin", "manager", "telesales", "direct_page", "viewer"],
            },
        },
    },
};

export async function GET() {
    return NextResponse.json(OPENAPI_SPEC, {
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}
