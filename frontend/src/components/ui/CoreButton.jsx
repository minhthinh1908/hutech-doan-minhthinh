import { Button } from "primereact/button";
import { cx, toneClass } from "./coreStyles";

export default function CoreButton({
  tone = "primary",
  className = "",
  loading = false,
  label,
  children,
  icon = null,
  iconPosition = "left",
  ...rest
}) {
  const content = children ?? label;

  return (
    <Button
      {...rest}
      loading={loading}
      className={cx("core-btn !rounded-lg !px-4 !py-2 focus-visible:!outline-none", toneClass(tone), className)}
    >
      <span className="inline-flex items-center gap-2">
        {icon && iconPosition === "left" ? icon : null}
        <span>{content}</span>
        {icon && iconPosition === "right" ? icon : null}
      </span>
    </Button>
  );
}
