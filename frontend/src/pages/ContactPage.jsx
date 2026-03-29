import { useState } from "react";
import "./ContactPage.css";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: ""
  });

  function handleSubmit(e) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="contact-page">
      <div className="contact-page__hero">
        <div className="container">
          <h1 className="contact-page__title">Liên hệ</h1>
          <p className="contact-page__lead">
            BINH DINH TOOLS — Máy móc &amp; thiết bị công nghiệp. Gửi yêu cầu cho chúng tôi,
            hotline hỗ trợ trong giờ làm việc.
          </p>
        </div>
      </div>

      <div className="container contact-page__grid">
        <section className="contact-page__panel" aria-labelledby="contact-info-heading">
          <h2 id="contact-info-heading" className="contact-page__section-title">
            <span className="contact-page__accent" aria-hidden />
            Thông tin liên hệ
          </h2>

          <div className="contact-page__cards">
            <article className="contact-card">
              <h3 className="contact-card__title">Hotline tư vấn</h3>
              <p className="contact-card__line">
                CN Bình Định:{" "}
                <a href="tel:0336634677" className="contact-card__phone">
                  0336 634 677
                </a>
              </p>
              <p className="contact-card__line">
                CN HCM:{" "}
                <a href="tel:0981278914" className="contact-card__phone">
                  0981 278 914
                </a>
              </p>
            </article>

            <article className="contact-card">
              <h3 className="contact-card__title">Chi nhánh Bình Định</h3>
              <p className="contact-card__text">
                Địa chỉ: Quy Nhon, Bình Định (cập nhật theo cửa hàng thực tế)
              </p>
              <p className="contact-card__text">Giờ mở cửa: 8:00 – 18:00 (T2 – T7)</p>
            </article>

            <article className="contact-card">
              <h3 className="contact-card__title">Chi nhánh HCM</h3>
              <p className="contact-card__text">
                Địa chỉ: TP. Hồ Chí Minh (cập nhật theo cửa hàng thực tế)
              </p>
              <p className="contact-card__text">Giờ mở cửa: 8:00 – 18:00 (T2 – T7)</p>
            </article>
          </div>

          <div className="contact-page__map" aria-label="Bản đồ (placeholder)">
            <iframe
              title="Bản đồ khu vực Bình Định"
              src="https://www.openstreetmap.org/export/embed.html?bbox=108.95%2C13.65%2C109.35%2C14.05&layer=mapnik"
              loading="lazy"
            />
          </div>
        </section>

        <section className="contact-page__panel contact-page__panel--form" aria-labelledby="contact-form-heading">
          <h2 id="contact-form-heading" className="contact-page__section-title">
            <span className="contact-page__accent" aria-hidden />
            Gửi tin nhắn
          </h2>

          {sent ? (
            <div className="contact-page__success" role="status">
              <p>Cảm ơn bạn! Chúng tôi đã nhận được nội dung (demo — chưa gửi lên server).</p>
              <button
                type="button"
                className="contact-page__btn contact-page__btn--secondary"
                onClick={() => {
                  setSent(false);
                  setForm({ name: "", email: "", phone: "", message: "" });
                }}
              >
                Gửi tin khác
              </button>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              <label className="contact-form__field">
                <span className="contact-form__label">Họ và tên *</span>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="contact-form__input"
                />
              </label>
              <label className="contact-form__field">
                <span className="contact-form__label">Email *</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="contact-form__input"
                />
              </label>
              <label className="contact-form__field">
                <span className="contact-form__label">Điện thoại</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="contact-form__input"
                />
              </label>
              <label className="contact-form__field">
                <span className="contact-form__label">Nội dung *</span>
                <textarea
                  name="message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="contact-form__textarea"
                  placeholder="Nhu cầu mua hàng, báo giá, bảo hành..."
                />
              </label>
              <button type="submit" className="contact-page__btn contact-page__btn--primary">
                Gửi liên hệ
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
