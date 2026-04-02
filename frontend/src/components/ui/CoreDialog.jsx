import { Dialog } from "primereact/dialog";
import { cx } from "./coreStyles";

export default function CoreDialog({ className = "", ...rest }) {
  return <Dialog className={cx("core-dialog", className)} {...rest} />;
}
