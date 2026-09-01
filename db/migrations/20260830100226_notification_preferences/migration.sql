-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "in_app_notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_preferences_organizationId_idx" ON "notification_preferences"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_organizationId_userId_eventType_ch_key" ON "notification_preferences"("organizationId", "userId", "eventType", "channel");

-- CreateIndex
CREATE INDEX "in_app_notifications_organizationId_userId_createdAt_idx" ON "in_app_notifications"("organizationId", "userId", "createdAt");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "in_app_notifications" ADD CONSTRAINT "in_app_notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_notification_preferences" ON "notification_preferences"
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

ALTER TABLE "in_app_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "in_app_notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_in_app_notifications" ON "in_app_notifications"
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
