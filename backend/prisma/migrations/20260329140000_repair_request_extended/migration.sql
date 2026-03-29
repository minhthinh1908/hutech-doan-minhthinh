-- AlterTable
ALTER TABLE "repair_requests" ADD COLUMN "attachment_urls" JSONB,
ADD COLUMN "admin_notes" TEXT,
ADD COLUMN "resolution_notes" TEXT,
ADD COLUMN "expected_completion_date" DATE,
ADD COLUMN "completed_at" TIMESTAMP(3);

-- Chuẩn hóa trạng thái cũ (nếu có)
UPDATE "repair_requests" SET "repair_status" = 'in_progress' WHERE "repair_status" = 'processing';
