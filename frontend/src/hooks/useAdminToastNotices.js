import { useEffect } from "react";
import { useCoreToast } from "../components/ui/index.js";

export default function useAdminToastNotices({ err, msg, setErr, setMsg }) {
  const toast = useCoreToast();

  useEffect(() => {
    if (!err) return;
    toast.error(err);
    if (typeof setErr === "function") setErr("");
  }, [err, setErr, toast]);

  useEffect(() => {
    if (!msg) return;
    toast.success(msg);
    if (typeof setMsg === "function") setMsg("");
  }, [msg, setMsg, toast]);
}
