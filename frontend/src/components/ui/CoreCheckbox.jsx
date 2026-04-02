import { Checkbox } from "primereact/checkbox";
import { cx } from "./coreStyles";

export default function CoreCheckbox({
  checked,
  onChange,
  label = "",
  className = "",
  helpText = "",
  error = "",
  inputId,
  ...rest
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label className="inline-flex cursor-pointer items-start gap-2 text-sm font-medium text-[#111111]" htmlFor={inputId}>
        <Checkbox inputId={inputId} checked={checked} onChange={onChange} className="mt-0.5" {...rest} />
        {label ? <span>{label}</span> : null}
      </label>
      {helpText ? <small className="text-[#666666]">{helpText}</small> : null}
      {error ? <small className="text-red-600">{error}</small> : null}
    </div>
  );
}
