import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api-response";
import { requireRouteAuth } from "@/lib/route-auth";

/**
 * GET /api/receipts/[id]/pdf — Generate printable receipt HTML
 * 
 * Returns styled HTML that can be printed to PDF via browser's print dialog.
 * Content-Type: text/html
 */

type Ctx = { params: Promise<{ id: string }> };

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(amount) + "đ";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

function methodLabel(method: string): string {
  const map: Record<string, string> = {
    cash: "Tiền mặt",
    bank_transfer: "Chuyển khoản",
    card: "Thẻ",
    other: "Khác (MoMo/Ví điện tử)",
  };
  return map[method] || method;
}

function numberToVietnameseWords(n: number): string {
  if (n === 0) return "không đồng";
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const groups = ["", "nghìn", "triệu", "tỷ"];

  function readGroup(num: number): string {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    let s = "";
    if (h > 0) s += units[h] + " trăm ";
    if (t > 1) s += units[t] + " mươi ";
    else if (t === 1) s += "mười ";
    else if (h > 0 && u > 0) s += "lẻ ";
    if (t > 1 && u === 1) s += "mốt";
    else if (t >= 1 && u === 5) s += "lăm";
    else if (u > 0) s += units[u];
    return s.trim();
  }

  const parts: string[] = [];
  let g = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      parts.unshift(readGroup(chunk) + " " + groups[g]);
    }
    n = Math.floor(n / 1000);
    g++;
  }
  return parts.join(" ").trim() + " đồng";
}

type ReceiptWithRelations = {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  receivedAt: Date;
  createdAt: Date;
  student: {
    lead: { fullName: string; phone: string | null; province: string | null; licenseType: string | null };
    course: { code: string } | null;
  };
  branch: { name: string; code: string } | null;
  createdBy: { name: string | null; email: string } | null;
};

export async function GET(req: Request, ctx: Ctx) {
  const { error } = requireRouteAuth(req);
  if (error) return error;

  try {
    const { id } = await ctx.params;
    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            lead: { select: { fullName: true, phone: true, province: true, licenseType: true } },
            course: { select: { code: true } },
          },
        },
        branch: { select: { name: true, code: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }) as ReceiptWithRelations | null;

    if (!receipt) return jsonError(404, "NOT_FOUND", "Không tìm thấy biên lai");

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Biên lai #${receipt.id.slice(-8).toUpperCase()}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    color: #1a1a1a;
    background: #f5f5f5;
    padding: 20px;
  }

  .receipt {
    max-width: 680px;
    margin: 0 auto;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 20px rgba(0,0,0,0.08);
    overflow: hidden;
  }

  .header {
    background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
    color: white;
    padding: 28px 32px;
    text-align: center;
  }

  .header h1 {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 6px;
  }

  .header .subtitle {
    font-size: 13px;
    opacity: 0.85;
    letter-spacing: 0.5px;
  }

  .receipt-number {
    background: rgba(255,255,255,0.15);
    display: inline-block;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
    margin-top: 12px;
    letter-spacing: 1px;
  }

  .body { padding: 28px 32px; }

  .section {
    margin-bottom: 20px;
  }

  .section-title {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #6b7280;
    font-weight: 600;
    margin-bottom: 10px;
    padding-bottom: 6px;
    border-bottom: 1px solid #e5e7eb;
  }

  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
  }

  .info-label {
    font-size: 11px;
    color: #9ca3af;
    font-weight: 500;
    margin-bottom: 2px;
  }

  .info-value {
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
  }

  .amount-box {
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border: 2px solid #86efac;
    border-radius: 10px;
    padding: 20px 24px;
    text-align: center;
    margin: 20px 0;
  }

  .amount-label {
    font-size: 12px;
    color: #16a34a;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .amount-value {
    font-size: 32px;
    font-weight: 700;
    color: #15803d;
    letter-spacing: 1px;
  }

  .amount-words {
    font-size: 13px;
    color: #4b5563;
    font-style: italic;
    margin-top: 6px;
  }

  .footer {
    padding: 20px 32px;
    border-top: 1px dashed #d1d5db;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    text-align: center;
  }

  .signature-block {
    padding-top: 10px;
  }

  .signature-block .title {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
    margin-bottom: 50px;
  }

  .signature-block .line {
    border-top: 1px solid #9ca3af;
    padding-top: 6px;
    font-size: 11px;
    color: #6b7280;
  }

  .stamp {
    text-align: center;
    padding: 16px 32px;
    background: #fafafa;
    font-size: 11px;
    color: #9ca3af;
  }

  .print-btn {
    display: block;
    max-width: 680px;
    margin: 16px auto;
    padding: 12px 32px;
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }
  .print-btn:hover { background: #1d4ed8; }

  @media print {
    body { background: white; padding: 0; }
    .receipt { box-shadow: none; border-radius: 0; }
    .print-btn { display: none !important; }
  }
</style>
</head>
<body>
<div class="receipt">
  <div class="header">
    <h1>ĐÀO TẠO LÁI XE THẦY DUY</h1>
    <div class="subtitle">${receipt.branch?.name || "Chi nhánh"}</div>
    <div class="receipt-number">BIÊN LAI #${receipt.id.slice(-8).toUpperCase()}</div>
  </div>

  <div class="body">
    <div class="section">
      <div class="section-title">Thông tin học viên</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Họ tên</span>
          <span class="info-value">${receipt.student.lead.fullName || "—"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Số điện thoại</span>
          <span class="info-value">${receipt.student.lead.phone || "—"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Hạng bằng</span>
          <span class="info-value">${receipt.student.lead.licenseType || "—"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Khóa học</span>
          <span class="info-value">${receipt.student.course?.code || "—"}</span>
        </div>
      </div>
    </div>

    <div class="amount-box">
      <div class="amount-label">Số tiền đã thu</div>
      <div class="amount-value">${formatCurrency(receipt.amount)}</div>
      <div class="amount-words">Bằng chữ: ${numberToVietnameseWords(receipt.amount)}</div>
    </div>

    <div class="section">
      <div class="section-title">Chi tiết thanh toán</div>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Hình thức</span>
          <span class="info-value">${methodLabel(receipt.method)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Ngày thu</span>
          <span class="info-value">${formatDate(receipt.receivedAt)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Người thu</span>
          <span class="info-value">${receipt.createdBy?.name || receipt.createdBy?.email || "—"}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Ghi chú</span>
          <span class="info-value">${receipt.note || "—"}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="signature-block">
      <div class="title">Người nộp tiền</div>
      <div class="line">(Ký, ghi rõ họ tên)</div>
    </div>
    <div class="signature-block">
      <div class="title">Người thu tiền</div>
      <div class="line">(Ký, ghi rõ họ tên)</div>
    </div>
  </div>

  <div class="stamp">
    Ngày tạo: ${formatDate(receipt.createdAt)} • Mã: ${receipt.id}
  </div>
</div>

<button class="print-btn" onclick="window.print()">🖨️ In biên lai / Lưu PDF</button>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[receipt.pdf.GET]", err);
    return jsonError(500, "INTERNAL_ERROR", "Lỗi khi tạo biên lai PDF");
  }
}
