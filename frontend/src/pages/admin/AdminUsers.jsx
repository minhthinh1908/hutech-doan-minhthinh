import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import { CoreBadge, CoreButton, CoreCard, CoreDialog, CoreMessage, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

function money(n) {
  return Number(n || 0).toLocaleString("vi-VN");
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      dateStyle: "short",
      timeStyle: "short"
    });
  } catch {
    return String(iso);
  }
}

function activityKindVi(kind) {
  const m = {
    order: "Đơn hàng",
    review: "Đánh giá",
    warranty: "Bảo hành",
    repair: "Sửa chữa",
    refund: "Hoàn tiền"
  };
  return m[kind] || kind || "—";
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  useAdminToastNotices({ err, msg, setErr, setMsg });

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailActivity, setDetailActivity] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([apiGet("/admin/users"), apiGet("/admin/roles")]);
    setUsers(Array.isArray(u) ? u : []);
    setRoles(Array.isArray(r) ? r : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        await load();
      } catch (e) {
        if (!cancelled) setErr(e.message || "Không tải được dữ liệu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!detailId) {
      setDetail(null);
      setDetailActivity([]);
      setDetailErr("");
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailErr("");
    (async () => {
      try {
        const [u, activity] = await Promise.all([
          apiGet(`/admin/users/${detailId}`),
          apiGet(`/admin/users/${detailId}/activity`)
        ]);
        if (cancelled) return;
        setDetail(u);
        setDetailActivity(Array.isArray(activity) ? activity : []);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setDetailActivity([]);
          setDetailErr(e.message || "Không tải được chi tiết.");
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  async function setRole(userId, role_id) {
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/users/${userId}`, { role_id });
      setMsg("Đã cập nhật vai trò.");
      await load();
      if (detailId === String(userId)) {
        try {
          const u = await apiGet(`/admin/users/${userId}`);
          setDetail(u);
        } catch {
          /* giữ chi tiết cũ nếu lỗi */
        }
      }
    } catch (e) {
      setErr(e.message || "Không cập nhật được dữ liệu.");
    }
  }

  async function setStatus(userId, status) {
    setErr("");
    setMsg("");
    try {
      await apiPatch(`/admin/users/${userId}`, { status });
      setMsg(status === "inactive" ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản.");
      await load();
      setDetail((d) => (d && String(d.user_id) === String(userId) ? { ...d, status } : d));
    } catch (e) {
      setErr(e.message || "Không cập nhật được dữ liệu.");
    }
  }

  function closeDetail() {
    setDetailId(null);
  }

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Quản lý người dùng</h1>
      <p className="admin-lead">
        Xem danh sách, khóa / mở tài khoản, xem chi tiết và lịch sử đơn hàng. Khách không đăng nhập không có trong
        danh sách này.
      </p>
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10">
          <CoreSpinner />
          <span className="text-[#666666] font-semibold">Đang tải dữ liệu…</span>
        </div>
      ) : (
        <CoreCard>
          <CoreTable
            value={users}
            dataKey="user_id"
            rows={10}
            emptyMessage="Chưa có người dùng nào."
            columns={[
              { key: "id", header: "ID", field: "user_id" },
              { key: "name", header: "Họ tên", field: "full_name" },
              { key: "email", header: "Email", body: (u) => <span className="break-all">{u.email}</span> },
              { key: "phone", header: "SĐT", body: (u) => u.phone || "—" },
              {
                key: "role",
                header: "Vai trò",
                body: (u) => (
                  <select
                    className="admin-form-control min-w-[140px] py-1.5 text-xs"
                    value={String(u.role_id)}
                    onChange={(e) => setRole(u.user_id, e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.role_id} value={String(r.role_id)}>
                        {r.role_name}
                      </option>
                    ))}
                  </select>
                ),
              },
              {
                key: "status",
                header: "Trạng thái",
                body: (u) => {
                  const locked = u.status === "inactive";
                  return <CoreBadge value={locked ? "Đã khóa" : "Hoạt động"} tone={locked ? "danger" : "success"} />;
                },
              },
            ]}
            actionConfig={{
              onView: (row) => {
                setDetailId(String(row.user_id));
                setMsg("");
              },
              copyFields: [
                { label: "ID người dùng", field: "user_id" },
                { label: "Email", field: "email" },
                { label: "Số điện thoại", field: "phone" },
              ],
              getExtraItems: (row) => {
                const locked = row.status === "inactive";
                return [
                  locked
                    ? {
                        label: "Mở khóa",
                        icon: "pi pi-lock-open",
                        command: () => setStatus(row.user_id, "active"),
                      }
                    : {
                        label: "Khóa tài khoản",
                        icon: "pi pi-lock",
                        command: () => {
                          if (window.confirm(`Khóa tài khoản ${row.email}? Họ sẽ không đăng nhập được.`)) {
                            setStatus(row.user_id, "inactive");
                          }
                        },
                      },
                ];
              },
              excel: { fileName: "admin-users.xlsx" },
            }}
          />
        </CoreCard>
      )}

      <CoreDialog
        header="Chi tiết người dùng"
        visible={detailId != null}
        modal
        onHide={closeDetail}
        breakpoints={{ "960px": "100vw" }}
      >
        {detailLoading ? (
          <div className="flex items-center gap-3 py-4">
            <CoreSpinner className="h-6 w-6" />
            <span>Đang tải chi tiết…</span>
          </div>
        ) : detailErr ? (
          <CoreMessage severity="error" text={detailErr} />
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><strong>ID:</strong> {detail.user_id}</div>
              <div><strong>Họ tên:</strong> {detail.full_name}</div>
              <div><strong>Email:</strong> {detail.email}</div>
              <div><strong>Số điện thoại:</strong> {detail.phone || "—"}</div>
              <div className="sm:col-span-2"><strong>Địa chỉ:</strong> <span className="whitespace-pre-wrap">{detail.address || "—"}</span></div>
              <div><strong>Vai trò:</strong> {detail.role_name || "—"}</div>
              <div><strong>Trạng thái:</strong> {detail.status === "inactive" ? "Đã khóa (inactive)" : "Hoạt động (active)"}</div>
              <div><strong>Ngày tạo:</strong> {fmtDate(detail.created_at)}</div>
              <div><strong>Tổng đơn hàng:</strong> {detail.order_count != null ? detail.order_count : "—"}</div>
            </div>

            <CoreCard>
              <h3 className="font-bold mb-2">Lịch sử hoạt động</h3>
              {detailActivity.length === 0 ? (
                <p className="text-sm text-[#666666] m-0">Chưa có hoạt động nào được ghi nhận.</p>
              ) : (
                <CoreTable
                  value={detailActivity}
                  dataKey="at"
                  paginator={false}
                  columns={[
                    { key: "at", header: "Thời gian", body: (ev) => fmtDate(ev.at) },
                    { key: "kind", header: "Loại", body: (ev) => activityKindVi(ev.kind) },
                    { key: "title", header: "Tiêu đề", body: (ev) => ev.title || "—" },
                    {
                      key: "meta",
                      header: "Chi tiết",
                      body: (ev) => (
                        <span>
                          {ev.meta || "—"}
                          {ev.kind === "order" && ev.detail?.total_amount != null ? ` · ${money(ev.detail.total_amount)}đ` : ""}
                        </span>
                      ),
                    },
                  ]}
                />
              )}
            </CoreCard>
          </div>
        ) : null}
      </CoreDialog>
    </div>
  );
}
