import { Chart } from "primereact/chart";
import { cx } from "./coreStyles";

export default function CoreChart({ className = "", ...rest }) {
  return <Chart className={cx("core-chart", className)} {...rest} />;
}
