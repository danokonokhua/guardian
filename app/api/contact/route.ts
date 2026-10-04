import { z } from "zod";
import { jsonResponse, withRoute } from "@/lib/api";
import { logger } from "@/lib/logger";
import { sendTransactionalEmail } from "@/services/notifications/smtp";

const contactInquirySchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Please provide a valid email address").toLowerCase().max(256),
  company: z.string().trim().max(120).optional().nullable(),
  website: z.string().trim().max(256).optional().nullable(),
  plan: z.string().trim().max(50).optional().nullable(),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(2000),
});

export const POST = withRoute(async (request) => {
  const body = await request.json().catch(() => null);
  const parsed = contactInquirySchema.safeParse(body);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonResponse(
      { error: issue ? issue.message : "Invalid contact inquiry submission." },
      400,
    );
  }

  const { name, email, company, website, plan, message } = parsed.data;

  logger.info("sales_contact_inquiry_received", {
    name,
    email,
    company: company || "N/A",
    website: website || "N/A",
    plan: plan || "Custom / Enterprise",
    messageLength: message.length,
  });

  // Attempt to deliver notification to sales mailbox if configured
  await sendTransactionalEmail({
    to: "sales@useguardian.io",
    subject: `[Guardian Sales Inquiry] ${name} (${company || "Individual"}) - ${plan || "Enterprise"}`,
    text: `New Guardian Enterprise / Custom Sales Inquiry:\n\nName: ${name}\nEmail: ${email}\nCompany: ${company || "N/A"}\nWebsite: ${website || "N/A"}\nTarget Plan: ${plan || "Custom / Enterprise"}\n\nMessage:\n${message}\n\nTimestamp: ${new Date().toISOString()}`,
  }).catch((err) => {
    logger.warn("sales_notification_email_dispatch_failed", { error: String(err) });
  });

  return jsonResponse({
    success: true,
    message:
      "Thank you for reaching out! Our enterprise operations team has received your request and will follow up within 24 hours.",
  });
});
