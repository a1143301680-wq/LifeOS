import { dateInTimeZone, shiftCalendarDate } from "./calendar-date";

test("derives the identity calendar date across timezone boundaries", () => {
  const instant = new Date("2026-07-22T16:30:00Z");

  expect(dateInTimeZone(instant, "Asia/Shanghai")).toBe("2026-07-23");
  expect(dateInTimeZone(instant, "America/New_York")).toBe("2026-07-22");
});

test("moves calendar dates across month and year boundaries", () => {
  expect(shiftCalendarDate("2026-12-31", 1)).toBe("2027-01-01");
  expect(shiftCalendarDate("2026-03-01", -1)).toBe("2026-02-28");
});
