import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { OnboardingPayload } from '../types/onboarding';

const preferredSendTimeOptions = [
  { label: 'Manhã (08h - 11h)', value: 'manha' as const },
  { label: 'Tarde (12h - 17h)', value: 'tarde' as const },
  { label: 'Noite (18h - 22h)', value: 'noite' as const },
];

const familyStageOptions = [
  { label: 'Casal sem filhos', value: 'casal_sem_filhos' as const },
  { label: 'Casal com filhos', value: 'casal_com_filhos' as const },
  { label: 'Família monoparental', value: 'familia_monoparental' as const },
  { label: 'Solteiro(a)', value: 'solteiro' as const },
  { label: 'Outro formato', value: 'outro' as const },
];

const childrenAgeRangeOptions = [
  { label: 'Não tenho filhos', value: 'nenhum' as const },
  { label: '0 a 5 anos', value: '0_5' as const },
  { label: '6 a 12 anos', value: '6_12' as const },
  { label: '13 a 17 anos', value: '13_17' as const },
  { label: '18+ anos', value: '18_mais' as const },
];

const faithImportanceOptions = [
  { label: 'Central na rotina', value: 'central' as const },
  { label: 'Moderada', value: 'moderada' as const },
  { label: 'Aberta e em construção', value: 'aberta' as const },
];

const communityInvolvementOptions = [
  { label: 'Visitante ou explorando', value: 'visitante' as const },
  { label: 'Participante ativo', value: 'participante' as const },
  { label: 'Liderança ou voluntário', value: 'lideranca' as const },
];

const theologicalAlignmentOptions = [
  { label: 'Mais tradicional', value: 'tradicional' as const },
  { label: 'Buscando equilíbrio', value: 'equilibrada' as const },
  { label: 'Mais progressista', value: 'progressista' as const },
];

type FormState = {
  handle: string;
  preferred_send_time: '' | OnboardingPayload['preferred_send_time'];
  family_stage: OnboardingPayload['family_profile']['stage'];
  children_age_range: OnboardingPayload['family_profile']['children_age_range'];
  faith_importance: OnboardingPayload['beliefs']['faith_importance'];
  community_involvement: OnboardingPayload['beliefs']['community_involvement'];
  theological_alignment: OnboardingPayload['beliefs']['theological_alignment'];
  content_boundaries: string;
};

const defaultFormState: FormState = {
  handle: '',
  preferred_send_time: '',
  family_stage: 'casal_sem_filhos',
  children_age_range: 'nenhum',
  faith_importance: 'central',
  community_involvement: 'participante',
  theological_alignment: 'equilibrada',
  content_boundaries: '',
};

