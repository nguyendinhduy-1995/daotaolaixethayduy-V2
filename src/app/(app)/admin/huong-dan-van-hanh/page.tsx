import Link from "next/link";

export default function AdminHuongDanVanHanhPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Hướng dẫn vận hành</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Tài liệu này giúp đội vận hành làm việc theo đúng thứ tự: xem số liệu, xử lý việc ưu tiên, theo dõi nhật ký và phản hồi để hệ thống ngày càng sát thực tế.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">1) Mục tiêu</h2>
        <p className="mt-2 text-sm text-zinc-700">
          Giữ luồng xử lý đều mỗi ngày: không rơi khách, không trễ nhắc việc, và giữ tỉ lệ KPI phần trăm theo mục tiêu đã đặt.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">2) Ai dùng</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Trực Page: theo dõi tỉ lệ lấy được số và xử lý data chưa có số.</li>
          <li>Tư vấn: theo dõi hẹn/đến/ký theo phần trăm và danh sách gọi nhắc.</li>
          <li>Quản lý: theo dõi tổng quan chi nhánh và phân việc ưu tiên.</li>
          <li>Quản trị: kiểm soát quyền, luồng tự động, nhật ký và cấu hình tích hợp.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">3) Dữ liệu vào</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Khách hàng và lịch sử tương tác từ CRM.</li>
          <li>KPI phần trăm theo ngày/tháng từ màn hình KPI.</li>
          <li>Việc cần làm và nhật ký tự động hóa do hệ thống ghi lại.</li>
          <li>Dữ liệu tự động từ n8n gửi về qua API ingest.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">4) Thao tác theo ca</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
          <li>Vào KPI ngày để xem tỉ lệ phần trăm hiện tại.</li>
          <li>Vào Trợ lý công việc để xem gợi ý ưu tiên.</li>
          <li>Bấm tạo gọi nhắc hoặc tạo việc cần làm để giao cho đúng người.</li>
          <li>Cuối ca kiểm tra nhật ký tự động để xử lý lỗi còn tồn.</li>
          <li>Phản hồi Đúng, hữu ích hoặc Chưa đúng để hệ thống học dần.</li>
        </ol>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">5) Lỗi thường gặp</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Không thấy dữ liệu: kiểm tra quyền tài khoản theo chi nhánh/phụ trách.</li>
          <li>Không tạo được gọi nhắc: kiểm tra quyền thao tác gửi tin và thông tin liên hệ.</li>
          <li>Không có gợi ý mới: kiểm tra luồng tự động n8n và token tích hợp.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">6) Cách kiểm tra nhanh</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>
            Màn hình:
            {" "}
            <Link className="text-blue-700 hover:underline" href="/kpi/daily">/kpi/daily</Link>
            ,{" "}
            <Link className="text-blue-700 hover:underline" href="/ai/kpi-coach">/ai/kpi-coach</Link>
            ,{" "}
            <Link className="text-blue-700 hover:underline" href="/automation/logs">/automation/logs</Link>
            ,{" "}
            <Link className="text-blue-700 hover:underline" href="/api-hub">/api-hub</Link>.
          </li>
          <li>
            API quan trọng:
            {" "}
            <code>/api/kpi/daily</code>,
            {" "}
            <code>/api/ai/suggestions</code>,
            {" "}
            <code>/api/tasks</code>,
            {" "}
            <code>/api/automation/logs</code>,
            {" "}
            <code>/api/admin/n8n/workflows</code>.
          </li>
        </ul>
      </section>
    </div>
  );
}
