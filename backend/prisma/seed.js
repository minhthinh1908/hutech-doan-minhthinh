/**
 * Tạo vai trò + tài khoản admin mặc định (chạy một lần sau khi có DB).
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
    return;
  }

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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
