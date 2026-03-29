/**
 * Tạo / cập nhật tài khoản buyer để test (không phụ thuộc seed đầy đủ).
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const EMAIL = "test-buyer@binhdinhtools.local";
const PASSWORD = "Test@123456";
const FULL_NAME = "Khách test mua hàng";

async function main() {
  const buyerRole = await prisma.role.findFirst({ where: { role_name: "buyer" } });
  if (!buyerRole) {
    console.error("Không có role buyer — chạy seed tối thiểu hoặc tạo role buyer trong DB.");
    process.exit(1);
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

  if (existing) {
    await prisma.user.update({
      where: { email: EMAIL },
      data: {
        password_hash: hash,
        full_name: FULL_NAME,
        status: "active",
        role_id: buyerRole.role_id
      }
    });
    console.log("Đã cập nhật mật khẩu cho tài khoản đã tồn tại.");
  } else {
    await prisma.user.create({
      data: {
        role_id: buyerRole.role_id,
        full_name: FULL_NAME,
        email: EMAIL,
        password_hash: hash,
        phone: "0909876543",
        status: "active"
      }
    });
    console.log("Đã tạo tài khoản buyer mới.");
  }

  console.log("");
  console.log("Đăng nhập buyer:");
  console.log("  Email:    ", EMAIL);
  console.log("  Mật khẩu:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
