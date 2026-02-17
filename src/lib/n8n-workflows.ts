export type N8nWorkflow = {
  id: string;
  name: string;
  objective: string;
  trigger: "cron" | "webhook" | "manual";
  schedule: string;
  inputSources: string[];
  transformLogic: string[];
  apiCalls: Array<{
    method: "GET" | "POST" | "PATCH";
    endpoint: string;
    headers: string[];
  }>;
  samplePayload: string;
  idempotency: string;
  retryBackoff: string;
  expectedResult: string;
  definitionOfDone: string[];
  failConditions: string[];
  retryPolicy: string[];
  n8nNotes: string[];
};

export const N8N_SECURITY_GUIDELINES: string[] = [
  "Mọi ingest route dùng secret header (x-service-token hoặc secret chuyên biệt theo route).",
  "Không đẩy secret vào client/browser; chỉ cấu hình trong n8n credentials hoặc environment.",
  "dateKey bắt buộc định dạng YYYY-MM-DD theo Asia/Ho_Chi_Minh.",
  "Workflow định kỳ cần bật retry + idempotency để tránh ghi trùng dữ liệu.",
];

export const N8N_DEFINITIONS: string[] = [
  "TRỰC PAGE: denominator = tổng tin nhắn chưa có số theo ownerId từ lúc nhận lead.",
  "TRỰC PAGE: numerator = số lead chuyển sang trạng thái có số trong ngày theo ownerId.",
  "TƯ VẤN: Hẹn/Data = APPOINTED/HAS_PHONE, Đến/Hẹn = ARRIVED/APPOINTED, Ký/Đến = SIGNED/ARRIVED.",
  "Mọi đề xuất AI trong CRM đang ở mức skeleton: luật cố định, n8n sẽ thay bằng quyết định AI sau.",
];

export const N8N_INGEST_ENDPOINTS: Array<{
  name: string;
  method: "POST" | "PATCH";
  endpoint: string;
  header: string;
  curl: string;
}> = [
  {
    name: "Ingest gợi ý Trợ lý công việc",
    method: "POST",
    endpoint: "/api/ai/suggestions/ingest",
    header: "x-service-token: <SERVICE_TOKEN>",
    curl: `curl -X POST "$BASE_URL/api/ai/suggestions/ingest" \\
  -H "x-service-token: REDACTED" \\
  -H "Idempotency-Key: REDACTED-UUID" \\
  -H "Content-Type: application/json" \\
  -d '{"source":"n8n","runId":"run-2026-02-16-1010","suggestions":[{"dateKey":"2026-02-16","role":"telesales","scoreColor":"RED","title":"Tỷ lệ gọi thấp","content":"Ưu tiên gọi lại nhóm khách có số","actionsJson":[{"type":"CREATE_OUTBOUND_JOB"}]}]}'`,
  },
  {
    name: "Cập nhật trạng thái danh sách gọi",
    method: "PATCH",
    endpoint: "/api/outbound/jobs/{id}",
    header: "x-service-token: <SERVICE_TOKEN>",
    curl: `curl -X PATCH "$BASE_URL/api/outbound/jobs/REDACTED_JOB_ID" \\
  -H "x-service-token: REDACTED" \\
  -H "Idempotency-Key: REDACTED-UUID" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"DONE","runId":"run-2026-02-16-01"}'`,
  },
  {
    name: "Ingest nhật ký vận hành n8n",
    method: "POST",
    endpoint: "/api/automation/logs/ingest",
    header: "x-service-token: <SERVICE_TOKEN>",
    curl: `curl -X POST "$BASE_URL/api/automation/logs/ingest" \\
  -H "x-service-token: REDACTED" \\
  -H "Idempotency-Key: REDACTED-UUID" \\
  -H "Content-Type: application/json" \\
  -d '{"branchId":"REDACTED_BRANCH","channel":"n8n","status":"sent","milestone":"w7.apply","payload":{"runId":"run-2026-02-16-01"}}'`,
  },
];

