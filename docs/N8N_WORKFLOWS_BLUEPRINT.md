# N8N_WORKFLOWS_BLUEPRINT

## 1) Workflow: Trợ lý công việc 10 phút/lần

- Tên workflow: `Tro ly cong viec - 10min`
- Trigger: `Cron` mỗi 10 phút (timezone `Asia/Ho_Chi_Minh`).
- Input chính:
  - `GET /api/kpi/daily?date=YYYY-MM-DD`
  - `GET /api/kpi/targets?branchId=...&role=...&ownerId=...`
  - `GET /api/goals?periodType=DAILY&dateKey=...&branchId=...`
- Nodes gợi ý:
  1. `Cron`
  2. `HTTP Request` (kpi daily)
  3. `HTTP Request` (kpi targets)
  4. `HTTP Request` (daily goals)
  5. `Function` (tính tỷ lệ % so với mục tiêu)
  6. `LLM/Prompt` (sinh gợi ý)
  7. `HTTP Request` ingest `POST /api/ai/suggestions/ingest`
- Output:
  - suggestions theo `role/branch/owner` với `scoreColor`, `actionsJson`, `metricsJson`.
  - khi có `ownerId`, ưu tiên lấy target theo nhân sự; nếu không có thì fallback target theo vai trò.
- Auth:
  - Header ingest: `x-service-token`, `Idempotency-Key`.
- Retry/backoff:
  - tối đa 3 lần: `2s -> 5s -> 15s`.
- Idempotency:
  - key gợi ý: `${runId}:/api/ai/suggestions/ingest:${branchId}:${role}`.

## 2) Workflow: Director Briefing 2 lần/ngày

- Tên workflow: `Director Briefing - 2x/day`
- Trigger: `Cron` lúc `09:00` và `17:00` ICT.
- Input chính:
  - `GET /api/kpi/daily`
  - `GET /api/goals?periodType=DAILY`
  - `GET /api/goals?periodType=MONTHLY`
  - `GET /api/expenses/summary?month=...`
- Nodes gợi ý:
  1. `Cron`
  2. `HTTP` lấy KPI + goals + expenses
  3. `Function` tổng hợp executive snapshot
  4. `LLM/Prompt` tạo brief cho giám đốc
  5. `HTTP Request` ingest suggestions (role `manager`/`admin`)
- Output:
  - 1-3 suggestions cấp quản lý với action rõ ràng.
- Retry/backoff:
  - tối đa 3 lần, backoff `2s/5s/15s`.
- Idempotency:
  - key: `${runId}:/api/ai/suggestions/ingest:director`.

## 3) Workflow: Learning Loop hàng ngày

- Tên workflow: `Tro ly cong viec - Learning Loop Daily`
- Trigger: `Cron` 23:30 ICT.
- Input chính:
  - feedback từ CRM: `POST /api/ai/suggestions/{id}/feedback` đã lưu trong DB.
  - dữ liệu KPI delta ngày sau (qua `GET /api/kpi/daily`).
- Nodes gợi ý:
  1. `Cron`
  2. `HTTP`/DB query feedback + outcomes
  3. `Function` scoring rule hiệu quả suggestion
  4. `Store` prompt/rules (Data Store / Notion / Sheet)
- Output:
  - bộ rule/prompt update cho workflow #1 và #2.
- Retry/backoff:
  - 3 lần với `2s/5s/15s`.
- Idempotency:
  - key theo runId + ngày: `${runId}:learning-loop:${dateKey}`.

## Payload ingest mẫu

```json
{
  "source": "n8n",
  "runId": "tro-ly-cong-viec-2026-02-16-1010",
  "suggestions": [
    {
      "dateKey": "2026-02-16",
      "role": "telesales",
      "branchId": "REDACTED_BRANCH_ID",
      "ownerId": "REDACTED_USER_ID",
      "scoreColor": "RED",
      "title": "Tỷ lệ hẹn từ data đang thấp",
      "content": "- Gọi lại nhóm data có số\n- Ưu tiên khách có lịch hẹn hôm qua",
      "actionsJson": [
        {
          "type": "outbound_call",
          "label": "Tạo danh sách gọi nhắc",
          "channel": "CALL_NOTE",
          "templateKey": "remind_schedule",
          "leadId": "REDACTED_LEAD_ID"
        }
      ],
      "metricsJson": {
        "gap": 12,
        "funnel": {
          "hasPhone": 48,
          "called": 29,
          "appointed": 6
        }
      }
    }
  ]
}
```
