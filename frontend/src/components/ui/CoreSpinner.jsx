import { ProgressSpinner } from "primereact/progressspinner";
import { cx } from "./coreStyles";

export default function CoreSpinner({ className = "", ...rest }) {
  return <ProgressSpinner className={cx("core-spinner", className)} {...rest} />;
}
