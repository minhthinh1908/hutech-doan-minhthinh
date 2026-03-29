/**
 * Tạo vai trò + tài khoản admin mặc định, voucher demo, đơn mẫu, yêu cầu sửa chữa mẫu, đánh giá mẫu.
 *
 * Ví dụ dữ liệu Admin → Đánh giá (sau `npx prisma db seed`):
 *   - 3 đánh giá: đã duyệt / chờ duyệt / từ chối; 1 bình luận của shop trên đánh giá đã duyệt.
 *   - Tài khoản thử: demo-buyer@binhdinhtools.local / Demo@123456; seed-reviewer-2@binhdinhtools.local / Demo@123456
 *
 * Admin → Hoàn tiền — 4 yêu cầu mẫu (chờ xử lý / đã duyệt / từ chối / hoàn tất), lý do bắt đầu bằng "[seed-demo hoàn tiền]".
 *
 * Admin → Bảo hành — 3 khách mẫu (phiếu BH + ghi chú admin):
 *   - demo-buyer@… (đơn mẫu + BH gắn sửa chữa seed)
 *   - demo-bh-2@binhdinhtools.local / Demo@123456 — Trần Thị Nga
 *   - demo-bh-3@binhdinhtools.local / Demo@123456 — Lê Văn Minh
 *
 *   cd backend
 *   npx prisma db seed
 *
 * Hoặc đặt trong .env:
 *   ADMIN_EMAIL=your@email.com
 *   ADMIN_PASSWORD=YourStrongPassword
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { ensureDefaultBrands } = require("../services/ensureDefaultBrands");
const { ensureDefaultCategories } = require("../services/ensureDefaultCategories");
const { ensureDefaultCategoryBrands } = require("../services/ensureDefaultCategoryBrands");
const { seedDemoRefundRequests } = require("../services/seedDemoRefundRequests");

const prisma = new PrismaClient();

async function ensureRole(name) {
  let r = await prisma.role.findFirst({ where: { role_name: name } });
  if (!r) {
    r = await prisma.role.create({ data: { role_name: name } });
    console.log(`[seed] Created role: ${name} (id=${r.role_id})`);
  }
  return r;
}

async function seedDefaultCategories() {
  const r = await ensureDefaultCategories(prisma, { onlyIfDbEmpty: true });
  if (r.skipped) {
    console.log("[seed] categories: DB already has rows — skipped (dùng Admin → Đồng bộ để thêm thiếu).");
  } else {
    console.log(
      `[seed] categories: +${r.parentsEnsured} nhóm gốc, +${r.childrenCreated} danh mục con.`
    );
  }
  const br = await ensureDefaultCategoryBrands(prisma);
  if (br.linksCreated > 0) {
    console.log(`[seed] category_brands: +${br.linksCreated} liên kết (nhóm gốc ↔ thương hiệu).`);
  }
}

async function ensureSiteFooter() {
  await prisma.siteFooter.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      site_name: "BÌNH ĐỊNH TOOLS",
      branch1_label: "Chi nhánh Bình Định:",
      branch1_phone: "0336 634 677",
      branch1_address:
        "73 Đường Đào Tấn, Phường Nhơn Bình, Thành phố Quy Nhơn, Tỉnh Bình Định",
      branch2_label: "Chi nhánh HCM:",
      branch2_phone: "0981 278 914",
      branch2_address: "2A, đường số 9, phường Phú Lâm, Thành Phố Hồ Chí Minh",
      email: "binhdinhtools@gmail.com",
      website_url: "https://binhdinhtools.vn",
      copyright_line: "© BÌNH ĐỊNH TOOLS",
      policies_json: [
        { label: "Hướng dẫn mua hàng", to: "/gioi-thieu" },
        { label: "Chính sách vận chuyển", to: "/dich-vu" },
        { label: "Chính sách bán hàng tử tế", to: "/lien-he" },
        { label: "Chính sách bảo mật thông tin", to: "/lien-he" }
      ]
    },
    update: {}
  });
  console.log("[seed] site_footer (id=1) ready.");
}

/** Mã voucher demo — hiển thị trong Admin → Voucher; khách nhập ở giỏ hàng (idempotent). */
const DEMO_VOUCHER_CODE = "DEMO-GIAM10";

