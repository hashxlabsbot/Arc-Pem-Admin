-- CreateTable
CREATE TABLE "LicenseRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "licenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LicenseRequest_licenseId_key" ON "LicenseRequest"("licenseId");

-- CreateIndex
CREATE INDEX "LicenseRequest_status_createdAt_idx" ON "LicenseRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LicenseRequest_email_idx" ON "LicenseRequest"("email");

-- CreateIndex
CREATE INDEX "LicenseRequest_clientId_idx" ON "LicenseRequest"("clientId");

-- AddForeignKey
ALTER TABLE "LicenseRequest" ADD CONSTRAINT "LicenseRequest_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
