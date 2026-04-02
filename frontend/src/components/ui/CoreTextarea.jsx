import { InputTextarea } from "primereact/inputtextarea";
import { coreInputBaseClass, cx, fieldStateClass } from "./coreStyles";

export default function CoreTextarea({
  label,
  helpText = "",
  error = "",
  required = false,
  className = "",
  textareaClassName = "",
  disabled = false,
  ...rest
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-[#111111]">
        {label}
        {required ? <span className="text-amber-600"> *</span> : null}
      </span>
      <InputTextarea
        {...rest}
        disabled={disabled}
        className={cx(
          "w-full mt-1 min-h-[5rem]",
          coreInputBaseClass,
          fieldStateClass({ error, disabled }),
          textareaClassName
        )}
      />
      {helpText ? <small className="mt-1 block text-[#666666]">{helpText}</small> : null}
      {error ? <small className="mt-1 block text-red-600">{error}</small> : null}
    </label>
  );
}
