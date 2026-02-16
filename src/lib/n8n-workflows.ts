export type N8nWorkflow = {
  id: string;
  name: string;
  objective: string;
  trigger: "cron" | "webhook" | "manual";
  schedule: string;
  inputSources: string[];
  transformLogic: string[];
  apiCalls: Array<{
    method: "GET" | "POST";
    endpoint: string;
    headers: string[];
  }>;
  samplePayload: string;
  idempotency: string;
  retryBackoff: string;
  expectedResult: string;
};

export const N8N_SECURITY_GUIDELINES: string[] = [
  "Mọi ingest route dùng secret header (x-ops-secret, x-marketing-secret, x-cron-secret, x-worker-secret).",
  "Không đẩy secret vào client/browser; chỉ cấu hình trong n8n credentials hoặc environment.",
  "dateKey bắt buộc định dạng YYYY-MM-DD theo Asia/Ho_Chi_Minh.",
  "Với workflow chạy định kỳ 10 phút, dùng cùng windowMinutes=10 để đồng nhất bucket dữ liệu.",
];

export const N8N_DEFINITIONS: string[] = [
  "TRỰC PAGE: denominator = tổng tin nhắn chưa có số theo ownerId từ lúc nhận lead.",
  "TRỰC PAGE: numerator = số lead chuyển sang trạng thái có số trong ngày theo ownerId.",
  "TƯ VẤN: Hẹn/Data = APPOINTED/HAS_PHONE, Đến/Hẹn = ARRIVED/APPOINTED, Ký/Đến = SIGNED/ARRIVED.",
  "dateKey = YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh; windowMinutes mặc định 10.",
];

export const N8N_INGEST_ENDPOINTS: Array<{
  name: string;
  method: "POST";
  endpoint: string;
  header: string;
  curl: string;
}> = [
  {
    name: "Ops Pulse 10 phút",
    method: "POST",
    endpoint: "/api/ops/pulse",
    header: "x-ops-secret: <OPS_SECRET>",
    curl: `curl -X POST "$BASE_URL/api/ops/pulse" \\
  -H "x-ops-secret: $OPS_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role":"PAGE",
    "ownerId":"user_cuid",
    "dateKey":"2026-02-15",
    "windowMinutes":10,
    "metrics":{"messagesToday":100,"dataToday":12,"calledToday":0,"appointedToday":0,"arrivedToday":0,"signedToday":0}
  }'`,
  },
  {
    name: "Marketing report theo ngày",
    method: "POST",
    endpoint: "/api/marketing/report",
    header: "x-marketing-secret: <MARKETING_SECRET>",
    curl: `curl -X POST "$BASE_URL/api/marketing/report" \\
  -H "x-marketing-secret: $MARKETING_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date":"2026-02-15",
    "source":"meta",
    "branchCode":"HCM",
    "spendVnd":2500000,
    "messages":42,
    "meta":{"campaign":"Lead Form"}
  }'`,
  },
  {
    name: "Cron daily vận hành",
    method: "POST",
    endpoint: "/api/cron/daily",
    header: "x-cron-secret: <CRON_SECRET>",
    curl: `curl -X POST "$BASE_URL/api/cron/daily" \\
  -H "x-cron-secret: $CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"dryRun":false,"force":false}'`,
  },
  {
    name: "Worker outbound dispatch",
    method: "POST",
    endpoint: "/api/worker/outbound",
    header: "x-worker-secret: <WORKER_SECRET>",
    curl: `curl -X POST "$BASE_URL/api/worker/outbound" \\
  -H "x-worker-secret: $WORKER_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"dryRun":false,"batchSize":50,"retryFailedOnly":false}'`,
  },
];

