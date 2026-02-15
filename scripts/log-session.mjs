#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const NOTES_PATH = path.resolve(process.cwd(), "docs/SESSION_NOTES.md");

function getArgValue(key) {
  const arg = process.argv.find((item) => item.startsWith(`--${key}=`));
  if (arg) return arg.slice(key.length + 3).trim();

  const idx = process.argv.findIndex((item) => item === `--${key}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1].trim();

  const envKey = `LOG_${key.toUpperCase()}`;
  return (process.env[envKey] || "").trim();
}

function nowInHcm() {
  const now = new Date();
  const date = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);

  const time = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);

  return `${date} ${time}`;
}

function toList(raw, fallback) {
  if (!raw) return [fallback];
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : [fallback];
}

function toCommandList(raw) {
  if (!raw) return ["- (chưa ghi lệnh)"];
  return raw
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `- ${item}`);
}

function ensureNotesFile() {
  const dir = path.dirname(NOTES_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(NOTES_PATH)) {
    const base = [
      "# SESSION NOTES",
      "",
      "## QUY ƯỚC",
      "",
      "### Format entry chuẩn",
      "Mỗi entry trong mục **NHẬT KÝ** phải theo đúng cấu trúc:",
      "- Ngày/giờ (Asia/Ho_Chi_Minh)",
      "- Mục tiêu",
      "- Tóm tắt thay đổi",
      "- Files touched",
      "- Commands ran + kết quả",
      "- Commit hash + message",
      "- Manual browser test checklist",
      "- Next steps",
      "",
      "### Checklist test trình duyệt",
      "- [ ] Đăng nhập thành công theo luồng chuẩn hiện tại",
      "- [ ] Điều hướng đúng route chính của tính năng vừa sửa",
      "- [ ] Kiểm tra responsive mobile (375px) và desktop",
      "- [ ] Kiểm tra trạng thái loading/empty/error",
      "- [ ] Kiểm tra hành vi nút hành động chính",
      "- [ ] Kiểm tra đăng xuất/điều hướng bảo mật nếu có liên quan",
      "",
      "### Cách ghi lệnh chạy",
      "- Ghi theo từng dòng, đúng lệnh đã chạy.",
      "- Mỗi lệnh có trạng thái rõ ràng: `PASS` hoặc `FAIL`.",
      "- Nếu `FAIL`, ghi ngắn gọn lý do và cách xử lý.",
      "",
      "## NHẬT KÝ",
      "",
    ].join("\n");
    fs.writeFileSync(NOTES_PATH, base, "utf8");
  }
}

const title = getArgValue("title") || "Phiên làm việc";
const summary = getArgValue("summary") || "(chưa ghi tóm tắt)";
const files = toList(getArgValue("files"), "(không có file)");
const commands = toCommandList(getArgValue("commands"));
const commit = getArgValue("commit") || "(chưa có commit)";
const next = getArgValue("next") || "(chưa ghi việc tiếp theo)";

const entry = [
  `### ${nowInHcm()} - ${title}`,
  "",
  "- **Mục tiêu**",
  `  ${title}`,
  "",
  "- **Tóm tắt thay đổi**",
  `  ${summary}`,
  "",
  "- **Files touched**",
  ...files.map((file) => `  - \`${file}\``),
  "",
  "- **Commands ran + kết quả**",
  ...commands.map((line) => `  ${line}`),
  "",
  "- **Commit hash + message**",
  `  ${commit}`,
  "",
  "- **Manual browser test checklist**",
  "  - [ ] Đăng nhập học viên và vào trang /student",
  "  - [ ] Kiểm tra tab Tổng quan hiển thị đúng dữ liệu",
  "  - [ ] Chuyển tab Tổng quan / Lịch học / Tài liệu / Học phí",
  "  - [ ] Kiểm tra responsive mobile và desktop",
  "  - [ ] Đăng xuất thành công",
  "",
  "- **Next steps**",
  `  ${next}`,
  "",
].join("\n");

ensureNotesFile();
fs.appendFileSync(NOTES_PATH, `${entry}\n`, "utf8");

console.log(`Đã append session note vào: ${NOTES_PATH}`);
