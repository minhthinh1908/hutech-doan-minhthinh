import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import BuyerSidebar from "../components/BuyerSidebar.jsx";

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
    }
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setSaving(true);
    try {
      await updateProfile({
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        address: address.trim() || null
      });
      setMsg("Đã cập nhật hồ sơ.");
    } catch (ex) {
      setErr(ex.message || "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="buyer-page">
      <div className="buyer-page__hero">
        <div className="container">
          <h1 className="buyer-page__title">Quản lý hồ sơ</h1>
          <p className="buyer-page__sub">
            Xem và cập nhật họ tên, email, số điện thoại và địa chỉ liên hệ / giao hàng.
          </p>
        </div>
      </div>
      <div className="container buyer-shell">
        <BuyerSidebar />
        <div className="buyer-panel">
          <form className="buyer-form" onSubmit={handleSubmit}>
            {msg ? (
              <p className="buyer-msg buyer-msg--ok" role="status">
                {msg}
              </p>
            ) : null}
            {err ? (
              <p className="buyer-msg buyer-msg--err" role="alert">
                {err}
              </p>
            ) : null}
            <label className="buyer-form__field">
              <span className="buyer-form__label">Họ và tên</span>
              <input
                className="buyer-form__input"
                value={full_name}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
            <label className="buyer-form__field">
              <span className="buyer-form__label">Email</span>
              <input
                className="buyer-form__input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="buyer-form__field">
              <span className="buyer-form__label">Điện thoại</span>
              <input
                className="buyer-form__input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0901234567"
                autoComplete="tel"
              />
            </label>
            <label className="buyer-form__field">
              <span className="buyer-form__label">Địa chỉ</span>
              <textarea
                className="buyer-form__input buyer-form__textarea"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Số nhà, đường, phường/xã, tỉnh/thành…"
                rows={4}
                autoComplete="street-address"
              />
            </label>
            <button type="submit" className="buyer-form__btn" disabled={saving}>
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
