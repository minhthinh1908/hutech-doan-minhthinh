import { isValidElement } from "react";

const DEFAULT_LEAD =
  "Nội dung trang đang được cập nhật. Vui lòng quay lại sau hoặc liên hệ hotline.";

export default function StaticPage({ title, children, htmlContent }) {
  const hasHtml = htmlContent != null && String(htmlContent).trim() !== "";
  const leadText = typeof children === "string" || typeof children === "number" ? String(children) : null;

  return (
    <div className="static-page">
      <div className="static-page__hero">
        <div className="container">
          <h1 className="static-page__title">{title}</h1>
        </div>
      </div>
      <div className="container static-page__body">
        {hasHtml ? (
          <div className="static-page__html" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        ) : isValidElement(children) ? (
          <div className="static-page__slot">{children}</div>
        ) : (
          <p className="static-page__lead">{leadText ?? DEFAULT_LEAD}</p>
        )}
      </div>
    </div>
  );
}
