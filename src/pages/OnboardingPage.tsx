import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { OnboardingPayload } from '../types/onboarding';

const preferredSendTimeOptions = [
  { label: '08:00 (manhã)', value: '08:00' as const },
  { label: '12:00 (início da tarde)', value: '12:00' as const },
  { label: '18:00 (final da tarde)', value: '18:00' as const },
  { label: '21:00 (noite)', value: '21:00' as const },
];

const employmentStatusOptions = [
  { label: 'Desempregado(a)', value: 'desempregado' as const },
  { label: 'Estudante', value: 'estudante' as const },
  { label: 'Trabalho meio período', value: 'meio_periodo' as const },
  { label: 'Trabalho em tempo integral', value: 'tempo_integral' as const },
  { label: 'Aposentado(a)', value: 'aposentado' as const },
];

const educationLevelOptions = [
  { label: 'Nenhum', value: 'nenhum' as const },
  { label: 'Ensino fundamental', value: 'fundamental' as const },
  { label: 'Ensino médio', value: 'medio' as const },
  { label: 'Graduação', value: 'graduacao' as const },
  { label: 'Mestrado', value: 'mestrado' as const },
  { label: 'Doutorado', value: 'doutorado' as const },
  { label: 'Outros', value: 'outros' as const },
];

const familyStatusOptions = [
  { label: 'Solteiro(a)', value: 'solteiro' as const },
  { label: 'Casado(a)', value: 'casado' as const },
  { label: 'Divorciado(a)', value: 'divorciado' as const },
  { label: 'Viúvo(a)', value: 'viuvo' as const },
  { label: 'União estável', value: 'uniao_estavel' as const },
];

const livingWithOptions = [
  { label: 'Moro sozinho(a)', value: 'sozinho' as const },
  { label: 'Com parceiro(a)', value: 'parceiro' as const },
  { label: 'Com filhos', value: 'filhos' as const },
  { label: 'Com família extensa', value: 'familia_extensa' as const },
  { label: 'Com colegas de quarto', value: 'colegas_quarto' as const },
  { label: 'Outro arranjo', value: 'outro' as const },
];

const incomeBracketOptions = [
  { label: 'Baixa', value: 'baixa' as const },
  { label: 'Média-baixa', value: 'media_baixa' as const },
  { label: 'Média', value: 'media' as const },
  { label: 'Média-alta', value: 'media_alta' as const },
  { label: 'Alta', value: 'alta' as const },
];

const religionOptions = [
  { label: 'Católico(a)', value: 'catolico' as const },
  { label: 'Protestante', value: 'protestante' as const },
  { label: 'Evangélico(a)', value: 'evangelico' as const },
  { label: 'Espírita', value: 'espirita' as const },
  { label: 'Umbanda', value: 'umbanda' as const },
  { label: 'Candomblé', value: 'candomble' as const },
  { label: 'Judaico', value: 'judaico' as const },
  { label: 'Islâmico', value: 'islamico' as const },
  { label: 'Budista', value: 'budista' as const },
  { label: 'Hindu', value: 'hindu' as const },
  { label: 'Ateu', value: 'ateu' as const },
  { label: 'Agnóstico', value: 'agnostico' as const },
  { label: 'Outros', value: 'outros' as const },
];

const moralValuesOptions = [
  { label: 'Fé', value: 'fe' as const },
  { label: 'Honestidade', value: 'honestidade' as const },
  { label: 'Respeito', value: 'respeito' as const },
  { label: 'Responsabilidade', value: 'responsabilidade' as const },
  { label: 'Compaixão', value: 'compaixao' as const },
  { label: 'Justiça', value: 'justica' as const },
  { label: 'Família', value: 'familia' as const },
  { label: 'Perseverança', value: 'perseveranca' as const },
  { label: 'Serviço', value: 'servico' as const },
  { label: 'Humildade', value: 'humildade' as const },
];

export type FormState = {
  handle: string;
  preferred_send_time: '' | OnboardingPayload['preferred_send_time'];
  onboarding_complete: boolean;
  employment_status: string;
  education_level: string;
  family_status: string;
  living_with: string;
  income_bracket: string;
  religion: string;
  moral_values: string[];
};

const defaultFormState: FormState = {
  handle: '',
  preferred_send_time: '08:00',
  onboarding_complete: false,
  employment_status: '',
  education_level: '',
  family_status: '',
  living_with: '',
  income_bracket: '',
  religion: '',
  moral_values: [],
};

export const toggleMoralValueSelection = (currentValues: string[], value: string) =>
  currentValues.includes(value)
    ? currentValues.filter((item) => item !== value)
    : [...currentValues, value];