async function ensureDemoVoucher(prismaClient) {
  const existing = await prismaClient.voucher.findUnique({
    where: { code: DEMO_VOUCHER_CODE }
  });
  if (existing) {
    console.log(`[seed] demo voucher: đã có mã ${DEMO_VOUCHER_CODE} — bỏ qua.`);
    return;
  }
  await prismaClient.voucher.create({
    data: {
      code: DEMO_VOUCHER_CODE,
      discount_type: "percent",
      discount_value: 10,
      min_order_value: 100000,
      max_discount_amount: 500000,
      start_date: new Date("2026-01-01T00:00:00.000Z"),
      end_date: new Date("2027-12-31T23:59:59.000Z"),
      status: "active",
      usage_limit: 500,
      per_user_limit: 3,
      usage_count: 0,
      applicable_category_ids: null
    }
  });
  console.log(
    `[seed] demo voucher: mã ${DEMO_VOUCHER_CODE} — giảm 10% (trần 500.000đ), đơn tối thiểu 100.000đ, tối đa 500 lượt, mỗi khách 3 lần, hạn 2026–2027.`
  );
}

/** SP tối thiểu để luôn có thể tạo đơn mẫu khi catalog trống (SKU cố định, idempotent). */
async function ensureDemoSeedProduct(prismaClient) {
  const existing = await prismaClient.product.findUnique({ where: { sku: "DEMO-ORDER-SEED" } });
  if (existing) return existing;
  const cat = await prismaClient.category.findFirst({ orderBy: { category_id: "asc" } });
  const brand = await prismaClient.brand.findFirst({ orderBy: { brand_id: "asc" } });
  if (!cat || !brand) {
    console.warn("[seed] demo order: thiếu danh mục hoặc thương hiệu — không tạo SP demo.");
    return null;
  }
  const p = await prismaClient.product.create({
    data: {
      category_id: cat.category_id,
      brand_id: brand.brand_id,
      product_name: "Sản phẩm demo (đơn hàng mẫu)",
      sku: "DEMO-ORDER-SEED",
      price: 199000,
      stock_quantity: 10,
      status: "active"
    }
  });
  console.log("[seed] đã tạo sản phẩm DEMO-ORDER-SEED (199.000đ, tồn 10) phục vụ đơn mẫu.");
  return p;
}

/** Một đơn hàng mẫu cho Admin → Đơn hàng (idempotent: chỉ tạo nếu chưa có đơn của user demo). */
async function ensureDemoOrder(prismaClient) {
  const buyerRole = await prismaClient.role.findFirst({ where: { role_name: "buyer" } });
  if (!buyerRole) {
    console.warn("[seed] demo order: không có role buyer — bỏ qua.");
    return;
  }

  const demoEmail = "demo-buyer@binhdinhtools.local";
  let buyer = await prismaClient.user.findUnique({ where: { email: demoEmail } });
  if (!buyer) {
    buyer = await prismaClient.user.create({
      data: {
        role_id: buyerRole.role_id,
        full_name: "Khách ví dụ (demo đơn hàng)",
        email: demoEmail,
        password_hash: await bcrypt.hash("Demo@123456", 10),
        phone: "0901234567",
        status: "active"
      }
    });
    console.log("[seed] demo buyer:", demoEmail, "(mật khẩu Demo@123456 — để thử đăng nhập buyer)");
  }

  const hasOrder = await prismaClient.order.findFirst({
    where: { user_id: buyer.user_id },
    select: { order_id: true }
  });
  if (hasOrder) {
    console.log(`[seed] demo order: đã có đơn (order_id=${hasOrder.order_id}) — bỏ qua.`);
    return;
  }

  let product = await prismaClient.product.findFirst({
    where: { status: "active", stock_quantity: { gte: 1 } },
    orderBy: { product_id: "asc" }
  });
  let decrementStock = true;
  if (!product) {
    product = await prismaClient.product.findFirst({
      where: { status: "active" },
      orderBy: { product_id: "asc" }
    });
    decrementStock = false;
  }
  if (!product) {
    product = await ensureDemoSeedProduct(prismaClient);
    if (product) decrementStock = true;
  }
  if (!product) {
    console.log("[seed] demo order: không thể tạo sản phẩm demo — bỏ qua.");
    return;
  }

  const qty = product.stock_quantity >= 2 ? 2 : 1;
  const unit = Number(product.price);
  const lineTotal = unit * qty;
  const subtotal = lineTotal;
  const total = subtotal;

  await prismaClient.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        user_id: buyer.user_id,
        order_status: "confirmed",
        subtotal,
        discount_amount: 0,
        total_amount: total,
        payment_status: "paid",
        order_date: new Date()
      }
    });
    await tx.orderItem.create({
      data: {
        order_id: order.order_id,
        product_id: product.product_id,
        quantity: qty,
        unit_price: product.price,
        line_total: lineTotal
      }
    });
    await tx.payment.create({
      data: {
        order_id: order.order_id,
        payment_method: "cod",
        payment_status: "success",
        paid_at: new Date()
      }
    });
    if (decrementStock && product.stock_quantity >= qty) {
      await tx.product.update({
        where: { product_id: product.product_id },
        data: { stock_quantity: { decrement: qty } }
      });
    }
  });

  const stockNote = decrementStock && product.stock_quantity >= qty ? "" : " (không trừ kho — tồn = 0)";
  console.log(
    `[seed] demo order: đã tạo 1 đơn mẫu (confirmed, COD, đã thanh toán paid — hiện trong báo cáo doanh thu) — khách: ${demoEmail}, SP: ${product.product_name} x${qty}.${stockNote}`
  );
}

