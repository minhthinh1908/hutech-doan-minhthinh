/**
 * Mỗi thương hiệu mặc định: thêm tối đa 2 sản phẩm mẫu dựa trên model thật trên thị trường (idempotent theo SKU).
 * Ảnh: URL Unsplash (ảnh xưởng/công cụ minh họa — không phải ảnh catalog chính hãng theo từng SKU).
 * Chạy khi `npx prisma db seed` hoặc: npm run seed:brand-products
 */
const { WANT } = require("./ensureDefaultBrands");
const { cacheRemoteImageToUploads } = require("../utils/cacheRemoteImageToUploads");

/** Ảnh minh họa công cụ / xưởng (Unsplash — dùng demo, không thay thế ảnh sản phẩm thật khi bán). */
const IMG = (id) =>
  `https://images.unsplash.com/photo-${id}?w=800&auto=format&fit=crop&q=80`;

/** Ảnh Dewalt Vietnam — trình duyệt cần `referrerPolicy="no-referrer"` trên thẻ img (CDN hay chặn Referer localhost). */
const DEWALT_VN_IMG =
  "https://imgs.dewaltvietnam.com/wp-content/uploads/2025/04/may-khoan-van-vit-dung-pin-dewalt-dcd778d2-b1-2-pin-18v-2ah-sac-dcd778d2-b1-300x300.jpg";

/** Tên danh mục con dưới nhóm "MÁY MÓC CẦM TAY" */
const PARENT_MACHINES = "MÁY MÓC CẦM TAY";

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function findCategoryUnderMachines(prisma, childName) {
  const parent = await prisma.category.findFirst({
    where: { parent_id: null, category_name: PARENT_MACHINES }
  });
  if (!parent) return null;
  const cat = await prisma.category.findFirst({
    where: { parent_id: parent.category_id, category_name: childName }
  });
  return cat;
}

/**
 * Ảnh ngoài (Dewalt CDN…) → tải về /uploads khi có cacheLocalAs — giống upload trong Admin, tránh hotlink.
 * @param {{ image_url?: string, cacheLocalAs?: string, sku?: string }} item
 */
async function resolveImageForSeedItem(item) {
  if (!item.image_url) return null;
  if (item.cacheLocalAs) {
    try {
      return await cacheRemoteImageToUploads(item.image_url, item.cacheLocalAs);
    } catch (e) {
      console.warn(`[seed-real-products] không lưu ảnh vào uploads (${item.sku}): ${e.message}`);
      return item.image_url;
    }
  }
  return item.image_url;
}

/**
 * Danh sách cố định: 2 SP / brand — tên + SKU thật phổ biến (Milwaukee, DEWALT, STANLEY, WORX);
 * Amaxtools: tên mô phỏng dòng sản phẩm (hãng phân phối VN, model có thể khác theo năm).
 */
