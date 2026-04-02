---
name: ui-consistency
description: >-
  Enforces a single visual system across buyer-facing and admin React UIs in this
  repo (tokens, typography, spacing, PrimeReact + Tailwind + global CSS). Use
  when editing frontend layout, styling, or components under frontend/src/pages,
  frontend/src/pages/admin, frontend/src/components, frontend/src/styles, or
  when the user asks for UI consistency, theming, or matching admin with the store.
---

# UI đồng nhất User / Admin

## Khi nào bắt buộc áp dụng

- Sửa hoặc thêm màn hình trong `frontend/src/pages/` (buyer) hoặc `frontend/src/pages/admin/`.
- Sửa shell chung: `frontend/src/components/` (Layout, header, footer, nav, `AdminShell`, v.v.).
- Thêm/sửa style toàn cục: `frontend/src/index.css`, `frontend/src/App.css`, `frontend/src/styles/`, `frontend/tailwind.config.js`.

## Nguyên tắc cốt lõi

1. **Một hệ token**: màu nền, chữ, vàng chủ đạo, sidebar — lấy từ `:root` trong `frontend/src/index.css` (`--bd-yellow`, `--bd-black`, `--bd-text`, `--bd-gray`, `--bd-sidebar-width`, `--font`, `--bd-tracking-label`, …). Không nhân đôi bằng hex tùy ý nếu đã có biến tương đương.
2. **Thương hiệu / accent**: map thương hiệu qua `frontend/src/utils/brandAccent.js` và class trong `frontend/src/styles/brandAccent.css` — không copy-paste bảng màu brand sang file khác.
3. **Hybrid CSS**: dự án dùng **Tailwind + CSS file + PrimeReact** (xem `frontend/src/main.jsx`). Ưu tiên class utility Tailwind cho layout/spacing; giữ pattern hiện có trong page/component CSS; component thư viện giữ theme PrimeReact.
4. **Đồng nhất user ↔ admin**: cùng font (`var(--font)`), cùng scale spacing (ưu tiên `rem`/token), cùng style nút/link nhận diện (vàng `--bd-yellow` / đen `--bd-black`), cùng cách hiển thị trạng thái (loading / empty / lỗi).

## Quy trình trước khi code UI

1. **Audit nhanh**: mở `index.css` + một màn buyer và một màn admin tương tự (vd. danh sách / form) để bắt chước pattern.
2. **Reuse**: tìm component hoặc class có sẵn trước khi tạo block mới.
3. **Sau khi sửa**: so sánh nhanh buyer vs admin (tiêu đề trang, card, bảng, nút primary).

## Checklist pattern thống nhất

| Vùng | Hướng dẫn |
|------|-----------|
| Page shell | Cùng cấu trúc: vùng nội dung có `max-width` / padding như `.container` hoặc pattern đang dùng trong trang tương tự. |
| Tiêu đề trang | Cùng hierarchy (một `h1` chính; label phụ dùng tracking `--bd-tracking-label` nếu là nhãn UI). |
| Nút primary | Vàng nền / đen chữ hoặc đảo tùy contrast đang dùng site-wide; không tự nghĩ palette mới. |
| Form / input | Trùng chiều cao, border-radius, focus — bám PrimeReact hoặc class đang dùng trang lân cận. |
| Bảng / list | Header bảng, zebra/hover — thống nhất với admin pages hiện có (`Admin*.jsx` + CSS đi kèm). |
| Loading / empty / error | Một kiểu copy ngắn + spinner/skeleton cùng family với phần còn lại của app. |

## Việc không nên làm

- Thêm màu hex một lần (`#xxxxxx`) rải rác khi đã có `--bd-*`.
- Tách style admin sang “theme khác” (font/spacing khác buyer) trừ khi có yêu cầu rõ ràng.
- Bỏ qua `AdminShell` / layout buyer khi thêm route mới.

## Tài liệu chi tiết

Xem [reference.md](reference.md) (bảng token, đường dẫn file, gợi ý Tailwind).