/** Đơn demo cũ (unpaid/pending) → paid/success để Báo cáo có ví dụ doanh thu (idempotent). */
async function ensureDemoOrderPaidForReports(prismaClient) {
  const demoEmail = "demo-buyer@binhdinhtools.local";
  const buyer = await prismaClient.user.findUnique({ where: { email: demoEmail } });
  if (!buyer) return;

  const orders = await prismaClient.order.findMany({
    where: {
      user_id: buyer.user_id,
      payment_status: { notIn: ["paid", "success"] }
    },
    include: { payments: true }
  });
  if (orders.length === 0) return;

  for (const o of orders) {
    await prismaClient.$transaction(async (tx) => {
      await tx.order.update({
        where: { order_id: o.order_id },
        data: { payment_status: "paid" }
      });
      for (const p of o.payments) {
        await tx.payment.update({
          where: { payment_id: p.payment_id },
          data: { payment_status: "success", paid_at: p.paid_at ?? new Date() }
        });
      }
    });
  }
  console.log(
    `[seed] demo order: đã cập nhật ${orders.length} đơn demo → thanh toán paid (mẫu cho báo cáo doanh thu).`
  );
}

async function ensureDemoRefundRequests(prismaClient) {
  await seedDemoRefundRequests(prismaClient);
}

const DEMO_BH_ADMIN_TAG = "[DEMO-BH-SEED]";

/**
 * Thêm 2 khách + đơn + phiếu bảo hành mẫu (idempotent theo admin_note).
 * Cùng demo-buyer tạo thành ~3 người để Admin → Bảo hành có ví dụ rõ.
 */
