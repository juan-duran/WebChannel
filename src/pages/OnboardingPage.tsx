import type { FocusEvent, FormEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { OnboardingPayload } from '../types/onboarding';

type ValueMap = Record<string, string>;

type OnboardingProfile = {
  user_email: string | null;
  handle: string | null;
  preferred_send_time: string | null;
  onboarding_complete: boolean | null;
  employment_status: string | null;
  education_level: string | null;
  family_status: string | null;
  living_with: string | null;
  income_bracket: string | null;
  religion: string | null;
  moral_values: string[] | null;
};

const employmentStatusValueMap: ValueMap = {
  desempregado: 'desempregado',
  estudante: 'estudante',
  meio_periodo: 'meio_periodo',
  tempo_integral: 'tempo_integral',
  aposentado: 'aposentado',
};

const employmentStatusBackendAliases: ValueMap = {
  unemployed: 'desempregado',
  student: 'estudante',
  part_time: 'meio_periodo',
  full_time: 'tempo_integral',
  retired: 'aposentado',
};

const employmentStatusOptions = [
  { label: 'Desempregado(a)', value: 'desempregado' as const },
  { label: 'Estudante', value: 'estudante' as const },
  { label: 'Trabalho meio período', value: 'meio_periodo' as const },
  { label: 'Trabalho em tempo integral', value: 'tempo_integral' as const },
  { label: 'Aposentado(a)', value: 'aposentado' as const },
];

const educationLevelValueMap: ValueMap = {
  nenhum: 'nenhum',
  fundamental: 'fundamental',
  medio: 'medio',
  graduacao: 'graduacao',
  mestrado: 'mestrado',
  doutorado: 'doutorado',
  outros: 'outros',
};

const educationLevelBackendAliases: ValueMap = {
  none: 'nenhum',
  primary: 'fundamental',
  secondary: 'medio',
  bachelors: 'graduacao',
  masters: 'mestrado',
  doctorate: 'doutorado',
  other: 'outros',
};

const educationLevelOptions = [
  { label: 'Nenhum', value: 'nenhum' as const },
  { label: 'Ensino fundamental', value: 'fundamental' as const },
  { label: 'Ensino médio', value: 'medio' as const },
  { label: 'Graduação', value: 'graduacao' as const },
  { label: 'Mestrado', value: 'mestrado' as const },
  { label: 'Doutorado', value: 'doutorado' as const },
  { label: 'Outros', value: 'outros' as const },
];

const familyStatusValueMap: ValueMap = {
  solteiro: 'solteiro',
  casado: 'casado',
  divorciado: 'divorciado',
  viuvo: 'viuvo',
  uniao_estavel: 'uniao_estavel',
};

const familyStatusBackendAliases: ValueMap = {
  single: 'solteiro',
  married: 'casado',
  divorced: 'divorciado',
  widowed: 'viuvo',
  civil_union: 'uniao_estavel',
};

const familyStatusOptions = [
  { label: 'Solteiro(a)', value: 'solteiro' as const },
  { label: 'Casado(a)', value: 'casado' as const },
  { label: 'Divorciado(a)', value: 'divorciado' as const },
  { label: 'Viúvo(a)', value: 'viuvo' as const },
  { label: 'União estável', value: 'uniao_estavel' as const },
];

const livingWithValueMap: ValueMap = {
  sozinho: 'sozinho',
  parceiro: 'parceiro',
  filhos: 'filhos',
  familia_extensa: 'familia_extensa',
  colegas_quarto: 'colegas_quarto',
  outro: 'outro',
};

const livingWithBackendAliases: ValueMap = {
  alone: 'sozinho',
  partner: 'parceiro',
  children: 'filhos',
  extended_family: 'familia_extensa',
  roommates: 'colegas_quarto',
  other: 'outro',
};

const livingWithOptions = [
  { label: 'Moro sozinho(a)', value: 'sozinho' as const },
  { label: 'Com parceiro(a)', value: 'parceiro' as const },
  { label: 'Com filhos', value: 'filhos' as const },
  { label: 'Com família extensa', value: 'familia_extensa' as const },
  { label: 'Com colegas de quarto', value: 'colegas_quarto' as const },
  { label: 'Outro arranjo', value: 'outro' as const },
];

const incomeBracketValueMap: ValueMap = {
  baixa: 'baixa',
  media_baixa: 'media_baixa',
  media: 'media',
  media_alta: 'media_alta',
  alta: 'alta',
};

const incomeBracketBackendAliases: ValueMap = {
  low: 'baixa',
  lower_middle: 'media_baixa',
  middle: 'media',
  upper_middle: 'media_alta',
  high: 'alta',
};

const incomeBracketOptions = [
  { label: 'Baixa', value: 'baixa' as const },
  { label: 'Média-baixa', value: 'media_baixa' as const },
  { label: 'Média', value: 'media' as const },
  { label: 'Média-alta', value: 'media_alta' as const },
  { label: 'Alta', value: 'alta' as const },
];

const religionValueMap: ValueMap = {
  catolico: 'catolico',
  protestante: 'protestante',
  evangelico: 'evangelico',
  espirita: 'espirita',
  umbanda: 'umbanda',
  candomble: 'candomble',
  judaico: 'judaico',
  islamico: 'islamico',
  budista: 'budista',
  hindu: 'hindu',
  ateu: 'ateu',
  agnostico: 'agnostico',
  outros: 'outros',
};

const religionBackendAliases: ValueMap = {
  catholic: 'catolico',
  protestant: 'protestante',
  evangelical: 'evangelico',
  spiritist: 'espirita',
  umbanda: 'umbanda',
  candomble: 'candomble',
  jewish: 'judaico',
  islamic: 'islamico',
  buddhist: 'budista',
  hindu: 'hindu',
  atheist: 'ateu',
  agnostic: 'agnostico',
  other: 'outros',
};

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

const moralValuesValueMap: ValueMap = {
  fe: 'fe',
  honestidade: 'honestidade',
  respeito: 'respeito',
  responsabilidade: 'responsabilidade',
  compaixao: 'compaixao',
  justica: 'justica',
  familia: 'familia',
  perseveranca: 'perseveranca',
  servico: 'servico',
  humildade: 'humildade',
};

const moralValuesBackendAliases: ValueMap = {
  faith: 'fe',
  honesty: 'honestidade',
  respect: 'respeito',
  responsibility: 'responsabilidade',
  compassion: 'compaixao',
  justice: 'justica',
  family: 'familia',
  perseverance: 'perseveranca',
  service: 'servico',
  humility: 'humildade',
};

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
  preferred_send_time_opt_out: boolean;
  onboarding_complete: boolean;
  employment_status: string;
  education_level: string;
  family_status: string;
  living_with: string;
  income_bracket: string;
  religion: string;
  moral_values: string[];
};

