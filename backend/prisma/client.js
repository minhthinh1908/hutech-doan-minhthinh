const { PrismaClient } = require("@prisma/client");

/** Tăng khi đổi schema Prisma — tránh dùng client cũ trong dev (thiếu model mới). */
const PRISMA_SCHEMA_VERSION = 2;

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__bd_prisma || global.__bd_prisma_schema_version !== PRISMA_SCHEMA_VERSION) {
    if (global.__bd_prisma) {
      global.__bd_prisma.$disconnect().catch(() => {});
    }
    global.__bd_prisma = new PrismaClient();
    global.__bd_prisma_schema_version = PRISMA_SCHEMA_VERSION;
  }
  prisma = global.__bd_prisma;
}

module.exports = prisma;