export const N8N_WORKFLOWS: N8nWorkflow[] = [
  {
    id: "W1",
    name: "Ops Pulse - Trực Page 10 phút",
    objective: "Đo % ra Data theo ngày và cảnh báo ngay khi dưới target.",
    trigger: "cron",
    schedule: "Mỗi 10 phút (n8n Cron)",
    inputSources: ["Pancake/Meta inbox", "Owner mapping nội bộ"],
    transformLogic: [
      "Lấy và tổng hợp messagesToday theo ownerId + dateKey từ Pancake API.",
      "Tính dataToday = count LeadEvent HAS_PHONE theo ownerId + dateKey (HCM).",
      "Gửi snapshot role=PAGE, windowMinutes=10.",
    ],
    apiCalls: [
      { method: "POST", endpoint: "/api/ops/pulse", headers: ["x-ops-secret", "Content-Type: application/json"] },
    ],
    samplePayload: `{
  "role":"PAGE",
  "ownerId":"user_page_01",
  "dateKey":"2026-02-15",
  "windowMinutes":10,
  "metrics":{"messagesToday":120,"dataToday":18,"calledToday":0,"appointedToday":0,"arrivedToday":0,"signedToday":0}
}`,
    idempotency:
      "OpsPulse upsert theo unique(role,dateKey,windowMinutes,bucketStart,ownerScopeKey,branchScopeKey).",
    retryBackoff: "Retry 3 lần (10s/30s/60s), log lỗi vào Error Trigger node.",
    expectedResult: "CRM lưu snapshot, trả status OK/WARNING/CRITICAL + checklist gợi ý.",
  },
  {
    id: "W2",
    name: "Ops Pulse - Telesales 10 phút",
    objective: "Theo dõi pipeline gọi/hẹn/đến/ký theo owner để điều phối ngay trong ngày.",
    trigger: "cron",
    schedule: "Mỗi 10 phút (n8n Cron)",
    inputSources: ["LeadEvent stream", "Owner mapping"],
    transformLogic: [
      "Tổng hợp dataToday/calledToday/appointedToday/arrivedToday/signedToday theo ownerId.",
      "Chuẩn hóa số nguyên >=0 và dateKey HCM.",
      "Gọi ingest TELESALES.",
    ],
    apiCalls: [
      { method: "POST", endpoint: "/api/ops/pulse", headers: ["x-ops-secret", "Content-Type: application/json"] },
    ],
    samplePayload: `{
  "role":"TELESALES",
  "ownerId":"user_tele_01",
  "dateKey":"2026-02-15",
  "windowMinutes":10,
  "metrics":{"messagesToday":0,"dataToday":8,"calledToday":6,"appointedToday":3,"arrivedToday":1,"signedToday":0}
}`,
    idempotency:
      "Cùng bucket 10 phút sẽ update bản ghi cũ, không tạo duplicate.",
    retryBackoff: "Retry 3 lần; nếu fail thì đẩy cảnh báo Telegram/Slack.",
    expectedResult: "Admin xem được gap KPI và ưu tiên xử lý trên /admin/ops.",
  },
  {
    id: "W3",
    name: "Marketing Meta Ads theo ngày",
    objective: "Đẩy spend/messages từ Meta Ads vào CRM để tính CPL chuẩn theo ngày.",
    trigger: "cron",
    schedule: "1 lần/ngày lúc 23:50 hoặc mỗi 1 giờ",
    inputSources: ["Meta Ads API", "Branch mapping theo code"],
    transformLogic: [
      "Chuẩn hóa date YYYY-MM-DD theo HCM.",
      "Làm tròn spend/messages và đảm bảo >=0.",
      "Upsert report theo (dateKey, branchId, source).",
    ],
    apiCalls: [
      {
        method: "POST",
        endpoint: "/api/marketing/report",
        headers: ["x-marketing-secret", "Content-Type: application/json"],
      },
    ],
    samplePayload: `{
  "date":"2026-02-15",
  "source":"meta",
  "branchCode":"HCM",
  "spendVnd":3250000,
  "messages":58,
  "meta":{"campaign":"Form Lead"}
}`,
    idempotency: "API upsert theo key unique dateKey+branchId+source.",
    retryBackoff: "Retry 3 lần (30s/2m/5m), sau đó ghi dead-letter.",
    expectedResult: "Trang /marketing cập nhật KPI Chi phí/Nhắn tin/CPL.",
  },
  {
    id: "W4",
    name: "Cron Daily tạo thông báo + queue outbound",
    objective: "Tự tạo việc cần làm và xếp hàng tin nhắn follow-up mỗi ngày.",
    trigger: "cron",
    schedule: "Hằng ngày 08:00 (force ngoài giờ yên tĩnh khi cần)",
    inputSources: ["Notification rules", "Finance/receipt state", "Tuỳ chọn force"],
    transformLogic: [
      "Gọi cron daily để generate notification.",
      "Queue outbound theo priority/caps/dedupe window.",
      "Ghi AutomationLog scope daily.",
    ],
    apiCalls: [
      { method: "POST", endpoint: "/api/cron/daily", headers: ["x-cron-secret", "Content-Type: application/json"] },
    ],
    samplePayload: `{
  "dryRun": false,
  "force": false
}`,
    idempotency: "Dedupe theo rule notification + outbound dedupe window.",
    retryBackoff: "Retry 2 lần; nếu fail gửi cảnh báo và chạy lại manual /admin/cron.",
    expectedResult: "Có counters notifications/outbound và log vận hành ngày.",
  },
  {
    id: "W5",
    name: "Outbound Worker Dispatch",
    objective: "Đẩy hàng đợi outbound đều đặn với giới hạn tốc độ an toàn.",
    trigger: "cron",
    schedule: "Mỗi 1-2 phút",
    inputSources: ["OutboundMessage queue", "Rate limit env", "Lease lock"],
    transformLogic: [
      "Chọn batch eligible (QUEUED/FAILED retry).",
      "Lease message, dispatch theo concurrency + rate limit.",
      "Cập nhật retryCount/nextAttemptAt khi lỗi.",
    ],
    apiCalls: [
      {
        method: "POST",
        endpoint: "/api/worker/outbound",
        headers: ["x-worker-secret", "Content-Type: application/json"],
      },
    ],
    samplePayload: `{
  "dryRun": false,
  "batchSize": 50,
  "retryFailedOnly": false,
  "concurrency": 5
}`,
    idempotency: "LeaseId + leaseExpiresAt chống double-dispatch.",
    retryBackoff: "Backoff+jitter theo retry policy trong worker service.",
    expectedResult: "Queue giảm dần, trạng thái SENT/FAILED cập nhật đầy đủ.",
  },
  {
    id: "W6",
    name: "Outbound Callback Status",
    objective: "Đồng bộ trạng thái gửi thực tế từ provider/n8n về CRM.",
    trigger: "webhook",
    schedule: "Realtime theo event callback",
    inputSources: ["Provider webhook", "messageId mapping"],
    transformLogic: [
      "Xác thực x-callback-secret.",
      "Map status SENT/FAILED/SKIPPED.",
      "Cập nhật providerMessageId, sentAt, error, retry.",
    ],
    apiCalls: [
      {
        method: "POST",
        endpoint: "/api/outbound/callback",
        headers: ["x-callback-secret", "Content-Type: application/json"],
      },
    ],
    samplePayload: `{
  "messageId":"msg_cuid",
  "status":"SENT",
  "providerMessageId":"provider_123",
  "sentAt":"2026-02-15T10:15:00.000Z"
}`,
    idempotency: "Update theo messageId; callback lặp lại sẽ overwrite trạng thái mới nhất.",
    retryBackoff: "Nếu callback fail 5xx thì provider retry; CRM trả code chuẩn để n8n xử lý.",
    expectedResult: "UI /outbound và /automation/logs phản ánh trạng thái gửi thực tế.",
  },
  {
    id: "W7",
    name: "Áp dụng đề xuất + học từ phản hồi",
    objective: "Biến đề xuất thành việc thực tế và học lại từ phản hồi người dùng.",
    trigger: "manual",
    schedule: "Theo thao tác người dùng + job đồng bộ mỗi 30 phút",
    inputSources: ["/api/ai/suggestions", "/api/tasks", "/api/automation/logs", "feedback của người dùng"],
    transformLogic: [
      "Người dùng bấm Áp dụng để tạo việc hoặc danh sách gọi nhắc.",
      "Khi việc hoàn thành, CRM nhắc phản hồi Hữu ích/Chưa đúng.",
      "n8n đọc phản hồi + kết quả thực tế để điều chỉnh luật gợi ý.",
    ],
    apiCalls: [
      { method: "POST", endpoint: "/api/tasks", headers: ["Authorization: Bearer", "Content-Type: application/json"] },
      {
        method: "POST",
        endpoint: "/api/outbound/jobs",
        headers: ["Authorization: Bearer", "Idempotency-Key", "Content-Type: application/json"],
      },
      { method: "POST", endpoint: "/api/ai/suggestions/{id}/feedback", headers: ["Authorization: Bearer", "Content-Type: application/json"] },
    ],
    samplePayload: `{
  "title":"Gọi lại nhóm khách hẹn",
  "message":"Ưu tiên xử lý trước 16h",
  "type":"TASK",
  "suggestionId":"sug_xxx",
  "actionKey":"CREATE_TASK"
}`,
    idempotency: "Các lệnh tạo danh sách gọi dùng Idempotency-Key để tránh tạo trùng.",
    retryBackoff: "Retry 3 lần với backoff tăng dần ở node HTTP của n8n.",
    expectedResult: "Tỷ lệ áp dụng và tỷ lệ hữu ích tăng dần theo từng tuần.",
  },
];
