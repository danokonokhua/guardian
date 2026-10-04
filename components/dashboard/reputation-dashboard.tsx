"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

interface ReviewMetrics {
  averageRating: number;
  totalReviews: number;
  unansweredReviews: number;
  responseRatePercent: number;
  sentimentScore: number;
  sentimentBreakdown: {
    positivePercent: number;
    neutralPercent: number;
    negativePercent: number;
  };
  topKeywords: Array<{ tag: string; count: number }>;
}

interface ReviewItem {
  id: string;
  source: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  rating: number;
  comment: string;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | string;
  sentimentScore: number;
  sentimentKeywords?: any;
  hasReply: boolean;
  replyText?: string | null;
  aiSuggestedReply?: string | null;
  aiSuggestionStatus?: string | null;
  reviewDate: string;
}

export function ReputationDashboard({ organizationId }: { organizationId: string }) {
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRating, setFilterRating] = useState<string>("all");
  const [filterReplied, setFilterReplied] = useState<string>("all");
  const [filterSentiment, setFilterSentiment] = useState<string>("all");
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [reload, setReload] = useState(0);
  const [showSimulateModal, setShowSimulateModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const query = new URLSearchParams();
    if (filterRating !== "all") query.set("rating", filterRating);
    if (filterSentiment !== "all") query.set("sentiment", filterSentiment);
    if (filterReplied === "unanswered") query.set("hasReply", "false");
    if (filterReplied === "answered") query.set("hasReply", "true");

    fetch(`/api/v1/organizations/${organizationId}/reputation?${query.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Could not load reputation data.");
        return r.json();
      })
      .then((body) => {
        if (!cancelled && body.data) {
          setMetrics(body.data.metrics);
          setReviews(body.data.reviews || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId, filterRating, filterReplied, filterSentiment, reload]);

  async function handleGenerateAiDraft(reviewId: string) {
    setBusyReviewId(reviewId);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/reputation/reviews/${reviewId}/response`,
        { method: "POST" },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || "Failed to generate AI response.");

      // Set initial draft text into editable state
      if (body.data?.aiSuggestedReply) {
        setDraftEdits((prev) => ({
          ...prev,
          [reviewId]: body.data.aiSuggestedReply,
        }));
      }
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI drafting failed");
    } finally {
      setBusyReviewId(null);
    }
  }

  async function handleApproveReply(reviewId: string) {
    const textToSubmit =
      draftEdits[reviewId] || reviews.find((r) => r.id === reviewId)?.aiSuggestedReply;
    if (!textToSubmit || !textToSubmit.trim()) {
      alert("Please enter a response message.");
      return;
    }

    setBusyReviewId(reviewId);
    try {
      const res = await fetch(
        `/api/v1/organizations/${organizationId}/reputation/reviews/${reviewId}/response`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyText: textToSubmit.trim() }),
        },
      );
      if (!res.ok) throw new Error("Failed to save response.");
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve reply");
    } finally {
      setBusyReviewId(null);
    }
  }

  async function handleSimulateReview(isPositive: boolean) {
    setShowSimulateModal(false);
    setLoading(true);
    try {
      const payload = isPositive
        ? {
            authorName: "Liam Sterling",
            rating: 5,
            comment:
              "Absolutely top tier service! The team went above and beyond to protect our website.",
            source: "GOOGLE_BUSINESS",
          }
        : {
            authorName: "Kevin R.",
            rating: 1,
            comment:
              "Terrible experience, checkout form failed and customer support was completely unresponsive.",
            source: "GOOGLE_BUSINESS",
          };

      const res = await fetch(`/api/v1/organizations/${organizationId}/reputation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add simulation review.");
      setReload((r) => r + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Metrics Hero Cards */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Average Rating */}
          <GlassCard className="p-5">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
              Average Rating
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white">
                {metrics.averageRating.toFixed(1)}
              </span>
              <span className="text-xs text-amber-400">/ 5.0</span>
            </div>
            <div className="flex text-amber-400 text-xs mt-1">
              {"★".repeat(Math.round(metrics.averageRating))}
              {"☆".repeat(5 - Math.round(metrics.averageRating))}
              <span className="ml-2 text-slate-400">({metrics.totalReviews} reviews)</span>
            </div>
          </GlassCard>

          {/* Response Rate */}
          <GlassCard className="p-5">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
              Response Rate
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-white">
                {metrics.responseRatePercent}%
              </span>
              <span className="text-xs text-emerald-400">
                {metrics.unansweredReviews === 0
                  ? "All Answered"
                  : `${metrics.unansweredReviews} Pending`}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
              <div
                className="bg-emerald-500 h-1.5 rounded-full"
                style={{ width: `${metrics.responseRatePercent}%` }}
              />
            </div>
          </GlassCard>

          {/* Sentiment Health Score */}
          <GlassCard className="p-5">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
              Sentiment Score
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-emerald-400">
                {metrics.sentimentScore}
              </span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {metrics.sentimentBreakdown.positivePercent}% Positive sentiment ratio
            </p>
          </GlassCard>

          {/* Sentiment Breakdown */}
          <GlassCard className="p-5">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
              Sentiment Distribution
            </span>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Positive
                </span>
                <span>{metrics.sentimentBreakdown.positivePercent}%</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-sky-400" /> Neutral
                </span>
                <span>{metrics.sentimentBreakdown.neutralPercent}%</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-400" /> Negative
                </span>
                <span>{metrics.sentimentBreakdown.negativePercent}%</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Top Recurring Themes */}
      {metrics && metrics.topKeywords.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-slate-900/40 border border-white/5">
          <span className="text-xs text-slate-400 font-medium mr-2">Identified Themes:</span>
          {metrics.topKeywords.map((kw, i) => (
            <span
              key={i}
              className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 font-medium"
            >
              {kw.tag} <span className="text-emerald-400 font-bold ml-1">({kw.count})</span>
            </span>
          ))}
        </div>
      )}

      {/* Filter and Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/5 bg-slate-900/40">
        <div className="flex flex-wrap items-center gap-3">
          {/* Rating Filter */}
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5"
          >
            <option value="all">All Stars</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          {/* Response Status */}
          <select
            value={filterReplied}
            onChange={(e) => setFilterReplied(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5"
          >
            <option value="all">All Response States</option>
            <option value="unanswered">Awaiting Reply</option>
            <option value="answered">Replied</option>
          </select>

          {/* Sentiment Filter */}
          <select
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5"
          >
            <option value="all">All Sentiments</option>
            <option value="POSITIVE">Positive</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="NEGATIVE">Negative</option>
          </select>
        </div>

        <button
          onClick={() => setShowSimulateModal(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 transition-colors"
        >
          + Simulate Review (Sandbox)
        </button>
      </div>

      {/* Reviews Feed */}
      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-2 text-sm">Loading reviews and sentiment feed...</p>
        </div>
      ) : reviews.length === 0 ? (
        <GlassCard className="p-8 text-center text-slate-400">
          <p className="text-sm">No reviews match the selected filter criteria.</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const isBusy = busyReviewId === review.id;
            const draftText = draftEdits[review.id] ?? (review.aiSuggestedReply || "");

            return (
              <GlassCard key={review.id} className="p-5 transition-all">
                {/* Author & Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-sm">
                      {review.authorName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">
                          {review.authorName}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                          {review.source.replace("_", " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-amber-400 text-xs font-medium">
                          {"★".repeat(review.rating)}
                          {"☆".repeat(5 - review.rating)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(review.reviewDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sentiment Badge */}
                  <div className="flex items-center gap-2">
                    {review.sentiment === "POSITIVE" && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                        Positive Tone
                      </span>
                    )}
                    {review.sentiment === "NEUTRAL" && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-medium">
                        Neutral Tone
                      </span>
                    )}
                    {review.sentiment === "NEGATIVE" && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium">
                        Critical Tone
                      </span>
                    )}
                  </div>
                </div>

                {/* Review Text */}
                <p className="mt-3 text-sm text-slate-200 leading-relaxed">"{review.comment}"</p>

                {/* Response Section */}
                <div className="mt-4 pt-3 border-t border-white/5">
                  {review.hasReply ? (
                    <div className="p-3 rounded-xl bg-slate-900/60 border border-emerald-500/20">
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
                        <span>✓ Response Published</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{review.replyText}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                          <span>⏳ Awaiting Owner Reply</span>
                        </span>

                        {!review.aiSuggestedReply && (
                          <button
                            onClick={() => handleGenerateAiDraft(review.id)}
                            disabled={isBusy}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors"
                          >
                            {isBusy ? "Generating..." : "⚡ Generate AI Response"}
                          </button>
                        )}
                      </div>

                      {/* AI Draft Box (PRD §14: Operator Authorization Required) */}
                      {review.aiSuggestedReply && (
                        <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
                              <span>🤖 AI Suggested Response (Draft)</span>
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Requires Operator Approval (PRD §14)
                            </span>
                          </div>

                          <textarea
                            value={draftText}
                            onChange={(e) =>
                              setDraftEdits((prev) => ({
                                ...prev,
                                [review.id]: e.target.value,
                              }))
                            }
                            rows={3}
                            className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-xs text-slate-200 focus:ring-1 focus:ring-cyan-500"
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleGenerateAiDraft(review.id)}
                              disabled={isBusy}
                              className="px-3 py-1 rounded text-xs text-slate-400 hover:text-white"
                            >
                              Regenerate
                            </button>
                            <button
                              onClick={() => handleApproveReply(review.id)}
                              disabled={isBusy}
                              className="button-primary text-xs px-3 py-1.5"
                            >
                              {isBusy ? "Publishing..." : "Approve & Mark Replied"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Simulate Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Simulate Customer Review</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Test how Guardian's reputation engine classifies sentiment, updates health scores, and
              drafts AI responses.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleSimulateReview(true)}
                className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition-colors"
              >
                <span className="text-lg block">⭐️ 5-Star Praise</span>
                <span className="text-xs text-emerald-300 mt-1 block">
                  Simulate high satisfaction & positive tone
                </span>
              </button>

              <button
                onClick={() => handleSimulateReview(false)}
                className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-left transition-colors"
              >
                <span className="text-lg block">⚠️ 1-Star Complaint</span>
                <span className="text-xs text-rose-300 mt-1 block">
                  Simulate critical checkout failure & alert spike
                </span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSimulateModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
