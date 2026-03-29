-- AlterTable
ALTER TABLE "reviews" ADD COLUMN "moderation_status" TEXT NOT NULL DEFAULT 'approved';

-- CreateTable
CREATE TABLE "review_comments" (
    "review_comment_id" BIGSERIAL NOT NULL,
    "review_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("review_comment_id")
);

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("review_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
