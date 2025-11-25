export type OnboardingPayload = {
  handle: string;
  preferred_send_time: string;
  family_profile: {
    stage: 'casal_sem_filhos' | 'casal_com_filhos' | 'familia_recomposta' | 'multigeracional' | 'solteiro' | 'outro';
    children_age_range: 'nenhum' | '0-5' | '6-12' | '13-17' | '18+' | 'mix';
  };
  beliefs: {
    faith_importance: 'central' | 'moderada' | 'pontual';
    community_involvement: 'lideranca' | 'participante' | 'observador';
    theological_alignment: 'tradicional' | 'equilibrada' | 'progressista';
    content_boundaries: string;
  };
};