const CATALOG = [
  {
    brandName: "Milwaukee",
    items: [
      {
        sku: "SEED-REAL-MIL-001",
        product_name: "Milwaukee M18 FPD2 — Máy khoan búa pin 18V (brushless)",
        categoryChild: "Máy Khoan Pin",
        price: 6490000,
        old_price: 7290000,
        stock_quantity: 12,
        warranty_months: 12,
        description:
          "Máy khoan búa Milwaukee M18 FPD2 dòng FUEL, motor không chổi than, 2 tốc độ, đèn LED. Model tham khảo thị trường — kiểm tra phụ kiện/pin theo bộ bán tại cửa hàng.",
        is_hot: true,
        image_url: IMG("1504148455328-c37690758f0f")
      },
      {
        sku: "SEED-REAL-MIL-002",
        product_name: "Milwaukee M18 FID2 — Máy vặn vít động lực pin 18V",
        categoryChild: "Máy Bắn Vít",
        price: 4590000,
        old_price: null,
        stock_quantity: 8,
        warranty_months: 12,
        description:
          "Súng vặn vít động lực M18 FID2, lực siết cao, phù hợp bulông và vít lớn. Dòng sản phẩm Milwaukee M18 — thông số chi tiết theo catalog hãng.",
        is_hot: false,
        image_url: IMG("1504328345606-18bbc8c9d7d1")
      }
    ]
  },
  {
    brandName: "DEWALT",
    items: [
      {
        sku: "SEED-REAL-DEW-001",
        product_name:
          "Máy khoan vặn vít dùng pin Dewalt DCD778D2-B1 (2 Pin 18V 2Ah + Sạc)",
        categoryChild: "Máy Khoan Pin",
        price: 3490000,
        old_price: 3890000,
        stock_quantity: 20,
        warranty_months: 12,
        description:
          "Bộ máy khoan vặn vít pin DEWALT DCD778D2-B1: kèm 2 pin 18V 2Ah và sạc. Ảnh tham khảo từ Dewalt Vietnam (imgs.dewaltvietnam.com). Thông số chi tiết và phụ kiện theo tem nhãn / hộp bán lẻ.",
        is_new: true,
        image_url: DEWALT_VN_IMG,
        /** Tải ảnh Dewalt VN về uploads — hiển thị giống ảnh bạn upload tay */
        cacheLocalAs: "seed-dewalt-dcd778-demo.jpg",
        /** Chạy lại seed sẽ ghi đè tên + mô tả + ảnh cho SKU này (catalog chuẩn) */
        seedForcePatch: true
      },
      {
        sku: "SEED-REAL-DEW-002",
        product_name: "DEWALT DCF887 — Máy bắn vít động lực 20V XR",
        categoryChild: "Máy Bắn Vít",
        price: 3790000,
        old_price: 4190000,
        stock_quantity: 10,
        warranty_months: 12,
        description:
          "Máy bắn vít động lực DCF887 dòng XR, 3 tốc độ, đèn LED. Tham khảo catalog DEWALT 20V Max cho phụ kiện đi kèm. (Ảnh minh họa cùng file seed Dewalt — thay URL đúng model DCF887 trong Admin nếu cần.)",
        is_hot: true,
        image_url: DEWALT_VN_IMG,
        cacheLocalAs: "seed-dewalt-dcd778-demo.jpg"
      }
    ]
  },
  {
    brandName: "STANLEY",
    items: [
      {
        sku: "SEED-REAL-STN-001",
        product_name: "STANLEY FatMax FMC645 — Máy khoan pin 18V (dòng FatMax)",
        categoryChild: "Máy Khoan Pin",
        price: 2190000,
        old_price: 2590000,
        stock_quantity: 15,
        warranty_months: 12,
        description:
          "Máy khoan pin STANLEY FatMax 18V — dòng công cụ pin phổ biến, cân bằng giá và độ bền. Mã FMC645/FMC645D2 tùy bộ bán kèm pin.",
        is_bestseller: true,
        image_url: IMG("1503387762-592deb58ef4e")
      },
      {
        sku: "SEED-REAL-STN-002",
        product_name: "STANLEY STCT1850 — Máy cưa kiếm pin 18V (FatMax)",
        categoryChild: "Máy Cưa Kiếm",
        price: 2650000,
        old_price: null,
        stock_quantity: 6,
        warranty_months: 12,
        description:
          "Máy cưa kiếm pin STANLEY FatMax — cắt gỗ, nhựa theo lưỡi phù hợp. Mã tham khảo thị trường STCT1850; kiểm tra pin và lưỡi đi kèm khi mua.",
        is_new: false,
        image_url: IMG("1581578731548-c64695cc6952")
      }
    ]
  },
  {
    brandName: "Amaxtools",
    items: [
      {
        sku: "SEED-REAL-AMX-001",
        product_name: "Amaxtools AT-21V-KD — Máy khoan búa pin 21V (bộ 2 pin)",
        categoryChild: "Máy Khoan Pin",
        price: 1590000,
        old_price: 1890000,
        stock_quantity: 25,
        warranty_months: 6,
        description:
          "Dòng máy khoan pin Amaxtools phân phối tại VN — công suất 21V, kèm 2 pin và sạc (tùy phiên bản). Tên mã mang tính minh họa catalog cửa hàng.",
        is_hot: false,
        image_url: IMG("1452860606245-08b45b53fe2d")
      },
      {
        sku: "SEED-REAL-AMX-002",
        product_name: "Amaxtools AT-AG100 — Máy mài góc pin 100mm",
        categoryChild: "Máy Mài Góc Pin",
        price: 1290000,
        old_price: null,
        stock_quantity: 14,
        warranty_months: 6,
        description:
          "Máy mài góc pin đường kính đĩa 100mm — phù hợp công trình và sửa chữa. Thông số chi tiết theo tem nhãn sản phẩm.",
        is_new: true,
        image_url: IMG("1513467535989-fcffe8f8d0ee")
      }
    ]
  },
  {
    brandName: "WORX",
    items: [
      {
        sku: "SEED-REAL-WRX-001",
        product_name: "WORX WX175 — Máy khoan vặn vít pin 20V (WX175)",
        categoryChild: "Máy Khoan Pin",
        price: 1990000,
        old_price: 2290000,
        stock_quantity: 18,
        warranty_months: 12,
        description:
          "WORX WX175 — máy khoan vặn vít pin 20V, nhẹ, phù hợp DIY. Model bán rộng rãi; bộ phụ kiện theo từng gói bán lẻ.",
        is_hot: true,
        image_url: IMG("1581092160562-40aa08b788d8")
      },
      {
        sku: "SEED-REAL-WRX-002",
        product_name: "WORX WX800 — Máy cắt đa năng (multi-cutter) pin 20V",
        categoryChild: "Máy cắt đa năng",
        price: 2490000,
        old_price: null,
        stock_quantity: 9,
        warranty_months: 12,
        description:
          "WORX WX800 — cắt gỗ, nhựa mỏng và vật liệu phù hợp theo lưỡi kèm theo. Tham khảo hướng dẫn an toàn của hãng.",
        is_new: true,
        image_url: IMG("1581147036334-9d87d21b93e4")
      }
    ]
  }
];

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 */
async function seedRealProductsPerBrand(prisma) {
  let created = 0;
  let skipped = 0;
  let imagesUpdated = 0;

  for (const block of CATALOG) {
    const brand = await prisma.brand.findFirst({
      where: { brand_name: block.brandName }
    });
    if (!brand) {
      console.warn(`[seed-real-products] Bỏ qua — chưa có thương hiệu: ${block.brandName}`);
      continue;
    }

    for (const item of block.items) {
      const imageUrl = await resolveImageForSeedItem(item);
      const existing = await prisma.product.findUnique({ where: { sku: item.sku } });
      if (existing) {
        skipped++;
        if (item.seedForcePatch && imageUrl) {
          await prisma.product.update({
            where: { sku: item.sku },
            data: {
              image_url: imageUrl,
              product_name: item.product_name,
              description: item.description,
              price: item.price,
              old_price: item.old_price ?? null,
              warranty_months: item.warranty_months
            }
          });
          imagesUpdated++;
          console.log(`[seed-real-products] đồng bộ catalog (seedForcePatch): ${item.sku}`);
        } else if (
          item.cacheLocalAs &&
          imageUrl &&
          String(existing.image_url || "").trim() !== String(imageUrl).trim()
        ) {
          await prisma.product.update({
            where: { sku: item.sku },
            data: { image_url: imageUrl }
          });
          imagesUpdated++;
          console.log(`[seed-real-products] đồng bộ ảnh local (cacheLocalAs): ${item.sku}`);
        } else if (
          imageUrl &&
          (!existing.image_url || String(existing.image_url).trim() === "")
        ) {
          await prisma.product.update({
            where: { sku: item.sku },
            data: { image_url: imageUrl }
          });
          imagesUpdated++;
          console.log(`[seed-real-products] cập nhật ảnh: ${item.sku}`);
        }
        continue;
      }

      const cat = await findCategoryUnderMachines(prisma, item.categoryChild);
      if (!cat) {
        console.warn(
          `[seed-real-products] Không tìm thấy danh mục "${item.categoryChild}" — bỏ qua SKU ${item.sku}`
        );
        continue;
      }

      await prisma.product.create({
        data: {
          brand_id: brand.brand_id,
          category_id: cat.category_id,
          product_name: item.product_name,
          sku: item.sku,
          price: item.price,
          old_price: item.old_price ?? undefined,
          stock_quantity: item.stock_quantity,
          warranty_months: item.warranty_months,
          description: item.description,
          status: "active",
          is_hot: Boolean(item.is_hot),
          is_bestseller: Boolean(item.is_bestseller),
          is_new: Boolean(item.is_new),
          contact_only: false,
          image_url: imageUrl || null
        }
      });
      created++;
      console.log(`[seed-real-products] + ${item.sku} — ${item.product_name}`);
    }
  }

  console.log(
    `[seed-real-products] xong: +${created} sản phẩm, bỏ qua (đã có SKU): ${skipped}, cập nhật ảnh: ${imagesUpdated}. Thương hiệu mục tiêu: ${WANT.map((w) => w.name).join(", ")}.`
  );
}

module.exports = { seedRealProductsPerBrand, CATALOG };
