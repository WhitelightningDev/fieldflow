export const TEAM_SIZE_VALUES = ["1", "2-5", "6-15", "16-30", "31+"] as const;
export type TeamSizeValue = (typeof TEAM_SIZE_VALUES)[number];

export const TEAM_SIZE_OPTIONS: { value: TeamSizeValue; label: string }[] = [
  { value: "1", label: "Just me" },
  { value: "2-5", label: "2–5 techs" },
  { value: "6-15", label: "6–15 techs" },
  { value: "16-30", label: "16–30 techs" },
  { value: "31+", label: "31+ techs" },
];

