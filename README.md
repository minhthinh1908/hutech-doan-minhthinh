# Website thương mại điện tử — E-commerce Tools

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

## Vai trò của Payment Gateway (actor ngoài)

Trong mô hình use case, **Payment Gateway** là **actor bên ngoài** hệ thống cửa hàng, tham gia vào use case **Process Payment** (xử lý thanh toán) khi **Buyer** đặt hàng và chọn thanh toán trực tuyến.

**Nhiệm vụ của Payment Gateway**

| Nhiệm vụ | Mô tả |
|----------|--------|
| Nhận yêu cầu thanh toán | Nhận luồng thanh toán do **hệ thống** chuyển tiếp sau khi Buyer xác nhận đơn (số tiền, mã tham chiếu đơn hàng, …). |
| Xử lý giao dịch | Thực hiện giao dịch với tổ chức tài chính / ví điện tử theo giao thức của từng cổng (VNPay, MoMo, ZaloPay, …). |
| Xác thực thanh toán | Đối soát chữ ký, trạng thái giao dịch, chống giả mạo callback. |
| Trả kết quả về hệ thống | Thông báo **thành công** hoặc **thất bại** (và mã lỗi nếu có) để backend cập nhật `payment_status` / bản ghi `Payment` tương ứng. |

**Phạm vi trách nhiệm (ranh giới)**

- Payment Gateway **không** quản lý sản phẩm, người dùng hay đơn hàng; các thực thể đó thuộc **hệ thống nội bộ** (database + API).
- Cổng chỉ xử lý **giao dịch thanh toán** (transaction) theo yêu cầu và phản hồi kết quả — phù hợp nguyên tắc **tách biệt trách nhiệm** trong kiến trúc TMĐT.

```mermaid
sequenceDiagram
  participant B as Buyer
  participant S as Hệ thống (Shop API)
  participant G as Payment Gateway
  B->>S: Đặt hàng / chọn thanh toán
  S->>G: Yêu cầu thanh toán (số tiền, ref đơn)
  G->>G: Xử lý & xác thực giao dịch
  G-->>S: Kết quả (thành công / thất bại)
  S->>S: Cập nhật trạng thái thanh toán đơn hàng
```

**Trong mã nguồn hiện tại:** bảng `payments` và trường `payment_status` trên đơn hàng phục vụ **ghi nhận** thanh toán; **tích hợp cổng thực** (redirect, IPN/webhook) là bước triển khai tiếp theo, đúng với vai trò actor nêu trên.

### Trạng thái thanh toán (`payment_status`)

Cùng một bộ giá trị cho **`orders.payment_status`** và **`payments.payment_status`**:

| Giá trị | Ý nghĩa |
|---------|---------|
| `pending` | Đơn / giao dịch đã tạo nhưng **chưa thanh toán** (hoặc chờ thu COD). |
| `processing` | **Đang xử lý** — chuyển sang cổng, chờ chuyển khoản, hoặc chờ xác nhận. |
| `paid` | **Thanh toán thành công.** |
| `failed` | **Thanh toán thất bại** (có thể thử lại). |
| `cancelled` | **Khách hủy** thanh toán (phiên cổng / hủy giao dịch). |
| `refunded` | **Đã hoàn tiền** cho khách. |

- **Buyer:** nhãn tiếng Việt ngắn gọn (`frontend/src/utils/paymentStatusLabels.js` — `paymentStatusBuyerLabel`).  
- **Admin:** nhãn kèm **mã + mô tả** (`paymentStatusAdminLabel`) và bảng **nhật ký** `payment_status_logs` (nguồn: `system` | `admin` | `gateway` | `buyer`).  
- **Ghi log:** mỗi lần đổi trạng thái (đặt hàng, cổng, webhook, cập nhật admin) ghi vào bảng **`payment_status_logs`**.

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

### 4. Áp dụng voucher (Buyer ↔ Admin)

