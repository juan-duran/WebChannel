export type OnboardingPayload = {
  handle: string;
  preferred_send_time: 'manha' | 'tarde' | 'noite';
  family_profile: {
    stage:
      | 'casal_sem_filhos'
      | 'casal_com_filhos'
      | 'familia_monoparental'
      | 'solteiro'
      | 'outro';
    children_age_range: 'nenhum' | '0_5' | '6_12' | '13_17' | '18_mais';
  };
  beliefs: {
    faith_importance: 'central' | 'moderada' | 'aberta';
    community_involvement: 'visitante' | 'participante' | 'lideranca';
    content_boundaries: string;
    theological_alignment: 'tradicional' | 'equilibrada' | 'progressista';
  };
};
