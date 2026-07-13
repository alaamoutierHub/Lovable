import { describe, it, expect, beforeEach } from "vitest";
import { CONNECTORS, connectorByKey } from "./registry";
import { configureAnalytics, isAnalyticsConfigured, track } from "./analytics";

describe("connector registry", () => {
  it("every connector has a unique key and required fields", () => {
    const keys = new Set<string>();
    for (const c of CONNECTORS) {
      expect(c.key).toBeTruthy();
      expect(keys.has(c.key)).toBe(false);
      keys.add(c.key);
      expect(c.name).toBeTruthy();
      expect(["ai", "analytics", "email", "data", "billing", "messaging"]).toContain(c.category);
      expect(["mvp", "phase2", "phase3"]).toContain(c.phase);
    }
  });

  it("server-only connectors declare no client config fields", () => {
    for (const c of CONNECTORS) {
      if (!c.clientSafe) expect(c.configFields).toHaveLength(0);
    }
  });

  it("lookup by key works", () => {
    expect(connectorByKey("posthog")?.name).toBe("PostHog");
    expect(connectorByKey("nope")).toBeUndefined();
  });
});

describe("analytics", () => {
  beforeEach(() => configureAnalytics(null));

  it("no-ops when unconfigured", () => {
    expect(isAnalyticsConfigured()).toBe(false);
    expect(track("test_event")).toBe(false);
  });

  it("configures from a client-safe key", () => {
    configureAnalytics({ projectApiKey: "phc_test", host: "https://example.posthog.com" });
    expect(isAnalyticsConfigured()).toBe(true);
    configureAnalytics(null); // reset so track() doesn't hit the network in other tests
  });
});
