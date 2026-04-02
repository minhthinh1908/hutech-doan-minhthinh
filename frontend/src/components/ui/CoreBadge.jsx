import { Tag } from "primereact/tag";
import { cx } from "./coreStyles";

const severityMap = {
  success: "success",
  warn: "warning",
  danger: "danger",
  info: "info",
  neutral: null,
};

const toneClass = {
  success: "!bg-[#22c55e] !text-white !border !border-[#16a34a]",
  warn: "!bg-[#fff3c4] !text-[#7a5a00] !border !border-[#ffd54f]",
  danger: "!bg-[#ef4444] !text-white !border !border-[#dc2626]",
  info: "!bg-[#1A1A1A] !text-[#FFC107] !border !border-[#1A1A1A]",
  neutral: "!bg-[#F5F5F5] !text-[#666666] border border-[#E5E5E5]",
};

export default function CoreBadge({ value, tone = "neutral", rounded = true, className = "" }) {
  return (
    <Tag
      value={value}
      severity={severityMap[tone] ?? null}
      rounded={rounded}
      className={cx(toneClass[tone] ?? toneClass.neutral, className)}
    />
  );
}
