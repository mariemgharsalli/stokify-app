import { describe, expect, it } from "vitest";
import { ar } from "../strings/ar";
import { en } from "../strings/en";
import { fr } from "../strings/fr";

function shape(value) {
  if (Array.isArray(value)) return value.map(shape);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = shape(value[key]);
        return acc;
      }, {});
  }
  return typeof value;
}

describe("catalogues de textes", () => {
  it("garde les mêmes clés en français, anglais et arabe", () => {
    expect(shape(en)).toEqual(shape(fr));
    expect(shape(ar)).toEqual(shape(fr));
  });
});
