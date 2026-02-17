"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchJson, type ApiClientError } from "@/lib/api-client";
import { clearToken, fetchMe, getToken } from "@/lib/auth-client";
import { ACTION_KEYS, MODULE_KEYS, type ActionKey, type ModuleKey } from "@/lib/permission-keys";
import { hasUiPermission } from "@/lib/ui-permissions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type PermissionGroup = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

type PermissionRule = {
  module: ModuleKey;
  action: ActionKey;
  allowed: boolean;
};

type UserItem = {
  id: string;
  name: string | null;
  email: string;
  role: string;
};

type TabKey = "groups" | "users";
type OverrideState = "default" | "allow" | "deny";

const ACTION_LABEL: Record<ActionKey, string> = {
  VIEW: "Xem",
  CREATE: "Tạo",
  UPDATE: "Sửa",
  FEEDBACK: "Phản hồi",
  EDIT: "Sửa",
  DELETE: "Xóa",
  EXPORT: "Xuất",
  ASSIGN: "Gán",
  RUN: "Chạy",
  INGEST: "Nạp dữ liệu",
};

function parseApiError(error: ApiClientError) {
  return `${error.code}: ${error.message}`;
}

function keyOf(moduleKey: ModuleKey, action: ActionKey) {
  return `${moduleKey}:${action}`;
}

