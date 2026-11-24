import { describe, expect, test } from "bun:test";
import { isCanonFile, parseCanon, pastBookmark } from "../src/engine/canon";

describe("canon files", () => {
  test("sections with metadata, front-matter defaults, keys default to the heading", () => {
    const text = `---
chapter: 3
---
# The Factions

## The Staff
keys: Staff, wardens
chapter: 5
order: 40

The Staff keep the order of Floor 1.

## The Mane

The Mane climb.

## Floor 1 rules
always: yes
chapter: 0

No one raises stone in the street.
`;
    const e = parseCanon("canon/factions.md", text);
    expect(e.map((x) => [x.name, x.keys, x.chapter, x.constant, x.order])).toEqual([
      ["The Staff", ["Staff", "wardens"], 5, false, 40],
      ["The Mane", ["The Mane"], 3, false, 100],
      ["Floor 1 rules", [], 0, true, 100],
    ]);
    expect(e[0].content).toBe("The Staff keep the order of Floor 1.");
    expect(e[0].key).toBe("factions.md#the_staff");
  });

  test("a file without sections is one entry named by its title", () => {
    const e = parseCanon("canon/aethelgard.md", "# Aethelgard\nkeys: white city\n\nThe white city.");
    expect(e).toHaveLength(1);
    expect(e[0].name).toBe("Aethelgard");
    expect(e[0].keys).toEqual(["white city"]);
    expect(e[0].content).toBe("The white city.");
  });

  test("README and _drafts are never synced", () => {
    expect(isCanonFile("canon/README.md")).toBe(false);
    expect(isCanonFile("canon/_draft.md")).toBe(false);
    expect(isCanonFile("canon/staff.md")).toBe(true);
    expect(isCanonFile("canon/notes.txt")).toBe(false);
  });

  test("the bookmark", () => {
    expect(pastBookmark(6, 5)).toBe(true);
    expect(pastBookmark(5, 5)).toBe(false);
    expect(pastBookmark(99, null)).toBe(false);
  });
});
