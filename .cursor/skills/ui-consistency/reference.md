# Reference — UI consistency (project)

## Token chính (`frontend/src/index.css`)

| Token | Ý nghĩa |
|-------|---------|
| `--bd-yellow` | Vàng chủ đạo (CTA, highlight) |
| `--bd-yellow-dark` | Vàng đậm (hover/active) |
| `--bd-black` | Nền tối / contrast |
| `--bd-white` | Nền sáng |
| `--bd-gray` | Nền phụ / vùng nhẹ |
| `--bd-text` | Màu chữ body |
| `--bd-red-phone` | Nhấn mạnh đỏ (hotline / cảnh báo nhẹ) |
| `--bd-sidebar-width` | Độ rộng sidebar admin |
| `--font` | Stack font toàn app |
| `--bd-tracking-label` | Tracking cho nhãn in hoa / UI label |

Dùng trong CSS: `color: var(--bd-text);`, `background: var(--bd-gray);`, v.v.

## Thương hiệu (accent)

- Logic map tên → key: `frontend/src/utils/brandAccent.js` (`getBrandAccentKey`).
- Class visual: `frontend/src/styles/brandAccent.css` (CategoryNav, Home, v.v.).
- Khi thêm vùng “theo brand”, mở rộng tại đây thay vì hard-code màu ở từng page.

## Công cụ styling

- **Tailwind**: `frontend/tailwind.config.js`, directive trong `frontend/src/index.css` (`@tailwind base/components/utilities`).
- **PrimeReact**: import theme trong `frontend/src/main.jsx` — ưu tiên component có sẵn cho form/table/dialog khi đã dùng ở admin hoặc buyer.
- **Global**: `frontend/src/index.css`, `frontend/src/App.css`.

## Thư mục cần đồng bộ

| Thư mục | Vai trò |
|---------|---------|
| `frontend/src/pages/` | Màn buyer |
| `frontend/src/pages/admin/` | Màn admin — cần cùng “ngôn ngữ” spacing/typography với buyer |
| `frontend/src/components/` | Shell, nav, header, footer, `AdminShell` |
| `frontend/src/styles/` | Style dùng chung (vd. brand accent) |

## Tailwind — gợi ý ngắn

- Layout: `flex`, `grid`, `gap-*`, `max-w-*`, `px-*`, `py-*` — giữ nhịp với các trang đã có (thường padding ngang ~ `1rem` khớp `.container`).
- Màu: ưu tiên `bg-[var(--bd-yellow)]` hoặc class CSS có sẵn hơn là hex mới trong `className`.
- Typography: `font-sans` đã align với body nếu config Tailwind map về `--font`; nếu không chắc, dùng style từ CSS file page hiện có.

## Ghi chú

- Không dùng CSS Modules (`*.module.css`) trong repo này — ưu tiên file `.css` cạnh component hoặc global.
