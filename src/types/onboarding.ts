export type OnboardingPayload = {
  handle: string;
  preferred_send_time: string;
  moral_values: string[];
  employment_status?: string | null;
  education_level?: string | null;
  family_status?: string | null;
  living_with?: string | null;
  income_bracket?: string | null;
  religion?: string | null;
  content_boundaries?: string | null;
  family_stage?: string | null;
  children_age_range?: string | null;
  faith_importance?: string | null;
  community_involvement?: string | null;
  theological_alignment?: string | null;
};
