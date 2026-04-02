import { RadioButton } from "primereact/radiobutton";
import { cx } from "./coreStyles";

export default function CoreRadio({
  value,
  checked,
  onChange,
  label,
  name,
  inputId,
  className = "",
  ...rest
}) {
  return (
    <label
      className={cx("inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#111111]", className)}
      htmlFor={inputId}
    >
      <RadioButton name={name} inputId={inputId} value={value} checked={checked} onChange={onChange} {...rest} />
      <span>{label}</span>
    </label>
  );
}
