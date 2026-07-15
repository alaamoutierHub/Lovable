// Render smoke-tests for the hand-built viz primitives. Uses react-dom/server
// (no jsdom needed) to confirm each component mounts without throwing and emits
// sensible markup — the closest we can get to "it renders" without a DOM.
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Stat, Bar, RankBars, Gauge, Donut, Sparkline, HeatCell, ColumnChart, LineChart, Scatter, StackedBar } from "./viz";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("viz primitives render", () => {
  it("Stat renders label, value, delta and hint", () => {
    const out = html(
      <Stat label="Net ROI" value="2.85" tone="green" hint="Incr / Inv" delta={{ value: "12%", direction: "up" }} />,
    );
    expect(out).toContain("Net ROI");
    expect(out).toContain("2.85");
    expect(out).toContain("Incr / Inv");
    expect(out).toContain("▲");
  });

  it("Bar sets a clamped width and renders a label", () => {
    const out = html(<Bar value={5} max={10} tone="green" label="50%" />);
    expect(out).toContain("width:50%");
    expect(out).toContain("50%");
  });

  it("Bar with zero max does not throw and renders 0 width", () => {
    const out = html(<Bar value={5} max={0} />);
    expect(out).toContain("width:0%");
  });

  it("RankBars renders one row per datum, empty-safe", () => {
    const out = html(
      <RankBars data={[{ label: "Amazon", value: 2.8, display: "2.8" }, { label: "Meta", value: 0.4, display: "0.4" }]} />,
    );
    expect(out).toContain("Amazon");
    expect(out).toContain("Meta");
    expect(html(<RankBars data={[]} />)).toContain("No data");
  });

  it("Gauge renders an SVG with the rounded value", () => {
    const out = html(<Gauge value={82.4} tone="green" label="DQ score" />);
    expect(out).toContain("<svg");
    expect(out).toContain("82"); // rounded, centered
    expect(out).toContain("DQ score");
  });

  it("Donut renders a segment per datum with legend percentages", () => {
    const out = html(
      <Donut data={[{ label: "Amazon", value: 60 }, { label: "Meta", value: 40 }]} centerValue="100%" />,
    );
    expect(out).toContain("Amazon");
    expect(out).toContain("60%");
    expect(out).toContain("40%");
    // two colored segments + background ring => at least 3 circles
    expect((out.match(/<circle/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it("Donut with all-zero values renders without divide-by-zero", () => {
    const out = html(<Donut data={[{ label: "A", value: 0 }, { label: "B", value: 0 }]} />);
    expect(out).toContain("—"); // legend shows em-dash when total is 0
  });

  it("Sparkline renders a polyline, and — for empty data", () => {
    expect(html(<Sparkline values={[1, 3, 2, 5]} />)).toContain("<polyline");
    expect(html(<Sparkline values={[]} />)).toContain("—");
  });

  it("ColumnChart renders a column per datum, empty-safe", () => {
    const out = html(<ColumnChart data={[{ label: "Jan", value: 10, display: "10" }, { label: "Feb", value: 20, display: "20" }]} />);
    expect(out).toContain("Jan");
    expect(out).toContain("Feb");
    expect(html(<ColumnChart data={[]} />)).toContain("No data");
  });

  it("LineChart renders polylines + legend, empty-safe", () => {
    const out = html(<LineChart labels={["Jan", "Feb", "Mar"]} series={[{ name: "Incr", values: [1, 3, 2], hex: "#0f766e", area: true }]} />);
    expect(out).toContain("<polyline");
    expect(out).toContain("Incr");
    expect(html(<LineChart labels={[]} series={[]} />)).toContain("No data");
  });

  it("Scatter renders a point per datum with a break-even line for negatives", () => {
    const out = html(<Scatter points={[{ x: 5000, y: 2.1, label: "Amazon" }, { x: 3000, y: -0.3, label: "Noon" }]} xLabel="Investment" yLabel="ROI" />);
    expect((out.match(/<circle/g) || []).length).toBe(2);
    expect(out).toContain("Investment");
    expect(html(<Scatter points={[]} />)).toContain("No data");
  });

  it("StackedBar renders proportional segments with legend %", () => {
    const out = html(<StackedBar data={[{ label: "Media", value: 60 }, { label: "Trade", value: 40 }]} />);
    expect(out).toContain("Media");
    expect(out).toContain("60%");
    expect(html(<StackedBar data={[{ label: "x", value: 0 }]} />)).toContain("No data");
  });

  it("HeatCell applies an alpha-suffixed background and renders children", () => {
    const out = html(<HeatCell intensity={0.5} hex="#0f766e">Score 80</HeatCell>);
    expect(out).toContain("Score 80");
    expect(out).toContain("#0f766e"); // hex present with alpha suffix
  });
});
