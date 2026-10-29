const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** en-GB writes September as "Sept"; every month stays three letters. */
const tidy = (text: string) => text.replaceAll("Sept", "Sep");

/**
 * A billing period, in UTC: "12 Nov – 12 Dec 2026", with the year once at
 * the end, or on both sides when the period crosses a year.
 */
export function formatPeriod(start: Date, end: Date) {
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const from =
    startYear === endYear
      ? dayMonth.format(start)
      : `${dayMonth.format(start)} ${startYear}`;
  return tidy(`${from} – ${dayMonth.format(end)} ${endYear}`);
}
