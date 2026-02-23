/**
 * Email Service — sends emails via Resend API or falls back to log-only mode
 * 
 * Requires env: RESEND_API_KEY
 * Optional: EMAIL_FROM (default: "CRM Thầy Duy <noreply@thayduydaotaolaixe.com>")
 * 
 * If RESEND_API_KEY is not set, emails are logged but not sent (preview mode).
 */

interface SendEmailInput {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
}

interface SendEmailResult {
    success: boolean;
    id?: string;
    error?: string;
    preview?: boolean; // true if email was not actually sent
}

/**
 * Convert markdown-like report to simple HTML email
 */
export function markdownToHtml(md: string): string {
    let html = md
        // Headers
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2 style='color:#1e3a5f;border-bottom:1px solid #e5e7eb;padding-bottom:6px;'>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1 style='color:#1e3a5f;'>$1</h1>")
        // Bold
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // Tables
        .replace(/\|(.+)\|/g, (match) => {
            const cells = match.split("|").filter(Boolean).map(c => c.trim());
            return "<tr>" + cells.map(c => `<td style="padding:6px 12px;border:1px solid #e5e7eb;">${c}</td>`).join("") + "</tr>";
        })
        // List items
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
        // HR
        .replace(/^---$/gm, "<hr style='border:none;border-top:1px solid #e5e7eb;margin:16px 0;'>")
        // Italic
        .replace(/\*(.+?)\*/g, "<em style='color:#6b7280;font-size:12px;'>$1</em>")
        // Line breaks
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, "<br>");

    // Wrap tables
    html = html.replace(/<tr>[\s\S]*?<\/tr>/g, (match) => {
        if (match.includes("<table")) return match;
        return `<table style="width:100%;border-collapse:collapse;margin:8px 0;">${match}</table>`;
    });

    // Wrap list items
    html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (match) => `<ul style="margin:8px 0;padding-left:20px;">${match}</ul>`);

    return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#1a1a1a;background:#f9fafb;">
<div style="background:white;border-radius:8px;padding:24px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
${html}
</div>
<div style="text-align:center;margin-top:16px;font-size:11px;color:#9ca3af;">
  CRM Đào Tạo Lái Xe Thầy Duy • crm.thayduydaotaolaixe.com
</div>
</body>
</html>`;
}

/**
 * Send an email. Returns success/failure.
 * If RESEND_API_KEY is not configured, logs the email and returns preview mode.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM || "CRM Thầy Duy <noreply@thayduydaotaolaixe.com>";
    const to = Array.isArray(input.to) ? input.to : [input.to];

    if (!apiKey) {
        console.log(`[email] PREVIEW MODE — would send to: ${to.join(", ")} | subject: ${input.subject}`);
        return { success: true, preview: true };
    }

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to,
                subject: input.subject,
                html: input.html || undefined,
                text: input.text || undefined,
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            console.error("[email] Resend error:", res.status, body);
            return { success: false, error: `Resend ${res.status}: ${body}` };
        }

        const data = await res.json();
        return { success: true, id: data.id };
    } catch (err) {
        console.error("[email] Send failed:", err);
        return { success: false, error: String(err) };
    }
}
