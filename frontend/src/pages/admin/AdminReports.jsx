import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../api/client.js";
import "./AdminPages.css";
import "./AdminReports.css";

function money(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0";
  return x.toLocaleString("vi-VN");
}

function formatError(err) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Không kết nối được máy chủ. Kiểm tra mạng, VPN hoặc thử lại sau.";
  }
  if (/internal server error|^500$/i.test(raw) || /^5\d\d$/.test(raw.trim())) {
    return "Lỗi máy chủ (5xx). Thử lại sau; nếu lặp lại, xem log backend hoặc cơ sở dữ liệu.";
  }
  return raw || "Đã xảy ra lỗi không xác định.";
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Trả về { from, to } dạng ISO cho API */
function rangeFromPreset(key) {
  const end = endOfDay(new Date());
  const start = startOfDay(new Date());
  switch (key) {
    case "7d":
      start.setDate(start.getDate() - 6);
      break;
    case "30d":
      start.setDate(start.getDate() - 29);
      break;
    case "90d":
      start.setDate(start.getDate() - 89);
      break;
    case "ytd":
      start.setMonth(0, 1);
      break;
    default:
      start.setDate(start.getDate() - 29);
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

const ORDER_STATUS_LABELS = {
  pending: "Chờ xử lý",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
  processing: "Đang xử lý (cũ)",
  shipped: "Đang giao (cũ)"
};

const MAIN_PRESETS = [
  { key: "7d", label: "7 ngày" },
  { key: "30d", label: "30 ngày" },
  { key: "90d", label: "90 ngày" },
  { key: "ytd", label: "Năm nay" }
];

function formatBucket(bucket, groupBy) {
  if (bucket == null) return "—";
  try {
    const d = new Date(bucket);
    if (Number.isNaN(d.getTime())) return String(bucket);
    if (groupBy === "month") {
      return d.toLocaleDateString("vi-VN", { month: "short", year: "numeric" });
    }
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch {
    return String(bucket);
  }
}

export default function AdminReports() {
  const initial = useMemo(() => rangeFromPreset("30d"), []);
  const [preset, setPreset] = useState("30d");
  const [customFrom, setCustomFrom] = useState(initial.from.slice(0, 10));
  const [customTo, setCustomTo] = useState(initial.to.slice(0, 10));
  /** Chỉ cập nhật khi chọn preset có sẵn hoặc bấm «Áp dụng» — tránh gọi API khi gõ ngày */
  const [appliedFrom, setAppliedFrom] = useState(initial.from.slice(0, 10));
  const [appliedTo, setAppliedTo] = useState(initial.to.slice(0, 10));
  const [chartGroupBy, setChartGroupBy] = useState("day");

  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [top, setTop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const rangeForPreset = useMemo(() => {
    if (preset === "custom") return null;
    return rangeFromPreset(preset);
  }, [preset]);

  const activeRange = useMemo(() => {
    if (preset === "custom") {
      if (!appliedFrom || !appliedTo) return null;
      const from = startOfDay(new Date(appliedFrom)).toISOString();
      const to = endOfDay(new Date(appliedTo)).toISOString();
      if (new Date(from) > new Date(to)) return null;
      return { from, to };
    }
    return rangeForPreset;
  }, [preset, appliedFrom, appliedTo, rangeForPreset]);

  const loadData = useCallback(async () => {
    const range = activeRange;
    if (!range) {
      setErr("Chọn khoảng thời gian hợp lệ (ngày bắt đầu ≤ ngày kết thúc).");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const params = { from: range.from, to: range.to };
      const [summaryData, revenueData, topData] = await Promise.all([
        apiGet("/admin/reports/summary", params),
        apiGet("/admin/reports/revenue", { ...params, groupBy: chartGroupBy }),
        apiGet("/admin/reports/top-products", { ...params, limit: 10 })
      ]);
      setSummary(summaryData);
      setRevenue(revenueData);
      setTop(topData);
    } catch (e) {
      setErr(formatError(e));
      setSummary(null);
      setRevenue(null);
      setTop(null);
    } finally {
      setLoading(false);
    }
  }, [activeRange, chartGroupBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handlePreset(key) {
    setPreset(key);
    const r = rangeFromPreset(key);
    setCustomFrom(r.from.slice(0, 10));
    setCustomTo(r.to.slice(0, 10));
    if (key !== "custom") {
      setAppliedFrom(r.from.slice(0, 10));
      setAppliedTo(r.to.slice(0, 10));
    }
  }

  function goCustomMode() {
    setPreset("custom");
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) {
      setErr("Chọn đủ ngày bắt đầu và kết thúc.");
      return;
    }
    setAppliedFrom(customFrom);
    setAppliedTo(customTo);
    setPreset("custom");
  }

  const revenueRows = revenue?.rows || [];
  const maxRev = useMemo(() => {
    let m = 0;
    for (const row of revenueRows) {
      const v = Number(row.revenue);
      if (Number.isFinite(v) && v > m) m = v;
    }
    return m || 1;
  }, [revenueRows]);

  const topRows = top?.rows || [];
  const statusEntries = summary?.orders_by_status
    ? Object.entries(summary.orders_by_status).sort((a, b) => b[1] - a[1])
    : [];

  const kpis = summary?.kpis;

  return (
    <div className="admin-page admin-report">
      <h1>Báo cáo &amp; thống kê</h1>
      <p className="admin-page__muted">
        Tổng quan bán hàng theo kỳ: doanh thu (đơn đã thanh toán), đơn hàng, khách, sản phẩm, voucher và hậu mãi. Điều chỉnh
        khoảng thời gian để lọc toàn bộ báo cáo bên dưới.
      </p>

      <aside className="admin-report__examples" aria-label="Ví dụ đọc số liệu">
        <p className="admin-report__examples-title">Ví dụ đọc số liệu</p>
        <ul className="admin-report__examples-list">
          <li>
            <strong>Doanh thu = 0đ nhưng «Đơn hàng» &gt; 0:</strong> thường do đơn trong kỳ chưa ghi nhận thanh toán (trạng thái
            khác paid/success). Ví dụ đơn COD mới đặt còn unpaid — cập nhật thanh toán ở mục Đơn hàng thì doanh thu mới tính.
          </li>
          <li>
            <strong>Đơn hàng (trong kỳ):</strong> mọi trạng thái giao hàng, lọc theo ngày đặt — khác với doanh thu chỉ lấy đơn đã
            thanh toán.
          </li>
          <li>
            <strong>Khách hàng:</strong> số lớn là tổng tài khoản đăng ký; dòng nhỏ là bao nhiêu người có ít nhất một đơn trong
            kỳ đang lọc.
          </li>
        </ul>
      </aside>

      <div className="admin-report__toolbar">
        <div className="admin-report__toolbar-group">
          <label>Khoảng thời gian</label>
          <div className="admin-report__preset-row">
            {MAIN_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`admin-report__preset-btn${preset === p.key ? " admin-report__preset-btn--active" : ""}`}
                onClick={() => handlePreset(p.key)}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`admin-report__preset-btn${preset === "custom" ? " admin-report__preset-btn--active" : ""}`}
              onClick={goCustomMode}
            >
              Tùy chỉnh
            </button>
          </div>
        </div>
        <div className="admin-report__toolbar-group">
          <label>Từ ngày — đến ngày</label>
          <div className="admin-report__date-inputs">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="admin-page__muted">—</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            <button type="button" className="admin-report__apply" onClick={applyCustomRange}>
              Áp dụng
            </button>
          </div>
        </div>
        <div className="admin-report__toolbar-group">
          <label>Doanh thu theo</label>
          <div className="admin-report__chart-mode">
            <button
              type="button"
              className={`admin-report__mini-btn${chartGroupBy === "day" ? " admin-report__mini-btn--on" : ""}`}
              onClick={() => setChartGroupBy("day")}
            >
              Theo ngày
            </button>
            <button
              type="button"
              className={`admin-report__mini-btn${chartGroupBy === "month" ? " admin-report__mini-btn--on" : ""}`}
              onClick={() => setChartGroupBy("month")}
            >
              Theo tháng
            </button>
          </div>
        </div>
      </div>

      {err ? (
        <p className="admin-msg admin-msg--err" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? (
        <div className="admin-report__loading">
          <span className="admin-report__spinner" aria-hidden />
          Đang tải số liệu…
        </div>
      ) : (
        <>
          <section className="admin-report__kpis" aria-label="Chỉ số tổng quan">
            <article className="admin-report__kpi admin-report__kpi--revenue">
              <p className="admin-report__kpi-label">Doanh thu (kỳ đang chọn)</p>
              <p className="admin-report__kpi-value">{money(kpis?.revenue)}đ</p>
              <p className="admin-report__kpi-sub">Chỉ tính đơn có thanh toán paid / success.</p>
            </article>
            <article className="admin-report__kpi admin-report__kpi--orders">
              <p className="admin-report__kpi-label">Đơn hàng (trong kỳ)</p>
              <p className="admin-report__kpi-value">{money(kpis?.orders_count)}</p>
              <p className="admin-report__kpi-sub">Mọi trạng thái đơn, theo ngày đặt.</p>
            </article>
            <article className="admin-report__kpi admin-report__kpi--customers">
              <p className="admin-report__kpi-label">Khách hàng</p>
              <p className="admin-report__kpi-value">{money(kpis?.customers_registered)}</p>
              <p className="admin-report__kpi-sub">
                Tài khoản đăng ký (tổng). Trong kỳ có <strong>{money(kpis?.buyers_in_period)}</strong> người đặt đơn.
              </p>
            </article>
            <article className="admin-report__kpi admin-report__kpi--products">
              <p className="admin-report__kpi-label">Sản phẩm (catalog)</p>
              <p className="admin-report__kpi-value">{money(kpis?.products_catalog)}</p>
              <p className="admin-report__kpi-sub">Tổng SKU trong hệ thống.</p>
            </article>
          </section>

          <section className="admin-report__section">
            <div className="admin-report__section-head">
              <h2 className="admin-report__section-title">Doanh thu theo thời gian</h2>
              <p className="admin-report__section-hint">
                {revenue?.groupBy === "month" ? "Nhóm theo tháng" : "Nhóm theo ngày"} — cùng kỳ với bộ lọc phía trên.
              </p>
            </div>
            {revenueRows.length === 0 ? (
              <div className="admin-report__empty">Không có dữ liệu doanh thu trong kỳ đã chọn.</div>
            ) : (
              <>
                <div className="admin-report__chart" role="img" aria-label="Biểu đồ cột doanh thu">
                  {revenueRows.map((row, i) => {
                    const v = Number(row.revenue);
                    const pct = maxRev > 0 ? Math.max(4, (v / maxRev) * 100) : 4;
                    return (
                      <div key={i} className="admin-report__bar-col">
                        <div className="admin-report__bar-value">{money(row.revenue)}đ</div>
                        <div className="admin-report__bar-area">
                          <div className="admin-report__bar" style={{ height: `${pct}%` }} title={`${money(row.revenue)}đ`} />
                        </div>
                        <div className="admin-report__bar-caption">{formatBucket(row.bucket, revenue?.groupBy)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="admin-table-wrap" style={{ marginTop: "1rem" }}>
                  <table className="admin-table admin-table--compact">
                    <thead>
                      <tr>
                        <th>Kỳ</th>
                        <th>Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {revenueRows.map((row, i) => (
                        <tr key={i}>
                          <td>{formatBucket(row.bucket, revenue?.groupBy)}</td>
                          <td>{money(row.revenue)}đ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="admin-report__section">
            <div className="admin-report__section-head">
              <h2 className="admin-report__section-title">Top sản phẩm bán chạy</h2>
              <p className="admin-report__section-hint">Theo doanh thu dòng (đơn đã thanh toán) trong kỳ.</p>
            </div>
            {topRows.length === 0 ? (
              <div className="admin-report__empty">Chưa có dữ liệu bán trong kỳ.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Tên sản phẩm</th>
                      <th>Số lượng bán</th>
                      <th>Doanh thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topRows.map((row, i) => (
                      <tr key={row.product_id ?? i}>
                        <td>{i + 1}</td>
                        <td>{row.product_name}</td>
                        <td>{money(row.total_quantity)}</td>
                        <td>{money(row.total_sales)}đ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="admin-report__grid-2">
            <section className="admin-report__panel">
              <h3 className="admin-report__panel-title">Đơn hàng theo trạng thái (trong kỳ)</h3>
              {statusEntries.length === 0 ? (
                <div className="admin-report__empty" style={{ padding: "1rem" }}>
                  Không có đơn trong kỳ.
                </div>
              ) : (
                <div className="admin-report__status-list">
                  {statusEntries.map(([code, count]) => (
                    <div key={code} className="admin-report__status-row">
                      <span className="admin-report__status-name">{ORDER_STATUS_LABELS[code] || code}</span>
                      <span className="admin-report__status-pill">{money(count)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="admin-report__panel">
              <h3 className="admin-report__panel-title">Voucher</h3>
              <div className="admin-report__voucher-row">
                <span>Số lượt dùng (gắn đơn trong kỳ)</span>
                <strong>{money(summary?.voucher?.usage_count)}</strong>
              </div>
              <div className="admin-report__voucher-row">
                <span>Tổng tiền giảm</span>
                <strong>{money(summary?.voucher?.total_discount)}đ</strong>
              </div>
            </section>
          </div>

          <section className="admin-report__section">
            <h2 className="admin-report__section-title">Hậu mãi</h2>
            <p className="admin-page__muted" style={{ marginTop: 0 }}>
              Theo ngày tạo yêu cầu, trong kỳ lọc.
            </p>
            <div className="admin-report__after-grid">
              <div className="admin-report__after-card">
                <span>Yêu cầu sửa chữa</span>
                <strong>{money(summary?.after_sales?.repair_requests)}</strong>
              </div>
              <div className="admin-report__after-card">
                <span>Yêu cầu hoàn tiền</span>
                <strong>{money(summary?.after_sales?.refund_requests)}</strong>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
