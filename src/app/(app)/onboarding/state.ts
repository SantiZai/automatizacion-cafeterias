export type OnboardingState = {
  error?: string;
  fieldErrors?: Partial<Record<"name" | "stampsRequired" | "rewardName", string>>;
};
