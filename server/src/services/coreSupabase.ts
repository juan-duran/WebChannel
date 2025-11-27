import { PostgrestMaybeSingleResponse, createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export type OnboardingProfile = {
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

export type OnboardingPayload = {
  handle: string;
  preferred_send_time: string | null;
  moral_values: string[];
  employment_status: string | null;
  education_level: string | null;
  family_status: string | null;
  living_with: string | null;
  income_bracket: string | null;
  religion: string | null;
};

type SubscriberRecord = {
  id: number;
  email: string;
  active: boolean;
  user_id: string | null;
  users?: unknown;
};

class CoreSupabaseService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.coreSupabase.url, config.coreSupabase.serviceKey);
    logger.info('Core Supabase client initialized');
  }

  async findSubscriberByEmail(
    email: string
  ): Promise<PostgrestMaybeSingleResponse<SubscriberRecord>> {
    try {
      return await this.client
        .from('subscribers')
        .select('*, users(*)')
        .ilike('email', email)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
    } catch (error) {
      logger.error({ error, email }, 'Failed to fetch subscriber from core');
      throw error;
    }
  }

  async getOnboardingProfile(email: string): Promise<OnboardingProfile | null> {
    try {
      const { data, error }: PostgrestMaybeSingleResponse<OnboardingProfile> = await this.client
        .rpc('rpc_get_web_onboarding', { p_email: email })
        .maybeSingle();

      if (error) throw error;
      return data ?? null;
    } catch (error) {
      logger.error({ error, email }, 'Failed to fetch onboarding profile');
      throw error;
    }
  }

  async updateOnboardingProfile(email: string, payload: OnboardingPayload): Promise<void> {
    try {
      const { error } = await this.client.rpc('rpc_update_web_onboarding', {
        p_email: email,
        p_payload: payload,
      });

      if (error) throw error;
    } catch (error) {
      logger.error({ error, email }, 'Failed to update onboarding profile');
      throw error;
    }
  }
}

export const coreSupabaseService = new CoreSupabaseService();