export const buildOnboardingPayload = (formState: FormState): OnboardingPayload => ({
  handle: formState.handle.trim(),
  preferred_send_time: (formState.preferred_send_time || '08:00') as OnboardingPayload['preferred_send_time'],
  employment_status: formState.employment_status || null,
  education_level: formState.education_level || null,
  family_status: formState.family_status || null,
  living_with: formState.living_with || null,
  income_bracket: formState.income_bracket || null,
  religion: formState.religion || null,
  moral_values: Array.isArray(formState.moral_values) ? formState.moral_values : [],
});

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

  const fetchUserData = useCallback(async () => {
    if (!userEmail) {
      return;
    }

    const { data, error } = await supabase
      .from('subscribers')
      .select(
        `
          handle,
          preferred_send_time,
          onboarding_complete,
          employment_status,
          education_level,
          users (
            handle,
            preferred_send_time,
            onboarding_complete
          ),
          user_family_profile (
            family_status,
            living_with,
            income_bracket
          ),
          user_moral_profile (
            religion,
            moral_values
          )
        `,
      )
      .eq('email', userEmail)
      .single();

    if (error) {
      console.error('Erro ao carregar dados do usuário', error);
      return;
    }

    const familyProfile = Array.isArray(data?.user_family_profile)
      ? data?.user_family_profile[0]
      : data?.user_family_profile;

    const moralProfile = Array.isArray(data?.user_moral_profile)
      ? data?.user_moral_profile[0]
      : data?.user_moral_profile;

    setFormState((prev) => ({
      ...prev,
      handle: (data?.handle ?? data?.users?.handle ?? '').trim(),
      preferred_send_time: data?.preferred_send_time?.slice(0, 5) ?? '08:00',
      onboarding_complete: data?.onboarding_complete ?? data?.users?.onboarding_complete ?? false,
      employment_status: data?.employment_status ?? '',
      education_level: data?.education_level ?? '',
      family_status: familyProfile?.family_status ?? '',
      living_with: familyProfile?.living_with ?? '',
      income_bracket: familyProfile?.income_bracket ?? '',
      religion: moralProfile?.religion ?? '',
      moral_values: moralProfile?.moral_values ?? [],
    }));
  }, [userEmail]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const validate = () => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    const trimmedHandle = formState.handle.trim();

    if (!trimmedHandle) {
      newErrors.handle = 'Informe um apelido ou forma de tratamento.';
    }

    if (!/^\d{2}:\d{2}$/.test(formState.preferred_send_time)) {
      newErrors.preferred_send_time = 'Escolha um horário válido no formato HH:MM.';
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

    const payload = buildOnboardingPayload(formState);

    setSubmitting(true);

    try {
      const { error } = await supabase.rpc('rpc_update_web_onboarding', {
        p_email: userEmail,
        p_payload: payload,
      });

      if (error) {
        throw error;
      }

      await fetchUserData();
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

  const toggleMoralValue = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      moral_values: toggleMoralValueSelection(prev.moral_values, value),
    }));
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
          {formState.onboarding_complete ? (
            <span className="inline-flex items-center gap-2 mt-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
              <CheckCircle2 className="w-4 h-4" />
              Perfil completo
            </span>
          ) : (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 mt-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Onboarding pendente</span>
            </div>
          )}
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
            <p className="text-xs uppercase font-semibold text-blue-600 tracking-wide">Perfil</p>
            <h3 className="text-lg font-semibold text-gray-900">Sua rotina e contexto</h3>
            <p className="text-sm text-gray-600">Esses dados ajudam a adaptar exemplos e referências do conteúdo.</p>
          </header>

          <div className="field-stack">
            <label className="space-y-1" htmlFor="employment_status">
              <span className="font-medium text-gray-800">Situação profissional</span>
              <select
                id="employment_status"
                name="employment_status"
                value={formState.employment_status}
                onChange={(e) => updateField('employment_status', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione uma opção</option>
                {employmentStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="education_level">
              <span className="font-medium text-gray-800">Escolaridade</span>
              <select
                id="education_level"
                name="education_level"
                value={formState.education_level}
                onChange={(e) => updateField('education_level', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione uma opção</option>
                {educationLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="family_status">
              <span className="font-medium text-gray-800">Estado civil</span>
              <select
                id="family_status"
                name="family_status"
                value={formState.family_status}
                onChange={(e) => updateField('family_status', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione uma opção</option>
                {familyStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="living_with">
              <span className="font-medium text-gray-800">Com quem você mora?</span>
              <select
                id="living_with"
                name="living_with"
                value={formState.living_with}
                onChange={(e) => updateField('living_with', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione uma opção</option>
                {livingWithOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1" htmlFor="income_bracket">
              <span className="font-medium text-gray-800">Faixa de renda familiar</span>
              <select
                id="income_bracket"
                name="income_bracket"
                value={formState.income_bracket}
                onChange={(e) => updateField('income_bracket', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione uma opção</option>
                {incomeBracketOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">Usamos apenas para personalizar exemplos e sugestões.</p>
            </label>

            <label className="space-y-1" htmlFor="religion">
              <span className="font-medium text-gray-800">Caminho de fé</span>
              <select
                id="religion"
                name="religion"
                value={formState.religion}
                onChange={(e) => updateField('religion', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecione uma opção</option>
                {religionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="font-medium text-gray-800">Valores que guiam suas escolhas</legend>
              <p className="text-sm text-gray-600">Selecione quantos quiser para ajustar o tom das mensagens.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {moralValuesOptions.map((option) => {
                  const checked = formState.moral_values.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:border-blue-300"
                    >
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={checked}
                        onChange={() => toggleMoralValue(option.value)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
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
