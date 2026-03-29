/** Map API / datetime ↔ form state cho admin voucher */

export function isoToDatetimeLocal(v) {
  if (v == null || v === "") return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function emptyVoucherForm() {
  return {
    code: "",
    discount_type: "percent",
    discount_value: "",
    max_discount_amount: "",
    min_order_value: "0",
    start_date: "",
    end_date: "",
    usage_limit: "",
    per_user_limit: "",
    selectedCategoryIds: []
  };
}

/**
 * @param {object} v — bản ghi voucher từ API
 */
export function voucherRecordToForm(v) {
  const raw = v.applicable_category_ids;
  let selected = [];
  if (Array.isArray(raw)) {
    selected = raw.map((x) => String(x));
  }
  const dt = String(v.discount_type || "").toLowerCase();
  const discount_type = dt === "fixed" ? "fixed" : "percent";

  return {
    code: v.code || "",
    discount_type,
    discount_value: v.discount_value != null ? String(v.discount_value) : "",
    max_discount_amount:
      v.max_discount_amount != null && v.max_discount_amount !== ""
        ? String(v.max_discount_amount)
        : "",
    min_order_value: v.min_order_value != null ? String(v.min_order_value) : "0",
    start_date: isoToDatetimeLocal(v.start_date),
    end_date: isoToDatetimeLocal(v.end_date),
    usage_limit: v.usage_limit != null ? String(v.usage_limit) : "",
    per_user_limit: v.per_user_limit != null ? String(v.per_user_limit) : "",
    selectedCategoryIds: selected
  };
}

function buildPayloadFields(form) {
  const isPercent = form.discount_type === "percent";
  return {
    code: String(form.code || "").trim(),
    discount_type: form.discount_type,
    discount_value: Number(form.discount_value),
    min_order_value: Number(form.min_order_value || 0),
    max_discount_amount:
      isPercent && form.max_discount_amount !== "" && form.max_discount_amount != null
        ? Number(form.max_discount_amount)
        : null,
    start_date: form.start_date,
    end_date: form.end_date,
    usage_limit: form.usage_limit === "" ? null : parseInt(form.usage_limit, 10),
    per_user_limit: form.per_user_limit === "" ? null : parseInt(form.per_user_limit, 10),
    applicable_category_ids:
      Array.isArray(form.selectedCategoryIds) && form.selectedCategoryIds.length > 0
        ? form.selectedCategoryIds.map(String)
        : null
  };
}

/** Body tạo mới — luôn active (trạng thái chỉ đổi từ bảng) */
export function formToCreatePayload(form) {
  return { ...buildPayloadFields(form), status: "active" };
}

/** Body cập nhật — không gửi status */
export function formToUpdatePayload(form) {
  return buildPayloadFields(form);
}

export function validateVoucherForm(form) {
  const errors = [];
  const code = String(form.code || "").trim();
  if (!code) errors.push("Nhập mã voucher.");

  const dv = Number(form.discount_value);
  if (Number.isNaN(dv) || dv <= 0) errors.push("Giá trị giảm phải là số dương.");
  if (form.discount_type === "percent") {
    if (!Number.isNaN(dv) && dv > 100) errors.push("Phần trăm giảm không được vượt 100%.");
    if (form.max_discount_amount !== "" && form.max_discount_amount != null) {
      const m = Number(form.max_discount_amount);
      if (Number.isNaN(m) || m < 0) errors.push("Giảm tối đa (đ) không hợp lệ.");
    }
  }

  if (!form.start_date || !form.end_date) {
    errors.push("Chọn thời gian bắt đầu và kết thúc.");
  } else {
    const a = new Date(form.start_date);
    const b = new Date(form.end_date);
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a >= b) {
      errors.push("Thời gian kết thúc phải sau thời gian bắt đầu.");
    }
  }

  if (form.usage_limit !== "") {
    const u = parseInt(form.usage_limit, 10);
    if (Number.isNaN(u) || u < 0) errors.push("Giới hạn tổng lượt phải là số ≥ 0.");
  }
  if (form.per_user_limit !== "") {
    const u = parseInt(form.per_user_limit, 10);
    if (Number.isNaN(u) || u < 0) errors.push("Giới hạn mỗi khách phải là số ≥ 0.");
  }

  return { ok: errors.length === 0, errors };
}
