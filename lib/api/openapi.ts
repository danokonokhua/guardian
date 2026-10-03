/**
 * Guardian OpenAPI 3.0.3 Specification (PRD §19).
 * Defines endpoints, security schemes, request/response models, and rate limits.
 */
export function getOpenApiSpecification(): Record<string, unknown> {
  return {
    openapi: "3.0.3",
    info: {
      title: "Guardian Digital Revenue & Security Platform API",
      version: "1.0.0",
      description:
        "Programmatic REST API for Guardian digital health monitoring, automated remediation, issues, monitors, and agency portfolio management. Versioned under /api/v1.",
      contact: {
        name: "Guardian Developer Platform",
        url: "https://useguardian.io",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "Guardian Core API v1",
      },
    ],
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key (gdn_live_...)",
          description: "Supply your raw API key in the Authorization header: `Bearer gdn_live_...`",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "Supply your raw API key directly in the `X-API-Key` header.",
        },
      },
      schemas: {
        ApiSuccessEnvelope: {
          type: "object",
          required: ["data", "requestId"],
          properties: {
            data: { type: "object" },
            requestId: { type: "string", format: "uuid" },
          },
        },
        HealthScore: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 0, maximum: 100 },
            state: { type: "string", enum: ["MEASURED", "PARTIAL", "INSUFFICIENT_DATA"] },
            components: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  score: { type: "number" },
                  state: { type: "string" },
                },
              },
            },
          },
        },
        Issue: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] },
            status: { type: "string", enum: ["OPEN", "RESOLVED", "IGNORED"] },
            problem: { type: "string" },
            recommendation: { type: "string" },
          },
        },
        ApiKey: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            keyPrefix: { type: "string", example: "gdn_live_ab12..." },
            scopes: { type: "array", items: { type: "string" } },
            rateLimitPerMinute: { type: "integer", example: 120 },
            createdAt: { type: "string", format: "date-time" },
            lastUsedAt: { type: "string", format: "date-time", nullable: true },
            isActive: { type: "boolean" },
          },
        },
      },
      headers: {
        "X-RateLimit-Limit": {
          description: "Maximum requests permitted per minute.",
          schema: { type: "integer" },
        },
        "X-RateLimit-Remaining": {
          description: "Remaining requests in the current window.",
          schema: { type: "integer" },
        },
        "X-RateLimit-Reset": {
          description: "Unix timestamp in seconds when the window resets.",
          schema: { type: "integer" },
        },
      },
    },
    paths: {
      "/organizations/{organizationId}/health": {
        get: {
          summary: "Get Digital Health Score",
          description: "Retrieves the weighted digital health score and category breakdown.",
          tags: ["Digital Health"],
          parameters: [
            {
              name: "organizationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            200: {
              description: "Digital health score overview",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" },
                },
              },
            },
            401: { description: "Missing or invalid API key" },
            404: { description: "Organization not found" },
          },
        },
      },
      "/organizations/{organizationId}/issues": {
        get: {
          summary: "List Detected Issues",
          description: "Lists operational, security, and performance issues.",
          tags: ["Issues"],
          parameters: [
            {
              name: "organizationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "severity",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
            {
              name: "status",
              in: "query",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "List of issues",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" },
                },
              },
            },
          },
        },
      },
      "/organizations/{organizationId}/monitors": {
        get: {
          summary: "List Synthetic Monitors",
          description: "Returns all active uptime, SSL, DNS, form, and SEO monitors.",
          tags: ["Monitors"],
          parameters: [
            {
              name: "organizationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            200: {
              description: "List of monitors",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" },
                },
              },
            },
          },
        },
      },
      "/organizations/{organizationId}/remediation": {
        get: {
          summary: "AutoFix Remediation Overview",
          description: "Returns pending approvals, verified actions, and AutoFix queue.",
          tags: ["Remediation"],
          parameters: [
            {
              name: "organizationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            200: {
              description: "Remediation overview",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" },
                },
              },
            },
          },
        },
      },
      "/organizations/{organizationId}/api-keys": {
        get: {
          summary: "List API Keys",
          description: "Lists all registered API keys for the organization.",
          tags: ["API Keys"],
          parameters: [
            {
              name: "organizationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            200: {
              description: "List of API keys",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" },
                },
              },
            },
          },
        },
        post: {
          summary: "Create API Key",
          description: "Generates a new API key. Raw token is returned ONCE in the response.",
          tags: ["API Keys"],
          parameters: [
            {
              name: "organizationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string" },
                    scopes: { type: "array", items: { type: "string" } },
                    expiresInDays: { type: "integer", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Generated API Key with raw token",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ApiSuccessEnvelope" },
                },
              },
            },
          },
        },
      },
      "/organizations/{organizationId}/api-keys/{keyId}": {
        delete: {
          summary: "Revoke API Key",
          description: "Immediately revokes an API key.",
          tags: ["API Keys"],
          parameters: [
            {
              name: "organizationId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
            {
              name: "keyId",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
            },
          ],
          responses: {
            200: { description: "API key revoked" },
          },
        },
      },
    },
  };
}

