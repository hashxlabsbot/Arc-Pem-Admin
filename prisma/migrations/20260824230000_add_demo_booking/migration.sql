-- CreateTable
CREATE TABLE "DemoBooking" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "company" TEXT,
    "role" TEXT,
    "teamSize" TEXT,
    "preferredDate" TEXT,
    "preferredTime" TEXT,
    "meetLink" TEXT,
    "calendarEventId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemoBooking_status_createdAt_idx" ON "DemoBooking"("status", "createdAt");