export const N8N_WORKFLOWS: N8nWorkflow[] = [
  {
    id: "W7",
    name: "Áp dụng đề xuất -> Gửi đi -> Hoàn tất -> Phản hồi",
    objective: "Khép kín vòng thao tác người dùng và học từ phản hồi thực tế.",
    trigger: "manual",
    schedule: "Theo thao tác người dùng + đồng bộ 5-10 phút",
    inputSources: ["/api/ai/suggestions", "/api/tasks", "/api/outbound/jobs", "feedback người dùng"],
    transformLogic: [
      "Người dùng bấm Áp dụng để tạo việc hoặc danh sách gọi.",
      "n8n đọc danh sách gọi mới, xử lý gửi đi và cập nhật trạng thái.",
      "Khi hoàn tất, CRM nhắc người dùng phản hồi để làm dữ liệu học.",
    ],
    apiCalls: [
      { method: "POST", endpoint: "/api/tasks", headers: ["Authorization: Bearer", "Content-Type: application/json"] },
      {
        method: "POST",
        endpoint: "/api/outbound/jobs",
        headers: ["Authorization: Bearer", "Idempotency-Key", "Content-Type: application/json"],
      },
      {
        method: "PATCH",
        endpoint: "/api/outbound/jobs/{id}",
        headers: ["x-service-token", "Idempotency-Key", "Content-Type: application/json"],
      },
      {
        method: "POST",
        endpoint: "/api/ai/suggestions/{id}/feedback",
        headers: ["Authorization: Bearer", "Content-Type: application/json"],
      },
      {
        method: "POST",
        endpoint: "/api/automation/logs/ingest",
        headers: ["x-service-token", "Idempotency-Key", "Content-Type: application/json"],
      },
    ],
    samplePayload: `{
  "status": "DONE",
  "runId": "run-2026-02-16-01",
  "lastError": null
}`,
    idempotency: "POST/PATCH quan trọng bắt buộc Idempotency-Key để chống ghi trùng.",
    retryBackoff: "Retry 3 lần (10s/30s/60s), vẫn lỗi thì ghi log failed.",
    expectedResult: "Có chuỗi log rõ ràng từ áp dụng đến phản hồi.",
    definitionOfDone: [
      "Danh sách gọi chuyển trạng thái DONE.",
      "Task liên kết được chốt DONE (nếu có).",
      "Có log ingest trạng thái cuối cùng.",
    ],
    failConditions: [
      "Thiếu x-service-token hoặc token sai.",
      "PATCH trạng thái lỗi quá 3 lần liên tiếp.",
      "Không ghi được log ingest.",
    ],
    retryPolicy: [
      "Retry tối đa 3 lần cho PATCH /api/outbound/jobs/{id}.",
      "Khoảng nghỉ: 10 giây, 30 giây, 60 giây.",
      "Nếu vẫn lỗi thì ghi failed và cảnh báo vận hành.",
    ],
    n8nNotes: [
      "Node 1: HTTP GET lấy danh sách gọi mới từ /api/outbound/jobs?status=NEW.",
      "Node 2: Split in Batches để gửi đi từng phần, tránh nghẽn nhà cung cấp.",
      "Node 3: HTTP PATCH cập nhật trạng thái DISPATCHED/DONE/FAILED.",
      "Node 4: HTTP POST /api/automation/logs/ingest lưu lại kết quả từng nhánh.",
      "Node 5: Nếu FAILED thì route sang nhánh retry với backoff tăng dần.",
    ],
  },
  {
    id: "W8",
    name: "Nhắc việc theo lịch và việc đến hạn",
    objective: "Nhắc đúng thời điểm cho việc cần làm và lịch học quan trọng.",
    trigger: "cron",
    schedule: "Mỗi 30 phút",
    inputSources: ["/api/tasks", "/api/schedule", "múi giờ HCM"],
    transformLogic: [
      "Lọc việc sắp đến hạn trong 2-4 giờ tới.",
      "Tạo danh sách gọi/nhắc hoặc thông báo nội bộ.",
      "Ghi log trạng thái gửi thành công/thất bại.",
    ],
    apiCalls: [
      { method: "GET", endpoint: "/api/tasks", headers: ["Authorization: Bearer"] },
      { method: "POST", endpoint: "/api/outbound/jobs", headers: ["Authorization: Bearer", "Idempotency-Key"] },
      { method: "POST", endpoint: "/api/automation/logs/ingest", headers: ["x-service-token", "Idempotency-Key"] },
    ],
    samplePayload: `{
  "title": "Nhắc việc học viên gần lịch học",
  "channel": "SMS",
  "suggestionId": "REDACTED_SUGGESTION_ID"
}`,
    idempotency: "Khóa theo runId + dueAt để tránh nhắc trùng cùng một ca.",
    retryBackoff: "Retry 3 lần, tăng dần 15s/45s/120s.",
    expectedResult: "Giảm bỏ sót việc quá hạn và tăng tỉ lệ xử lý đúng hạn.",
    definitionOfDone: [
      "Các việc đến hạn được tạo nhắc đúng khung giờ.",
      "Có log thành công hoặc skipped cho từng nhánh.",
    ],
    failConditions: [
      "Không đọc được /api/tasks.",
      "Tạo danh sách gọi nhắc thất bại liên tục.",
    ],
    retryPolicy: [
      "Retry 3 lần cho mỗi node ghi dữ liệu.",
      "Khoảng nghỉ: 15 giây, 45 giây, 120 giây.",
    ],
    n8nNotes: [
      "Node Cron -> Node HTTP GET /api/tasks?status=NEW.",
      "Node IF tách theo mức ưu tiên và hạn xử lý.",
      "Node HTTP POST tạo danh sách gọi nhắc nếu cần.",
      "Node HTTP POST ingest log để lưu dấu vết vận hành.",
    ],
  },
  {
    id: "W9",
    name: "Nhắc thu tiền / công nợ đến hạn",
    objective: "Tăng tỷ lệ thu đúng hạn, giảm dồn công nợ cuối kỳ.",
    trigger: "cron",
    schedule: "2 lần/ngày",
    inputSources: ["/api/receipts/summary", "/api/students"],
    transformLogic: [
      "Xác định nhóm học viên cần nhắc thu.",
      "Sinh gợi ý hoặc danh sách gọi nhắc cho nhân sự phụ trách.",
      "Theo dõi phản hồi để điều chỉnh khung giờ nhắc.",
    ],
    apiCalls: [
      { method: "POST", endpoint: "/api/ai/suggestions/ingest", headers: ["x-service-token", "Idempotency-Key"] },
      { method: "POST", endpoint: "/api/outbound/jobs", headers: ["Authorization: Bearer", "Idempotency-Key"] },
      { method: "POST", endpoint: "/api/automation/logs/ingest", headers: ["x-service-token", "Idempotency-Key"] },
    ],
    samplePayload: `{
  "source": "n8n",
  "runId": "run-receipt-2026-02-16",
  "suggestions": [{
    "dateKey": "2026-02-16",
    "role": "manager",
    "scoreColor": "YELLOW",
    "title": "Có học viên cần nhắc thu",
    "content": "Ưu tiên gọi nhóm đến hạn hôm nay"
  }]
}`,
    idempotency: "Khóa theo dateKey + branchId + loại nhắc để tránh tạo trùng.",
    retryBackoff: "Retry 3 lần, nếu vẫn fail thì gửi cảnh báo quản trị.",
    expectedResult: "Danh sách nhắc thu được cập nhật đều mỗi ngày.",
    definitionOfDone: [
      "Có suggestion hoặc danh sách gọi cho nhóm đến hạn.",
      "Log ingest được lưu đầy đủ theo runId.",
    ],
    failConditions: [
      "Payload thiếu source=n8n hoặc runId.",
      "Không tạo được suggestion sau 3 lần thử.",
    ],
    retryPolicy: [
      "Retry 3 lần cho ingest suggestion.",
      "Nếu thất bại, chuyển nhánh cảnh báo quản trị.",
    ],
    n8nNotes: [
      "Node HTTP GET lấy summary thu tiền theo chi nhánh.",
      "Node Function tính ngưỡng ưu tiên nhắc thu.",
      "Node HTTP POST ingest gợi ý + tạo job gọi nhắc.",
      "Node HTTP POST ingest log để theo dõi tỷ lệ gửi thành công.",
    ],
  },
  {
    id: "W10",
    name: "Cảnh báo chi phí vượt ngưỡng",
    objective: "Cảnh báo sớm khi chi phí ngày/tháng vượt ngưỡng đã đặt.",
    trigger: "cron",
    schedule: "Mỗi ngày 3 lần",
    inputSources: ["/api/expenses/summary", "ngưỡng từng chi nhánh"],
    transformLogic: [
      "Đọc tổng chi phí theo ngày và tháng.",
      "So với ngưỡng và tạo gợi ý hành động.",
      "Lưu insight + log để theo dõi xu hướng.",
    ],
    apiCalls: [
      { method: "GET", endpoint: "/api/expenses/summary", headers: ["Authorization: Bearer"] },
      { method: "POST", endpoint: "/api/ai/suggestions/ingest", headers: ["x-service-token", "Idempotency-Key"] },
      { method: "POST", endpoint: "/api/automation/logs/ingest", headers: ["x-service-token", "Idempotency-Key"] },
    ],
    samplePayload: `{
  "dateKey": "2026-02-16",
  "monthKey": "2026-02",
  "summary": "Chi phí vượt 12% so với ngưỡng"
}`,
    idempotency: "Khóa theo dateKey + branchId + loại cảnh báo.",
    retryBackoff: "Retry 3 lần, lỗi liên tiếp thì dừng và ghi failed.",
    expectedResult: "Quản lý nhận cảnh báo trước khi chi phí vượt sâu.",
    definitionOfDone: [
      "Gợi ý cảnh báo chi phí được tạo đúng chi nhánh.",
      "Có bản ghi log vận hành cho mỗi lần chạy.",
    ],
    failConditions: [
      "Không truy vấn được summary chi phí.",
      "Không ingest được gợi ý cảnh báo.",
    ],
    retryPolicy: [
      "Retry 3 lần cho mỗi lần gọi API.",
      "Dừng sau lần thứ 3 và ghi trạng thái failed.",
    ],
    n8nNotes: [
      "Node HTTP GET /api/expenses/summary?month=YYYY-MM.",
      "Node IF so sánh ngưỡng theo từng chi nhánh.",
      "Node HTTP POST ingest gợi ý cho quản lý.",
      "Node HTTP POST ingest log kết quả chạy.",
    ],
  },
  {
    id: "W11",
    name: "Nhắc lịch học và rủi ro gần ngày thi",
    objective: "Giảm tình trạng học viên sát ngày thi nhưng thiếu buổi học.",
    trigger: "cron",
    schedule: "Mỗi ngày 2 lần",
    inputSources: ["/api/schedule", "/api/students"],
    transformLogic: [
      "Lọc học viên gần ngày thi nhưng lịch học chưa đủ.",
      "Sinh nhắc việc cho quản lý/nhân sự phụ trách.",
      "Ghi log để so sánh trước-sau mỗi ngày.",
    ],
    apiCalls: [
      { method: "GET", endpoint: "/api/schedule", headers: ["Authorization: Bearer"] },
      { method: "POST", endpoint: "/api/tasks", headers: ["Authorization: Bearer"] },
      { method: "POST", endpoint: "/api/automation/logs/ingest", headers: ["x-service-token", "Idempotency-Key"] },
    ],
    samplePayload: `{
  "title": "Bổ sung lịch học cho nhóm gần ngày thi",
  "type": "REMINDER",
  "dueAt": "2026-02-16T17:00:00.000Z"
}`,
    idempotency: "Khóa theo studentId + dateKey để không nhắc trùng trong ngày.",
    retryBackoff: "Retry 3 lần với backoff 20s/60s/180s.",
    expectedResult: "Danh sách rủi ro lịch học giảm dần theo tuần.",
    definitionOfDone: [
      "Task nhắc bổ sung lịch được tạo cho nhóm rủi ro.",
      "Log ingest phản ánh đủ số lượng đã xử lý.",
    ],
    failConditions: [
      "Không đọc được dữ liệu lịch học/học viên.",
      "Tạo task thất bại liên tiếp.",
    ],
    retryPolicy: [
      "Retry 3 lần cho node tạo task.",
      "Khoảng nghỉ: 20 giây, 60 giây, 180 giây.",
    ],
    n8nNotes: [
      "Node HTTP GET lịch học và dữ liệu học viên gần thi.",
      "Node Function chấm điểm rủi ro và tạo danh sách cần xử lý.",
      "Node HTTP POST /api/tasks tạo việc nhắc bổ sung lịch.",
      "Node HTTP POST ingest log để báo cáo cuối ngày.",
    ],
  },
];
