/**
 * Generate 3 DOCX files:
 *   1. docs/bao-cao-phan-quyen.docx   – Permission report
 *   2. docs/huong-dan-truong-phong.docx – Manager user guide
 *   3. docs/huong-dan-nhan-vien.docx   – Staff user guide
 *
 * Run: npx tsx scripts/generate-docs.ts
 */
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, BorderStyle } from "docx";
import * as fs from "fs";
import * as path from "path";

const DOMAIN = "https://crm.thayduydaotaolaixe.com";

// ─── Permission data ──────────────────────────────────────
const MODULE_LABELS: Record<string, string> = {
    overview: "Tổng quan (Dashboard)",
    leads: "Khách hàng (Leads)",
    leads_board: "Bảng Kanban Lead",
    kpi_daily: "KPI hàng ngày",
    kpi_targets: "Mục tiêu KPI",
    goals: "Mục tiêu doanh thu",
    ai_kpi_coach: "AI KPI Coach",
    ai_suggestions: "Gợi ý AI",
    students: "Học viên",
    courses: "Khoá học",
    schedule: "Lịch học / Điểm danh",
    receipts: "Biên lai / Phiếu thu",
    notifications: "Thông báo / Công việc",
    outbound_jobs: "Chiến dịch gửi tin",
    messaging: "Gửi tin nhắn (Zalo/SMS)",
    my_payroll: "Bảng lương cá nhân",
    ops_ai_hr: "Ops AI HR",
    ops_n8n: "N8N Workflows",
    automation_logs: "Automation Logs",
    automation_run: "Chạy Automation",
    marketing_meta_ads: "Marketing / Meta Ads",
    admin_branches: "Quản lý chi nhánh",
    admin_users: "Quản lý nhân sự",
    admin_segments: "Phân khúc khách",
    admin_tuition: "Bảng giá học phí",
    admin_notification_admin: "Cài đặt thông báo",
    admin_automation_admin: "Cài đặt Automation",
    admin_send_progress: "Gửi tiến độ",
    admin_plans: "Quản lý kế hoạch",
    admin_student_content: "Nội dung học viên",
    admin_instructors: "Giáo viên",
    hr_kpi: "KPI nhân viên",
    hr_payroll_profiles: "Hồ sơ lương",
    hr_attendance: "Chấm công",
    hr_total_payroll: "Bảng lương tổng",
    api_hub: "API Hub",
    expenses: "Chi phí",
    salary: "Lương cơ bản",
    insights: "Phân tích chi phí",
    admin_tracking: "Mã tracking",
};

const ACTION_LABELS: Record<string, string> = {
    VIEW: "Xem",
    CREATE: "Tạo",
    UPDATE: "Sửa",
    FEEDBACK: "Phản hồi",
    EDIT: "Chỉnh sửa",
    DELETE: "Xóa",
    EXPORT: "Xuất",
    ASSIGN: "Gán",
    RUN: "Chạy",
    INGEST: "Nhập dữ liệu",
};

const STAFF_PERMISSIONS: Record<string, string[]> = {
    overview: ["VIEW"],
    leads: ["VIEW", "CREATE", "UPDATE"],
    leads_board: ["VIEW"],
    kpi_daily: ["VIEW"],
    goals: ["VIEW"],
    schedule: ["VIEW"],
    receipts: ["VIEW", "CREATE"],
    notifications: ["VIEW", "UPDATE"],
    my_payroll: ["VIEW"],
    outbound_jobs: ["VIEW"],
    messaging: ["VIEW"],
};

const MANAGER_PERMISSIONS: Record<string, string[]> = {
    overview: ["VIEW"],
    leads: ["VIEW", "CREATE", "UPDATE", "DELETE", "EXPORT", "ASSIGN"],
    leads_board: ["VIEW"],
    students: ["VIEW", "CREATE", "UPDATE"],
    courses: ["VIEW", "CREATE", "UPDATE"],
    schedule: ["VIEW", "CREATE", "UPDATE"],
    receipts: ["VIEW", "CREATE", "UPDATE"],
    kpi_daily: ["VIEW"],
    kpi_targets: ["VIEW", "EDIT"],
    goals: ["VIEW", "EDIT"],
    ai_suggestions: ["VIEW", "CREATE", "FEEDBACK"],
    notifications: ["VIEW", "CREATE", "UPDATE"],
    outbound_jobs: ["VIEW", "CREATE"],
    messaging: ["VIEW", "CREATE"],
    my_payroll: ["VIEW"],
    hr_attendance: ["VIEW", "CREATE", "UPDATE"],
    hr_kpi: ["VIEW", "CREATE"],
    expenses: ["VIEW", "EDIT"],
    insights: ["VIEW"],
    automation_logs: ["VIEW"],
    marketing_meta_ads: ["VIEW"],
    admin_branches: ["VIEW"],
    admin_tuition: ["VIEW"],
};

