import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import { Toast } from "primereact/toast";

const CoreToastContext = createContext(null);

export function CoreToastProvider({ children }) {
  const toastRef = useRef(null);

  const show = useCallback((message) => {
    toastRef.current?.show(message);
  }, []);

  const api = useMemo(
    () => ({
      show,
      success(detail, summary = "Thành công", life = 2200) {
        show({ severity: "success", summary, detail, life });
      },
      info(detail, summary = "Thông báo", life = 2200) {
        show({ severity: "info", summary, detail, life });
      },
      warn(detail, summary = "Lưu ý", life = 2600) {
        show({ severity: "warn", summary, detail, life });
      },
      error(detail, summary = "Lỗi", life = 3200) {
        show({ severity: "error", summary, detail, life });
      },
    }),
    [show]
  );

  return (
    <CoreToastContext.Provider value={api}>
      {children}
      <Toast ref={toastRef} position="top-right" className="core-toast" />
    </CoreToastContext.Provider>
  );
}

export function useCoreToast() {
  const ctx = useContext(CoreToastContext);
  if (ctx) return ctx;
  return {
    show: () => {},
    success: () => {},
    info: () => {},
    warn: () => {},
    error: (detail) => window.alert(detail || "Có lỗi xảy ra."),
  };
}