| Phần | Nội dung |
|------|----------|
| **Buyer** | Trang **Giỏ hàng**: nhập mã → **Áp dụng / xem trước** để xem tạm tính, **số tiền giảm**, tổng thanh toán (`POST /api/vouchers/preview`). **Đặt hàng** gửi kèm cùng mã (`POST /api/orders`, body `voucher_code`) — logic kiểm tra giống bước xem trước. |
| **Admin** | **Khuyến mãi / Voucher** (`/admin/voucher`): tạo/sửa mã do admin quản lý — **loại giảm** (% hoặc số tiền cố định), **giá trị**, **điều kiện** (đơn tối thiểu, danh mục áp dụng), **thời gian** hiệu lực, giới hạn lượt; **theo dõi số lần sử dụng** qua cột *Đã dùng / giới hạn* (`usage_count` / `usage_limit`) và phần tổng hợp trong **Báo cáo**. |

Luồng kiểm tra mã: `backend/services/voucherValidation.js` — đơn đặt ghi `OrderVoucher` và tăng `usage_count` trong `orderController.checkout`.

### Quản trị viên (`/admin`, role `admin`)

- Dashboard, sản phẩm, danh mục, thương hiệu, voucher  
- Đơn hàng, khách hàng (người dùng)  
- Bảo hành, sửa chữa, hoàn tiền, báo cáo  
- Cấu hình **chân trang** (chi nhánh, bản đồ, chính sách, …)  

---

## 3. Đặt hàng & xử lý thanh toán (Place Order + Process Payment)

### Khách (Buyer)

1. **Giỏ hàng** — Thêm sản phẩm, chỉnh số lượng; tùy chọn nhập **mã voucher** và «Áp dụng / xem trước» (`POST /api/vouchers/preview`).
2. **Địa chỉ giao hàng** — Nhập địa chỉ (bắt buộc) trước khi đặt; có thể lưu địa chỉ mặc định ở **Hồ sơ** (`PATCH /api/auth/me`) để form gợi ý sẵn.
3. **Đặt hàng** — `POST /api/orders` với `shipping_address` (+ tùy chọn `voucher_code`): tạo đơn `pending`, `payment_status: unpaid`, lưu **snapshot** địa chỉ trên bảng `orders`, xóa dòng giỏ.
4. **Thanh toán** — Trang chi tiết đơn (`/don-hang/:id`): chọn **COD**, **chuyển khoản**, hoặc **cổng thanh toán** (demo) rồi `POST /api/orders/:id/payments` — tạo bản ghi `payments` (chờ xác nhận / demo gateway). Admin cập nhật `payment_status` trên đơn hoặc từng dòng thanh toán khi đối soát.

```mermaid
flowchart LR
  A[Giỏ hàng] --> B[Địa chỉ + voucher]
  B --> C[POST /orders]
  C --> D[Chi tiết đơn]
  D --> E[POST /orders/:id/payments]
  E --> F[Admin xác nhận TT / trạng thái đơn]
```

### Quản trị (Admin)

- **Danh sách & lọc đơn** — `GET /api/admin/orders` (trạng thái, mã đơn).
- **Chi tiết đơn** — `GET /api/admin/orders/:order_id`: khách, **địa chỉ giao**, dòng hàng, voucher, **lịch sử thanh toán** (`payments`: phương thức, trạng thái, mã giao dịch, thời điểm nếu có).
- **Cập nhật trạng thái đơn** — `PATCH /api/admin/orders/:order_id` với `order_status`: chuỗi khuyến nghị **pending → confirmed → shipping → completed** (hoặc `cancelled`). Có thể đồng bộ `payment_status` khi đối soát.
- **Cập nhật thanh toán** — `PATCH /api/admin/payments/:payment_id` (ví dụ ghi `paid_at`, `transaction_code`).

> **Tích hợp cổng thực (VNPay, MoMo, …):** hiện tại là luồng demo; production cần redirect URL, webhook IPN và cập nhật trạng thái từ callback.

### Logic nghiệp vụ thanh toán (business rules)

Áp dụng trong code: `backend/services/paymentBusinessRules.js` + kiểm tra trong `orderController.createPayment`, `adminController.updatePayment` / `updateOrderStatus` / `updateRefundRequest`.

