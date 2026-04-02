import { Skeleton } from "primereact/skeleton";
import { cx } from "./coreStyles";

export default function CoreSkeleton({ className = "", ...rest }) {
  return <Skeleton className={cx("core-skeleton", className)} {...rest} />;
}
