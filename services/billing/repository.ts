import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { getPlanLimits, TRIAL_DURATION_DAYS } from "@/config/billing-plans";
import { isLiveBillingConfigured } from "@/services/billing/provider";
import type { Plan, SubscriptionStatus, BillingInterval, InvoiceStatus } from "@prisma/client";

export interface SubscriptionRecord {
  id: string;
  organizationId: string;
  plan: Plan;
  interval: BillingInterval;
  status: SubscriptionStatus;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceRecord {
  id: string;
  organizationId: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface BillingSummary {
  organizationId: string;
  organizationName: string;
  plan: Plan;
  subscription: SubscriptionRecord | null;
  limits: {
    maxWebsites: number;
    maxBusinesses: number;
    maxTeamMembers: number;
    minFrequencyMinutes: number | null;
    historyDays: number;
  };
  usage: {
    websitesCount: number;
    businessesCount: number;
    membersCount: number;
  };
  trial: {
    isTrialing: boolean;
    trialEndsAt: Date | null;
    daysRemaining: number | null;
  };
  invoices: InvoiceRecord[];
  livePaymentConnected?: boolean;
}

export async function getBillingSummary(scope: TenantScope): Promise<BillingSummary | null> {
  return withTenantTransaction(scope, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: scope.organizationId },
      include: {
        subscription: true,
        billingInvoices: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            websites: true,
            businesses: true,
            members: true,
          },
        },
      },
    });

    if (org === null) return null;

    const currentPlan = org.subscription?.plan ?? org.plan;
    const limits = getPlanLimits(currentPlan);

    const isTrialing = org.subscription?.status === "TRIALING";
    let daysRemaining: number | null = null;
    if (isTrialing && org.subscription?.trialEndsAt) {
      const now = new Date().getTime();
      const end = new Date(org.subscription.trialEndsAt).getTime();
      daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    }

    return {
      organizationId: org.id,
      organizationName: org.name,
      plan: currentPlan,
      subscription: org.subscription,
      limits: {
        maxWebsites: limits.maxWebsites,
        maxBusinesses: limits.maxBusinesses,
        maxTeamMembers: limits.maxTeamMembers,
        minFrequencyMinutes: limits.minFrequencyMinutes,
        historyDays: limits.historyDays,
      },
      usage: {
        websitesCount: org._count.websites,
        businessesCount: org._count.businesses,
        membersCount: org._count.members,
      },
      trial: {
        isTrialing,
        trialEndsAt: org.subscription?.trialEndsAt ?? null,
        daysRemaining,
      },
      invoices: org.billingInvoices,
      livePaymentConnected: isLiveBillingConfigured(),
    };
  });
}

export async function upsertSubscription(
  scope: TenantScope,
  data: {
    plan: Plan;
    interval?: BillingInterval;
    status?: SubscriptionStatus;
    trialStartsAt?: Date | null;
    trialEndsAt?: Date | null;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date | null;
    cancelAtPeriodEnd?: boolean;
    provider?: string;
    providerCustomerId?: string | null;
    providerSubscriptionId?: string | null;
  },
): Promise<SubscriptionRecord> {
  return withTenantTransaction(scope, async (tx) => {
    await tx.organization.update({
      where: { id: scope.organizationId },
      data: { plan: data.plan },
    });

    return tx.subscription.upsert({
      where: { organizationId: scope.organizationId },
      create: {
        organizationId: scope.organizationId,
        plan: data.plan,
        interval: data.interval ?? "MONTHLY",
        status: data.status ?? "ACTIVE",
        trialStartsAt: data.trialStartsAt,
        trialEndsAt: data.trialEndsAt,
        currentPeriodStart: data.currentPeriodStart ?? new Date(),
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
        provider: data.provider ?? "MANUAL",
        providerCustomerId: data.providerCustomerId,
        providerSubscriptionId: data.providerSubscriptionId,
      },
      update: {
        plan: data.plan,
        interval: data.interval,
        status: data.status,
        trialStartsAt: data.trialStartsAt,
        trialEndsAt: data.trialEndsAt,
        currentPeriodStart: data.currentPeriodStart,
        currentPeriodEnd: data.currentPeriodEnd,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd,
        provider: data.provider,
        providerCustomerId: data.providerCustomerId,
        providerSubscriptionId: data.providerSubscriptionId,
      },
    });
  });
}

export async function startTrial(
  scope: TenantScope,
  plan: Plan = "PRO",
): Promise<SubscriptionRecord> {
  const now = new Date();
  const endsAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  return upsertSubscription(scope, {
    plan,
    status: "TRIALING",
    trialStartsAt: now,
    trialEndsAt: endsAt,
    currentPeriodStart: now,
    currentPeriodEnd: endsAt,
  });
}

export async function recordInvoice(
  scope: TenantScope,
  data: {
    amountCents: number;
    currency?: string;
    status?: InvoiceStatus;
    invoiceNumber?: string | null;
    hostedInvoiceUrl?: string | null;
    pdfUrl?: string | null;
    paidAt?: Date | null;
  },
): Promise<InvoiceRecord> {
  return withTenantTransaction(scope, async (tx) => {
    return tx.billingInvoice.create({
      data: {
        organizationId: scope.organizationId,
        amountCents: data.amountCents,
        currency: data.currency ?? "usd",
        status: data.status ?? "PAID",
        invoiceNumber: data.invoiceNumber,
        hostedInvoiceUrl: data.hostedInvoiceUrl,
        pdfUrl: data.pdfUrl,
        paidAt: data.paidAt ?? new Date(),
      },
    });
  });
}
