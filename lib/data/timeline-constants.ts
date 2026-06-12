export const TIMELINE_CATEGORIES = [
  "port",
  "railway",
  "schools",
  "families",
  "culture",
  "sport",
  "market",
  "beach",
  "oldCity",
  "work",
  "fishing",
  "migration",
  "cansado",
  "snim",
  "religiousEvents",
  "nationalEvents",
  "neighborhoods",
  "other",
] as const;

export type TimelineCategory = (typeof TIMELINE_CATEGORIES)[number];

export const TIMELINE_PAGE_SIZE = 20;
