export default function AdminHuongDanAiPage() {
  return (
    <div className="space-y-4">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-500 p-4 text-white shadow-lg shadow-fuchsia-200 animate-fadeInUp">
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">🤖</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">Hướng dẫn Trợ lý công việc</h2>
            <p className="text-sm text-white/80">Dùng Trợ lý công việc hằng ngày theo cách đơn giản, dễ làm</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "80ms" }}>
        <div className="h-1 bg-gradient-to-r from-fuchsia-500 to-pink-500" />
        <div className="p-4">
          <h3 className="text-base font-semibold text-zinc-900">📊 1) Đọc KPI phần trăm như thế nào?</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            <li>Trực Page: xem tỉ lệ lấy được số trong ngày.</li>
            <li>Tư vấn: xem 3 tỉ lệ chính là hẹn từ data, đến từ hẹn, ký từ đến.</li>
            <li>Nếu tỉ lệ thấp hơn mục tiêu, ưu tiên xử lý ngay trong ca làm.</li>
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "160ms" }}>
        <div className="h-1 bg-gradient-to-r from-pink-500 to-rose-500" />
        <div className="p-4">
          <h3 className="text-base font-semibold text-zinc-900">📋 2) Dùng Trợ lý công việc hằng ngày</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            <li>Mở trang Trợ lý công việc và chọn đúng ngày cần xem.</li>
            <li>Đọc từng gợi ý theo màu: Đỏ cần làm ngay, Vàng cần theo dõi, Xanh đang ổn.</li>
            <li>Bấm &quot;Tạo danh sách gọi&quot; để đẩy việc ra hàng gọi nhanh.</li>
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "240ms" }}>
        <div className="h-1 bg-gradient-to-r from-rose-500 to-red-500" />
        <div className="p-4">
          <h3 className="text-base font-semibold text-zinc-900">💬 3) Phản hồi để hệ thống ngày càng đúng</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
            <li>Nếu gợi ý đúng: bấm &quot;Đúng, hữu ích&quot;.</li>
            <li>Nếu chưa đúng: bấm &quot;Chưa đúng&quot; và ghi chú ngắn lý do.</li>
            <li>Phản hồi càng đều thì gợi ý sau càng sát thực tế vận hành.</li>
          </ul>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm animate-fadeInUp" style={{ animationDelay: "320ms" }}>
        <div className="h-1 bg-gradient-to-r from-purple-500 to-fuchsia-500" />
        <div className="p-4">
          <h3 className="text-base font-semibold text-zinc-900">⚙️ 4) n8n chạy ra sao?</h3>
          <p className="mt-2 text-sm text-zinc-700">
            n8n là nơi xử lý tự động: lấy dữ liệu từ CRM, phân tích và gửi gợi ý về lại hệ thống.
            CRM chỉ làm 3 việc chính: cung cấp API dữ liệu, hiển thị gợi ý và lưu phản hồi.
          </p>
        </div>
      </div>
    </div>
  );
}