const invertValueMap = (map: ValueMap): ValueMap =>
  Object.fromEntries(Object.entries(map).map(([uiValue, backendValue]) => [backendValue, uiValue]));

const normalizePreferredSendTime = (value: string | null | undefined) => {
  if (!value) return '';

  const trimmed = value.trim();

  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed.slice(0, 5);
  if (/^\d{1,2}$/.test(trimmed)) return `${trimmed.padStart(2, '0')}:00`;

  return trimmed;
};

const mapValueFromBackend = (
  value: string | null | undefined,
  map: ValueMap,
  aliases: ValueMap = {},
) => {
  if (!value) return '';
  if (aliases[value]) return aliases[value];
  const inverse = invertValueMap(map);
  if (inverse[value]) return inverse[value];
  return map[value] ? value : '';
};

const mapValueToBackend = (value: string, map: ValueMap) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) return null;
  return map[normalizedValue] ?? normalizedValue;
};

const mapArrayFromBackend = (values: string[] | null | undefined, map: ValueMap, aliases: ValueMap = {}) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((entry) => mapValueFromBackend(entry, map, aliases))
    .filter((entry): entry is string => Boolean(entry));
};

const mapArrayToBackend = (values: string[], map: ValueMap) =>
  Array.isArray(values)
    ? values
        .map((value) => mapValueToBackend(value, map))
        .filter((entry): entry is string => Boolean(entry))
    : [];

