import { z } from "zod";
import { createTenantScope } from "@/db/tenant";
import { apiSuccess, withApiRoute } from "@/lib/api";
import { requirePermission } from "@/lib/auth/context";
import {
  registerCampaign,
  getCrossChannelPerformance,
  seedSandboxMarketingCampaigns,
} from "@/services/marketing/service";

const addCampaignSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    channel: z
      .enum([
        "GOOGLE_ADS",
        "META_ADS",
        "LINKEDIN_ADS",
        "EMAIL_MARKETING",
        "DIRECT_CRM",
      ])
      .optional(),
    externalCampaignId: z.string().trim().optional().nullable(),
    budgetDailyCents: z.number().int().nonnegative().optional().nullable(),
    websiteId: z.string().optional().nullable(),
    currency: z.string().default("USD"),
    seedSandbox: z.boolean().optional(),
  })
  .refine((data) => data.seedSandbox || (!!data.name && !!data.channel), {
    message: "Name and channel are required unless seeding sandbox",
  });

export const GET = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:read");
  const tenantScope = createTenantScope(context);

  const url = new URL(request.url);
  const websiteId = url.searchParams.get("websiteId") || undefined;

  const overview = await getCrossChannelPerformance(tenantScope, websiteId);

  return apiSuccess({ overview }, requestId);
});

export const POST = withApiRoute(async (request, { params, requestId }) => {
  const { organizationId } = params;
  if (!organizationId) throw new Error("Missing organizationId.");

  const context = await requirePermission(organizationId, "org:update");
  const tenantScope = createTenantScope(context);

  const body = addCampaignSchema.parse(await request.json().catch(() => ({})));

  if (body.seedSandbox) {
    const overview = await seedSandboxMarketingCampaigns(tenantScope, body.websiteId || undefined);
    return apiSuccess({ seeded: true, overview }, requestId, 201);
  }

  const campaign = await registerCampaign(tenantScope, {
    name: body.name!,
    channel: body.channel!,
    externalCampaignId: body.externalCampaignId,
    budgetDailyCents: body.budgetDailyCents,
    websiteId: body.websiteId,
    currency: body.currency,
  });

  return apiSuccess(campaign, requestId, 201);
});
