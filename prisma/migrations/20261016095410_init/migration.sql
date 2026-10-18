-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNT_MANAGER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'RENEWED', 'LOST');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('PRICE', 'COMPETITOR', 'NO_LONGER_NEEDED', 'POOR_SERVICE', 'NO_RESPONSE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('DAYS_30', 'DAYS_7', 'OVERDUE');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'MESSAGE');

-- CreateEnum
CREATE TYPE "FollowUpOutcome" AS ENUM ('INTERESTED', 'NEEDS_DISCOUNT', 'CONSIDERING_COMPETITOR', 'NO_RESPONSE', 'NOT_INTERESTED', 'OTHER');

-- CreateEnum
CREATE TYPE "RenewalEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'REMINDER_SENT', 'REMINDER_FAILED', 'FOLLOW_UP_ADDED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ACCOUNT_MANAGER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "ownerId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "startDate" DATE NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Renewal" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "currentValue" DECIMAL(12,2) NOT NULL,
    "renewedValue" DECIMAL(12,2),
    "status" "RenewalStatus" NOT NULL DEFAULT 'PENDING',
    "lostReason" "LostReason",
    "outcomeNotes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Renewal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "renewalId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "recipientEmail" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "renewalId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "FollowUpType" NOT NULL,
    "outcome" "FollowUpOutcome",
    "notes" TEXT,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalEvent" (
    "id" TEXT NOT NULL,
    "renewalId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "RenewalEventType" NOT NULL,
    "fromStatus" "RenewalStatus",
    "toStatus" "RenewalStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RenewalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Customer_ownerId_idx" ON "Customer"("ownerId");

-- CreateIndex
CREATE INDEX "Subscription_customerId_idx" ON "Subscription"("customerId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Renewal_status_dueDate_idx" ON "Renewal"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Renewal_subscriptionId_cycleNumber_key" ON "Renewal"("subscriptionId", "cycleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Renewal_one_open_per_subscription" ON "Renewal"("subscriptionId") WHERE ("closedAt" IS NULL);

-- CreateIndex
CREATE INDEX "Reminder_status_idx" ON "Reminder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_renewalId_type_key" ON "Reminder"("renewalId", "type");

-- CreateIndex
CREATE INDEX "FollowUp_renewalId_contactedAt_idx" ON "FollowUp"("renewalId", "contactedAt");

-- CreateIndex
CREATE INDEX "FollowUp_nextFollowUpAt_idx" ON "FollowUp"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "FollowUp_createdById_idx" ON "FollowUp"("createdById");

-- CreateIndex
CREATE INDEX "RenewalEvent_renewalId_createdAt_idx" ON "RenewalEvent"("renewalId", "createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Renewal" ADD CONSTRAINT "Renewal_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "Renewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "Renewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalEvent" ADD CONSTRAINT "RenewalEvent_renewalId_fkey" FOREIGN KEY ("renewalId") REFERENCES "Renewal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalEvent" ADD CONSTRAINT "RenewalEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business rules enforced by the database itself
ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_value_nonnegative" CHECK ("value" >= 0),
  ADD CONSTRAINT "Subscription_term_positive" CHECK ("termMonths" > 0);

ALTER TABLE "Renewal"
  ADD CONSTRAINT "Renewal_cycle_positive" CHECK ("cycleNumber" >= 1),
  ADD CONSTRAINT "Renewal_values_nonnegative"
    CHECK ("currentValue" >= 0 AND ("renewedValue" IS NULL OR "renewedValue" >= 0)),
  ADD CONSTRAINT "Renewal_closed_matches_status"
    CHECK (("status" IN ('RENEWED', 'LOST')) = ("closedAt" IS NOT NULL)),
  ADD CONSTRAINT "Renewal_lost_reason_only_when_lost"
    CHECK ("lostReason" IS NULL OR "status" = 'LOST'),
  ADD CONSTRAINT "Renewal_renewed_value_only_when_renewed"
    CHECK ("renewedValue" IS NULL OR "status" = 'RENEWED');