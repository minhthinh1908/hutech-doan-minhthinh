import { Dropdown } from "primereact/dropdown";
import { coreInputBaseClass, cx, fieldStateClass } from "./coreStyles";

export default function CoreSelect({
  label,
  options = [],
  value,
  onChange,
  optionLabel = "label",
  optionValue = "value",
  optionGroupLabel,
  optionGroupChildren,
  placeholder = "",
  required = false,
  disabled = false,
  helpText = "",
  error = "",
  className = "",
  selectClassName = "",
  filter = true,
  ...rest
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-sm font-medium text-[#111111]">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <Dropdown
        {...rest}
        value={value}
        options={options}
        onChange={onChange}
        optionLabel={optionLabel}
        optionValue={optionValue}
        optionGroupLabel={optionGroupLabel}
        optionGroupChildren={optionGroupChildren}
        placeholder={placeholder}
        disabled={disabled}
        filter={filter}
        filterBy={optionLabel}
        filterPlaceholder="Tìm…"
        showFilterClear
        className={cx(
          "core-select w-full mt-1",
          coreInputBaseClass,
          fieldStateClass({ error, disabled }),
          selectClassName
        )}
        panelClassName="core-select-panel"
      />
      {helpText ? <small className="mt-1 block text-[#666666]">{helpText}</small> : null}
      {error ? <small className="mt-1 block text-red-600">{error}</small> : null}
    </label>
  );
}
