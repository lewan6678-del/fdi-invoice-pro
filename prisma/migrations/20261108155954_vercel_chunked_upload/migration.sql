-- AlterEnum
ALTER TYPE "ImportJobStatus" ADD VALUE 'UPLOADING';

-- CreateTable
CREATE TABLE "upload_chunks" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "upload_id" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_chunks_job_id_upload_id_index_key" ON "upload_chunks"("job_id", "upload_id", "index");
