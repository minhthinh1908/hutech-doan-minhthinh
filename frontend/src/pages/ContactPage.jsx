import { useState } from "react";
import { CoreButton, CoreMessage } from "../components/ui/index.js";

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
            E-commerce Tools — Máy móc &amp; thiết bị công nghiệp. Gửi yêu cầu cho chúng tôi,
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
                CN 1:{" "}
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
              <h3 className="contact-card__title">Chi nhánh 1</h3>
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

          <div className="contact-page__map" aria-label="Bản đồ chi nhánh HCM">
            <iframe
              title="Bản đồ Bình Định Tools CN HCM"
              src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d15679.138944254515!2d106.627968!3d10.751067!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752d003c905679%3A0x5a5b4ce804d42864!2zQsOsbmggxJDhu4tuaCBUb29scyBDTiBIQ00!5e0!3m2!1sen!2sus!4v1775135059204!5m2!1sen!2sus"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
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
              <CoreMessage
                severity="success"
                text="Cảm ơn bạn! Chúng tôi đã nhận được nội dung (demo — chưa gửi lên server)."
              />
              <CoreButton
                type="button"
                tone="primary"
                className="contact-page__success-btn"
                onClick={() => {
                  setSent(false);
                  setForm({ name: "", email: "", phone: "", message: "" });
                }}
              >
                Gửi tin khác
              </CoreButton>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSubmit} noValidate>
              <label className="contact-form__field">
                <span className="admin-form-label">Họ và tên *</span>
                <input
                  type="text"
                  name="name"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="admin-form-control"
                />
              </label>
              <label className="contact-form__field">
                <span className="admin-form-label">Email *</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="admin-form-control"
                />
              </label>
              <label className="contact-form__field">
                <span className="admin-form-label">Điện thoại</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="admin-form-control"
                />
              </label>
              <label className="contact-form__field">
                <span className="admin-form-label">Nội dung *</span>
                <textarea
                  name="message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  className="admin-form-control contact-form__textarea"
                  placeholder="Nhu cầu mua hàng, báo giá, bảo hành..."
                />
              </label>
              <CoreButton type="submit" tone="secondary">
                Gửi liên hệ
              </CoreButton>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
