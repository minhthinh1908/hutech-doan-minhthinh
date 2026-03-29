import { useCallback, useEffect, useState } from "react";
import { apiGet } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

export function useCartItemCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const data = await apiGet("/cart");
      const n = (data.items || []).reduce((s, i) => s + (i.quantity || 0), 0);
      setCount(n);
    } catch {
      setCount(0);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUp = () => load();
    window.addEventListener("bd-cart-updated", onUp);
    return () => window.removeEventListener("bd-cart-updated", onUp);
  }, [load]);

  return count;
}
