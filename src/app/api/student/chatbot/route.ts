import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Student AI Chatbot — GPT-powered with personalized DB context
 * POST /api/student/chatbot
 * Body: { message: string, history?: Array<{role: string, content: string}> }
 * Auth: student_access_token cookie (optional — for personalization)
 * 
 * Uses OpenAI GPT-4o-mini with driving school knowledge context.
 * Falls back to FAQ answers if OpenAI is unavailable.
 */

const SYSTEM_PROMPT = `Bạn là trợ lý AI thông minh của Trung tâm Đào tạo Lái xe Thầy Duy.

## VAI TRÒ
- Tên: Trợ lý Thầy Duy
- Nhiệm vụ: Hỗ trợ học viên về các vấn đề liên quan đến đào tạo lái xe
- Ngôn ngữ: Tiếng Việt, thân thiện, dùng emoji phù hợp
- Giọng điệu: Nhiệt tình, chuyên nghiệp, dễ hiểu

## KIẾN THỨC

### Thông tin trung tâm
- 📞 Hotline: 0948 742 666
- 💬 Zalo: 0948 742 666
- 🌐 Website: thayduydaotaolaixe.com
- ⏰ Thời gian: 7:00 - 21:00 hàng ngày

### Các hạng bằng & học phí (tham khảo)
| Hạng | Học phí | Thời gian |
|------|---------|-----------|
| B1 (số tự động) | ~15-18 triệu | 3-4 tháng |
| B2 (số sàn) | ~18-22 triệu | 3-6 tháng |
| C | ~25-30 triệu | 4-6 tháng |
Bao gồm: Đào tạo + thi lý thuyết + thi thực hành + mô phỏng. Hỗ trợ trả góp.

### Quy trình học
1. Đăng ký — Nộp hồ sơ + học phí
2. Học lý thuyết — 30 giờ trên lớp + ôn app (600 câu)
3. Thi lý thuyết — 25 câu, đạt ≥21 câu đúng
4. Học mô phỏng — Luyện 120 tình huống trên app
5. Thi mô phỏng — 50 câu / 30 phút, đạt ≥45 câu đúng
6. Học thực hành — 14 buổi (B2)
7. Thi thực hành — Sa hình + đường trường
8. Nhận bằng — 7-15 ngày sau thi

### Mẹo thi lý thuyết
- **20 câu điểm liệt** — sai 1 câu liệt = rớt ngay
- Chủ yếu: nồng độ cồn (0.0mg/l), tốc độ khu dân cư (50km/h), biển cấm
- Biển tròn = bắt buộc, tam giác = cảnh báo, vuông = chỉ dẫn
- Nhường đường: Xe ưu tiên > Biển báo > Vạch kẻ > Xe bên phải
- Khoảng cách: ≤60km/h: 35m, >60km/h: 55m

### Mẹo thi mô phỏng (120 tình huống)
- Phanh sớm — thấy nguy hiểm nhấn phanh ngay
- Ngã tư: giảm tốc + quan sát dù đèn xanh
- Người đi bộ: luôn nhường (trẻ em, người già)
- Trời mưa/đêm: giảm 10-20% tốc độ
- 50 câu / 30 phút → mỗi câu ~36 giây

### Lịch học chung
- Ca sáng: 7:00 - 11:00
- Ca chiều: 13:00 - 17:00
- Ca tối: 18:00 - 21:00

## QUY TẮC
1. Trả lời NGẮN GỌN (tối đa 200 từ), dùng markdown formatting
2. Khi không biết → nói rõ và gợi ý liên hệ hotline
3. KHÔNG bịa thông tin, đặc biệt về giá và lịch
4. Nếu câu hỏi ngoài phạm vi đào tạo lái xe → lịch sự từ chối và hướng dẫn lại
5. Khi có thông tin cá nhân học viên → cá nhân hoá câu trả lời`;

