# Backend E-commerce API

REST API cho website thương mại điện tử, xây dựng theo ERD trong `database.txt`: người dùng, danh mục, sản phẩm, giỏ hàng, đơn hàng, thanh toán, voucher, đánh giá, bảo hành, sửa chữa, hoàn tiền.

## Công nghệ

| Thành phần | Công nghệ |
|------------|-----------|
| Runtime | Node.js |
| Framework | Express 4 |
| ORM | Prisma 6 |
| CSDL | PostgreSQL |
| Auth | JWT (access token + refresh token, lưu hash refresh trong DB) |
| Mật khẩu | bcryptjs |

## Cấu trúc thư mục

```
backend/
├── server.js              # Khởi động server, load dotenv
├── app.js                 # Express app, mount routes, error handler
├── package.json
├── nodemon.json           # Cấu hình `npm run dev` (watch + node server.js)
├── .env                   # Biến môi trường (không commit secret thật)
├── prisma/
│   ├── schema.prisma      # Model DB + bảng refresh_tokens
│   └── client.js          # Singleton PrismaClient
├── routes/                # Định tuyến HTTP
├── controllers/         # Xử lý nghiệp vụ + gọi Prisma
├── middleware/            # JWT, phân quyền, xử lý lỗi
├── utils/                 # asyncHandler, tokens, pagination
├── database.txt           # ERD tham chiếu (PlantUML)
└── Ecommerce_API_Prism_Postgres.postman_collection.json  # Postman
```

## Yêu cầu môi trường

- Node.js (khuyến nghị LTS)
- PostgreSQL (local hoặc cloud, ví dụ Neon)
- npm

## Cài đặt và chạy

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
```

Chạy production:

```bash
npm start
```

Chạy development (nodemon):

```bash
npm run dev
```

Mặc định server lắng nghe cổng `3000` (hoặc `PORT` trong `.env`).

## Biến môi trường (`.env`)

Tạo file `.env` trong thư mục `backend` với nội dung tương tự (thay giá trị bằng của bạn):

| Biến | Mô tả |
|------|--------|
| `PORT` | Cổng HTTP (mặc định 3000) |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL cho Prisma |
| `JWT_SECRET` | Secret ký access token |
| `JWT_REFRESH_SECRET` | Secret ký refresh token (nên khác access) |
| `ACCESS_TOKEN_TTL` | Thời hạn access token, ví dụ `15m` |
| `REFRESH_TOKEN_TTL` | Thời hạn refresh token, ví dụ `7d` |

**Lưu ý:** Không đưa file `.env` chứa mật khẩu/secret lên Git công khai.

## Xác thực và phân quyền

- **Access token:** gửi header `Authorization: Bearer <accessToken>`.
- **Refresh token:** body JSON `{ "refreshToken": "..." }` cho `/api/auth/refresh` và `/api/auth/logout`.
- Refresh token được **hash (SHA-256)** rồi lưu bảng `refresh_tokens`; khi refresh thì **rotate** (thu hồi token cũ, cấp token mới).
- Vai trò admin: JWT payload có `role_name: "admin"`; các route `/api/admin/*` và một số CRUD trên catalog yêu cầu role này.

Đảm bảo trong DB có bản ghi role `admin` (và user gán `role_id` tương ứng) nếu cần test admin.

## Danh sách API (tóm tắt)

### Chung

| Phương thức | Đường dẫn | Mô tả |
|-------------|-----------|--------|
| GET | `/` | Kiểm tra API đang chạy |

### Auth — `/api/auth`

| Phương thức | Đường dẫn | Auth |
|-------------|-----------|------|
| POST | `/register` | Không |
| POST | `/login` | Không — trả `accessToken`, `refreshToken` |
| POST | `/refresh` | Body refresh token |
| POST | `/logout` | Body refresh token |
| GET | `/me` | Bearer access |
| GET | `/admin` | Bearer access + role admin |

### Catalog (đọc công khai; ghi cần admin)

| Prefix | Ghi chú |
|--------|---------|
| `/api/categories` | GET list/detail; POST/PATCH/DELETE admin |
| `/api/brands` | Tương tự |
| `/api/products` | GET có phân trang/lọc/sort; POST/PATCH/DELETE admin |
| GET | `/api/products/:id/reviews` — danh sách đánh giá |

### Người dùng đã đăng nhập (Bearer)

| Prefix | Chức năng |
|--------|-----------|
| `/api/cart` | Xem giỏ, thêm/sửa/xóa dòng giỏ |
| `/api/orders` | Checkout từ giỏ, xem đơn, tạo/xem thanh toán theo đơn |
| `/api/reviews` | Tạo/sửa/xóa đánh giá (theo sản phẩm) |
| `/api/warranties` | Danh sách bảo hành của user |
| `/api/repair-requests` | Danh sách yêu cầu sửa; POST theo `warranty_id` |
| `/api/refund-requests` | Danh sách hoàn tiền; POST theo `order_id` |

### Voucher

| Phương thức | Đường dẫn | Auth |
|-------------|-----------|------|
| GET | `/api/vouchers/code/:code` | Công khai |
| GET/POST/PATCH/DELETE | `/api/vouchers` | Admin |

### Admin — `/api/admin` (Bearer + role admin)

- Users: list, cập nhật
- Roles: list, tạo, xóa
- Orders: list, cập nhật `order_status` / `payment_status`
- Payments: cập nhật trạng thái, mã giao dịch, `paid_at`
- Warranties, repair-requests, refund-requests: list + cập nhật trạng thái
- Báo cáo: `GET /api/admin/reports/revenue`, `GET /api/admin/reports/top-products`

## Luồng nghiệp vụ tiêu biểu

1. **Đăng ký / đăng nhập** → lưu `accessToken` và `refreshToken`.
2. **Duyệt sản phẩm** (public) → **thêm giỏ** → **POST `/api/orders`** checkout (trừ tồn, tạo order_items, có thể áp voucher, tạo warranty nếu sản phẩm có tháng bảo hành).
3. **POST `/api/orders/:id/payments`** tạo bản ghi thanh toán; admin có thể cập nhật qua `/api/admin/payments/:id` và trạng thái đơn.

## Postman

Import file:

`Ecommerce_API_Prism_Postgres.postman_collection.json`

Biến collection: `baseUrl`, `accessToken`, `refreshToken`. Request login/refresh có script tự ghi token.

## Lệnh Prisma hữu ích

```bash
npm run prisma:generate   # prisma generate
npm run prisma:migrate    # prisma migrate dev
```

## Ghi chú kỹ thuật

- ID kiểu `BigInt` trong Prisma thường được trả về dạng **chuỗi** trong JSON để tương thích client.
- Lỗi Prisma phổ biến được map trong `middleware/errorHandler.js` (ví dụ unique constraint, record not found).

## Tài liệu tham chiếu

- ERD: `database.txt`
- Schema: `prisma/schema.prisma`