function cellP(text: string, bold = false) {
    return new Paragraph({ children: [new TextRun({ text, bold, size: 20, font: "Arial" })] });
}

function headerCell(text: string) {
    return new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: "Arial", color: "FFFFFF" })] })],
        shading: { fill: "2563EB" },
        width: { size: 3000, type: WidthType.DXA },
    });
}

function dataCell(text: string, width = 3000) {
    return new TableCell({
        children: [cellP(text)],
        width: { size: width, type: WidthType.DXA },
    });
}

function heading(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
    return new Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function para(text: string, bold = false) {
    return new Paragraph({ children: [new TextRun({ text, bold, size: 22, font: "Arial" })], spacing: { after: 80 } });
}

function bulletItem(text: string) {
    return new Paragraph({
        children: [new TextRun({ text, size: 22, font: "Arial" })],
        bullet: { level: 0 },
        spacing: { after: 40 },
    });
}

// ─── 1. BÁO CÁO PHÂN QUYỀN ──────────────────────────────
function createPermissionReport(): Document {
    const sections: Paragraph[] = [];
    sections.push(heading("BÁO CÁO PHÂN QUYỀN HỆ THỐNG CRM"));
    sections.push(para("Thầy Duy Đào Tạo Lái Xe – CRM"));
    sections.push(para(`Ngày: ${new Date().toLocaleDateString("vi-VN")}`));
    sections.push(para(""));

    sections.push(heading("1. Tổng quan", HeadingLevel.HEADING_2));
    sections.push(para("Hệ thống CRM sử dụng mô hình phân quyền RBAC (Role-Based Access Control) với 3 nhóm quyền mặc định:"));
    sections.push(bulletItem("Nhân viên – 11 module, 15 quyền: Quyền cơ bản cho telesales, nhân viên kinh doanh"));
    sections.push(bulletItem("Trưởng phòng – 23 module, 48 quyền: Quản lý lead, học viên, khoá học, HR cơ bản, chi phí"));
    sections.push(bulletItem("Quản trị – 40 module, 400 quyền: Full quyền toàn hệ thống"));
    sections.push(para(""));

    sections.push(heading("2. Ma trận phân quyền chi tiết", HeadingLevel.HEADING_2));

    // Build permission table
    const buildTable = (name: string, perms: Record<string, string[]>) => {
        sections.push(heading(`2.${name === "Nhân viên" ? "1" : "2"} ${name}`, HeadingLevel.HEADING_3));
        const rows = [
            new TableRow({
                children: [headerCell("Module"), headerCell("Quyền được cấp"), headerCell("Mô tả")],
                tableHeader: true,
            }),
        ];
        for (const [mod, actions] of Object.entries(perms)) {
            rows.push(new TableRow({
                children: [
                    dataCell(MODULE_LABELS[mod] || mod),
                    dataCell(actions.map(a => ACTION_LABELS[a] || a).join(", ")),
                    dataCell(getModuleDescription(mod)),
                ],
            }));
        }
        sections.push(new Paragraph({ text: "" }));
        return new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
        });
    };

    const tables: (Paragraph | Table)[] = [...sections];
    tables.push(buildTable("Nhân viên", STAFF_PERMISSIONS));
    tables.push(para(""));
    tables.push(buildTable("Trưởng phòng", MANAGER_PERMISSIONS));
    tables.push(para(""));

    tables.push(heading("3. So sánh nhanh", HeadingLevel.HEADING_2));
    const compareRows = [
        new TableRow({ children: [headerCell("Chức năng"), headerCell("Nhân viên"), headerCell("Trưởng phòng"), headerCell("Quản trị")], tableHeader: true }),
    ];
    const allMods = [...new Set([...Object.keys(STAFF_PERMISSIONS), ...Object.keys(MANAGER_PERMISSIONS)])].sort();
    for (const mod of allMods) {
        compareRows.push(new TableRow({
            children: [
                dataCell(MODULE_LABELS[mod] || mod),
                dataCell(STAFF_PERMISSIONS[mod] ? "✅ " + STAFF_PERMISSIONS[mod].map(a => ACTION_LABELS[a]).join(", ") : "❌"),
                dataCell(MANAGER_PERMISSIONS[mod] ? "✅ " + MANAGER_PERMISSIONS[mod].map(a => ACTION_LABELS[a]).join(", ") : "❌"),
                dataCell("✅ Full"),
            ],
        }));
    }
    tables.push(new Table({ rows: compareRows, width: { size: 100, type: WidthType.PERCENTAGE } }));

    tables.push(para(""));
    tables.push(heading("4. Ghi chú", HeadingLevel.HEADING_2));
    tables.push(bulletItem("Admin (Quản trị) có quyền cao nhất, truy cập mọi module và action."));
    tables.push(bulletItem("Trưởng phòng KHÔNG có quyền: quản lý nhân sự (admin_users), cài đặt automation, N8N, ops."));
    tables.push(bulletItem("Nhân viên KHÔNG được: xóa/export lead, quản lý học viên, tạo lịch, sửa KPI."));
    tables.push(bulletItem("Mỗi user có thể được gán vào 1 nhóm quyền. Admin có thể override quyền cho từng cá nhân."));

    return new Document({ sections: [{ children: tables as (Paragraph | Table)[] }] });
}

