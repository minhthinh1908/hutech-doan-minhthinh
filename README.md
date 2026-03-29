# Website thương mại điện tử — Bình Định Tools

Đồ án xây dựng **hệ thống bán hàng trực tuyến** (e-commerce) cho cửa hàng công cụ — gồm **giao diện khách hàng**, **quản trị (admin)** và **API REST** kết nối cơ sở dữ liệu quan hệ. Dự án áp dụng kiến trúc **tách frontend / backend**, xác thực **JWT** (access + refresh token), quản lý dữ liệu bằng **Prisma ORM** trên **PostgreSQL**.

---

## Mục tiêu & phạm vi đồ án

| Hạng mục | Nội dung |
|----------|-----------|
| **Đối tượng sử dụng** | Khách mua hàng (đăng ký / đăng nhập), quản trị viên cửa hàng |
| **Nghiệp vụ chính** | Duyệt sản phẩm theo danh mục & thương hiệu, giỏ hàng, đặt hàng, mã giảm giá (voucher), đánh giá sản phẩm, bảo hành — sửa chữa — hoàn tiền (theo luồng yêu cầu) |
| **Quản trị** | CRUD sản phẩm, danh mục, thương hiệu, voucher, đơn hàng, người dùng, báo cáo, cấu hình chân trang |
| **Mục tiêu kỹ thuật** | API có cấu trúc rõ ràng, phân quyền admin/khách, upload ảnh sản phẩm, dữ liệu nhất quán qua migration |

---

## Công nghệ sử dụng

### Frontend (`frontend/`)

- **React 18** — giao diện component, **React Router 6** — điều hướng SPA  
- **Vite 6** — dev server, build tối ưu, **proxy** `/api` và `/uploads` → backend  
- **Fetch API** — gọi REST; token lưu `localStorage` (`bd_access_token`)

### Backend (`backend/`)

- **Node.js** + **Express 4** — REST API, middleware xử lý lỗi thống nhất  
- **Prisma 6** + **PostgreSQL** — schema, migration, truy vấn an toàn kiểu  
- **jsonwebtoken** — JWT access / refresh; **bcryptjs** — băm mật khẩu  
- **Multer** — upload ảnh (JPEG, PNG, GIF, WebP) vào thư mục `uploads/`

---

## Kiến trúc tổng quan

```mermaid
flowchart LR
  subgraph client [Trình duyệt]
    UI[React SPA - Vite]
  end
  subgraph server [Backend]
    API[Express API]
    AUTH[JWT Middleware]
    API --> AUTH
  end
  subgraph data [Dữ liệu]
    PG[(PostgreSQL)]
    FS[Thư mục uploads]
  end
  UI -->|HTTP /api /uploads| API
  API --> PG
  API --> FS
```

- **Development:** Frontend chạy cổng **8080**, proxy sang backend **3000** (xem `frontend/vite.config.js`).  
- **Production:** Build frontend (`npm run build`), phục vụ file tĩnh bằng nginx / CDN hoặc cùng host; backend chạy độc lập và cấu hình CORS / reverse proxy nếu cần.

---

## Cấu trúc thư mục (rút gọn)

```
.
├── README.md
├── frontend/
│   ├── src/
│   │   ├── api/           # client gọi API
│   │   ├── components/    # Layout, header, footer, thẻ sản phẩm, …
│   │   ├── context/       # AuthContext
│   │   ├── hooks/         # ví dụ: useCartItemCount
│   │   ├── pages/         # trang công khai + admin/*
│   │   ├── utils/         # map dữ liệu, voucher, …
│   │   ├── App.jsx        # định tuyến
│   │   └── main.jsx
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma  # mô hình dữ liệu
│   │   ├── migrations/    # lịch sử migration (theo dự án)
│   │   └── seed.js        # seed vai trò, admin, footer, danh mục mặc định
│   ├── routes/            # auth, products, cart, orders, admin, …
│   ├── controllers/
│   ├── middleware/        # auth, upload, errorHandler
│   ├── app.js             # đăng ký route & static /uploads
│   ├── server.js
│   └── package.json
└── .gitignore
```

---

## Chức năng theo vai trò

### Khách hàng (đã đăng nhập khi cần)

- Trang chủ (sản phẩm nổi bật, gợi ý, mega menu danh mục / thương hiệu)  
- Danh mục sản phẩm, chi tiết sản phẩm, đánh giá  
- Giỏ hàng, đặt hàng, xem đơn hàng & chi tiết  
- Voucher (áp dụng theo quy tắc backend)  
- Bảo hành, yêu cầu sửa chữa, yêu cầu hoàn tiền  
- Tài khoản cá nhân; đăng nhập / đăng ký  

### Quản trị viên (`/admin`, role `admin`)

- Dashboard, sản phẩm, danh mục, thương hiệu, voucher  
- Đơn hàng, khách hàng (người dùng)  
- Bảo hành, sửa chữa, hoàn tiền, báo cáo  
- Cấu hình **chân trang** (chi nhánh, bản đồ, chính sách, …)  

---

## Cơ sở dữ liệu (tóm tắt)

Schema định nghĩa trong `backend/prisma/schema.prisma`, gồm các nhóm chính:

- **Người dùng & phân quyền:** `Role`, `User`, `RefreshToken`  
- **Danh mục & sản phẩm:** `Category` (cây phân cấp), `Brand`, `CategoryBrand`, `Product` (giá, flash sale, nhãn hot/mới/bestseller, …)  
- **Mua hàng:** `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`, `Voucher`, `OrderVoucher`  
- **Sau bán:** `Review`, `Warranty`, `RepairRequest`, `RefundRequest`  
- **Giao diện site:** `SiteFooter` (một bản ghi cấu hình chân trang)  

---

## Cài đặt & chạy dự án

### Yêu cầu hệ thống

- **Node.js** (khuyến nghị LTS)  
- **PostgreSQL** (phiên bản tương thích với Prisma)  
- Git (tùy chọn)

### 1. Cơ sở dữ liệu

Tạo database trống trên PostgreSQL, ghi lại chuỗi kết nối dạng:

`postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

### 2. Backend

```bash
cd backend
npm install
```

Tạo file **`backend/.env`** (không commit — đã có trong `.gitignore`), tối thiểu:

| Biến | Mô tả |
|------|--------|
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho Prisma |
| `JWT_SECRET` | Khóa ký JWT access (bắt buộc) |
| `JWT_REFRESH_SECRET` | Khóa refresh (khuyến nghị; nếu thiếu có thể dùng chung `JWT_SECRET` tùy code) |
| `ACCESS_TOKEN_TTL` | Thời hạn access token (giây; mặc định ~15 phút nếu không đặt) |
| `REFRESH_TOKEN_TTL` | Thời hạn refresh token (giây; mặc định ~7 ngày) |
| `PORT` | Cổng API (mặc định **3000**) |

Sinh Prisma Client và áp dụng migration:

```bash
npx prisma generate
npx prisma migrate dev
```

Seed dữ liệu ban đầu (vai trò, admin, footer, danh mục/thương hiệu mặc định — tùy logic seed):

```bash
npm run prisma:seed
```

Trong seed có thể đặt **`ADMIN_EMAIL`**, **`ADMIN_PASSWORD`** trong `.env` để tài khoản admin không dùng mật khẩu mặc định.

Chạy API:

```bash
npm run dev
# hoặc: npm start
```

Kiểm tra: mở `http://localhost:3000/` — phản hồi JSON báo API đang chạy.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Trình duyệt: **`http://localhost:8080`** (Vite proxy `/api` → `http://localhost:3000`).

Build sản phẩm:

```bash
npm run build
npm run preview   # xem thử bản build cục bộ
```

---

## API REST (tiền tố `/api`)

Các nhóm route đăng ký trong `backend/app.js` (đường dẫn đầy đủ = `/api` + bảng dưới):

| Tiền tố | Nội dung gợi ý |
|---------|----------------|
| `/api/auth` | Đăng ký, đăng nhập, refresh token, đăng xuất |
| `/api/categories`, `/api/brands`, `/api/category-brands` | Danh mục, thương hiệu, liên kết mega menu |
| `/api/products` | Sản phẩm, lọc, chi tiết |
| `/api/cart`, `/api/orders` | Giỏ hàng, đơn hàng |
| `/api/vouchers` | Mã giảm giá |
| `/api/reviews` | Đánh giá |
| `/api/warranties`, `/api/repair-requests`, `/api/refund-requests` | Bảo hành, sửa chữa, hoàn tiền |
| `/api/site-footer` | Nội dung chân trang |
| `/api/admin/*` | Thao tác quản trị (kèm middleware phân quyền admin) |

Ảnh tải lên phục vụ tĩnh tại **`/uploads/...`** (cùng origin backend).

---

## Bảo mật & lưu ý báo cáo

- Mật khẩu lưu dạng **hash** (bcrypt), không lưu plaintext.  
- API nhạy cảm dùng **Bearer JWT**; refresh token lưu server (bảng `refresh_tokens`).  
- File **`.env`** chứa bí mật — **không đưa lên Git** (đã cấu hình `.gitignore`).  
- Upload giới hạn **loại ảnh** và **kích thước** (xem `middleware/uploadImage.js`).  
- Lỗi server: trong môi trường không production có thể trả thêm `stack` để debug (`errorHandler`).

---

## Script npm tham khảo

| Vị trí | Lệnh | Ý nghĩa |
|--------|------|---------|
| Backend | `npm run dev` | Nodemon — tự khởi động lại khi đổi code |
| Backend | `npm start` | Chạy `node server.js` |
| Backend | `npm run prisma:generate` | `prisma generate` |
| Backend | `npm run prisma:migrate` | `prisma migrate dev` |
| Backend | `npm run prisma:seed` | Chạy `prisma/seed.js` |
| Frontend | `npm run dev` | Dev server Vite (port 8080) |
| Frontend | `npm run build` | Build production → `frontend/dist` |
| Frontend | `npm run preview` | Xem bản build |

---

## Hướng phát triển (gợi ý)

- Tích hợp cổng thanh toán thực (VNPay, MoMo, …) và webhook xác nhận.  
- Gửi email / SMS xác nhận đơn hàng.  
- Viết test tự động (API: Jest/Supertest; UI: Vitest + Testing Library).  
- Triển khai Docker / CI-CD và HTTPS chuẩn production.

---

## Tác giả & giấy phép
- Họ tên: Đặng Minh Thịnh
- GVHD: Lê Thị Ngọc Thơ
- Lớp: 20BOIT02
