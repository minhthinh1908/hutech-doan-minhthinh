import CoreButton from "./CoreButton.jsx";
import { cx } from "./coreStyles.js";

export default function CoreFilterButtons({
  options = [],
  activeValue,
  onChange,
  className = "",
  buttonClassName = "",
  activeTone = "primary",
  inactiveTone = "secondary",
  getLabel,
}) {
  return (
    <div className={cx("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const value = option?.value ?? option?.key;
        const isActive = value === activeValue;
        const fallbackLabel = option?.label ?? String(value ?? "");
        const label = typeof getLabel === "function" ? getLabel(option, isActive) : fallbackLabel;
        return (
          <CoreButton
            key={String(value)}
            type="button"
            label={label}
            tone={isActive ? activeTone : inactiveTone}
            className={buttonClassName}
            onClick={() => onChange?.(value, option)}
          />
        );
      })}
    </div>
  );
}
