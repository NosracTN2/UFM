import { describe, expect, test } from "bun:test";
import { killXp, levelLabel, rate, thresholdsCrossed, xpToNext } from "../src/shared/math";

describe("System math (bible checks)", () => {
  test("points rate across Circles and Thresholds", () => {
    expect(rate(1)).toBe(1);
    expect(rate(14)).toBe(1);
    expect(rate(15)).toBe(2);
    expect(rate(24)).toBe(2);
    expect(rate(25)).toBe(3);
    expect(rate(35)).toBe(4);
    expect(rate(45)).toBe(5);
    expect(rate(49)).toBe(5);
    expect(rate(50)).toBe(10);
    expect(rate(60)).toBe(20);
    expect(rate(99)).toBe(50);
    expect(rate(100)).toBe(100);
    expect(rate(149)).toBe(500);
    expect(rate(150)).toBe(1000);
  });

  test("30,000 XP to leave Level 15, 500,000 at 50, 10,000,000 at 100", () => {
    expect(xpToNext(15)).toBe(30_000);
    expect(xpToNext(50)).toBe(500_000);
    expect(xpToNext(100)).toBe(10_000_000);
  });

  test("XP example from the sheet: Level 16 needs 32,000", () => {
    expect(xpToNext(16)).toBe(32_000);
  });

  test("At Level 15, a Level 30 captain kill pays 22,500", () => {
    expect(killXp(30, 15)).toBe(22_500);
  });

  test("kills far below you pay nothing", () => {
    expect(killXp(5, 20)).toBe(0);
    expect(killXp(10, 10)).toBe(1000);
  });

  test("labels and Threshold counting", () => {
    expect(levelLabel(16)).toBe("16 · Stone Circle, second Threshold");
    expect(thresholdsCrossed(14)).toBe(0);
    expect(thresholdsCrossed(15)).toBe(1);
    expect(thresholdsCrossed(50)).toBe(5);
  });
});
