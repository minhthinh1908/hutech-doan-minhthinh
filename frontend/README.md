# Frontend — E-COMMERCE TOOLS (demo giao diện)

Giao diện React + Vite, tông vàng / đen / trắng giống trang thương mại dụng cụ.

## Chạy

```bash
cd frontend
npm install
npm run dev
```

Mở trình duyệt: `http://localhost:8080` (đã khớp với `.vscode/launch.json`)

## Các trang (React Router)

| Đường dẫn | Nội dung |
|-----------|-----------|
| `/` | Trang chủ (banner, sidebar, tab sản phẩm) |
| `/lien-he` | **Liên hệ** — form + hotline + bản đồ |
| `/gioi-thieu` | Giới thiệu (placeholder) |
| `/dich-vu` | Dịch vụ (placeholder) |
| `/tin-tuc` | Tin tức (placeholder) |

Thanh vàng trên cùng: **LIÊN HỆ** dùng `NavLink` tới `/lien-he` (không còn `href="#"`). **SẢN PHẨM** trỏ `/#products` về đầu trang chủ + khu sản phẩm.

## API backend (tùy chọn)

Proxy đã cấu trong `vite.config.js`: request tới `/api/*` chuyển tới `http://localhost:3000`. Chạy backend trước khi gọi API từ frontend.

## Cấu trúc

- `src/components/` — TopBar, header, thanh danh mục, nút bảo hành nổi
- `src/pages/HomePage.jsx` — Sidebar, banner, tab sản phẩm bán chạy / mới

Ảnh banner dùng Unsplash (có thể thay bằng ảnh trong `public/`).

## Giao diện (cập nhật)

- Logo: khung nhà + máy khoan (`components/LogoMark.jsx`), chữ E-commerce / TOOLS.
- Hotline: nhãn **Hotline tư vấn**, icon điện thoại trong vòng tròn vàng, số **0336 634 677** / **0981 278 914**.
- Nút **Dịch Vụ Bảo Hành** nổi: kèm icon tai nghe.
- Banner chính: chữ DEWALT góc phải, giá vàng, chip 20V MAX / BRUSHLESS / XR, lớp vân gỗ nhẹ.
- Nút **DANH MỤC SẢN PHẨM** rộng bằng cột sidebar (220px).
- Trang chủ: **carousel** sản phẩm (nền vàng gradient, tab Bán chạy / Mới, nút trái phải), thẻ **Hot**, **-%**, giá đỏ + giá gạch / **Liên hệ**.
- Khối **Thương Hiệu**: lọc Milwaukee / DeWalt / … + lưới sản phẩm (`ProductCard`).
- Nút **lên đầu trang** (góc phải dưới, khi cuộn xuống).
