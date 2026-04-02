import { Card } from "primereact/card";
import { cx } from "./coreStyles";

export default function CoreCard({ className = "", ...rest }) {
  return <Card className={cx("core-card", className)} {...rest} />;
}
