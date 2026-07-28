-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BlogPostView" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniques" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BlogPostView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPostVisit" (
    "slug" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "visitorHash" TEXT NOT NULL,

    CONSTRAINT "BlogPostVisit_pkey" PRIMARY KEY ("slug","date","visitorHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlogPostView_slug_date_key" ON "BlogPostView"("slug", "date");

-- CreateIndex
CREATE INDEX "BlogPostView_slug_idx" ON "BlogPostView"("slug");
