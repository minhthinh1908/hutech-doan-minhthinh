/**
 * Tạo 4 yêu cầu hoàn tiền mẫu (pending / approved / rejected / completed) + 4 đơn paid.
 * Idempotent: bỏ qua nếu đã có lý do bắt đầu bằng DEMO_REFUND_PREFIX.
 * Gọi từ prisma/seed.js hoặc: node scripts/seed-demo-refunds.js
 */

const DEMO_REFUND_PREFIX = "[seed-demo hoàn tiền]";

async function ensureDemoSeedProduct(prismaClient) {
  const existing = await prismaClient.product.findUnique({ where: { sku: "DEMO-ORDER-SEED" } });
  if (existing) return existing;
  const cat = await prismaClient.category.findFirst({ orderBy: { category_id: "asc" } });
  const brand = await prismaClient.brand.findFirst({ orderBy: { brand_id: "asc" } });
  if (!cat || !brand) {
    console.warn("[seed-demo-refunds] thiếu danh mục hoặc thương hiệu — không tạo SP demo.");
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
  console.log("[seed-demo-refunds] đã tạo sản phẩm DEMO-ORDER-SEED.");
  return p;
}

async function seedDemoRefundRequests(prismaClient) {
  const dup = await prismaClient.refundRequest.findFirst({
    where: { reason: { startsWith: DEMO_REFUND_PREFIX } }
  });
  if (dup) {
    console.log("[seed-demo-refunds] đã có yêu cầu mẫu — bỏ qua.");
    return { skipped: true, created: 0 };
  }

  const demoEmail = "demo-buyer@ecommercetools.local";
  const buyer = await prismaClient.user.findUnique({ where: { email: demoEmail } });
  if (!buyer) {
    console.warn(
      "[seed-demo-refunds] chưa có khách demo-buyer@ecommercetools.local — chạy trước: npx prisma db seed (hoặc tạo user buyer)."
    );
    return { skipped: true, created: 0, error: "no_demo_buyer" };
  }

  let product = await prismaClient.product.findFirst({
    where: { status: "active", stock_quantity: { gte: 1 } },
    orderBy: { product_id: "asc" }
  });
  if (!product) {
    product = await prismaClient.product.findFirst({
      where: { status: "active" },
      orderBy: { product_id: "asc" }
    });
  }
  if (!product) {
    product = await ensureDemoSeedProduct(prismaClient);
  }
  if (!product) {
    console.warn("[seed-demo-refunds] không có sản phẩm — bỏ qua.");
    return { skipped: true, created: 0, error: "no_product" };
  }

  const orders = [];
  for (let i = 0; i < 4; i++) {
    const p = await prismaClient.product.findUnique({ where: { product_id: product.product_id } });
    const qty = 1;
    const canDecrement = p.stock_quantity >= qty;
    const unit = Number(p.price);
    const lineTotal = unit * qty;

    const order = await prismaClient.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          user_id: buyer.user_id,
          order_status: "completed",
          subtotal: lineTotal,
          discount_amount: 0,
          total_amount: lineTotal,
          payment_status: "paid",
          order_date: new Date(Date.now() - (3 - i) * 86400000)
        }
      });
      await tx.orderItem.create({
        data: {
          order_id: o.order_id,
          product_id: p.product_id,
          quantity: qty,
          unit_price: p.price,
          line_total: lineTotal
        }
      });
      await tx.payment.create({
        data: {
          order_id: o.order_id,
          payment_method: "cod",
          payment_gateway: "cod",
          payment_status: "success",
          paid_amount: lineTotal,
          currency: "VND",
          paid_at: new Date()
        }
      });
      if (canDecrement) {
        await tx.product.update({
          where: { product_id: p.product_id },
          data: { stock_quantity: { decrement: qty } }
        });
      }
      return o;
    });
    orders.push(order);
  }

  const samples = [
    {
      refund_status: "pending",
      refund_amount: 150000,
      reason: `${DEMO_REFUND_PREFIX} Khách báo giao nhầm màu — chờ xác minh với kho.`,
      request_date: new Date("2026-03-20T10:00:00.000Z"),
      buyer_note: "Nhờ shop chụp ảnh seal tem khi đối chiếu màu.",
      admin_note: null
    },
    {
      refund_status: "approved",
      refund_amount: 398000,
      reason: `${DEMO_REFUND_PREFIX} Đồng ý hoàn một phần theo chính sách đổi trả.`,
      request_date: new Date("2026-03-18T14:00:00.000Z"),
      buyer_note: null,
      admin_note: "Đã xác nhận với kho — sẽ hoàn theo tỷ lệ đã thông báo qua điện thoại."
    },
    {
      refund_status: "rejected",
      refund_amount: 99000,
      reason: `${DEMO_REFUND_PREFIX} Không đủ chứng từ / quá hạn đổi trả.`,
      request_date: new Date("2026-03-15T09:30:00.000Z"),
      buyer_note: null,
      admin_note: "Quá 7 ngày kể từ nhận hàng — không đủ điều kiện đổi theo policy."
    },
    {
      refund_status: "completed",
      refund_amount: 199000,
      reason: `${DEMO_REFUND_PREFIX} Đã chuyển khoản hoàn tiền — mẫu hoàn tất xử lý.`,
      request_date: new Date("2026-03-10T11:00:00.000Z"),
      buyer_note: "STK đã gửi qua Zalo.",
      admin_note: "Đã chuyển khoản 199.000đ — mã giao dịch demo REF-001."
    }
  ];

  for (let i = 0; i < 4; i++) {
    await prismaClient.refundRequest.create({
      data: {
        order_id: orders[i].order_id,
        user_id: buyer.user_id,
        reason: samples[i].reason,
        buyer_note: samples[i].buyer_note,
        admin_note: samples[i].admin_note,
        refund_amount: samples[i].refund_amount,
        refund_status: samples[i].refund_status,
        request_date: samples[i].request_date
      }
    });
  }

  console.log(
    "[seed-demo-refunds] +4 đơn mẫu + 4 yêu cầu (pending / approved / rejected / completed) — Admin → Hoàn tiền."
  );
  return { skipped: false, created: 4 };
}

module.exports = { seedDemoRefundRequests, DEMO_REFUND_PREFIX };