function getModuleDescription(mod: string): string {
    const desc: Record<string, string> = {
        overview: "Xem dashboard tổng quan doanh thu, leads, conversion",
        leads: "Quản lý khách hàng trong pipeline bán hàng",
        leads_board: "Xem bảng Kanban trạng thái khách hàng",
        kpi_daily: "Xem KPI doanh thu/hồ sơ theo ngày",
        kpi_targets: "Thiết lập và xem mục tiêu KPI",
        goals: "Đặt mục tiêu doanh thu, hồ sơ, chi phí",
        ai_suggestions: "Nhận gợi ý công việc từ AI",
        students: "Quản lý thông tin học viên",
        courses: "Quản lý khoá học, kỳ thi",
        schedule: "Lịch học, lịch thi, điểm danh",
        receipts: "Nhập và quản lý biên lai thu tiền",
        notifications: "Xem thông báo, đánh dấu đã đọc",
        outbound_jobs: "Tạo và xem chiến dịch gửi tin",
        messaging: "Xem tin nhắn đã gửi qua Zalo/SMS",
        my_payroll: "Xem bảng lương cá nhân",
        hr_attendance: "Chấm công nhân viên",
        hr_kpi: "Thiết lập KPI cho nhân viên",
        expenses: "Nhập và xem chi phí hàng ngày",
        insights: "Phân tích chi phí theo thời gian",
        automation_logs: "Xem nhật ký tự động hoá",
        marketing_meta_ads: "Xem báo cáo quảng cáo Meta",
        admin_branches: "Quản lý chi nhánh",
        admin_tuition: "Xem bảng giá học phí",
    };
    return desc[mod] || "";
}

