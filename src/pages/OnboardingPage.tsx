import type { FocusEvent, FormEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useCurrentUser } from '../state/UserContext';
import { useOnboardingStatus } from '../state/OnboardingStatusContext';
import type { OnboardingPayload } from '../types/onboarding';
import { enableNotifications } from '../lib/pushNotifications';
import { useWebpushStatus } from '../hooks/useWebpushStatus';

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
  const preferredSendTime = normalizePreferredSendTime(state.preferred_send_time);
  const hasPreferredSendTime = state.preferred_send_time_opt_out || Boolean(preferredSendTime);

  const requiredFields = [
    state.employment_status,
    state.education_level,
    state.family_status,
    state.living_with,
    state.income_bracket,
    state.religion,
  ];
  const hasMandatoryFields = requiredFields.every(Boolean);
  const hasMoralValues = Array.isArray(state.moral_values) && state.moral_values.length > 0;

  return Boolean(trimmedHandle && hasPreferredSendTime && hasMandatoryFields && hasMoralValues);
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
  const { email: userEmail } = useCurrentUser();
  const { refresh: refreshOnboardingStatus } = useOnboardingStatus();
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(true);
  const { enabled: pushEnabled, refresh: refreshPushStatus } = useWebpushStatus({ auto: false });
  const [pushDismissed, setPushDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('webpush_asked_after_onboarding') === 'true';
    } catch {
      return false;
    }
  });
  const [pushCtaLoading, setPushCtaLoading] = useState(false);
  const [pushCtaError, setPushCtaError] = useState<string | null>(null);
  const [redirectScheduled, setRedirectScheduled] = useState(false);

  useEffect(() => {
    if (!pushDismissed) {
      refreshPushStatus();
    }
  }, [pushDismissed, refreshPushStatus]);

  const openPreferredTimePicker = useCallback(
    (event: MouseEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>) =>
      event.currentTarget.showPicker?.(),
    [],
  );

  const isEmailMissing = useMemo(() => !userEmail, [userEmail]);
  const onboardingComplete = useMemo(() => hasCompletedOnboarding(formState), [formState]);

  const fetchUserData = useCallback(async () => {
    setIsOnboardingLoading(true);

    if (!userEmail) {
      setIsOnboardingLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/onboarding', { credentials: 'include' });

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
        const employment_status = mapValueFromBackend(
          data?.employment_status,
          employmentStatusValueMap,
          employmentStatusBackendAliases,
        );
        const education_level = mapValueFromBackend(
          data?.education_level,
          educationLevelValueMap,
          educationLevelBackendAliases,
        );
        const family_status = mapValueFromBackend(
          data?.family_status,
          familyStatusValueMap,
          familyStatusBackendAliases,
        );
        const living_with = mapValueFromBackend(data?.living_with, livingWithValueMap, livingWithBackendAliases);
        const income_bracket = mapValueFromBackend(
          data?.income_bracket,
          incomeBracketValueMap,
          incomeBracketBackendAliases,
        );
        const religion = mapValueFromBackend(data?.religion, religionValueMap, religionBackendAliases);
        const moral_values = mapArrayFromBackend(
          data?.moral_values,
          moralValuesValueMap,
          moralValuesBackendAliases,
        );

        const nextState = {
          ...prev,
          handle: normalizedHandle,
          preferred_send_time: normalizedPreferredTime,
          preferred_send_time_opt_out: preferredSendTimeOptOut,
          employment_status,
          education_level,
          family_status,
          living_with,
          income_bracket,
          religion,
          moral_values,
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
  }, [userEmail]);

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
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
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
      await refreshOnboardingStatus();

      const completedNow = hasCompletedOnboarding({
        ...formState,
        onboarding_complete: true,
      });
      if (completedNow && !redirectScheduled) {
        setRedirectScheduled(true);
        // Redireciona para /tap após breve delay para o usuário ver a confirmação
        window.setTimeout(() => {
          window.history.pushState(null, '', '/tap');
          window.dispatchEvent(new PopStateEvent('popstate'));
        }, 1200);
      }
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

  const handlePushDismiss = useCallback(() => {
    setPushDismissed(true);
    try {
      localStorage.setItem('webpush_asked_after_onboarding', 'true');
    } catch {
      // ignore storage errors
    }
  }, []);

  const handlePushEnable = useCallback(async () => {
    setPushCtaLoading(true);
    setPushCtaError(null);
    try {
      await enableNotifications();
      await refreshPushStatus();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível ativar notificações.';
      setPushCtaError(message);
    } finally {
      setPushCtaLoading(false);
    }
  }, [refreshPushStatus]);

  const pushPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'default';
  const showPushCta = !pushDismissed && (pushEnabled === false || pushPermission !== 'granted');

  return (
    <div className="py-6 sm:relative">
      <div className="bg-white border-[3px] border-black shadow-brutal p-4 sm:p-6 mb-5">
        <div className="space-y-3">
          <p className="text-xs font-mono font-bold text-brutal-orange uppercase tracking-widest">Seu perfil</p>
          <h2 className="text-2xl font-mono font-extrabold text-black uppercase tracking-tight">Personalização do Quenty AI</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            Conte um pouco sobre você para que o Quenty adapte os resumos ao seu mundo. Usamos essas informações para
            calibrar os 3 pilares de consciência artificial — quem você é, no que você acredita e o ambiente ao seu
            redor — e assim escolher exemplos, linguagem e debates que façam sentido para a sua rotina. Nada de feed
            genérico: quanto melhor você se descreve aqui, mais precisas e úteis ficam as sugestões e conversas que o
            Quenty prepara para você.
          </p>
          {isOnboardingLoading ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 border-2 border-black text-black text-xs font-mono font-bold mt-2">
              <span className="h-2 w-2 bg-black animate-pulse" aria-hidden />
              <span className="uppercase">Carregando status...</span>
            </div>
          ) : onboardingComplete ? (
            <span className="inline-flex items-center gap-2 mt-2 px-3 py-2 bg-green-100 border-2 border-black text-green-700 text-xs font-mono font-bold uppercase shadow-[2px_2px_0_0_#22c55e]">
              <CheckCircle2 className="w-4 h-4" />
              Perfil completo
            </span>
          ) : (
            <div className="inline-flex items-center gap-2 mt-2 px-3 py-2 bg-brutal-yellow border-2 border-black text-black text-xs font-mono font-bold uppercase shadow-[2px_2px_0_0_#000000]">
              <AlertCircle className="w-4 h-4" />
              <span>Onboarding pendente</span>
            </div>
          )}
        </div>
      </div>

      {status.type && (
        <div
          className={`mb-5 flex items-start gap-3 border-[3px] px-4 py-4 ${
            status.type === 'success'
              ? 'bg-green-50 border-green-600 shadow-[4px_4px_0_0_#22c55e]'
              : 'bg-red-50 border-red-600 shadow-[4px_4px_0_0_#ef4444]'
          }`}
        >
          <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center border-2 border-black ${status.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {status.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1">
            <p className={`font-mono font-bold uppercase text-sm ${status.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {status.type === 'success' ? 'Tudo certo!' : 'Ops, algo deu errado'}
            </p>
            <p className={`text-sm ${status.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{status.message}</p>
          </div>
        </div>
      )}

      {showPushCta && (
        <div className="mb-5 bg-white border-[3px] border-black p-4 shadow-brutal">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-brutal-orange border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000000]">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <p className="font-mono font-bold text-black uppercase text-sm">
                Último passo: ative as notificações
              </p>
              <p className="text-xs text-gray-700">
                Sem notificações ativas não conseguimos entregar as 15 notícias do dia para você. Habilite o alerta do navegador para ser avisado assim que o resumo ficar pronto.
              </p>
              {pushCtaError && <p className="text-xs font-mono font-bold text-red-600">{pushCtaError}</p>}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePushEnable}
                  disabled={pushCtaLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-black border-2 border-black text-white text-xs font-mono font-bold uppercase shadow-[3px_3px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {pushCtaLoading ? 'Ativando...' : 'Ativar notificações'}
                </button>
                <button
                  type="button"
                  onClick={handlePushDismiss}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-black text-black text-xs font-mono font-bold uppercase shadow-[3px_3px_0_0_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#000000] transition-all"
                >
                  Pular agora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 pb-28 sm:pb-32 sm:relative">
        <section className="bg-white border-[3px] border-black p-4 sm:p-6 shadow-brutal">
          <header className="flex flex-col gap-2 mb-5">
            <p className="text-xs font-mono font-bold text-brutal-orange uppercase tracking-widest">
              Informações básicas
            </p>
            <h3 className="text-lg font-mono font-bold text-black uppercase">Como podemos te chamar?</h3>
            <p className="text-sm text-gray-600">
              Usaremos esse nome para te enviar conteúdos e sugestões personalizadas.
            </p>
          </header>

          <div className="space-y-4">
            <label className="block space-y-2" htmlFor="handle">
              <span className="font-mono font-bold text-black text-sm uppercase">Apelido ou forma de tratamento</span>
              <input
                id="handle"
                name="handle"
                type="text"
                value={formState.handle}
                onChange={(e) => updateField('handle', e.target.value)}
                className={`w-full border-2 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brutal-yellow ${
                  errors.handle ? 'border-red-500' : 'border-black'
                }`}
                placeholder="Ex.: João e Ana Silva"
                maxLength={80}
                required
              />
              {errors.handle && (
                <p className="flex items-center gap-1 text-sm font-mono text-red-600">
                  <AlertCircle className="w-4 h-4" /> {errors.handle}
                </p>
              )}
            </label>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <label className="block space-y-2" htmlFor="preferred_send_time">
                  <span className="font-mono font-bold text-black text-sm uppercase">Horário preferido para mensagens</span>
                  <p className="text-sm text-gray-600">Selecione um horário para receber o lembrete diário.</p>
                </label>
                <label className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 border-2 border-black text-sm font-mono font-bold text-black cursor-pointer hover:bg-brutal-yellow transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 border-2 border-black bg-white text-black focus:ring-brutal-yellow accent-black"
                    checked={formState.preferred_send_time_opt_out}
                    onChange={(e) => togglePreferredSendTimeOptOut(e.target.checked)}
                  />
                  <span>Não quero mensagens diárias</span>
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
                className={`w-full min-w-0 appearance-none border-2 bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brutal-yellow disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 ${
                  errors.preferred_send_time ? 'border-red-500' : 'border-black'
                }`}
                disabled={formState.preferred_send_time_opt_out}
                aria-disabled={formState.preferred_send_time_opt_out}
                placeholder="HH:mm"
                required={!formState.preferred_send_time_opt_out}
              />
              {errors.preferred_send_time && (
                <p className="flex items-center gap-1 text-sm font-mono text-red-600">
                  <AlertCircle className="w-4 h-4" /> {errors.preferred_send_time}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="bg-white border-[3px] border-black p-4 sm:p-6 shadow-brutal">
          <header className="flex flex-col gap-2 mb-5">
            <p className="text-xs font-mono font-bold text-brutal-orange uppercase tracking-widest">Perfil</p>
            <h3 className="text-lg font-mono font-bold text-black uppercase">Sua rotina e contexto</h3>
            <p className="text-sm text-gray-600">Esses dados ajudam a adaptar exemplos e referências do conteúdo.</p>
          </header>

          <div className="space-y-4">
            <label className="block space-y-2" htmlFor="employment_status">
              <span className="font-mono font-bold text-black text-sm uppercase">Situação profissional</span>
              <select
                id="employment_status"
                name="employment_status"
                value={formState.employment_status}
                onChange={(e) => updateField('employment_status', e.target.value)}
                className="w-full border-2 border-black bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brutal-yellow"
              >
                <option value="">Selecione uma opção</option>
                {employmentStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2" htmlFor="education_level">
              <span className="font-mono font-bold text-black text-sm uppercase">Escolaridade</span>
              <select
                id="education_level"
                name="education_level"
                value={formState.education_level}
                onChange={(e) => updateField('education_level', e.target.value)}
                className="w-full border-2 border-black bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brutal-yellow"
              >
                <option value="">Selecione uma opção</option>
                {educationLevelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2" htmlFor="family_status">
              <span className="font-mono font-bold text-black text-sm uppercase">Estado civil</span>
              <select
                id="family_status"
                name="family_status"
                value={formState.family_status}
                onChange={(e) => updateField('family_status', e.target.value)}
                className="w-full border-2 border-black bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brutal-yellow"
              >
                <option value="">Selecione uma opção</option>
                {familyStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2" htmlFor="living_with">
              <span className="font-mono font-bold text-black text-sm uppercase">Com quem você mora?</span>
              <select
                id="living_with"
                name="living_with"
                value={formState.living_with}
                onChange={(e) => updateField('living_with', e.target.value)}
                className="w-full border-2 border-black bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brutal-yellow"
              >
                <option value="">Selecione uma opção</option>
                {livingWithOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2" htmlFor="income_bracket">
              <span className="font-mono font-bold text-black text-sm uppercase">Faixa de renda familiar</span>
              <select
                id="income_bracket"
                name="income_bracket"
                value={formState.income_bracket}
                onChange={(e) => updateField('income_bracket', e.target.value)}
                className="w-full border-2 border-black bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brutal-yellow"
              >
                <option value="">Selecione uma opção</option>
                {incomeBracketOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">Usamos apenas para personalizar exemplos e sugestões.</p>
            </label>

            <label className="block space-y-2" htmlFor="religion">
              <span className="font-mono font-bold text-black text-sm uppercase">Caminho de fé</span>
              <select
                id="religion"
                name="religion"
                value={formState.religion}
                onChange={(e) => updateField('religion', e.target.value)}
                className="w-full border-2 border-black bg-white px-4 py-3 text-sm text-black focus:outline-none focus:ring-2 focus:ring-brutal-yellow"
              >
                <option value="">Selecione uma opção</option>
                {religionOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-3">
              <legend className="font-mono font-bold text-black text-sm uppercase">Valores que guiam suas escolhas</legend>
              <p className="text-sm text-gray-600">Selecione quantos quiser para ajustar o tom das mensagens.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {moralValuesOptions.map((option) => {
                  const checked = formState.moral_values.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className={`flex items-center gap-3 border-2 px-4 py-3 text-sm cursor-pointer transition-all ${
                        checked
                          ? 'border-black bg-brutal-yellow shadow-[3px_3px_0_0_#000000] -translate-x-0.5 -translate-y-0.5'
                          : 'border-black bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={checked}
                        onChange={() => toggleMoralValue(option.value)}
                        className="w-5 h-5 border-2 border-black bg-white accent-black focus:ring-brutal-yellow"
                      />
                      <span className={`font-mono font-bold ${checked ? 'text-black' : 'text-gray-700'}`}>{option.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </section>
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 bg-white/95 border-t-[3px] border-black px-4 py-4 backdrop-blur pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:fixed sm:inset-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:bottom-6 sm:w-full sm:max-w-screen-md sm:px-0 sm:bg-transparent sm:border-none sm:backdrop-blur-0 sm:pb-0">
          <div className="sm:flex sm:items-center sm:justify-between sm:gap-6 sm:border-[3px] sm:border-black sm:bg-white sm:p-4 sm:shadow-brutal">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="submit"
                disabled={submitting || isEmailMissing}
                className="inline-flex w-full justify-center items-center gap-2 px-6 py-3 bg-black border-2 border-black text-white text-sm font-mono font-bold uppercase shadow-[4px_4px_0_0_#FFDD00] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_#FFDD00] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {submitting ? 'Salvando...' : 'Salvar preferências'}
              </button>
              {isEmailMissing && (
                <p className="text-sm font-mono text-red-600 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Não encontramos seu email para salvar as preferências.
                </p>
              )}
            </div>
          </div>
        </div>
        {/* Spacer to give the desktop sticky bar room to engage when scrolling */}
        <div className="hidden sm:block h-16" aria-hidden />
      </form>
    </div>
  );
}
