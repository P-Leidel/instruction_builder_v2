import { describe, expect, it } from "vitest";
import { rowConnectorPoints } from "./output-connectors";

describe("row-wrap connector geometry", () => {
  it("uses actual cell edge centers and routes through the middle of their gap", () => {
    expect(rowConnectorPoints(
      { xMm: 112, yMm: 18, widthMm: 44, heightMm: 40 },
      { xMm: 10, yMm: 66, widthMm: 44, heightMm: 40 },
    )).toEqual({
      from: { xMm: 134, yMm: 58 },
      to: { xMm: 32, yMm: 66 },
      via: [{ xMm: 134, yMm: 62 }, { xMm: 32, yMm: 62 }],
    });
  });

  it("keeps a one-column continuation vertical and centered for differently sized cells", () => {
    expect(rowConnectorPoints(
      { xMm: 8, yMm: 5, widthMm: 30, heightMm: 24 },
      { xMm: 13, yMm: 35, widthMm: 20, heightMm: 28 },
    )).toEqual({
      from: { xMm: 23, yMm: 29 },
      to: { xMm: 23, yMm: 35 },
      via: [{ xMm: 23, yMm: 32 }, { xMm: 23, yMm: 32 }],
    });
  });
});