const FAQ_FALLBACK: Record<string, { keywords: string[]; answer: string }> = {
    greeting: {
        keywords: ["xin chao", "hello", "chao", "hey", "alo", "bat dau", "xin chào"],
        answer: "Xin chào! 👋 Tôi là trợ lý AI của Thầy Duy. Tôi có thể giúp bạn:\n\n📅 Xem lịch học\n📊 Tiến độ học tập\n📝 Mẹo thi lý thuyết\n🚗 Mẹo thi mô phỏng\n💰 Thông tin học phí\n📞 Liên hệ hỗ trợ\n\nBạn muốn hỏi gì?",
    },
    theory: {
        keywords: ["ly thuyet", "600 cau", "thi ly thuyet", "on thi", "cau liet", "meo thi ly"],
        answer: "📝 **Mẹo thi lý thuyết B2:**\n\n1. **Câu liệt** (sai là rớt): Nhớ 20 câu điểm liệt\n2. **Biển báo**: Tròn = bắt buộc, tam giác = cảnh báo, vuông = chỉ dẫn\n3. **Nhường đường**: Xe ưu tiên > Biển báo > Vạch kẻ > Xe bên phải\n4. **Tốc độ**: Khu dân cư 50km/h, ngoài 80km/h\n5. **Khoảng cách**: ≤60km/h: 35m, >60km/h: 55m\n\n💡 Luyện đủ 600 câu trên app ít nhất 3 lần!",
    },
    simulation: {
        keywords: ["mo phong", "120 tinh huong", "tinh huong", "phanh", "simulation"],
        answer: "🚗 **Mẹo thi mô phỏng:**\n\n1. **Phanh sớm** — Thấy nguy hiểm nhấn phanh ngay\n2. **Ngã tư**: Giảm tốc + quan sát dù đèn xanh\n3. **Người đi bộ**: Luôn nhường\n4. **Trời mưa/đêm**: Giảm 10-20% tốc độ\n\n⏱️ 50 câu / 30 phút → ~36 giây/câu\n🎯 Đạt: ≥45/50 câu đúng",
    },
    fee: {
        keywords: ["hoc phi", "phi", "gia", "bao nhieu tien", "tra gop"],
        answer: "💰 **Học phí (tham khảo):**\n\n| Hạng | Học phí |\n|------|--------|\n| B1 (số tự động) | ~15-18 triệu |\n| B2 (số sàn) | ~18-22 triệu |\n| C | ~25-30 triệu |\n\n📝 Bao gồm: Đào tạo + thi LT + thi TH + mô phỏng\n💳 Hỗ trợ trả góp\n📞 Hotline: 0948 742 666",
    },
    contact: {
        keywords: ["lien he", "so dien thoai", "hotline", "zalo", "goi", "tu van"],
        answer: "📞 **Liên hệ Thầy Duy:**\n\n📱 Hotline: **0948 742 666**\n💬 Zalo: 0948 742 666\n🌐 thayduydaotaolaixe.com\n⏰ 7:00 - 21:00 hàng ngày",
    },
    process: {
        keywords: ["quy trinh", "cac buoc", "hoc lai xe", "dang ky", "bao lau", "thoi gian"],
        answer: "📋 **Quy trình học lái xe:**\n\n1️⃣ Đăng ký — Nộp hồ sơ + học phí\n2️⃣ Học lý thuyết — 30 giờ\n3️⃣ Thi lý thuyết — ≥21/25\n4️⃣ Học mô phỏng — 120 tình huống\n5️⃣ Thi mô phỏng — ≥45/50\n6️⃣ Học thực hành — 14 buổi\n7️⃣ Thi thực hành — Sa hình + đường trường\n8️⃣ Nhận bằng — 7-15 ngày\n\n⏱️ Tổng: 3-6 tháng",
    },
};

function normalize(s: string): string {
    return s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d").replace(/Đ/g, "D");
}

function findFaqAnswer(message: string): string | null {
    const norm = normalize(message);
    // Use word-boundary-like matching: check for space-separated words
    for (const [, faq] of Object.entries(FAQ_FALLBACK)) {
        if (faq.keywords.some(k => {
            const nk = normalize(k);
            // For multi-word keywords, check substring
            if (nk.includes(" ")) return norm.includes(nk);
            // For single-word keywords, check word boundary
            const regex = new RegExp(`(^|\\s|[^a-z])${nk}($|\\s|[^a-z])`, "i");
            return regex.test(norm);
        })) {
            return faq.answer;
        }
    }
    return null;
}