async function ensureDemoWarrantyExtraBuyers(prismaClient) {
  const already = await prismaClient.warranty.count({
    where: { admin_note: { contains: DEMO_BH_ADMIN_TAG } }
  });
  if (already >= 2) {
    console.log("[seed] demo BH: đã có 2 phiếu mẫu [DEMO-BH-SEED] — bỏ qua.");
    return;
  }

  const buyerRole = await prismaClient.role.findFirst({ where: { role_name: "buyer" } });
  if (!buyerRole) {
    console.warn("[seed] demo BH: không có role buyer — bỏ qua.");
    return;
  }

  let product = await prismaClient.product.findFirst({
    where: { status: "active", warranty_months: { gte: 1 }, stock_quantity: { gte: 1 } },
    orderBy: { product_id: "asc" }
  });
  if (!product) {
    product = await prismaClient.product.findFirst({
      where: { status: "active", stock_quantity: { gte: 1 } },
      orderBy: { product_id: "asc" }
    });
  }
  if (!product) {
    product = await ensureDemoSeedProduct(prismaClient);
  }
  if (!product) {
    console.warn("[seed] demo BH: không có sản phẩm — bỏ qua.");
    return;
  }
  if (product.warranty_months < 1) {
    await prismaClient.product.update({
      where: { product_id: product.product_id },
      data: { warranty_months: 12 }
    });
    product = await prismaClient.product.findUnique({ where: { product_id: product.product_id } });
  }

  const samples = [
    {
      email: "demo-bh-2@binhdinhtools.local",
      full_name: "Trần Thị Nga",
      phone: "0911111111",
      warrantyStatus: "active",
      admin_note: `${DEMO_BH_ADMIN_TAG} Mua tại Quy Nhơn — đã gọi xác nhận kích hoạt BH.`,
      start_date: new Date("2026-03-01T00:00:00.000Z"),
      end_date: new Date("2028-12-31T00:00:00.000Z")
    },
    {
      email: "demo-bh-3@binhdinhtools.local",
      full_name: "Lê Văn Minh",
      phone: "0922222222",
      warrantyStatus: "expired",
      admin_note: `${DEMO_BH_ADMIN_TAG} Phiếu minh họa hết hạn (chỉ để xem bảng Admin).`,
      start_date: new Date("2023-01-01T00:00:00.000Z"),
      end_date: new Date("2024-06-01T00:00:00.000Z")
    }
  ];

  for (const s of samples) {
    const dup = await prismaClient.warranty.findFirst({
      where: { admin_note: { contains: DEMO_BH_ADMIN_TAG }, user: { email: s.email } }
    });
    if (dup) continue;

    let user = await prismaClient.user.findUnique({ where: { email: s.email } });
    if (!user) {
      user = await prismaClient.user.create({
        data: {
          role_id: buyerRole.role_id,
          full_name: s.full_name,
          email: s.email,
          password_hash: await bcrypt.hash("Demo@123456", 10),
          phone: s.phone,
          status: "active"
        }
      });
      console.log(`[seed] demo BH: tài khoản ${s.email} (Demo@123456) — ${s.full_name}`);
    }

    const hasOrder = await prismaClient.order.findFirst({ where: { user_id: user.user_id } });
    if (hasOrder) {
      console.warn(`[seed] demo BH: ${s.email} đã có đơn — bỏ qua phiếu mẫu cho user này.`);
      continue;
    }

    const unit = Number(product.price);
    const qty = 1;
    const lineTotal = unit * qty;

    await prismaClient.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          user_id: user.user_id,
          order_status: "completed",
          subtotal: lineTotal,
          discount_amount: 0,
          total_amount: lineTotal,
          payment_status: "paid",
          order_date: new Date("2026-02-15T10:00:00.000Z")
        }
      });
      const oi = await tx.orderItem.create({
        data: {
          order_id: order.order_id,
          product_id: product.product_id,
          quantity: qty,
          unit_price: product.price,
          line_total: lineTotal
        }
      });
      await tx.payment.create({
        data: {
          order_id: order.order_id,
          payment_method: "bank_transfer",
          payment_status: "success",
          paid_at: new Date("2026-02-15T11:00:00.000Z")
        }
      });
      await tx.warranty.create({
        data: {
          order_item_id: oi.order_item_id,
          user_id: user.user_id,
          start_date: s.start_date,
          end_date: s.end_date,
          status: s.warrantyStatus,
          admin_note: s.admin_note
        }
      });
      if (product.stock_quantity >= qty) {
        await tx.product.update({
          where: { product_id: product.product_id },
          data: { stock_quantity: { decrement: qty } }
        });
      }
    });
  }

  console.log(
    "[seed] demo BH: +2 khách mẫu (Trần Thị Nga, Lê Văn Minh) + phiếu BH — xem Admin → Bảo hành (cùng demo-buyer = 3 người)."
  );
}

const DEMO_REPAIR_PREFIX = "[DEMO-REPAIR]";

