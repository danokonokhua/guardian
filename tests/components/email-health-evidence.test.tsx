// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailHealthEvidence } from "@/components/dashboard/email-health-evidence";
import { evidence, type EmailHealthConfig } from "@/lib/email-health/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EmailHealthEvidence component", () => {
  it("renders deliverability score progress and remediation checklist when weak", () => {
    const config: EmailHealthConfig = {
      domainScope: "REGISTERED",
      emailHealth: {
        domain: "example.com",
        checkedAt: "2026-10-14T10:00:00Z",
        checks: {
          SPF: evidence("HEALTHY", "SPF valid", "dns:example.com:TXT", ["v=spf1 include:_spf.example.com -all"]),
          DMARC: evidence("WEAK", "DMARC monitoring only", "dns:_dmarc.example.com:TXT", ["v=DMARC1; p=none"]),
          DKIM: evidence("MISSING", "DKIM not found", "dns:google._domainkey.example.com:TXT", []),
          MTA_STS: evidence("MISSING", "MTA-STS not configured", "https://mta-sts.example.com", []),
        },
      },
    };

    render(<EmailHealthEvidence config={config} />);

    // Score display
    expect(screen.getByText("Deliverability & Spoofing Defense")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument(); // SPF 30 + DMARC weak 20 = 50
    expect(screen.getByText("Vulnerable to Spoofing")).toBeInTheDocument();

    // Remediation tips
    expect(screen.getByText("Recommendations to reach 100/100:")).toBeInTheDocument();
    expect(screen.getByText(/Upgrade policy from p=none to p=quarantine or p=reject/)).toBeInTheDocument();
    expect(screen.getByText(/Publish a cryptographic DKIM signature key/)).toBeInTheDocument();
    expect(screen.getByText(/Enable SMTP TLS policy enforcement/)).toBeInTheDocument();
  });

  it("renders 100/100 verified banner when all protocols are healthy", () => {
    const config: EmailHealthConfig = {
      domainScope: "REGISTERED",
      emailHealth: {
        domain: "example.com",
        checkedAt: "2026-10-14T10:00:00Z",
        checks: {
          SPF: evidence("HEALTHY", "SPF valid", "dns:example.com:TXT", ["v=spf1 include:_spf.example.com -all"]),
          DMARC: evidence("HEALTHY", "DMARC reject active", "dns:_dmarc.example.com:TXT", ["v=DMARC1; p=reject"]),
          DKIM: evidence("HEALTHY", "DKIM selector verified", "dns:google._domainkey.example.com:TXT", [
            "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC12345",
          ]),
          MTA_STS: evidence("HEALTHY", "MTA-STS enforced", "https://mta-sts.example.com", ["version: STSv1"]),
        },
      },
    };

    render(<EmailHealthEvidence config={config} />);

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Excellent Protection")).toBeInTheDocument();
    expect(screen.getByText(/All 4 email defense standards are fully verified/)).toBeInTheDocument();
  });

  it("copies DNS record to clipboard on button click", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const config: EmailHealthConfig = {
      domainScope: "REGISTERED",
      emailHealth: {
        domain: "example.com",
        checkedAt: "2026-10-14T10:00:00Z",
        checks: {
          SPF: evidence("HEALTHY", "SPF valid", "dns:example.com:TXT", ["v=spf1 include:_spf.example.com -all"]),
          DMARC: evidence("HEALTHY", "DMARC reject active", "dns:_dmarc.example.com:TXT", ["v=DMARC1; p=reject"]),
          DKIM: evidence("HEALTHY", "DKIM key", "dns:k1._domainkey.example.com", ["v=DKIM1; p=ABCDE"]),
          MTA_STS: evidence("HEALTHY", "MTA-STS valid", "dns:_mta-sts.example.com", ["v=STSv1"]),
        },
      },
    };

    render(<EmailHealthEvidence config={config} />);

    // Click the first copy button
    const copyButtons = screen.getAllByTitle("Copy record to clipboard");
    expect(copyButtons.length).toBeGreaterThan(0);

    fireEvent.click(copyButtons[0]!);

    expect(writeTextMock).toHaveBeenCalledWith("v=spf1 include:_spf.example.com -all");
    expect(screen.getByText("✓ Copied!")).toBeInTheDocument();
  });
});