async function getStudentContext(studentId: string): Promise<string> {
    try {
        const student = await prisma.student.findUnique({
            where: { id: studentId },
            select: {
                studyStatus: true,
                examDate: true,
                examStatus: true,
                lead: { select: { fullName: true, licenseType: true } },
                _count: { select: { practicalLessons: true, receipts: true } },
            },
        });
        if (!student) return "";

        const statusMap: Record<string, string> = {
            studying: "đang học", paused: "tạm nghỉ",
            completed: "hoàn thành", dropped: "nghỉ học",
        };

        return `\n\n## THÔNG TIN HỌC VIÊN (cá nhân hoá câu trả lời)
- Tên: ${student.lead.fullName || "N/A"}
- Hạng bằng: ${student.lead.licenseType || "B2"}
- Trạng thái: ${statusMap[student.studyStatus] || student.studyStatus}
- Buổi thực hành: ${student._count.practicalLessons} buổi
- Số lần đóng phí: ${student._count.receipts}${student.examDate ? `\n- Ngày thi dự kiến: ${new Intl.DateTimeFormat("vi-VN").format(student.examDate)}` : ""}`;
    } catch {
        return "";
    }
}

export async function POST(req: Request) {
    // Optional auth for personalization
    let studentId: string | null = null;
    try {
        const cookie = req.headers.get("cookie") || "";
        const match = cookie.match(/student_access_token=([^;]+)/);
        if (match) {
            const { verifyAccessToken } = await import("@/lib/jwt");
            const payload = verifyAccessToken(match[1]);
            studentId = payload?.sub || null;
        }
        if (!studentId) {
            const bearer = req.headers.get("authorization")?.replace("Bearer ", "");
            if (bearer) {
                const { verifyAccessToken } = await import("@/lib/jwt");
                const payload = verifyAccessToken(bearer);
                studentId = payload?.sub || null;
            }
        }
    } catch { /* unauthenticated is fine */ }

    try {
        const body = await req.json().catch(() => null);
        const message = body?.message?.trim();
        const history = body?.history || [];
        if (!message || message.length < 1) {
            return NextResponse.json({ error: "Vui lòng nhập câu hỏi" }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;

        // If no API key, use FAQ fallback
        if (!apiKey) {
            const faqAnswer = findFaqAnswer(message);
            return NextResponse.json({
                message,
                answer: faqAnswer || "🤔 Xin lỗi, tôi chưa hiểu. Gọi **0948 742 666** để được hỗ trợ!",
                intent: faqAnswer ? "faq" : "fallback",
                personalized: false,
                mode: "faq",
            });
        }

        // Build system prompt with student context
        let systemPrompt = SYSTEM_PROMPT;
        if (studentId) {
            const ctx = await getStudentContext(studentId);
            systemPrompt += ctx;
        }

        // Build messages array
        const messages: Array<{ role: string; content: string }> = [
            { role: "system", content: systemPrompt },
        ];

        // Add conversation history (max 10 messages)
        const recentHistory = history.slice(-10);
        for (const msg of recentHistory) {
            if (msg.role === "user" || msg.role === "assistant") {
                messages.push({ role: msg.role, content: msg.content });
            }
        }

        // Current message
        messages.push({ role: "user", content: message });

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages,
                max_tokens: 500,
                temperature: 0.5,
            }),
        });

        if (!openaiRes.ok) {
            const errText = await openaiRes.text();
            console.error("[chatbot] OpenAI error:", openaiRes.status, errText);
            // Fallback to FAQ
            const faqAnswer = findFaqAnswer(message);
            return NextResponse.json({
                message,
                answer: faqAnswer || "⚠️ Hệ thống AI tạm thời không khả dụng. Gọi **0948 742 666** để được hỗ trợ!",
                intent: faqAnswer ? "faq_fallback" : "error_fallback",
                personalized: !!studentId,
                mode: "fallback",
            });
        }

        const data = (await openaiRes.json()) as {
            choices: Array<{ message: { content: string } }>;
            usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const answer = data.choices?.[0]?.message?.content || "Không có câu trả lời.";

        return NextResponse.json({
            message,
            answer,
            intent: "ai",
            personalized: !!studentId,
            mode: "gpt",
            usage: data.usage,
        });
    } catch (err) {
        console.error("[student.chatbot]", err);
        return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
    }
}
