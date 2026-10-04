import "server-only";

export interface GenerateReviewResponseInput {
  authorName: string;
  rating: number;
  comment: string;
  businessName?: string;
  keywords?: string[];
}

export interface GeneratedAiResponse {
  draftReply: string;
  status: "PENDING_REVIEW";
  suggestedAt: string;
}

/**
 * Generates brand-safe, empathetic response drafts tailored to rating and sentiment.
 * Strict adherence to PRD §14: draft responses are always marked PENDING_REVIEW,
 * requiring explicit operator authorization before publishing.
 */
export function generateAiReviewResponse(input: GenerateReviewResponseInput): GeneratedAiResponse {
  const { authorName, rating, comment, businessName = "our team", keywords = [] } = input;
  const firstName = authorName.split(" ")[0] || "there";

  let draftReply = "";

  if (rating === 5) {
    if (keywords.includes("Customer Service")) {
      draftReply = `Hi ${firstName}, thank you so much for the 5-star review! We're thrilled to hear you had such a great experience with our service team. Providing fast and reliable support is always our top priority. We look forward to working with you again!`;
    } else if (keywords.includes("Speed & Performance")) {
      draftReply = `Hi ${firstName}, thanks for the fantastic 5-star feedback! Speed and performance are core to what we do, and we're delighted it's making a difference for you. Thanks for choosing ${businessName}!`;
    } else {
      draftReply = `Hi ${firstName}, thank you for taking the time to leave us a 5-star rating! Your support means the world to everyone on ${businessName}. Please don't hesitate to reach out whenever you need us.`;
    }
  } else if (rating === 4) {
    draftReply = `Hi ${firstName}, thank you for the great 4-star review! We're really glad you had a positive experience. We're constantly looking for ways to improve—if there's anything we can do to make your next experience a full 5 stars, please let us know!`;
  } else if (rating === 3) {
    draftReply = `Hello ${firstName}, thank you for sharing your feedback with us. We appreciate your honest review. We aim to deliver exceptional results for every client, and we'd love the opportunity to understand how we can improve. Please reach out to us directly so we can make things right.`;
  } else {
    // 1 - 2 Stars (Negative / Critical)
    if (
      keywords.includes("Reliability") ||
      comment.toLowerCase().includes("down") ||
      comment.toLowerCase().includes("broken")
    ) {
      draftReply = `Hi ${firstName}, we sincerely apologize for the frustration and disruption you experienced. System reliability is critical, and we regret falling short of your expectations. We would appreciate the chance to look into this for you immediately. Please contact our leadership directly at support@ourcompany.com so we can investigate and resolve this.`;
    } else if (keywords.includes("Pricing & Billing")) {
      draftReply = `Hi ${firstName}, thank you for bringing this to our attention. We are very sorry to hear about your experience with our billing or pricing. We want to review your account details right away and resolve any discrepancies. Please connect with us directly so our billing team can assist you immediately.`;
    } else {
      draftReply = `Hi ${firstName}, we are truly sorry that your experience didn't meet the high standards we strive for. We take feedback like yours very seriously and want to learn more about what went wrong so we can fix it. Please reach out to us directly at your convenience so we can make this right.`;
    }
  }

  return {
    draftReply,
    status: "PENDING_REVIEW",
    suggestedAt: new Date().toISOString(),
  };
}
