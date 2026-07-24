import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist" }),
}));

vi.mock("@next/third-parties/google", () => ({
  GoogleTagManager: () => null,
}));

vi.mock("@vercel/analytics/next", () => ({
  Analytics: () => null,
}));

vi.mock("@vercel/speed-insights/next", () => ({
  SpeedInsights: () => null,
}));

describe("RootLayout", () => {
  it("allows browser extensions to modify the root element before hydration", () => {
    const layout = RootLayout({ children: <main>Storefront</main> });

    expect(layout.type).toBe("html");
    expect(layout.props.suppressHydrationWarning).toBe(true);
  });
});
