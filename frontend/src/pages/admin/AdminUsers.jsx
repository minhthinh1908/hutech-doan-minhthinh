import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

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

function orderStatusVi(s) {
  const m = {
    pending: "Chờ xử lý",
    confirmed: "Đã xác nhận",
    shipping: "Đang giao",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    processing: "Đang xử lý (cũ)",
    shipped: "Đang giao (cũ)"
  };
  return m[s] || s || "—";
}

function payVi(s) {
  const m = {
    unpaid: "Chưa thanh toán",
    paid: "Đã thanh toán",
    pending: "Đang chờ",
    refunded: "Đã hoàn tiền"
  };
  return m[s] || s || "—";
}

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailOrders, setDetailOrders] = useState([]);
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
        if (!cancelled) setErr(e.message || "Không tải được danh sách.");
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
      setDetailOrders([]);
      setDetailErr("");
      return undefined;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailErr("");
    (async () => {
      try {
        const [u, orders] = await Promise.all([
          apiGet(`/admin/users/${detailId}`),
          apiGet("/admin/orders", { user_id: detailId })
        ]);
        if (cancelled) return;
        setDetail(u);
        setDetailOrders(Array.isArray(orders) ? orders : []);
      } catch (e) {
        if (!cancelled) {
          setDetail(null);
          setDetailOrders([]);
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
      setErr(e.message || "Không đổi được vai trò");
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
      setErr(e.message || "Không cập nhật được trạng thái.");
    }
  }

  function closeDetail() {
    setDetailId(null);
  }

  return (
    <div className="admin-page">
      <h1>Quản lý người dùng</h1>
      <p className="admin-page__muted">
        Xem danh sách, khóa / mở tài khoản, xem chi tiết và lịch sử đơn hàng. Khách không đăng nhập không có trong
        danh sách này.
      </p>
      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="admin-msg admin-msg--ok" role="status">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <p>Đang tải…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Họ tên</th>
                <th>Email</th>
                <th>SĐT</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "#666" }}>
                    Chưa có người dùng nào.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const locked = u.status === "inactive";
                  return (
                    <tr key={u.user_id}>
                      <td>{u.user_id}</td>
                      <td>{u.full_name}</td>
                      <td style={{ wordBreak: "break-all" }}>{u.email}</td>
                      <td>{u.phone || "—"}</td>
                      <td>
                        <select
                          className="admin-select--order-status"
                          value={String(u.role_id)}
                          onChange={(e) => setRole(u.user_id, e.target.value)}
                          aria-label={`Vai trò ${u.full_name}`}
                        >
                          {roles.map((r) => (
                            <option key={r.role_id} value={String(r.role_id)}>
                              {r.role_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className={`admin-badge ${locked ? "admin-badge--off" : "admin-badge--ok"}`}>
                          {locked ? "Đã khóa" : "Hoạt động"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                          <button
                            type="button"
                            className="admin-btn"
                            style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                            onClick={() => {
                              setDetailId(String(u.user_id));
                              setMsg("");
                            }}
                          >
                            Chi tiết
                          </button>
                          {locked ? (
                            <button
                              type="button"
                              className="admin-btn"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                              onClick={() => setStatus(u.user_id, "active")}
                            >
                              Mở khóa
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn admin-btn--danger"
                              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                              onClick={() => {
                                if (window.confirm(`Khóa tài khoản ${u.email}? Họ sẽ không đăng nhập được.`)) {
                                  setStatus(u.user_id, "inactive");
                                }
                              }}
                            >
                              Khóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {detailId ? (
        <div
          className="admin-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-user-detail-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <div className="admin-modal admin-modal--user" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="admin-modal__close" aria-label="Đóng" onClick={closeDetail}>
              ×
            </button>
            <h2 className="admin-modal__title" id="admin-user-detail-title">
              Chi tiết người dùng
            </h2>

            {detailLoading ? (
              <p>Đang tải…</p>
            ) : detailErr ? (
              <p className="admin-msg admin-msg--err" role="alert">
                {detailErr}
              </p>
            ) : detail ? (
              <div className="admin-order-detail">
                <div className="admin-order-detail__grid">
                  <div>
                    <strong>ID</strong>
                    {detail.user_id}
                  </div>
                  <div>
                    <strong>Họ tên</strong>
                    {detail.full_name}
                  </div>
                  <div>
                    <strong>Email</strong>
                    {detail.email}
                  </div>
                  <div>
                    <strong>Số điện thoại</strong>
                    {detail.phone || "—"}
                  </div>
                  <div>
                    <strong>Vai trò</strong>
                    {detail.role_name || "—"}
                  </div>
                  <div>
                    <strong>Trạng thái</strong>
                    {detail.status === "inactive" ? "Đã khóa (inactive)" : "Hoạt động (active)"}
                  </div>
                  <div>
                    <strong>Ngày tạo</strong>
                    {fmtDate(detail.created_at)}
                  </div>
                  <div>
                    <strong>Tổng đơn hàng</strong>
                    {detail.order_count != null ? detail.order_count : "—"}
                  </div>
                </div>

                <div>
                  <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>Lịch sử đơn hàng</h3>
                  {detailOrders.length === 0 ? (
                    <p className="admin-page__muted" style={{ margin: 0 }}>
                      Chưa có đơn hàng.
                    </p>
                  ) : (
                    <div className="admin-table-wrap" style={{ maxHeight: "min(50vh, 320px)", overflow: "auto" }}>
                      <table className="admin-table admin-table--compact">
                        <thead>
                          <tr>
                            <th>Mã đơn</th>
                            <th>Ngày</th>
                            <th>Trạng thái</th>
                            <th>Thanh toán</th>
                            <th>Tổng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailOrders.map((o) => (
                            <tr key={String(o.order_id)}>
                              <td>#{String(o.order_id)}</td>
                              <td>{fmtDate(o.order_date)}</td>
                              <td>{orderStatusVi(o.order_status)}</td>
                              <td>{payVi(o.payment_status)}</td>
                              <td>{money(o.total_amount)}đ</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
