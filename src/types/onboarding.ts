export type OnboardingPayload = {
  handle: string;
  preferred_send_time: string;
  employment_status?: string | null;
  education_level?: string | null;
  family_status?: string | null;
  living_with?: string | null;
  income_bracket?: string | null;
  religion?: string | null;
  moral_values?: string[];
};