const defaultFormState: FormState = {
  handle: '',
  preferred_send_time: '',
  preferred_send_time_opt_out: false,
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

export const hasCompletedOnboarding = (
  state: Pick<
    FormState,
    | 'handle'
    | 'preferred_send_time'
    | 'preferred_send_time_opt_out'
    | 'employment_status'
    | 'education_level'
    | 'family_status'
    | 'living_with'
    | 'income_bracket'
    | 'religion'
    | 'moral_values'
  >,
) => {
  const trimmedHandle = state.handle?.trim();
  const preferredSendTimeOptOut = Boolean(state.preferred_send_time_opt_out);
  const preferredSendTime = normalizePreferredSendTime(state.preferred_send_time);

  const hasPreferredSendTime = preferredSendTimeOptOut || Boolean(preferredSendTime);

  return Boolean(
    trimmedHandle &&
      hasPreferredSendTime &&
      state.employment_status &&
      state.education_level &&
      state.family_status &&
      state.living_with &&
      state.income_bracket &&
      state.religion &&
      state.moral_values?.length,
  );
};

export const buildOnboardingPayload = (formState: FormState): OnboardingPayload => {
  const normalizedPreferredSendTime = normalizePreferredSendTime(formState.preferred_send_time);

  return {
    handle: formState.handle.trim(),
    preferred_send_time: formState.preferred_send_time_opt_out
      ? null
      : normalizedPreferredSendTime || null,
    employment_status: mapValueToBackend(formState.employment_status, employmentStatusValueMap),
    education_level: mapValueToBackend(formState.education_level, educationLevelValueMap),
    family_status: mapValueToBackend(formState.family_status, familyStatusValueMap),
    living_with: mapValueToBackend(formState.living_with, livingWithValueMap),
    income_bracket: mapValueToBackend(formState.income_bracket, incomeBracketValueMap),
    religion: mapValueToBackend(formState.religion, religionValueMap),
    moral_values: mapArrayToBackend(formState.moral_values, moralValuesValueMap),
  };
};

export function OnboardingPage() {
  const { user, session } = useAuth();
  const userEmail = user?.email ?? '';
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);

  const openPreferredTimePicker = useCallback(
    (event: MouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) =>
      event.currentTarget.showPicker?.(),
    [],
  );

  const onboardingComplete = useMemo(() => hasCompletedOnboarding(formState), [formState]);

  const isEmailMissing = useMemo(() => !userEmail, [userEmail]);

  const fetchUserData = useCallback(async () => {
    setIsOnboardingLoading(true);

    if (!userEmail) {
      setIsOnboardingLoading(false);
      return;
    }

    if (!session?.access_token) {
      setIsOnboardingLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/onboarding', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorMessage = await response.text().catch(() => '');
        console.info('Dados de onboarding indisponíveis, ignorando carregamento.', errorMessage);
        setStatus({
          type: 'error',
          message: 'Não foi possível carregar seus dados de onboarding. Tente novamente ou fale com o suporte.',
        });
        return;
      }

      const { data } = (await response.json()) as { data: OnboardingProfile | null };

      if (!data) {
        return;
      }

      setFormState((prev) => {
        const normalizedHandle = (data?.handle ?? '').trim();
        const normalizedPreferredTime = normalizePreferredSendTime(data?.preferred_send_time);
        const preferredSendTimeOptOut = data?.preferred_send_time === null;
        const employmentStatus = mapValueFromBackend(
          data?.employment_status,
          employmentStatusValueMap,
          employmentStatusBackendAliases,
        );
        const educationLevel = mapValueFromBackend(
          data?.education_level,
          educationLevelValueMap,
          educationLevelBackendAliases,
        );
        const familyStatus = mapValueFromBackend(
          data?.family_status,
          familyStatusValueMap,
          familyStatusBackendAliases,
        );
        const livingWith = mapValueFromBackend(data?.living_with, livingWithValueMap, livingWithBackendAliases);
        const incomeBracket = mapValueFromBackend(
          data?.income_bracket,
          incomeBracketValueMap,
          incomeBracketBackendAliases,
        );
        const religion = mapValueFromBackend(data?.religion, religionValueMap, religionBackendAliases);
        const moralValues = mapArrayFromBackend(
          data?.moral_values,
          moralValuesValueMap,
          moralValuesBackendAliases,
        );

        const nextState = {
          ...prev,
          handle: normalizedHandle,
          preferred_send_time: normalizedPreferredTime,
          preferred_send_time_opt_out: preferredSendTimeOptOut,
          employment_status: employmentStatus,
          education_level: educationLevel,
          family_status: familyStatus,
          living_with: livingWith,
          income_bracket: incomeBracket,
          religion,
          moral_values: moralValues,
        };

        return {
          ...nextState,
          onboarding_complete: hasCompletedOnboarding(nextState),
        };
      });
    } catch (error) {
      console.error('Erro ao carregar dados de onboarding', error);
      setStatus({
        type: 'error',
        message: 'Não foi possível carregar seus dados de onboarding. Tente novamente ou fale com o suporte.',
      });
    } finally {
      setIsOnboardingLoading(false);
    }
  }, [session?.access_token, userEmail]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const validate = () => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};
    const trimmedHandle = formState.handle.trim();
    const preferredTime = normalizePreferredSendTime(formState.preferred_send_time);

    if (!trimmedHandle) {
      newErrors.handle = 'Informe um apelido ou forma de tratamento.';
    }

    if (!formState.preferred_send_time_opt_out && !/^\d{2}:\d{2}$/.test(preferredTime)) {
      newErrors.preferred_send_time = 'Informe um horário válido no formato HH:mm.';
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
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ payload }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const message = typeof errorBody.error === 'string'
          ? errorBody.error
          : 'Não foi possível salvar suas preferências. Tente novamente.';
        throw new Error(message);
      }

      setFormState((prev) => ({
        ...prev,
        onboarding_complete: hasCompletedOnboarding(prev),
      }));
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

  const togglePreferredSendTimeOptOut = (optOut: boolean) => {
    setFormState((prev) => ({
      ...prev,
      preferred_send_time_opt_out: optOut,
      preferred_send_time: optOut ? '' : prev.preferred_send_time,
    }));

    if (optOut) {
      setErrors((prev) => {
        const { preferred_send_time, ...rest } = prev;
        return rest;
      });
    }
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
          {isOnboardingLoading ? (
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 mt-2">
              <span className="h-2 w-2 rounded-full bg-gray-400 animate-pulse" aria-hidden />
              <span>Carregando status...</span>
            </div>
          ) : onboardingComplete ? (
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

      {status.type && (
        <div
          className={`mb-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
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

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="space-y-1" htmlFor="preferred_send_time">
                  <span className="font-medium text-gray-800">Horário preferido para receber mensagens</span>
                  <p className="text-sm text-gray-600">Selecione um horário para receber o lembrete diário.</p>
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={formState.preferred_send_time_opt_out}
                    onChange={(e) => togglePreferredSendTimeOptOut(e.target.checked)}
                  />
                  <span>Não quero receber mensagens diárias</span>
                </label>
              </div>

              <input
                id="preferred_send_time"
                name="preferred_send_time"
                type="time"
                value={formState.preferred_send_time ?? ''}
                onClick={openPreferredTimePicker}
                onFocus={openPreferredTimePicker}
                onChange={(e) =>
                  updateField('preferred_send_time', normalizePreferredSendTime(e.target.value))
                }
                className={`w-full min-w-0 appearance-none rounded-lg border px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 ${
                  errors.preferred_send_time ? 'border-red-400' : 'border-gray-200'
                }`}
                disabled={formState.preferred_send_time_opt_out}
                aria-disabled={formState.preferred_send_time_opt_out}
                placeholder="HH:mm"
                required={!formState.preferred_send_time_opt_out}
              />
              {errors.preferred_send_time && (
                <p className="flex items-center gap-1 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" /> {errors.preferred_send_time}
                </p>
              )}
            </div>
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