export default function AdminPermissionPage() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [tab, setTab] = useState<TabKey>("groups");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchModule, setSearchModule] = useState("");

  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupRules, setGroupRules] = useState<Map<string, boolean>>(new Map());
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserGroupId, setSelectedUserGroupId] = useState<string>("");
  const [overrideMap, setOverrideMap] = useState<Map<string, OverrideState>>(new Map());

  const filteredModules = useMemo(() => {
    const q = searchModule.trim().toLowerCase();
    if (!q) return MODULE_KEYS;
    return MODULE_KEYS.filter((moduleKey) => moduleKey.toLowerCase().includes(q));
  }, [searchModule]);

  const loadGroups = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const data = await fetchJson<{ items: PermissionGroup[] }>("/api/admin/permission-groups?page=1&pageSize=200", { token });
    setGroups(data.items || []);
  }, []);

  const loadUsers = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const data = await fetchJson<{ items: UserItem[] }>("/api/users?page=1&pageSize=200", { token });
    setUsers(data.items || []);
  }, []);

  const loadGroupRules = useCallback(async (groupId: string) => {
    if (!groupId) return;
    const token = getToken();
    if (!token) return;
    const data = await fetchJson<{ group: PermissionGroup; rules: PermissionRule[] }>(`/api/admin/permission-groups/${groupId}/rules`, { token });
    setGroupName(data.group.name);
    setGroupDescription(data.group.description || "");
    const map = new Map<string, boolean>();
    for (const rule of data.rules) {
      map.set(keyOf(rule.module, rule.action), Boolean(rule.allowed));
    }
    setGroupRules(map);
  }, []);

  const loadUserOverrides = useCallback(async (userId: string) => {
    if (!userId) return;
    const token = getToken();
    if (!token) return;
    const data = await fetchJson<{
      user: { groupId: string | null };
      overrides: PermissionRule[];
    }>(`/api/admin/users/${userId}/permission-overrides`, { token });

    setSelectedUserGroupId(data.user.groupId || "");
    const map = new Map<string, OverrideState>();
    for (const override of data.overrides) {
      map.set(keyOf(override.module, override.action), override.allowed ? "allow" : "deny");
    }
    setOverrideMap(map);
  }, []);

  useEffect(() => {
    fetchMe()
      .then((data) => {
        const ok = hasUiPermission(data.user.permissions, "admin_users", "VIEW");
        setAllowed(ok);
      })
      .catch(() => {
        clearToken();
      })
      .finally(() => setCheckingAccess(false));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    setLoading(true);
    Promise.all([loadGroups(), loadUsers()])
      .catch((e) => {
        const err = e as ApiClientError;
        setError(`Không tải được dữ liệu: ${parseApiError(err)}`);
      })
      .finally(() => setLoading(false));
  }, [allowed, loadGroups, loadUsers]);

  useEffect(() => {
    if (!selectedGroupId) return;
    loadGroupRules(selectedGroupId).catch((e) => {
      const err = e as ApiClientError;
      setError(`Không tải được quyền nhóm: ${parseApiError(err)}`);
    });
  }, [loadGroupRules, selectedGroupId]);

  useEffect(() => {
    if (!selectedUserId) return;
    loadUserOverrides(selectedUserId).catch((e) => {
      const err = e as ApiClientError;
      setError(`Không tải được override người dùng: ${parseApiError(err)}`);
    });
  }, [loadUserOverrides, selectedUserId]);

  function toggleGroupRule(moduleKey: ModuleKey, action: ActionKey) {
    const key = keyOf(moduleKey, action);
    setGroupRules((prev) => {
      const next = new Map(prev);
      next.set(key, !Boolean(next.get(key)));
      return next;
    });
  }

  function setOverride(moduleKey: ModuleKey, action: ActionKey, state: OverrideState) {
    const key = keyOf(moduleKey, action);
    setOverrideMap((prev) => {
      const next = new Map(prev);
      if (state === "default") next.delete(key);
      else next.set(key, state);
      return next;
    });
  }

  async function createGroup() {
    const token = getToken();
    if (!token || !groupName.trim()) {
      setError("Thiếu dữ liệu bắt buộc");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await fetchJson<{ group: PermissionGroup }>("/api/admin/permission-groups", {
        method: "POST",
        token,
        body: { name: groupName.trim(), description: groupDescription.trim() || null },
      });
      await loadGroups();
      setSelectedGroupId(data.group.id);
      setSuccess("Đã tạo nhóm quyền.");
    } catch (e) {
      const err = e as ApiClientError;
      setError(`Không tạo được nhóm: ${parseApiError(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveGroupInfo() {
    const token = getToken();
    if (!token || !selectedGroupId || !groupName.trim()) {
      setError("Thiếu dữ liệu bắt buộc");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/admin/permission-groups/${selectedGroupId}`, {
        method: "PATCH",
        token,
        body: { name: groupName.trim(), description: groupDescription.trim() || null },
      });
      await loadGroups();
      setSuccess("Đã lưu thông tin nhóm quyền.");
    } catch (e) {
      const err = e as ApiClientError;
      setError(`Không lưu được nhóm quyền: ${parseApiError(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteGroup() {
    const token = getToken();
    if (!token || !selectedGroupId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await fetchJson(`/api/admin/permission-groups/${selectedGroupId}`, { method: "DELETE", token });
      setSelectedGroupId("");
      setGroupName("");
      setGroupDescription("");
      setGroupRules(new Map());
      await loadGroups();
      setSuccess("Đã xóa nhóm quyền.");
    } catch (e) {
      const err = e as ApiClientError;
      setError(`Không xóa được nhóm quyền: ${parseApiError(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveGroupRules() {
    const token = getToken();
    if (!token || !selectedGroupId) {
      setError("Thiếu dữ liệu bắt buộc");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const rules: PermissionRule[] = [];
      for (const moduleKey of MODULE_KEYS) {
        for (const action of ACTION_KEYS) {
          const allowed = Boolean(groupRules.get(keyOf(moduleKey, action)));
          rules.push({ module: moduleKey, action, allowed });
        }
      }

      await fetchJson(`/api/admin/permission-groups/${selectedGroupId}/rules`, {
        method: "PUT",
        token,
        body: { rules },
      });
      setSuccess("Đã lưu ma trận quyền của nhóm.");
    } catch (e) {
      const err = e as ApiClientError;
      setError(`Không lưu được rules: ${parseApiError(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function saveUserOverrides() {
    const token = getToken();
    if (!token || !selectedUserId) {
      setError("Thiếu dữ liệu bắt buộc");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const overrides: PermissionRule[] = [];
      for (const moduleKey of MODULE_KEYS) {
        for (const action of ACTION_KEYS) {
          const state = overrideMap.get(keyOf(moduleKey, action));
          if (!state || state === "default") continue;
          overrides.push({ module: moduleKey, action, allowed: state === "allow" });
        }
      }

      await fetchJson(`/api/admin/users/${selectedUserId}/permission-overrides`, {
        method: "PUT",
        token,
        body: {
          groupId: selectedUserGroupId || null,
          overrides,
        },
      });
      setSuccess("Đã lưu phân quyền người dùng.");
    } catch (e) {
      const err = e as ApiClientError;
      setError(`Không lưu được override: ${parseApiError(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function resetOverrides() {
    setOverrideMap(new Map());
  }

  if (checkingAccess) {
    return (
      <div className="flex items-center gap-2 text-zinc-700">
        <Spinner /> Đang kiểm tra quyền...
      </div>
    );
  }

  if (!allowed) {
    return <Alert type="error" message="Bạn không có quyền thực hiện" />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={tab === "groups" ? "primary" : "secondary"} onClick={() => setTab("groups")}>Nhóm quyền</Button>
          <Button variant={tab === "users" ? "primary" : "secondary"} onClick={() => setTab("users")}>Phân quyền theo người dùng</Button>
          <Input
            value={searchModule}
            onChange={(e) => setSearchModule(e.target.value)}
            placeholder="Tìm module..."
            className="min-w-[220px] md:ml-auto"
          />
        </div>
      </div>

      {error ? <Alert type="error" message={error} /> : null}
      {success ? <Alert type="success" message={success} /> : null}
      {loading ? <div className="text-sm text-zinc-600">Đang tải dữ liệu...</div> : null}

      {tab === "groups" ? (
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-3">
            <h2 className="text-sm font-semibold text-zinc-900">Danh sách nhóm quyền</h2>
            <Select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
              <option value="">Chọn nhóm quyền</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}{group.isSystem ? " (hệ thống)" : ""}
                </option>
              ))}
            </Select>

            <div className="space-y-2">
              <Input placeholder="Tên nhóm quyền" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
              <Input placeholder="Mô tả" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} />
              <div className="flex gap-2">
                <Button onClick={createGroup} disabled={saving}>Tạo nhóm</Button>
                {selectedGroupId ? <Button variant="secondary" onClick={saveGroupInfo} disabled={saving}>Lưu thông tin</Button> : null}
                {selectedGroupId ? <Button variant="secondary" onClick={deleteGroup} disabled={saving}>Xóa nhóm</Button> : null}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">Ma trận quyền của nhóm</h2>
              <Button variant="secondary" onClick={saveGroupRules} disabled={saving || !selectedGroupId}>Lưu</Button>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b border-zinc-200 px-2 py-2 text-left">Module</th>
                    {ACTION_KEYS.map((action) => (
                      <th key={action} className="border-b border-zinc-200 px-2 py-2 text-center">{ACTION_LABEL[action]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredModules.map((moduleKey) => (
                    <tr key={moduleKey}>
                      <td className="border-b border-zinc-100 px-2 py-2 font-mono text-xs text-zinc-700">{moduleKey}</td>
                      {ACTION_KEYS.map((action) => (
                        <td key={action} className="border-b border-zinc-100 px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(groupRules.get(keyOf(moduleKey, action)))}
                            onChange={() => toggleGroupRule(moduleKey, action)}
                            disabled={!selectedGroupId}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">Chọn người dùng</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email} ({user.role})
                </option>
              ))}
            </Select>

            <Select value={selectedUserGroupId} onChange={(e) => setSelectedUserGroupId(e.target.value)} disabled={!selectedUserId}>
              <option value="">Không gán nhóm</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveUserOverrides} disabled={saving || !selectedUserId}>Lưu override</Button>
            <Button variant="secondary" onClick={resetOverrides} disabled={saving || !selectedUserId}>Reset overrides</Button>
          </div>

          <div className="overflow-auto">
            <table className="w-full min-w-[1060px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-zinc-200 px-2 py-2 text-left">Module</th>
                  {ACTION_KEYS.map((action) => (
                    <th key={action} className="border-b border-zinc-200 px-2 py-2 text-center">{ACTION_LABEL[action]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredModules.map((moduleKey) => (
                  <tr key={moduleKey}>
                    <td className="border-b border-zinc-100 px-2 py-2 font-mono text-xs text-zinc-700">{moduleKey}</td>
                    {ACTION_KEYS.map((action) => {
                      const value = overrideMap.get(keyOf(moduleKey, action)) || "default";
                      return (
                        <td key={action} className="border-b border-zinc-100 px-2 py-2">
                          <Select
                            value={value}
                            onChange={(e) => setOverride(moduleKey, action, e.target.value as OverrideState)}
                            disabled={!selectedUserId}
                          >
                            <option value="default">Mặc định</option>
                            <option value="allow">Cho phép</option>
                            <option value="deny">Từ chối</option>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
