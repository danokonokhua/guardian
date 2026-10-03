import { describe, expect, it } from "vitest";
import { generateAiReviewResponse } from "@/services/reputation/ai-responder";

describe("AI Review Response Generator", () => {
  it("generates grateful response for 5-star customer praise", () => {
    const result = generateAiReviewResponse({
      authorName: "Alice Walker",
      rating: 5,
      comment: "Super service and very responsive team!",
      keywords: ["Customer Service"],
    });

    expect(result.status).toBe("PENDING_REVIEW"); // Requires operator approval
    expect(result.draftReply).toContain("Hi Alice");
    expect(result.draftReply).toContain("5-star");
    expect(result.draftReply).toContain("service team");
  });

  it("generates proactive response for 4-star review", () => {
    const result = generateAiReviewResponse({
      authorName: "Brian Miller",
      rating: 4,
      comment: "Good product, minor setup confusion.",
    });

    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.draftReply).toContain("Hi Brian");
    expect(result.draftReply).toContain("4-star");
    expect(result.draftReply).toContain("5 stars");
  });

  it("generates honest constructive reply for 3-star review", () => {
    const result = generateAiReviewResponse({
      authorName: "Carol",
      rating: 3,
      comment: "Average experience.",
    });

    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.draftReply).toContain("Carol");
    expect(result.draftReply).toContain("honest review");
  });

  it("generates de-escalating, apologetic response with offline contact for 1-star complaint", () => {
    const result = generateAiReviewResponse({
      authorName: "Dan Evans",
      rating: 1,
      comment: "Website was down and broken, lost orders!",
      keywords: ["Reliability"],
    });

    expect(result.status).toBe("PENDING_REVIEW");
    expect(result.draftReply).toContain("Hi Dan");
    expect(result.draftReply).toContain("sincerely apologize");
    expect(result.draftReply).toContain("support@");
  });
});
