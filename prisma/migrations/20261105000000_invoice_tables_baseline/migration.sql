-- BillingProfile, SellerProfile and Invoice were created in production with `prisma db push`, so no migration made
-- them and a database built from migrations alone could not issue invoices. This adds them only where missing: on
-- production, where they already exist, every statement is a no-op.

CREATE TABLE IF NOT EXISTS "BillingProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "gstin" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "SellerProfile" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "hsnSac" TEXT NOT NULL DEFAULT '998314',
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 18,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'ARC',
    "bankDetails" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SellerProfile_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "planName" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerGstin" TEXT,
    "buyerAddress" TEXT NOT NULL,
    "buyerStateCode" TEXT NOT NULL,
    "sellerName" TEXT NOT NULL,
    "sellerGstin" TEXT NOT NULL,
    "sellerAddress" TEXT NOT NULL,
    "sellerStateCode" TEXT NOT NULL,
    "placeOfSupply" TEXT NOT NULL,
    "hsnSac" TEXT NOT NULL,
    "taxRate" DOUBLE PRECISION NOT NULL,
    "taxableAmount" DOUBLE PRECISION NOT NULL,
    "cgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sgst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "igst" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "pdf" BYTEA NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingProfile_userId_key" ON "BillingProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_paymentId_key" ON "Invoice"("paymentId");
CREATE INDEX IF NOT EXISTS "Invoice_userId_idx" ON "Invoice"("userId");
CREATE INDEX IF NOT EXISTS "Invoice_issuedAt_idx" ON "Invoice"("issuedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BillingProfile_userId_fkey') THEN
    ALTER TABLE "BillingProfile" ADD CONSTRAINT "BillingProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_userId_fkey') THEN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