// ─── 2. HƯỚNG DẪN TRƯỞNG PHÒNG ──────────────────────────
function createManagerGuide(): Document {
    const children: (Paragraph | Table)[] = [];
    children.push(heading("HƯỚNG DẪN SỬ DỤNG CRM – TRƯỞNG PHÒNG"));
    children.push(para("Thầy Duy Đào Tạo Lái Xe"));
    children.push(para(`Phiên bản: ${new Date().toLocaleDateString("vi-VN")}`));
    children.push(para(""));

    children.push(heading("1. Đăng nhập", HeadingLevel.HEADING_2));
    children.push(para(`Truy cập: ${DOMAIN}/login`));
    children.push(bulletItem("Nhập tài khoản (username) và mật khẩu được admin cấp"));
    children.push(bulletItem("Sau khi đăng nhập, hệ thống tự chuyển đến Dashboard"));
    children.push(bulletItem("Phiên đăng nhập có thời hạn 24h, sau đó cần đăng nhập lại"));
    children.push(para(""));

    children.push(heading("2. Dashboard – Tổng quan", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/dashboard`));
    children.push(bulletItem("Xem tổng số leads mới, hồ sơ, doanh thu trong ngày/tháng"));
    children.push(bulletItem("Biểu đồ KPI theo ngày với phần trăm mục tiêu"));
    children.push(bulletItem("Danh sách việc cần làm (thông báo, lead cần follow-up)"));
    children.push(para(""));

    children.push(heading("3. Quản lý Khách hàng (Leads)", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/leads`));
    children.push(heading("3.1 Xem và tìm kiếm", HeadingLevel.HEADING_3));
    children.push(bulletItem("Danh sách leads với bộ lọc: trạng thái, tỉnh, hạng bằng, người phụ trách"));
    children.push(bulletItem("Tìm kiếm theo tên hoặc SĐT"));
    children.push(bulletItem("Bấm vào lead để xem chi tiết: thông tin, lịch sử sự kiện, ghi chú"));
    children.push(heading("3.2 Tạo lead mới", HeadingLevel.HEADING_3));
    children.push(bulletItem("Bấm nút '+' hoặc 'Thêm khách hàng'"));
    children.push(bulletItem("Nhập: Họ tên, SĐT, Tỉnh, Hạng bằng, Nguồn, Kênh, Ghi chú"));
    children.push(heading("3.3 Gán lead cho nhân viên", HeadingLevel.HEADING_3));
    children.push(bulletItem("Trong chi tiết lead → chọn 'Gán cho' → chọn nhân viên"));
    children.push(bulletItem("Gán hàng loạt: chọn checkbox nhiều leads → 'Gán hàng loạt'"));
    children.push(bulletItem("Auto-assign: nếu bật tính năng, leads tự động gán theo chi nhánh/tỉnh"));
    children.push(heading("3.4 Export dữ liệu", HeadingLevel.HEADING_3));
    children.push(bulletItem("Bấm 'Xuất CSV' để tải danh sách lead ra file Excel"));
    children.push(heading("3.5 Xóa lead", HeadingLevel.HEADING_3));
    children.push(bulletItem("Mở chi tiết lead → bấm 🗑️ Xóa → xác nhận"));
    children.push(bulletItem("Chỉ xóa được lead chưa chuyển thành học viên"));
    children.push(para(""));

    children.push(heading("4. Bảng Kanban", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/leads/board`));
    children.push(bulletItem("Xem leads theo cột trạng thái (Mới, Liên hệ, Đang tư vấn, Chốt, Mất)"));
    children.push(bulletItem("Kéo thả lead giữa các cột để chuyển trạng thái"));
    children.push(para(""));

    children.push(heading("5. Học viên", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/students`));
    children.push(bulletItem("Xem danh sách học viên, tìm kiếm theo tên/SĐT"));
    children.push(bulletItem("Tạo học viên mới từ lead đã chốt hoặc tạo trực tiếp"));
    children.push(bulletItem("Xem chi tiết: thông tin cá nhân, tài chính (biên lai), lịch học"));
    children.push(bulletItem("Cập nhật trạng thái: Đang học, Hoàn thành, Bảo lưu"));
    children.push(para(""));

    children.push(heading("6. Khoá học", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/courses`));
    children.push(bulletItem("Tạo khoá học mới: mã khoá, tỉnh, hạng bằng, ngày thi"));
    children.push(bulletItem("Gán học viên vào khoá"));
    children.push(bulletItem("Xem lịch thi, lịch học của khoá"));
    children.push(para(""));

    children.push(heading("7. Lịch học / Điểm danh", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/schedule`));
    children.push(bulletItem("Xem lịch học theo tuần/tháng"));
    children.push(bulletItem("Tạo buổi học mới, chỉnh sửa thời gian"));
    children.push(bulletItem("Điểm danh: đánh dấu có mặt/vắng cho học viên"));
    children.push(para(""));

    children.push(heading("8. Biên lai / Phiếu thu", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/receipts`));
    children.push(bulletItem("Tạo biên lai thu tiền cho học viên"));
    children.push(bulletItem("Nhập số tiền, loại phí, ghi chú"));
    children.push(bulletItem("Xem tổng thu theo ngày/tháng"));
    children.push(bulletItem("Sửa biên lai nếu nhập sai"));
    children.push(para(""));

    children.push(heading("9. KPI & Mục tiêu", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/kpi/daily, ${DOMAIN}/goals`));
    children.push(bulletItem("Xem KPI doanh thu, hồ sơ mới, leads theo ngày"));
    children.push(bulletItem("Thiết lập mục tiêu KPI cho team"));
    children.push(bulletItem("Đặt mục tiêu doanh thu và theo dõi tiến độ"));
    children.push(para(""));

    children.push(heading("10. Chấm công & HR", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/hr/attendance, ${DOMAIN}/hr/kpi`));
    children.push(bulletItem("Chấm công nhân viên trong phòng"));
    children.push(bulletItem("Thiết lập KPI cho từng nhân viên"));
    children.push(bulletItem("Xem bảng lương cá nhân tại /me/payroll"));
    children.push(para(""));

    children.push(heading("11. Chi phí", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/expenses`));
    children.push(bulletItem("Nhập chi phí hàng ngày theo danh mục"));
    children.push(bulletItem("Xem tổng hợp chi phí theo tháng"));
    children.push(bulletItem("Xem phân tích chi phí (insights)"));
    children.push(para(""));

    children.push(heading("12. Gợi ý AI", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/ai`));
    children.push(bulletItem("Nhận gợi ý công việc ưu tiên từ AI dựa trên dữ liệu KPI"));
    children.push(bulletItem("Đánh giá gợi ý (hữu ích / không hữu ích) để AI học hỏi"));
    children.push(para(""));

    children.push(heading("13. Thông báo", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/notifications`));
    children.push(bulletItem("Xem thông báo: nhắc follow-up, nhắc thu tiền, lịch học"));
    children.push(bulletItem("Tạo thông báo mới cho team"));
    children.push(bulletItem("Đánh dấu đã xử lý"));
    children.push(para(""));

    children.push(heading("14. Tin nhắn & Chiến dịch", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/outbound`));
    children.push(bulletItem("Xem danh sách chiến dịch gửi tin"));
    children.push(bulletItem("Tạo chiến dịch gửi Zalo/SMS cho nhóm leads"));
    children.push(bulletItem("Xem kết quả gửi tin (đã gửi, thất bại)"));

    return new Document({ sections: [{ children }] });
}

// ─── 3. HƯỚNG DẪN NHÂN VIÊN ──────────────────────────────
function createStaffGuide(): Document {
    const children: (Paragraph | Table)[] = [];
    children.push(heading("HƯỚNG DẪN SỬ DỤNG CRM – NHÂN VIÊN"));
    children.push(para("Thầy Duy Đào Tạo Lái Xe"));
    children.push(para(`Phiên bản: ${new Date().toLocaleDateString("vi-VN")}`));
    children.push(para(""));

    children.push(heading("1. Đăng nhập", HeadingLevel.HEADING_2));
    children.push(para(`Truy cập: ${DOMAIN}/login`));
    children.push(bulletItem("Nhập tên đăng nhập và mật khẩu do quản lý cấp"));
    children.push(bulletItem("Sau khi đăng nhập sẽ vào trang Dashboard"));
    children.push(bulletItem("Nếu quên mật khẩu, liên hệ admin để reset"));
    children.push(para(""));

    children.push(heading("2. Dashboard", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/dashboard`));
    children.push(bulletItem("Xem tổng quan công việc: leads được giao, KPI cá nhân"));
    children.push(bulletItem("Danh sách thông báo và việc cần làm"));
    children.push(para(""));

    children.push(heading("3. Quản lý Khách hàng", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/leads`));
    children.push(para("Đây là màn hình làm việc chính của nhân viên."));
    children.push(heading("3.1 Xem danh sách", HeadingLevel.HEADING_3));
    children.push(bulletItem("Xem leads được giao cho mình"));
    children.push(bulletItem("Lọc theo trạng thái: Mới, Đang liên hệ, Tư vấn, Chốt, Mất"));
    children.push(bulletItem("Tìm kiếm theo tên hoặc SĐT"));
    children.push(heading("3.2 Tạo lead mới", HeadingLevel.HEADING_3));
    children.push(bulletItem("Bấm nút '+' phía trên bên phải"));
    children.push(bulletItem("Nhập thông tin: Họ tên (*), SĐT (*), Tỉnh, Hạng bằng, Nguồn, Ghi chú"));
    children.push(bulletItem("(*) = Bắt buộc"));
    children.push(heading("3.3 Cập nhật lead", HeadingLevel.HEADING_3));
    children.push(bulletItem("Bấm vào lead → mở chi tiết"));
    children.push(bulletItem("Bấm ✏️ Sửa để cập nhật thông tin"));
    children.push(bulletItem("Thêm sự kiện: Gọi điện, Hẹn, Chuyển trạng thái, Ghi chú"));
    children.push(heading("3.4 Chuyển trạng thái", HeadingLevel.HEADING_3));
    children.push(bulletItem("Trong chi tiết lead → Thêm sự kiện → chọn 'Chuyển trạng thái'"));
    children.push(bulletItem("Chọn trạng thái mới (VD: Mới → Đang liên hệ → Tư vấn → Chốt)"));
    children.push(para(""));

    children.push(heading("4. Bảng Kanban", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/leads/board`));
    children.push(bulletItem("Xem trực quan leads theo trạng thái (dạng cột)"));
    children.push(bulletItem("Mỗi thẻ lead hiển thị: tên, SĐT, ngày tạo"));
    children.push(para(""));

    children.push(heading("5. KPI cá nhân", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/kpi/daily`));
    children.push(bulletItem("Xem KPI doanh thu, leads mới, hồ sơ của mình theo ngày"));
    children.push(bulletItem("So sánh với mục tiêu đã được Trưởng phòng thiết lập"));
    children.push(bulletItem("Theo dõi tiến độ luỹ kế tháng"));
    children.push(para(""));

    children.push(heading("6. Mục tiêu", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/goals`));
    children.push(bulletItem("Xem mục tiêu doanh thu/hồ sơ được giao"));
    children.push(bulletItem("Theo dõi phần trăm hoàn thành"));
    children.push(para(""));

    children.push(heading("7. Lịch học", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/schedule`));
    children.push(bulletItem("Xem lịch học của học viên mình phụ trách"));
    children.push(bulletItem("Lưu ý: Nhân viên chỉ xem, không tạo/sửa lịch"));
    children.push(para(""));

    children.push(heading("8. Biên lai", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/receipts`));
    children.push(bulletItem("Xem biên lai thu tiền đã tạo"));
    children.push(bulletItem("Tạo biên lai mới khi thu tiền từ học viên"));
    children.push(bulletItem("Nhập đúng: học viên, số tiền, loại phí"));
    children.push(para(""));

    children.push(heading("9. Thông báo", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/notifications`));
    children.push(bulletItem("Xem thông báo nhắc nhở: follow-up lead, thu tiền, lịch học"));
    children.push(bulletItem("Đánh dấu 'Đã xử lý' sau khi hoàn thành"));
    children.push(para(""));

    children.push(heading("10. Bảng lương", HeadingLevel.HEADING_2));
    children.push(para(`Đường dẫn: ${DOMAIN}/me/payroll`));
    children.push(bulletItem("Xem bảng lương cá nhân theo kỳ"));
    children.push(bulletItem("Chi tiết: lương cơ bản, hoa hồng, thưởng, khấu trừ"));
    children.push(para(""));

    children.push(heading("11. Mẹo sử dụng hiệu quả", HeadingLevel.HEADING_2));
    children.push(bulletItem("Luôn cập nhật trạng thái lead sau mỗi cuộc gọi"));
    children.push(bulletItem("Thêm ghi chú chi tiết để không quên context khi follow-up"));
    children.push(bulletItem("Kiểm tra thông báo đầu ngày để biết việc ưu tiên"));
    children.push(bulletItem("Tạo biên lai ngay khi thu tiền, không để cuối ngày"));
    children.push(bulletItem("Sử dụng bộ lọc để tìm leads cần follow-up nhanh"));

    return new Document({ sections: [{ children }] });
}

// ─── Main ─────────────────────────────────────────────────
async function main() {
    const docsDir = path.join(process.cwd(), "docs");
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const files = [
        { name: "bao-cao-phan-quyen.docx", doc: createPermissionReport() },
        { name: "huong-dan-truong-phong.docx", doc: createManagerGuide() },
        { name: "huong-dan-nhan-vien.docx", doc: createStaffGuide() },
    ];

    for (const { name, doc } of files) {
        const buffer = await Packer.toBuffer(doc);
        const filePath = path.join(docsDir, name);
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ Created: ${filePath}`);
    }

    console.log("\n🎉 All 3 DOCX files generated!");
}

main().catch((err) => {
    console.error("❌", err);
    process.exit(1);
});
