-- Seed 3 permission groups on production
-- Run: docker compose -f docker-compose.prod.yml exec -T postgres psql -U thayduy -d thayduy_crm < scripts/seed-permission-groups.sql

-- Create groups
INSERT INTO "PermissionGroup" (id, name, description, "isSystem", "createdAt", "updatedAt")
VALUES
  ('grp_staff_001', 'Nhân viên', 'Quyền cơ bản cho nhân viên telesales / direct_page', true, NOW(), NOW()),
  ('grp_manager_001', 'Trưởng phòng', 'Quyền quản lý: lead, học viên, khoá học, lịch, KPI, HR cơ bản, chi phí', true, NOW(), NOW()),
  ('grp_admin_001', 'Quản trị', 'Full quyền – admin hệ thống', true, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, "updatedAt" = NOW();

-- Clear old rules
DELETE FROM "PermissionRule" WHERE "groupId" IN ('grp_staff_001', 'grp_manager_001', 'grp_admin_001');

-- ─── Nhân viên (15 rules) ────────────────────────────────
INSERT INTO "PermissionRule" (id, "groupId", module, action, allowed, "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'grp_staff_001', 'overview', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'leads', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'leads', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'leads', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'leads_board', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'kpi_daily', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'goals', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'schedule', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'receipts', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'receipts', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'notifications', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'notifications', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'my_payroll', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'outbound_jobs', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_staff_001', 'messaging', 'VIEW', true, NOW(), NOW());

-- ─── Trưởng phòng (48 rules) ─────────────────────────────
INSERT INTO "PermissionRule" (id, "groupId", module, action, allowed, "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'grp_manager_001', 'overview', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'leads', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'leads', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'leads', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'leads', 'DELETE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'leads', 'EXPORT', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'leads', 'ASSIGN', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'leads_board', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'students', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'students', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'students', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'courses', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'courses', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'courses', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'schedule', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'schedule', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'schedule', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'receipts', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'receipts', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'receipts', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'kpi_daily', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'kpi_targets', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'kpi_targets', 'EDIT', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'goals', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'goals', 'EDIT', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'ai_suggestions', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'ai_suggestions', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'ai_suggestions', 'FEEDBACK', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'notifications', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'notifications', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'notifications', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'outbound_jobs', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'outbound_jobs', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'messaging', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'messaging', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'my_payroll', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'hr_attendance', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'hr_attendance', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'hr_attendance', 'UPDATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'hr_kpi', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'hr_kpi', 'CREATE', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'expenses', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'expenses', 'EDIT', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'insights', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'automation_logs', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'marketing_meta_ads', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'admin_branches', 'VIEW', true, NOW(), NOW()),
  (gen_random_uuid(), 'grp_manager_001', 'admin_tuition', 'VIEW', true, NOW(), NOW());

-- ─── Quản trị (all modules × all actions) ────────────────
DO $$
DECLARE
  mods TEXT[] := ARRAY['overview','leads','leads_board','kpi_daily','kpi_targets','goals',
    'ai_kpi_coach','ai_suggestions','students','courses','schedule',
    'receipts','notifications','outbound_jobs','messaging','my_payroll',
    'ops_ai_hr','ops_n8n','automation_logs','automation_run',
    'marketing_meta_ads','admin_branches','admin_users','admin_segments',
    'admin_tuition','admin_notification_admin','admin_automation_admin',
    'admin_send_progress','admin_plans','admin_student_content',
    'admin_instructors','hr_kpi','hr_payroll_profiles','hr_attendance',
    'hr_total_payroll','api_hub','expenses','salary','insights','admin_tracking'];
  acts TEXT[] := ARRAY['VIEW','CREATE','UPDATE','FEEDBACK','EDIT','DELETE','EXPORT','ASSIGN','RUN','INGEST'];
  m TEXT; a TEXT;
BEGIN
  FOREACH m IN ARRAY mods LOOP
    FOREACH a IN ARRAY acts LOOP
      INSERT INTO "PermissionRule" (id, "groupId", module, action, allowed, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'grp_admin_001', m, a, true, NOW(), NOW());
    END LOOP;
  END LOOP;
END$$;

-- Verify
SELECT pg.name, COUNT(pr.id) AS rules
FROM "PermissionGroup" pg
LEFT JOIN "PermissionRule" pr ON pr."groupId" = pg.id
GROUP BY pg.name ORDER BY pg.name;
