# Guardian — Grounded Recommendations v1

## Scope

Grounded recommendations v1 implements the PRD's `Issues → Business impact →
Priority → Recommendation` path as a read-only dashboard projection. It is
derived inside the existing tenant-scoped health read from:

- active persisted issue rows (`OPEN`, `ACKNOWLEDGED`, or `IN_PROGRESS`);
- the existing monitor-owned `metadata.recommendedAction` value; and
- the current deterministic Digital Health Score's bounded component evidence.

The projection is deliberately rule-based. It does not call an AI provider,
make a network request, execute an action, or send a notification. The
existing `health:read` authorization boundary protects the response; no
separate unscoped recommendation endpoint was added.

## Contract

Each recommendation contains a deterministic ID (`recommendation:<issueId>`),
priority, bounded title/action/rationale, optional business impact and
confidence, and an evidence link containing the issue ID/status/severity,
last-seen timestamp, score coverage, and score source version. When the issue
is represented in a score component's evidence, the response also includes
that component's category, weight, and current score. An issue without a
matching category is retained with a null category/score rather than being
assigned to an unrelated category.

The server returns at most ten recommendations, ordered by severity, score
component weight, recency, and issue ID. The result is deterministic for the
same issue and score inputs. Raw technical evidence, response bodies,
credentials, and unrelated issue metadata are not copied into the response.

## Missing-category and missing-action policy

The Digital Health Score continues to represent unsupported categories as
`PENDING`; a pending category alone never creates a recommendation. An active
issue can still produce a recommendation when its action is valid but no score
component mapping exists, with the missing linkage made explicit. If an issue
has no non-empty string `metadata.recommendedAction`, or has an unsupported
severity/status, it is skipped. Guardian never invents generic advice to fill
those gaps.

## Deferred lifecycle

V1 recommendations are a live read projection. Resolving or ignoring an issue
removes its recommendation on the next health read. There is intentionally no
recommendation table, migration, dismiss/complete state, action execution,
recommendation history, or recommendation-specific audit event yet. Those
changes require a separate product decision about lifecycle, retention,
approval, audit, and rollback and must follow the PRD's
`Problem → Evidence → Recommendation → Risk → Approval → Action → Verification
→ Rollback` flow.

The next validation gate is representative real-site testing of issue evidence,
action quality, score stability, and tenant isolation. Deployment remains out
of scope for this phase.