/** 3 yêu cầu sửa chữa mẫu cho Admin → Sửa chữa (cần đơn mẫu + bảo hành; idempotent). */
async function ensureDemoRepairRequests(prismaClient) {
  const dup = await prismaClient.repairRequest.findFirst({
    where: { issue_description: { startsWith: DEMO_REPAIR_PREFIX } }
  });
  if (dup) {
    console.log("[seed] demo repairs: đã có yêu cầu mẫu — bỏ qua.");
    return;
  }

  const demoEmail = "demo-buyer@binhdinhtools.local";
  const buyer = await prismaClient.user.findUnique({ where: { email: demoEmail } });
  if (!buyer) {
    console.warn("[seed] demo repairs: chưa có khách demo — bỏ qua.");
    return;
  }

  const orderItem = await prismaClient.orderItem.findFirst({
    where: { order: { user_id: buyer.user_id } },
    orderBy: { order_item_id: "asc" }
  });
  if (!orderItem) {
    console.warn("[seed] demo repairs: chưa có dòng đơn — chạy seed khi đã có đơn mẫu.");
    return;
  }

  let warranty = await prismaClient.warranty.findFirst({
    where: { order_item_id: orderItem.order_item_id }
  });
  if (!warranty) {
    warranty = await prismaClient.warranty.create({
      data: {
        order_item_id: orderItem.order_item_id,
        user_id: buyer.user_id,
        start_date: new Date("2025-06-01T00:00:00.000Z"),
        end_date: new Date("2028-06-01T00:00:00.000Z"),
        status: "active"
      }
    });
    console.log("[seed] demo repairs: +1 bảo hành gắn đơn mẫu (để tạo YC sửa chữa).");
  }

  const samples = [
    {
      repair_status: "pending",
      request_date: new Date("2026-03-10T09:00:00.000Z"),
      issue_description: `${DEMO_REPAIR_PREFIX} Máy khoan rung mạnh ở cấp số 2, nghi ngờ lỗi bánh răng.`,
      admin_notes: null,
      resolution_notes: null,
      expected_completion_date: null,
      completed_at: null
    },
    {
      repair_status: "in_progress",
      request_date: new Date("2026-03-18T14:30:00.000Z"),
      issue_description: `${DEMO_REPAIR_PREFIX} Pin không giữ sạc — đang kiểm tra cell.`,
      admin_notes: "Đã nhận máy, dự kiến báo giá trong 24h.",
      resolution_notes: null,
      expected_completion_date: new Date("2026-04-15T00:00:00.000Z"),
      completed_at: null
    },
    {
      repair_status: "completed",
      request_date: new Date("2026-03-05T11:00:00.000Z"),
      issue_description: `${DEMO_REPAIR_PREFIX} Thay chổi than — đã xong.`,
      admin_notes: "Khách đồng ý sửa tại chỗ.",
      resolution_notes: "Đã thay chổi than chính hãng; test tải 15 phút ổn định.",
      expected_completion_date: new Date("2026-03-20T00:00:00.000Z"),
      completed_at: new Date("2026-03-20T10:00:00.000Z")
    }
  ];

  for (const s of samples) {
    await prismaClient.repairRequest.create({
      data: {
        warranty_id: warranty.warranty_id,
        user_id: buyer.user_id,
        request_date: s.request_date,
        issue_description: s.issue_description,
        repair_status: s.repair_status,
        admin_notes: s.admin_notes,
        resolution_notes: s.resolution_notes,
        expected_completion_date: s.expected_completion_date,
        completed_at: s.completed_at,
        attachment_urls: null
      }
    });
  }

  console.log(
    "[seed] demo repairs: +3 yêu cầu sửa chữa mẫu (pending / in_progress / completed) — Admin → Sửa chữa."
  );
}

/** Nội dung đánh giá 1 — dùng nhận diện seed (idempotent, không hiển thị tiền tố lạ). */
const DEMO_REVIEW_1_SNIPPET = "Giao nhanh, máy chạy êm, đúng mô tả. Rất hài lòng.";