| Quy tắc | Cách triển khai |
|--------|------------------|
| Mỗi payment gắn order hợp lệ | `Payment.order_id` là FK; buyer chỉ tạo qua `POST /api/orders/:id/payments` khi đơn thuộc user. |
| Không paid nếu cổng chưa xác nhận | Admin **không** được PATCH `payment_status` thành `paid`/`success` cho `payment_method = payment_gateway` — chỉ webhook / `paymentGatewayService` / luồng hoàn tất phiên cổng. |
| Thanh toán thất bại | Đơn vẫn tồn tại; `orders.payment_status` có thể `failed` / `unpaid` / `pending` tùy luồng; dòng `payments` ghi `failed` (hoặc tương đương). |
| Thanh toán lại | Không tạo giao dịch mới khi còn dòng **pending** / **awaiting_confirmation**; sau **failed** / **cancelled** có thể tạo bản ghi payment mới. |
| Hoàn tiền xong | Khi `refund_status = completed`, đồng bộ `orders.payment_status = refunded` và các dòng payment đã thành công → `refunded`. |
| Buyer không sửa payment_status | Body `POST /orders/:id/payments` **không** được chứa `payment_status` — luôn tạo ở trạng thái chờ. |
| Đặt đơn `paid` từ admin | `PATCH /admin/orders/:id` với `payment_status: paid` chỉ khi đã có ít nhất một dòng payment `success` hoặc `paid` (sau khi COD/chuyển khoản xác nhận hoặc cổng thành công). |

### 10. Trường hợp xử lý ngoại lệ (Payment Gateway)

Các tình huống được **mô phỏng** qua `POST /api/orders/:order_id/payments/:payment_id/outcome` (body: `{ "scenario": "<tên>" }`, JWT buyer, chỉ `payment_gateway`). Thông báo thân thiện cho khách lưu ở `payments.buyer_message`, mã lỗi ở `payments.error_code`, cờ đối soát ở `payments.is_abnormal`. Log cấu trúc: `backend/services/paymentExceptionLog.js`.

| Scenario | Ý nghĩa |
|----------|---------|
| `gateway_timeout` | Timeout cổng — `payment_status`: `timeout` |
| `invalid_payment_info` | Sai thông tin thanh toán — `failed` |
| `user_cancelled` | Khách hủy giữa chừng — `cancelled` |
| `gateway_error` | Cổng trả lỗi — `failed` |
| `callback_failed` | Tiền có thể đã trừ nhưng callback không về — `callback_failed`, đơn: `pending_confirmation` |
| `duplicate` | Giao dịch trùng (đối soát) — `failed` |

**Chống trùng khi tạo phiên:** `POST /api/orders/:id/payments` có thể gửi `idempotency_key` (unique theo đơn); trùng khóa trả **200** với `duplicate: true` và bản ghi payment hiện có (không tạo dòng mới).

**Webhook / demo thành công:** khi cổng xác nhận thành công, các trường lỗi trên dòng payment được xóa (`error_code`, `buyer_message`, `is_abnormal`).

**Admin:** `GET /api/admin/payments?quick=abnormal` — các giao dịch lỗi hoặc bất thường (cờ `is_abnormal`, trạng thái `timeout` / `callback_failed`, hoặc có `error_code`).

---

## Cơ sở dữ liệu (tóm tắt)

Schema định nghĩa trong `backend/prisma/schema.prisma`, gồm các nhóm chính:

- **Người dùng & phân quyền:** `Role`, `User`, `RefreshToken`  
- **Danh mục & sản phẩm:** `Category` (cây phân cấp), `Brand`, `CategoryBrand`, `Product` (giá, flash sale, nhãn hot/mới/bestseller, …)  
- **Mua hàng:** `Cart`, `CartItem`, `Order` (có `shipping_address` snapshot lúc đặt), `OrderItem`, `Payment`, `Voucher`, `OrderVoucher`  
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

- Tích hợp **Payment Gateway** thực (VNPay, MoMo, …): redirect, IPN/webhook, đối soát với bảng `payments` — xem mục **Vai trò của Payment Gateway** ở trên.  
- Gửi email / SMS xác nhận đơn hàng.  
- Viết test tự động (API: Jest/Supertest; UI: Vitest + Testing Library).  
- Triển khai Docker / CI-CD và HTTPS chuẩn production.

---

## Tác giả & giấy phép
- Họ tên: Đặng Minh Thịnh
- GVHD: Lê Thị Ngọc Thơ
- Lớp: 20BOIT02
