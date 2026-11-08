-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('COMPANY_ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "InvoiceDirection" AS ENUM ('PURCHASE', 'SALE');

-- CreateEnum
CREATE TYPE "InvoiceNature" AS ENUM ('ORIGINAL', 'REPLACEMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ACTIVE', 'REPLACED', 'ADJUSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('XML', 'PDF', 'ZIP', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportItemStatus" AS ENUM ('PENDING', 'SUCCESS', 'DUPLICATE', 'ERROR', 'SKIPPED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_system_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "tax_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "english_name" TEXT,
    "address" TEXT NOT NULL,
    "fiscal_year_start_month" INTEGER NOT NULL DEFAULT 1,
    "current_fiscal_year" INTEGER NOT NULL,
    "investor_country" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "kind" "FileKind" NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_items" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "archive_name" TEXT,
    "kind" "FileKind" NOT NULL,
    "file_id" TEXT,
    "status" "ImportItemStatus" NOT NULL DEFAULT 'PENDING',
    "error_code" TEXT,
    "message" TEXT,
    "hint" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "import_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "direction" "InvoiceDirection" NOT NULL,
    "nature" "InvoiceNature" NOT NULL DEFAULT 'ORIGINAL',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "standard" TEXT,
    "invoice_name" TEXT,
    "template_code" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "exchange_rate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "payment_method" TEXT,
    "tax_authority_code" TEXT,
    "seller_name" TEXT NOT NULL,
    "seller_tax_code" TEXT NOT NULL,
    "seller_address" TEXT,
    "buyer_name" TEXT,
    "buyer_full_name" TEXT,
    "buyer_tax_code" TEXT,
    "buyer_address" TEXT,
    "total_before_tax" DECIMAL(20,4) NOT NULL,
    "total_tax" DECIMAL(20,4) NOT NULL,
    "total_discount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_payment" DECIMAL(20,4) NOT NULL,
    "total_in_words" TEXT,
    "related_template_code" TEXT,
    "related_series" TEXT,
    "related_number" TEXT,
    "related_issue_date" DATE,
    "related_note" TEXT,
    "related_invoice_id" TEXT,
    "xml_file_id" TEXT,
    "pdf_file_id" TEXT,
    "import_job_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "line_no" INTEGER NOT NULL,
    "nature" INTEGER NOT NULL DEFAULT 1,
    "item_code" TEXT,
    "item_name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DECIMAL(24,6),
    "unit_price" DECIMAL(24,6),
    "discount_rate" DECIMAL(9,4),
    "discount_amount" DECIMAL(20,4),
    "amount" DECIMAL(20,4) NOT NULL,
    "tax_rate" TEXT,
    "tax_amount" DECIMAL(20,4),

    CONSTRAINT "invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_tax_summaries" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tax_rate" TEXT NOT NULL,
    "taxable_amount" DECIMAL(20,4) NOT NULL,
    "tax_amount" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "invoice_tax_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "user_id" TEXT,
    "user_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "companies_tax_code_key" ON "companies"("tax_code");

-- CreateIndex
CREATE INDEX "memberships_company_id_idx" ON "memberships"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_user_id_company_id_key" ON "memberships"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storage_key_key" ON "stored_files"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_company_id_sha256_key" ON "stored_files"("company_id", "sha256");

-- CreateIndex
CREATE INDEX "import_jobs_company_id_created_at_idx" ON "import_jobs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "import_jobs_status_idx" ON "import_jobs"("status");

-- CreateIndex
CREATE INDEX "import_items_job_id_idx" ON "import_items"("job_id");

-- CreateIndex
CREATE INDEX "import_items_company_id_idx" ON "import_items"("company_id");

-- CreateIndex
CREATE INDEX "invoices_company_id_issue_date_idx" ON "invoices"("company_id", "issue_date");

-- CreateIndex
CREATE INDEX "invoices_company_id_direction_issue_date_idx" ON "invoices"("company_id", "direction", "issue_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_company_id_seller_tax_code_template_code_series_nu_key" ON "invoices"("company_id", "seller_tax_code", "template_code", "series", "number");

-- CreateIndex
CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_lines_company_id_idx" ON "invoice_lines"("company_id");

-- CreateIndex
CREATE INDEX "invoice_tax_summaries_invoice_id_idx" ON "invoice_tax_summaries"("invoice_id");

-- CreateIndex
CREATE INDEX "invoice_tax_summaries_company_id_idx" ON "invoice_tax_summaries"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "import_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_related_invoice_id_fkey" FOREIGN KEY ("related_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_xml_file_id_fkey" FOREIGN KEY ("xml_file_id") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pdf_file_id_fkey" FOREIGN KEY ("pdf_file_id") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_tax_summaries" ADD CONSTRAINT "invoice_tax_summaries_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
