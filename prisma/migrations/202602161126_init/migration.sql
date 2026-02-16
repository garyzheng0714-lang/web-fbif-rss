-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."SourceType" AS ENUM ('RSS', 'WECHAT_PLACEHOLDER');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "openId" TEXT NOT NULL,
    "userId" TEXT,
    "tenantKey" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."SourceType" NOT NULL DEFAULT 'RSS',
    "url" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pollIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "lastCheckedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "bitableRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FeedItem" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "bitableRecordId" TEXT,
    "syncedToBitableAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NotificationEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncCursor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_openId_key" ON "public"."User"("openId");

-- CreateIndex
CREATE INDEX "User_tenantKey_idx" ON "public"."User"("tenantKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE INDEX "FeedSource_enabled_pollIntervalMinutes_idx" ON "public"."FeedSource"("enabled", "pollIntervalMinutes");

-- CreateIndex
CREATE INDEX "FeedSource_updatedAt_idx" ON "public"."FeedSource"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedSource_type_url_key" ON "public"."FeedSource"("type", "url");

-- CreateIndex
CREATE INDEX "FeedItem_createdAt_idx" ON "public"."FeedItem"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "FeedItem_publishedAt_idx" ON "public"."FeedItem"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "FeedItem_contentHash_idx" ON "public"."FeedItem"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_sourceId_guid_key" ON "public"."FeedItem"("sourceId", "guid");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_eventKey_key" ON "public"."NotificationEvent"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_name_key" ON "public"."SyncCursor"("name");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FeedItem" ADD CONSTRAINT "FeedItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "public"."FeedSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

