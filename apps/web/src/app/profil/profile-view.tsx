'use client';

import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import type { RiskProfile } from '@/types/analysis';
import type { Settings, ThemePreference } from '@/lib/storage/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { useHistory } from '@/hooks/use-history';
import { useSettings } from '@/hooks/use-settings';
import { ASSETS } from '@/lib/market-data';
import { RISK_PROFILES } from '@/lib/analysis/risk';
import { RISK_PROFILE_LABEL } from '@/lib/utils/labels';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
  { value: 'auto', label: 'Auto' },
];

const RISK_OPTIONS: { value: RiskProfile; label: string }[] = [
  { value: 'prudent', label: RISK_PROFILE_LABEL.prudent },
  { value: 'modere', label: RISK_PROFILE_LABEL.modere },
  { value: 'agressif', label: RISK_PROFILE_LABEL.agressif },
];

export function ProfileView() {
  const [settings, update] = useSettings();
  const { entries, reset } = useHistory();
  const toast = useToast();
  const profile = RISK_PROFILES[settings.riskProfile];

  const setCalibration = (patch: Partial<Settings['calibration']>) => {
    update({ calibration: { ...settings.calibration, ...patch } });
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader title="Compte" description="Identité utilisée dans l’application." />
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-soft text-[15px] font-semibold text-ink-muted">
              {settings.displayName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-ink">{settings.displayName}</p>
              <p className="truncate text-[12.5px] text-ink-muted">{settings.email}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nom affiché" htmlFor="display-name">
              <Input
                id="display-name"
                value={settings.displayName}
                onChange={(event) => update({ displayName: event.target.value })}
              />
            </Field>
            <Field label="E-mail" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(event) => update({ email: event.target.value })}
              />
            </Field>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-line bg-line">
            <div className="bg-surface px-3 py-2.5">
              <dt className="text-[11px] text-ink-subtle">Analyses réalisées</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular text-ink">
                {entries.length}
              </dd>
            </div>
            <div className="bg-surface px-3 py-2.5">
              <dt className="text-[11px] text-ink-subtle">Aujourd’hui</dt>
              <dd className="mt-0.5 text-[15px] font-semibold tabular text-ink">
                {
                  entries.filter(
                    (entry) =>
                      new Date(entry.analysis.createdAt).toDateString() ===
                      new Date().toDateString(),
                  ).length
                }
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Abonnement"
          description="Formule en cours et accès aux analyses détaillées."
          action={
            <Badge tone={settings.subscribed ? 'long' : 'muted'}>
              {settings.subscribed ? 'Actif' : 'Gratuit'}
            </Badge>
          }
        />
        <CardContent className="space-y-3">
          <p className="text-[13px] leading-5 text-ink-muted">
            {settings.subscribed
              ? 'Analyses complètes débloquées : plan de trade, raisonnement et calculateur de risque.'
              : 'Analyses illimitées — verdict directionnel visible, le reste du résultat est flouté.'}
          </p>
          <Link
            href="/abonnement"
            className="inline-flex h-10 w-full items-center justify-center rounded-[var(--radius-control)] bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
          >
            {settings.subscribed ? 'Gérer l’abonnement' : 'Débloquer l’analyse complète'}
          </Link>
          <Switch
            label="Simuler un abonnement actif"
            description="Bascule locale de démonstration : aucun paiement n’est traité."
            checked={settings.subscribed}
            onChange={(checked) => update({ subscribed: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Apparence"
          description="Suit les réglages de votre système en mode automatique."
        />
        <CardContent>
          <Segmented
            label="Thème"
            value={settings.theme}
            onChange={(value) => update({ theme: value })}
            options={THEME_OPTIONS}
            className="w-full"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Risque par défaut"
          description="Utilisé par le moteur pour filtrer les configurations et dimensionner les positions."
        />
        <CardContent className="space-y-3">
          <Segmented
            label="Profil de risque"
            value={settings.riskProfile}
            onChange={(value) => update({ riskProfile: value })}
            options={RISK_OPTIONS}
            className="w-full"
          />
          <p className="text-[12px] leading-4 text-ink-muted">
            Confluence minimum {profile.minConfluence}/10 · R/R minimum {profile.minRiskReward} ·
            stop à {profile.stopAtrMultiple} ATR · risque conseillé {profile.defaultRiskPercent} %
            du capital.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Capital" htmlFor="profile-account">
              <Input
                id="profile-account"
                type="number"
                min={0}
                value={settings.accountSize}
                onChange={(event) => update({ accountSize: Number(event.target.value) })}
              />
            </Field>
            <Field label="Risque par trade (%)" htmlFor="profile-risk">
              <Input
                id="profile-risk"
                type="number"
                min={0}
                step={0.1}
                value={settings.riskPercent}
                onChange={(event) => update({ riskPercent: Number(event.target.value) })}
              />
            </Field>
          </div>
          <Field label="Actif par défaut" htmlFor="default-asset">
            <Select
              label="Actif par défaut"
              value={settings.defaultAssetId}
              onChange={(value) => update({ defaultAssetId: value })}
              options={ASSETS.map((asset) => ({
                value: asset.id,
                label: asset.symbol,
                description: asset.name,
              }))}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader
          title="Calibrage"
          description="Ajuste le vocabulaire et le niveau de détail des explications."
        />
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Field label="Expérience" htmlFor="calibration-experience">
            <Select
              label="Expérience"
              value={settings.calibration.experience}
              onChange={(value) => setCalibration({ experience: value })}
              options={[
                { value: 'debutant' as const, label: 'Je débute, moins de 6 mois' },
                { value: 'intermediaire' as const, label: 'Entre 6 mois et 2 ans' },
                { value: 'confirme' as const, label: 'Plus de 2 ans' },
              ]}
            />
          </Field>
          <Field label="Terrain de jeu" htmlFor="calibration-playground">
            <Select
              label="Terrain de jeu"
              value={settings.calibration.playground}
              onChange={(value) => setCalibration({ playground: value })}
              options={[
                { value: 'actions' as const, label: 'Actions et ETF' },
                { value: 'crypto' as const, label: 'Crypto' },
                { value: 'forex' as const, label: 'Forex' },
                { value: 'indices' as const, label: 'Indices' },
              ]}
            />
          </Field>
          <Field label="Objectif" htmlFor="calibration-objective">
            <Select
              label="Objectif"
              value={settings.calibration.objective}
              onChange={(value) => setCalibration({ objective: value })}
              options={[
                { value: 'comprendre' as const, label: 'Comprendre mes erreurs' },
                { value: 'progresser' as const, label: 'Progresser méthodiquement' },
                { value: 'performer' as const, label: 'Affiner ma performance' },
              ]}
            />
          </Field>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader title="Données" description="Le journal est stocké dans ce navigateur." />
        <CardContent>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              toast.push({
                tone: 'info',
                title: 'Journal réinitialisé',
                description: 'Les analyses de démonstration ont été régénérées.',
              });
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Réinitialiser le journal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
