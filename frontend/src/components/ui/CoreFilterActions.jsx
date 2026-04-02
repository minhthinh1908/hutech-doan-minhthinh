import CoreButton from "./CoreButton.jsx";
import { cx } from "./coreStyles.js";

/**
 * Nút hành động bộ lọc admin: «Áp dụng» / «Xóa lọc» — dùng chung kích thước và layout.
 * mode: applyClear | applyOnly | clearOnly
 */
export default function CoreFilterActions({
  mode = "applyClear",
  applyType = "button",
  applyLabel = "Áp dụng",
  clearLabel = "Xóa lọc",
  onApply,
  onClear,
  applyLoading = false,
  disabledApply = false,
  disabledClear = false,
  className = "",
  buttonClassName = "",
}) {
  const showApply = mode === "applyClear" || mode === "applyOnly";
  const showClear = mode === "applyClear" || mode === "clearOnly";

  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      {showApply ? (
        <CoreButton
          type={applyType === "submit" ? "submit" : "button"}
          label={applyLoading ? "Đang áp dụng…" : applyLabel}
          disabled={disabledApply || applyLoading}
          className={buttonClassName}
          onClick={applyType === "submit" ? undefined : onApply}
        />
      ) : null}
      {showClear ? (
        <CoreButton
          type="button"
          tone="secondary"
          label={clearLabel}
          disabled={disabledClear}
          className={buttonClassName}
          onClick={onClear}
        />
      ) : null}
    </div>
  );
}
