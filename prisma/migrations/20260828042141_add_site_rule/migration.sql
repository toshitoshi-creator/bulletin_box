-- CreateTable
CREATE TABLE "SiteRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "listUrl" TEXT NOT NULL,
    "index" JSONB NOT NULL,
    "detail" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SiteRule_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteRule_siteId_key" ON "SiteRule"("siteId");