export function OnboardingPage() {
  const { user } = useAuth();
  const userEmail = user?.email ?? '';
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const isEmailMissing = useMemo(() => !userEmail, [userEmail]);

  const validate = () => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    const handleWords = formState.handle.trim().split(/\s+/).filter(Boolean);

    if (handleWords.length < 2) {
      newErrors.handle = 'Use pelo menos duas palavras para se apresentar.';
    }

    if (formState.handle.trim().length > 60) {
      newErrors.handle = 'O apelido pode ter no máximo 60 caracteres.';
    }

    if (!formState.preferred_send_time) {
      newErrors.preferred_send_time = 'Escolha um horário preferido para receber conteúdos.';
    }

    return newErrors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus({ type: null, message: '' });

    const validationErrors = validate();
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0 || isEmailMissing) {
      return;
    }

    const payload: OnboardingPayload = {
      handle: formState.handle.trim(),
      preferred_send_time: formState.preferred_send_time as OnboardingPayload['preferred_send_time'],
      family_profile: {
        stage: formState.family_stage,
        children_age_range: formState.children_age_range,
      },
      beliefs: {
        faith_importance: formState.faith_importance,
        community_involvement: formState.community_involvement,
        theological_alignment: formState.theological_alignment,
        content_boundaries: formState.content_boundaries.trim(),
      },
    };

    setSubmitting(true);

    try {
      const { error } = await supabase.rpc('rpc_update_web_onboarding', {
        p_email: userEmail,
        p_payload: payload,
      });

      if (error) {
        throw error;
      }

      setStatus({ type: 'success', message: 'Preferências salvas com sucesso! 🎉' });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar suas preferências. Tente novamente.';
      setStatus({ type: 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="py-6">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-4 sm:p-6 mb-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-600">Seu perfil</p>
          <h2 className="text-2xl font-bold text-gray-900">Onboarding</h2>
          <p className="text-gray-600">
            Conte um pouco sobre você para personalizarmos suas sugestões e comunicações.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="form-card">
          <header className="flex flex-col gap-1 mb-4">
            <p className="text-xs uppercase font-semibold text-blue-600 tracking-wide">
              Informações básicas
            </p>
            <h3 className="text-lg font-semibold text-gray-900">Como podemos te chamar?</h3>
            <p className="text-sm text-gray-600">
              Usaremos esse nome para te enviar conteúdos e sugestões personalizadas.
            </p>
          </header>

          <div className="field-stack">
            <label className="space-y-1" htmlFor="handle">
              <span className="font-medium text-gray-800">Apelido ou forma de tratamento</span>
              <input
                id="handle"
                name="handle"
                type="text"
                value={formState.handle}
                onChange={(e) => updateField('handle', e.target.value)}
                className={`w-full rounded-lg border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.handle ? 'border-red-400' : 'border-gray-200'
                }`}
                placeholder="Ex.: João e Ana Silva"
                maxLength={80}
                required
              />
              {errors.handle && (
                <p className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" /> {errors.handle}
                </p>
              )}
            </label>

            <label className="space-y-1" htmlFor="preferred_send_time">
              <span className="font-medium text-gray-800">Horário preferido para receber mensagens</span>
              <select
                id="preferred_send_time"
                name="preferred_send_time"
                value={formState.preferred_send_time}
                onChange={(e) => updateField('preferred_send_time', e.target.value as FormState['preferred_send_time'])}
                className={`w-full rounded-lg border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  errors.preferred_send_time ? 'border-red-400' : 'border-gray-200'
                }`}
                required
              >
                <option value="">Selecione um horário</option>
                {preferredSendTimeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.preferred_send_time && (
                <p className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" /> {errors.preferred_send_time}
                </p>
              )}
            </label>
          </div>
        </section>

        <section className="form-card">
          <header className="flex flex-col gap-1 mb-4">
            <p className="text-xs uppercase font-semibold text-blue-600 tracking-wide">
              Perfil familiar
            </p>
            <h3 className="text-lg font-semibold text-gray-900">Entenda seu contexto</h3>
            <p className="text-sm text-gray-600">
              Essas escolhas nos ajudam a sugerir conteúdos e rotinas relevantes para sua família.
            </p>
          </header>

          <div className="field-stack">
            <label className="space-y-1" htmlFor="family_stage">
              <span className="font-medium text-gray-800">Configuração familiar</span>
              <select
                id="family_stage"
                name="family_stage"
                value={formState.family_stage}
                onChange={(e) => updateField('family_stage', e.target.value as FormState['family_stage'])}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {familyStageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="children_age_range">
              <span className="font-medium text-gray-800">Faixa etária dos filhos</span>
              <select
                id="children_age_range"
                name="children_age_range"
                value={formState.children_age_range}
                onChange={(e) => updateField('children_age_range', e.target.value as FormState['children_age_range'])}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {childrenAgeRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="form-card">
          <header className="flex flex-col gap-1 mb-4">
            <p className="text-xs uppercase font-semibold text-blue-600 tracking-wide">
              Crenças e valores
            </p>
            <h3 className="text-lg font-semibold text-gray-900">Conteúdos que respeitam seu ritmo</h3>
            <p className="text-sm text-gray-600">
              Escolha as afirmações que mais combinam com você para personalizarmos a linguagem e o tom.
            </p>
          </header>

          <div className="field-stack">
            <label className="space-y-1" htmlFor="faith_importance">
              <span className="font-medium text-gray-800">Importância da fé no dia a dia</span>
              <select
                id="faith_importance"
                name="faith_importance"
                value={formState.faith_importance}
                onChange={(e) => updateField('faith_importance', e.target.value as FormState['faith_importance'])}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {faithImportanceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="community_involvement">
              <span className="font-medium text-gray-800">Envolvimento com a comunidade</span>
              <select
                id="community_involvement"
                name="community_involvement"
                value={formState.community_involvement}
                onChange={(e) =>
                  updateField('community_involvement', e.target.value as FormState['community_involvement'])
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {communityInvolvementOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="theological_alignment">
              <span className="font-medium text-gray-800">Postura teológica</span>
              <select
                id="theological_alignment"
                name="theological_alignment"
                value={formState.theological_alignment}
                onChange={(e) =>
                  updateField('theological_alignment', e.target.value as FormState['theological_alignment'])
                }
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {theologicalAlignmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="content_boundaries">
              <span className="font-medium text-gray-800">Limites e preferências de conteúdo</span>
              <textarea
                id="content_boundaries"
                name="content_boundaries"
                rows={3}
                value={formState.content_boundaries}
                onChange={(e) => updateField('content_boundaries', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex.: Prefiro mensagens mais curtas, linguagem acolhedora e referências práticas."
              />
              <p className="text-xs text-gray-500">Opcional, mas ajuda muito a ajustar o tom.</p>
            </label>
          </div>
        </section>

        {status.type && (
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
              status.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 mt-0.5" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">
                {status.type === 'success' ? 'Tudo certo!' : 'Ops, algo deu errado'}
              </p>
              <p>{status.message}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="submit"
            disabled={submitting || isEmailMissing}
            className="inline-flex justify-center items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-3 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {submitting ? 'Salvando...' : 'Salvar preferências'}
          </button>
          {isEmailMissing && (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Não encontramos seu email para salvar as preferências.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
