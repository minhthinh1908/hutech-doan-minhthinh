import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../api/client.js";
import { CoreBadge, CoreCard, CoreChart, CoreFilterActions, CoreFilterButtons, CoreSpinner, CoreTable } from "../../components/ui/index.js";
import useAdminToastNotices from "../../hooks/useAdminToastNotices.js";

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
const PRESET_FILTER_OPTIONS = [...MAIN_PRESETS, { key: "custom", label: "Tùy chỉnh" }];
const REVENUE_GROUP_OPTIONS = [
  { key: "day", label: "Theo ngày" },
  { key: "month", label: "Theo tháng" }
];
const FILTER_BUTTON_CLASS = "!px-3 !py-1.5 text-sm";

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
  useAdminToastNotices({ err, setErr });

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

  const revenueChartData = useMemo(() => {
    const labels = revenueRows.map((row) => formatBucket(row.bucket, revenue?.groupBy));
    const values = revenueRows.map((row) => Number(row.revenue || 0));
    return {
      labels,
      datasets: [
        {
          label: "Doanh thu",
          data: values,
          backgroundColor: "rgba(59, 130, 246, 0.85)",
          borderColor: "rgba(29, 78, 216, 1)",
          borderWidth: 1
        }
      ]
    };
  }, [revenueRows, revenue?.groupBy]);

  const revenueChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${money(ctx.parsed.y)}đ`
          }
        }
      },
      scales: {
        y: {
          ticks: {
            callback: (value) => `${money(value)}đ`
          }
        }
      }
    }),
    []
  );

  return (
    <div className="admin-page">
      <h1 className="admin-section-title">Báo cáo &amp; thống kê</h1>
      <p className="admin-lead mt-2 max-w-4xl">
        Tổng quan bán hàng theo kỳ: doanh thu (đơn đã thanh toán), đơn hàng, khách, sản phẩm, voucher và hậu mãi. Điều chỉnh
        khoảng thời gian để lọc toàn bộ báo cáo bên dưới.
      </p>

      <CoreCard className="mt-4">
        <aside aria-label="Ví dụ đọc số liệu">
          <div className="text-xs font-extrabold uppercase tracking-wide text-[#1d4ed8] mb-2">Ví dụ đọc số liệu</div>
          <ul className="text-sm text-[#4b5563] list-disc pl-5 space-y-2">
            <li>
              <strong>Doanh thu = 0đ nhưng «Đơn hàng» &gt; 0:</strong> thường do đơn trong kỳ chưa ghi nhận thanh toán (trạng thái khác
              paid/success). Ví dụ đơn COD mới đặt còn unpaid — cập nhật thanh toán ở mục Đơn hàng thì doanh thu mới tính.
            </li>
            <li>
              <strong>Đơn hàng (trong kỳ):</strong> mọi trạng thái giao hàng, lọc theo ngày đặt — khác với doanh thu chỉ lấy đơn đã
              thanh toán.
            </li>
            <li>
              <strong>Khách hàng:</strong> số lớn là tổng tài khoản đăng ký; dòng nhỏ là bao nhiêu người có ít nhất một đơn trong kỳ
              đang lọc.
            </li>
          </ul>
        </aside>
      </CoreCard>

      <CoreCard className="mt-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 xl:items-end">
          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-2">Khoảng thời gian</div>
            <CoreFilterButtons
              options={PRESET_FILTER_OPTIONS}
              activeValue={preset}
              buttonClassName={FILTER_BUTTON_CLASS}
              onChange={(value) => (value === "custom" ? goCustomMode() : handlePreset(value))}
            />
          </div>

          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-2">Từ ngày — đến ngày</div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                className="admin-form-control min-w-[180px]"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-[#666666]">—</span>
              <input
                type="date"
                className="admin-form-control min-w-[180px]"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
              <CoreFilterActions mode="applyOnly" onApply={applyCustomRange} buttonClassName={FILTER_BUTTON_CLASS} />
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666] mb-2">Doanh thu theo</div>
            <CoreFilterButtons
              options={REVENUE_GROUP_OPTIONS}
              activeValue={chartGroupBy}
              buttonClassName={FILTER_BUTTON_CLASS}
              onChange={setChartGroupBy}
            />
          </div>
        </div>
      </CoreCard>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-10">
          <CoreSpinner />
          <span className="text-[#666666] font-semibold">Đang tải số liệu…</span>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <section aria-label="Chỉ số tổng quan">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <CoreCard>
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Doanh thu</div>
                <div className="text-2xl font-extrabold mt-1">{money(kpis?.revenue)}đ</div>
                <div className="text-sm text-[#94a3b8] mt-1">Chỉ tính đơn có thanh toán paid / success.</div>
              </CoreCard>
              <CoreCard>
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Đơn hàng</div>
                <div className="text-2xl font-extrabold mt-1">{money(kpis?.orders_count)}</div>
                <div className="text-sm text-[#94a3b8] mt-1">Mọi trạng thái đơn, theo ngày đặt.</div>
              </CoreCard>
              <CoreCard>
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Khách hàng</div>
                <div className="text-2xl font-extrabold mt-1">{money(kpis?.customers_registered)}</div>
                <div className="text-sm text-[#94a3b8] mt-1">
                  Trong kỳ có <strong>{money(kpis?.buyers_in_period)}</strong> người đặt đơn.
                </div>
              </CoreCard>
              <CoreCard>
                <div className="text-xs font-extrabold uppercase tracking-wide text-[#666666]">Sản phẩm (catalog)</div>
                <div className="text-2xl font-extrabold mt-1">{money(kpis?.products_catalog)}</div>
                <div className="text-sm text-[#94a3b8] mt-1">Tổng SKU trong hệ thống.</div>
              </CoreCard>
            </div>
          </section>

          <section>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#0f172a]">Doanh thu theo thời gian</h2>
                <div className="text-sm text-[#666666] mt-1">
                  {revenue?.groupBy === "month" ? "Nhóm theo tháng" : "Nhóm theo ngày"} — cùng kỳ với bộ lọc phía trên.
                </div>
              </div>
            </div>

            {revenueRows.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[#E5E5E5] bg-[#F5F5F5] p-8 text-center text-[#666666]">
                Không có dữ liệu doanh thu trong kỳ đã chọn.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <CoreCard>
                  <div className="h-[320px]">
                    <CoreChart type="bar" data={revenueChartData} options={revenueChartOptions} />
                  </div>
                </CoreCard>

                <CoreTable
                  value={revenueRows}
                  paginator={false}
                  emptyMessage="Chưa có dữ liệu doanh thu trong kỳ."
                  columns={[
                    { key: "period", header: "Kỳ", body: (row) => formatBucket(row.bucket, revenue?.groupBy) },
                    { key: "revenue", header: "Doanh thu", body: (row) => `${money(row.revenue)}đ` },
                  ]}
                />
              </div>
            )}
          </section>

          <section>
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[#0f172a]">Top sản phẩm bán chạy</h2>
                <div className="text-sm text-[#666666] mt-1">Theo doanh thu dòng (đơn đã thanh toán) trong kỳ.</div>
              </div>
            </div>

            {topRows.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[#E5E5E5] bg-[#F5F5F5] p-8 text-center text-[#666666]">
                Chưa có dữ liệu bán trong kỳ.
              </div>
            ) : (
              <CoreTable
                value={topRows}
                paginator={false}
                emptyMessage="Chưa có dữ liệu bán trong kỳ."
                columns={[
                  { key: "idx", header: "#", body: (_, options) => options.rowIndex + 1 },
                  { key: "name", header: "Tên sản phẩm", field: "product_name" },
                  { key: "qty", header: "Số lượng bán", body: (row) => money(row.total_quantity) },
                  { key: "sales", header: "Doanh thu", body: (row) => `${money(row.total_sales)}đ` },
                ]}
              />
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CoreCard>
              <div className="font-extrabold uppercase tracking-wide text-sm">Đơn hàng theo trạng thái (trong kỳ)</div>
              {statusEntries.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-[#E5E5E5] bg-[#F5F5F5] p-6 text-center text-[#666666]">
                  Không có đơn trong kỳ.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {statusEntries.map(([code, count]) => (
                    <div key={code} className="flex items-center justify-between gap-3">
                      <span className="text-[#475569] font-semibold">{ORDER_STATUS_LABELS[code] || code}</span>
                      <CoreBadge value={money(count)} tone="neutral" />
                    </div>
                  ))}
                </div>
              )}
            </CoreCard>

            <CoreCard>
              <div className="font-extrabold uppercase tracking-wide text-sm">Voucher</div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#666666]">Số lượt dùng (gắn đơn trong kỳ)</span>
                  <strong>{money(summary?.voucher?.usage_count)}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#666666]">Tổng tiền giảm</span>
                  <strong>{money(summary?.voucher?.total_discount)}đ</strong>
                </div>
              </div>
            </CoreCard>
          </div>

          <section>
            <h2 className="text-lg font-extrabold text-[#0f172a]">Hậu mãi</h2>
            <p className="text-sm text-[#666666] mt-1">Theo ngày tạo yêu cầu, trong kỳ lọc.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
              <CoreCard>
                <div className="text-sm text-[#666666]">Yêu cầu sửa chữa</div>
                <div className="text-2xl font-extrabold mt-1">{money(summary?.after_sales?.repair_requests)}</div>
              </CoreCard>
              <CoreCard>
                <div className="text-sm text-[#666666]">Yêu cầu hoàn tiền</div>
                <div className="text-2xl font-extrabold mt-1">{money(summary?.after_sales?.refund_requests)}</div>
              </CoreCard>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
