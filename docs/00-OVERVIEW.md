# 00 – Tổng quan hệ thống Thầy Duy CRM

## Mục tiêu sản phẩm

**Thầy Duy CRM** là hệ thống quản lý đào tạo lái xe toàn diện, phục vụ trung tâm đào tạo lái xe "Thầy Duy". Sản phẩm bao gồm:

- **CRM nội bộ**: quản lý khách hàng (lead), học viên, lịch học, thu tiền, KPI, lương, tự động hoá quy trình.
- **Cổng học viên (Student Portal)**: học viên tự đăng nhập xem lịch học, tiến độ, tài liệu hướng dẫn.
- **Landing page**: trang giới thiệu dịch vụ, đăng ký.
- **N8N Automation**: luồng tự động hoá (nhắc lịch, KPI coach, gửi tin, báo cáo marketing).

## Đối tượng sử dụng

| Role | Mô tả |
|------|--------|
| **Admin** | Quản trị viên toàn quyền: cấu hình hệ thống, phân quyền, quản lý chi nhánh, chạy cron, giám sát N8N |
| **Manager** | Quản lý chi nhánh: xem/quản lý lead, học viên, KPI, phiếu thu, phân bổ khách, xem báo cáo HR |
| **Telesales** | Nhân viên tư vấn: quản lý lead được phân, gọi/hẹn/chăm sóc, xem KPI cá nhân, tạo phiếu thu |
| **Direct Page** | Nhân viên page/kênh trực tiếp: tương tự telesales, ít quyền messaging |
| **Viewer** | Người xem: chỉ xem tổng quan, KPI, gợi ý AI |
| **Student** | Học viên: truy cập cổng học viên, xem lịch/tài chính/tài liệu |

## Kiến trúc hệ thống

| Layer | Công nghệ |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless functions) |
| ORM | Prisma 7 (PostgreSQL adapter) |
| Database | PostgreSQL |
| Cache/Queue | Redis |
| Auth | JWT (access token cookie + refresh) |
| Automation | N8N webhooks + service tokens |
| Infra | Docker + Docker Compose + Nginx reverse proxy + Certbot SSL |
| Testing | Playwright (E2E) + Vitest (Unit) |

## Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        LP["Landing Page<br/>(marketing)"]
        CRM["CRM Admin Panel<br/>(Admin/Manager/Telesales)"]
        SP["Student Portal<br/>(Học viên)"]
        PWA["App Học Lý Thuyết<br/>(taplai PWA)"]
    end

    subgraph "Application Layer (Next.js)"
        MW["Middleware<br/>(Auth + RBAC guard)"]
        API["API Routes<br/>(36 route groups)"]
        SVC["Services Layer<br/>(14 service modules)"]
        SSR["Server Components<br/>(UI rendering)"]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL<br/>36 models)]
        RD[(Redis<br/>cache/rate-limit)]
    end

    subgraph "External / Automation"
        N8N["N8N Workflows<br/>(8 main flows)"]
        ZALO["Zalo OA"]
        META["Meta Ads API"]
    end

    LP --> MW
    CRM --> MW
    SP --> MW
    PWA -->|student-progress API| API

    MW --> API
    MW --> SSR
    API --> SVC
    SVC --> PG
    SVC --> RD
    SSR --> SVC

    N8N -->|webhooks<br/>service-token| API
    N8N --> ZALO
    N8N --> META
    API -->|callback| N8N
```

## Data Flow chính

```mermaid
sequenceDiagram
    participant U as User (Telesales/Page)
    participant CRM as CRM UI
    participant API as API Routes
    participant DB as PostgreSQL
    participant N8N as N8N Automation

    Note over U,N8N: 1. Lead Pipeline Flow
    U->>CRM: Tạo/import khách hàng
    CRM->>API: POST /api/leads
    API->>DB: Insert Lead (status=NEW)
    API->>DB: Insert LeadEvent

    U->>CRM: Cập nhật trạng thái (gọi/hẹn/đến/ký)
    CRM->>API: PATCH /api/leads/{id}
    API->>DB: Update Lead status
    API->>DB: Insert LeadEvent

    Note over U,N8N: 2. Student Enrollment
    U->>CRM: Nâng lên học viên
    CRM->>API: POST /api/students
    API->>DB: Insert Student (linked to Lead)

    Note over U,N8N: 3. Automation & KPI
    N8N->>API: POST /api/cron/daily (CRON_SECRET)
    API->>DB: Generate notifications
    API->>DB: Compute KPI metrics
    N8N->>API: POST /api/ai/suggestions/ingest
    API->>DB: Upsert AiSuggestion

    Note over U,N8N: 4. Outbound Messaging
    N8N->>API: POST /api/worker/outbound
    API->>DB: Lease + dispatch messages
    API->>N8N: Forward to Zalo/SMS
    N8N->>API: POST /api/outbound/callback (status)
```

## Cấu trúc thư mục chính

```
thayduy-crm/
├── src/
│   ├── app/
│   │   ├── (app)/          # CRM admin pages (18 modules)
│   │   ├── (landing)/      # Landing page
│   │   ├── api/            # 36 API route groups
│   │   ├── login/          # CRM login
│   │   └── student/        # Student portal (5 pages)
│   ├── components/         # Shared UI components
│   ├── hooks/              # Custom React hooks
│   └── lib/                # Core libraries
│       ├── services/       # 14 business logic services
│       ├── providers/      # Auth/context providers
│       └── utils/          # Utility functions
├── prisma/
│   ├── schema.prisma       # 36 models, 33+ enums
│   ├── migrations/         # 38 migration folders
│   └── seed.ts             # Seed data
├── scripts/                # 23 operational scripts
├── n8n/                    # N8N workflow configs
│   ├── workflows/          # 12 workflow JSON files
│   └── deploy/             # Deploy scripts
├── nginx/                  # Nginx reverse proxy config
├── tests/                  # E2E + unit tests
├── docs/                   # Documentation (this folder)
├── docker-compose.yml      # Development stack
├── docker-compose.prod.yml # Production stack
└── middleware.ts            # Auth + RBAC middleware
```
