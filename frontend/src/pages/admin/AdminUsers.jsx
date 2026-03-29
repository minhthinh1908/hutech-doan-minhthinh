import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPatch } from "../../api/client.js";
import "./AdminPages.css";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const [u, r] = await Promise.all([apiGet("/admin/users"), apiGet("/admin/roles")]);
    setUsers(Array.isArray(u) ? u : []);
    setRoles(Array.isArray(r) ? r : []);
  }, []);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
  }, [load]);

  async function setRole(userId, role_id) {
    setErr("");
    try {
      await apiPatch(`/admin/users/${userId}`, { role_id });
      await load();
    } catch (e) {
      setErr(e.message || "Không đổi được vai trò");
    }
  }

  async function setStatus(userId, status) {
    setErr("");
    try {
      await apiPatch(`/admin/users/${userId}`, { status });
      await load();
    } catch (e) {
      setErr(e.message || "Lỗi");
    }
  }

  return (
    <div className="admin-page">
      <h1>Khách hàng / tài khoản</h1>
      <p className="admin-page__muted">Buyer và admin — guest không có dòng trong bảng này.</p>
      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td>{u.user_id}</td>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>
                  <select value={String(u.role_id)} onChange={(e) => setRole(u.user_id, e.target.value)}>
                    {roles.map((r) => (
                      <option key={r.role_id} value={String(r.role_id)}>
                        {r.role_name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={u.status} onChange={(e) => setStatus(u.user_id, e.target.value)}>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
