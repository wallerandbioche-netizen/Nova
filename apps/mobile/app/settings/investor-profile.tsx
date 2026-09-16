import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { RISK_QUESTIONNAIRE_DISCLAIMER } from '@nova/config';
import { Button, OptionList, Screen, SectionHeader, Text, useTheme } from '@nova/ui';
import { ApiError } from '../../src/api/client';
import {
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  HORIZON_OPTIONS,
  RISK_OPTIONS,
  RISK_SCENARIO,
} from '../../src/content/onboarding';
import { useAuth } from '../../src/state/auth-context';

/**
 * Investor profile editing.
 *
 * The same questions as onboarding, editable at any time: a profile that cannot be corrected
 * becomes wrong, and NOVA's personalisation would drift with it.
 */
export default function InvestorProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { api, investorProfile, refreshSession } = useAuth();

  const [goal, setGoal] = useState(investorProfile?.investmentGoal ?? null);
  const [horizon, setHorizon] = useState(investorProfile?.investmentHorizon ?? null);
  const [experience, setExperience] = useState(investorProfile?.experienceLevel ?? null);
  const [risk, setRisk] = useState(investorProfile?.riskTolerance ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const save = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await api.profile.saveInvestor({
        investmentGoal: goal,
        investmentHorizon: horizon,
        experienceLevel: experience,
        riskTolerance: risk,
        interestedAssetTypes: investorProfile?.interestedAssetTypes ?? ['etf'],
      });
      await refreshSession();
      router.back();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Le profil n’a pas pu être enregistré.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      title="Profil investisseur"
      footer={
        <Button
          label="Enregistrer"
          fullWidth
          loading={submitting}
          disabled={!goal || !horizon || !experience || !risk}
          onPress={save}
        />
      }
    >
      <View style={{ gap: theme.spacing.xl }}>
        <View>
          <SectionHeader title="Objectif" />
          <OptionList options={GOAL_OPTIONS} value={goal} onChange={setGoal as (v: string) => void} />
        </View>

        <View>
          <SectionHeader title="Horizon" />
          <OptionList
            options={HORIZON_OPTIONS}
            value={horizon}
            onChange={setHorizon as (v: string) => void}
          />
        </View>

        <View>
          <SectionHeader title="Expérience" />
          <OptionList
            options={EXPERIENCE_OPTIONS}
            value={experience}
            onChange={setExperience as (v: string) => void}
          />
        </View>

        <View>
          <SectionHeader title="Tolérance aux fluctuations" subtitle={RISK_SCENARIO} />
          <OptionList options={RISK_OPTIONS} value={risk} onChange={setRisk as (v: string) => void} />
        </View>

        <Text variant="caption" color="tertiary">
          {RISK_QUESTIONNAIRE_DISCLAIMER}
        </Text>

        {error ? (
          <Text variant="small" color="negative" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
