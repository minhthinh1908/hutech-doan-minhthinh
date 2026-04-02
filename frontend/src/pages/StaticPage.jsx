
export default function StaticPage({ title, children, htmlContent }) {
  const fallback =
    children ||
    "Nội dung trang đang được cập nhật. Vui lòng quay lại sau hoặc liên hệ hotline.";
  return (
    <div className="static-page">
      <div className="static-page__hero">
        <div className="container">
          <h1 className="static-page__title">{title}</h1>
        </div>
      </div>
      <div className="container static-page__body">
        {htmlContent != null && String(htmlContent).trim() !== "" ? (
          <div className="static-page__html" dangerouslySetInnerHTML={{ __html: htmlContent }} />
        ) : (
          <p className="static-page__lead">{fallback}</p>
        )}
      </div>
    </div>
  );
}
