import { Message } from "primereact/message";
import { cx } from "./coreStyles";

export default function CoreMessage({ className = "", ...rest }) {
  return <Message className={cx("core-message", className)} {...rest} />;
}
