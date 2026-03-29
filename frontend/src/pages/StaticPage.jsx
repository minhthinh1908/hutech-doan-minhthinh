import "./StaticPage.css";

export default function StaticPage({ title, children }) {
  return (
    <div className="static-page">
      <div className="static-page__hero">
        <div className="container">
          <h1 className="static-page__title">{title}</h1>
        </div>
      </div>
      <div className="container static-page__body">
        <p className="static-page__lead">
          {children ||
            "Nội dung trang đang được cập nhật. Vui lòng quay lại sau hoặc liên hệ hotline."}
        </p>
      </div>
    </div>
  );
}
