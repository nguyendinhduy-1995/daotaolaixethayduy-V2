import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AdminGuideClient } from "@/components/admin/AdminGuideClient";

export const dynamic = "force-dynamic";

export default function AdminGuidePage() {
  const filePath = join(process.cwd(), "FEATURE_MAP_AND_RUNBOOK.md");
  let markdown = "## Chưa có tài liệu\nVui lòng tạo FEATURE_MAP_AND_RUNBOOK.md ở thư mục gốc.";
  try {
    markdown = readFileSync(filePath, "utf8");
  } catch {
    // fallback nội dung mặc định
  }

  return <AdminGuideClient markdown={markdown} />;
}
