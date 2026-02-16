export default function AdminHuongDanAiPage() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Hướng dẫn Trợ lý công việc</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Trang này giúp anh/chị dùng Trợ lý công việc hằng ngày theo cách đơn giản, dễ làm.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">1) Đọc KPI phần trăm như thế nào?</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Trực Page: xem tỉ lệ lấy được số trong ngày.</li>
          <li>Tư vấn: xem 3 tỉ lệ chính là hẹn từ data, đến từ hẹn, ký từ đến.</li>
          <li>Nếu tỉ lệ thấp hơn mục tiêu, ưu tiên xử lý ngay trong ca làm.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">2) Dùng Trợ lý công việc hằng ngày</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Mở trang Trợ lý công việc và chọn đúng ngày cần xem.</li>
          <li>Đọc từng gợi ý theo màu: Đỏ cần làm ngay, Vàng cần theo dõi, Xanh đang ổn.</li>
          <li>Bấm &quot;Tạo danh sách gọi&quot; để đẩy việc ra hàng gọi nhanh.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">3) Phản hồi để hệ thống ngày càng đúng</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          <li>Nếu gợi ý đúng: bấm &quot;Đúng, hữu ích&quot;.</li>
          <li>Nếu chưa đúng: bấm &quot;Chưa đúng&quot; và ghi chú ngắn lý do.</li>
          <li>Phản hồi càng đều thì gợi ý sau càng sát thực tế vận hành.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">4) n8n chạy ra sao?</h2>
        <p className="mt-2 text-sm text-zinc-700">
          n8n là nơi xử lý tự động: lấy dữ liệu từ CRM, phân tích và gửi gợi ý về lại hệ thống.
          CRM chỉ làm 3 việc chính: cung cấp API dữ liệu, hiển thị gợi ý và lưu phản hồi.
        </p>
      </section>
    </div>
  );
}