/** 3 đánh giá mẫu (approved / pending / rejected); 3 user khác nhau để dễ nhìn khi chỉ có 1 sản phẩm. */
async function ensureDemoReviews(prismaClient) {
  const dup = await prismaClient.review.findFirst({
    where: { comment: { contains: DEMO_REVIEW_1_SNIPPET } }
  });
  if (dup) {
    console.log("[seed] demo reviews: đã có đánh giá mẫu — bỏ qua.");
    return;
  }

  const buyerRole = await prismaClient.role.findFirst({ where: { role_name: "buyer" } });
  if (!buyerRole) {
    console.warn("[seed] demo reviews: không có role buyer — bỏ qua.");
    return;
  }

  const demoEmail = "demo-buyer@binhdinhtools.local";
  const buyer = await prismaClient.user.findUnique({ where: { email: demoEmail } });
  if (!buyer) {
    console.warn("[seed] demo reviews: chưa có khách demo — chạy seed sau khi có demo-buyer@binhdinhtools.local.");
    return;
  }

  const email2 = "seed-reviewer-2@binhdinhtools.local";
  let buyer2 = await prismaClient.user.findUnique({ where: { email: email2 } });
  if (!buyer2) {
    buyer2 = await prismaClient.user.create({
      data: {
        role_id: buyerRole.role_id,
        full_name: "Khách ví dụ (đánh giá seed 2)",
        email: email2,
        password_hash: await bcrypt.hash("Demo@123456", 10),
        phone: "0907654321",
        status: "active"
      }
    });
    console.log(`[seed] demo reviews: tạo ${email2} (Demo@123456) — phân tách 3 đánh giá mẫu.`);
  }

  const products = await prismaClient.product.findMany({
    where: { status: "active" },
    take: 3,
    orderBy: { product_id: "asc" }
  });
  if (products.length === 0) {
    console.warn("[seed] demo reviews: không có sản phẩm active — bỏ qua.");
    return;
  }

  const adminRole = await prismaClient.role.findFirst({ where: { role_name: "admin" } });
  const adminUser = adminRole
    ? await prismaClient.user.findFirst({ where: { role_id: adminRole.role_id } })
    : null;

  const p0 = products[0];
  const p1 = products[1] || products[0];
  const p2 = products[2] || products[0];

  const r1 = await prismaClient.review.create({
    data: {
      user_id: buyer.user_id,
      product_id: p0.product_id,
      rating: 5,
      comment: DEMO_REVIEW_1_SNIPPET,
      moderation_status: "approved"
    }
  });

  await prismaClient.review.create({
    data: {
      user_id: buyer2.user_id,
      product_id: p1.product_id,
      rating: 4,
      comment:
        "Sản phẩm tốt nhưng hơi nặng tay; mong shop thêm video hướng dẫn lắp phụ kiện.",
      moderation_status: "pending"
    }
  });

  if (adminUser) {
    await prismaClient.review.create({
      data: {
        user_id: adminUser.user_id,
        product_id: p2.product_id,
        rating: 2,
        comment: "[ví dụ ẩn] Vỏ hộp móp một góc khi nhận; thiết bị vẫn dùng được.",
        moderation_status: "rejected"
      }
    });
  } else {
    await prismaClient.review.create({
      data: {
        user_id: buyer2.user_id,
        product_id: p2.product_id,
        rating: 2,
        comment: "Vỏ hộp móp một góc khi nhận; thiết bị vẫn dùng được.",
        moderation_status: "rejected"
      }
    });
  }

  if (adminUser) {
    await prismaClient.reviewComment.create({
      data: {
        review_id: r1.review_id,
        user_id: adminUser.user_id,
        body: "Cảm ơn bạn đã tin tưởng Bình Định Tools. Chúc bạn sử dụng hiệu quả!"
      }
    });
  }

  console.log(
    `[seed] demo reviews: +3 đánh giá (approved / pending / rejected) — ${demoEmail}, ${email2}${adminUser ? ", admin" : ""}; SP: ${p0.product_name}${products[1] ? `, ${p1.product_name}` : ""}${products[2] ? `, ${p2.product_name}` : ""}.`
  );
  if (adminUser) {
    console.log("[seed] demo reviews: +1 bình luận từ tài khoản admin trên đánh giá đã duyệt.");
  }
}

async function main() {
  await ensureRole("buyer");
  const adminRole =   await ensureRole("admin");
  await ensureSiteFooter();
  const brSeed = await ensureDefaultBrands(prisma);
  if (brSeed.created > 0) {
    console.log(`[seed] brands: +${brSeed.created} thương hiệu mặc định (Milwaukee, DEWALT, …).`);
  }
  await seedDefaultCategories();

  const email = (process.env.ADMIN_EMAIL || "admin@binhdinhtools.local").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@123456";

  if (!process.env.ADMIN_PASSWORD) {
    console.warn(
      "[seed] ADMIN_PASSWORD not set — using default password. Set ADMIN_EMAIL / ADMIN_PASSWORD in .env and run seed again, or change password after login."
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role_id !== adminRole.role_id) {
      await prisma.user.update({
        where: { user_id: existing.user_id },
        data: { role_id: adminRole.role_id }
      });
      console.log(`[seed] User ${email} promoted to admin.`);
    } else {
      console.log(`[seed] Admin user already exists: ${email}`);
    }
  } else {
    const password_hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        role_id: adminRole.role_id,
        full_name: "Quản trị viên",
        email,
        password_hash,
        status: "active"
      }
    });

    console.log(`[seed] Created admin user:`);
    console.log(`       Email:    ${email}`);
    console.log(`       Password: ${password.replace(/./g, "*")} (length ${password.length})`);
  }

  await ensureDemoVoucher(prisma);
  await ensureDemoOrder(prisma);
  await ensureDemoOrderPaidForReports(prisma);
  await ensureDemoRefundRequests(prisma);
  await ensureDemoWarrantyExtraBuyers(prisma);
  await ensureDemoRepairRequests(prisma);
  await ensureDemoReviews(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
