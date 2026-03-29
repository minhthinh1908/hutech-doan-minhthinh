import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client.js";
import BuyerSidebar from "../components/BuyerSidebar.jsx";
import { repairBadgeClass, repairStatusLabel } from "../utils/repairStatusConfig.js";
import "./BuyerPages.css";

function formatDateTime(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN");
  } catch {
    return "—";
  }
}

function formatDateOnly(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("vi-VN");
  } catch {
    return "—";
  }
}

function parseAttachments(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.filter((u) => typeof u === "string");
  return [];
}

export default function RepairsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try {
      const list = await apiGet("/repair-requests");
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || "Không tải được danh sách.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUp = () => load();
    window.addEventListener("bd-repair-updated", onUp);
    return () => window.removeEventListener("bd-repair-updated", onUp);
  }, [load]);

  async function openDetail(id) {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await apiGet(`/repair-requests/detail/${id}`);
      setDetail(d);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
  }

  useEffect(() => {
    if (!detailId) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") closeDetail();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Theo dõi sửa chữa</h1>
          <p className="buyer-page__sub">
            Danh sách yêu cầu bạn đã gửi từ «Xem bảo hành» — xem trạng thái, ngày dự kiến và phản hồi từ cửa hàng.
          </p>
        </div>
      </div>
      <div className="container buyer-shell">
        <BuyerSidebar />
        <div className="buyer-panel">
          {loading ? <div className="buyer-page__loading">Đang tải…</div> : null}
          {err ? (
            <p className="buyer-msg buyer-msg--err" role="alert">
              {err}
            </p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="buyer-muted">Chưa có yêu cầu nào. Gửi từ trang «Xem bảo hành» khi phiếu còn hiệu lực.</p>
          ) : null}
          {!loading && items.length > 0 ? (
            <div className="buyer-table-wrap">
              <table className="buyer-table">
                <thead>
                  <tr>
                    <th>Mã</th>
                    <th>Mã BH</th>
                    <th>Sản phẩm</th>
                    <th>Ngày gửi</th>
                    <th>Trạng thái</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => {
                    const pname = r.warranty?.order_item?.product?.product_name || "—";
                    return (
                      <tr key={r.repair_request_id}>
                        <td>#{r.repair_request_id}</td>
                        <td>#{r.warranty_id}</td>
                        <td>{pname}</td>
                        <td>{formatDateTime(r.request_date)}</td>
                        <td>
                          <span className={repairBadgeClass(r.repair_status)}>{repairStatusLabel(r.repair_status)}</span>
                        </td>
                        <td>
                          <button type="button" className="buyer-btn buyer-btn--link" onClick={() => openDetail(r.repair_request_id)}>
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>

      {detailId ? (
        <div className="buyer-modal-backdrop" role="presentation" onClick={(e) => e.target === e.currentTarget && closeDetail()}>
          <div className="buyer-modal buyer-modal--wide" role="dialog" aria-modal="true" aria-labelledby="buyer-repair-detail-title" onClick={(e) => e.stopPropagation()}>
            <h3 id="buyer-repair-detail-title">Chi tiết yêu cầu #{detailId}</h3>
            {detailLoading ? <p className="buyer-muted">Đang tải…</p> : null}
            {!detailLoading && detail ? (
              <div className="buyer-repair-detail">
                <div className="buyer-repair-detail__row">
                  <span className="buyer-repair-detail__label">Trạng thái</span>
                  <span className={repairBadgeClass(detail.repair_status)}>{repairStatusLabel(detail.repair_status)}</span>
                </div>
                <div className="buyer-repair-detail__row">
                  <span className="buyer-repair-detail__label">Sản phẩm</span>
                  <span>{detail.warranty?.order_item?.product?.product_name || "—"}</span>
                </div>
                <div className="buyer-repair-detail__row">
                  <span className="buyer-repair-detail__label">Mã bảo hành</span>
                  <span>#{detail.warranty_id}</span>
                </div>
                <div className="buyer-repair-detail__row">
                  <span className="buyer-repair-detail__label">Thời hạn BH</span>
                  <span>
                    {formatDateOnly(detail.warranty?.start_date)} — {formatDateOnly(detail.warranty?.end_date)}
                  </span>
                </div>
                {detail.expected_completion_date ? (
                  <div className="buyer-repair-detail__row">
                    <span className="buyer-repair-detail__label">Dự kiến hoàn tất</span>
                    <span>{formatDateOnly(detail.expected_completion_date)}</span>
                  </div>
                ) : null}
                <div className="buyer-repair-detail__block">
                  <span className="buyer-repair-detail__label">Mô tả gửi</span>
                  <p className="buyer-repair-detail__text">{detail.issue_description}</p>
                </div>
                {parseAttachments(detail.attachment_urls).length > 0 ? (
                  <div className="buyer-repair-detail__block">
                    <span className="buyer-repair-detail__label">Ảnh đính kèm</span>
                    <div className="buyer-repair-detail__imgs">
                      {parseAttachments(detail.attachment_urls).map((url) => (
                        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt="" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {detail.resolution_notes ? (
                  <div className="buyer-repair-detail__block buyer-repair-detail__block--highlight">
                    <span className="buyer-repair-detail__label">Phản hồi từ cửa hàng</span>
                    <p className="buyer-repair-detail__text">{detail.resolution_notes}</p>
                  </div>
                ) : null}
                {detail.completed_at ? (
                  <p className="buyer-muted" style={{ marginTop: "0.75rem", fontSize: "0.85rem" }}>
                    Cập nhật: {formatDateTime(detail.completed_at)}
                  </p>
                ) : null}
              </div>
            ) : null}
            {!detailLoading && !detail ? (
              <p className="buyer-msg buyer-msg--err">Không tải được chi tiết.</p>
            ) : null}
            <div className="buyer-actions" style={{ marginTop: "1rem" }}>
              <button type="button" className="buyer-btn" onClick={closeDetail}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
