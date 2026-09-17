import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { AnalysisRow } from '@/components/analysis/analysis-row';
import { StatusBadge } from '@/components/ui/status-badge';
import { Disclaimer } from '@/components/layout/disclaimer';
import { getAnalysisService } from '@/server/services';
import { requireViewer } from '@/server/session';
import { getUsageSnapshot } from '@/server/usage';
import { formatPrice, formatRange, formatRiskReward, orUnknown } from '@/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const viewer = await requireViewer();
  const service = getAnalysisService();

  const [latest, recent, usage] = await Promise.all([
    service.latest(viewer.id),
    service.list(viewer.id, { limit: 5 }),
    getUsageSnapshot(viewer.id),
  ]);

  const firstName = viewer.name?.split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display font-semibold text-content">
            Bienvenue{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mt-2 text-sm text-content-muted">Prêt à scanner ton prochain chart ?</p>
        </div>
        <ButtonLink href="/analyses/nouvelle" size="lg">
          + Nouvelle analyse
        </ButtonLink>
      </div>

      {!viewer.isSubscribed && (
        <Card
          tone="raised"
          className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6"
        >
          <div>
            <p className="text-sm font-medium text-content">Ton abonnement n&apos;est pas actif</p>
            <p className="mt-1 text-sm text-content-muted">
              Scan Trade Pro donne accès à toutes les analyses, sans limite.
            </p>
          </div>
          <ButtonLink href="/abonnement">Voir l&apos;abonnement</ButtonLink>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Analyses ce mois" value={String(usage.used)} />
        <Stat label="Total" value={String(recent.total)} />
        <Stat
          label="Limite mensuelle"
          value={usage.limit == null ? 'Aucune' : `${usage.remaining} restantes`}
          muted={usage.limit == null}
        />
      </div>

      <section aria-labelledby="latest-heading">
        <Card>
          <CardHeader
            title={<span id="latest-heading">Dernière analyse</span>}
            action={
              latest ? (
                <Link
                  href={`/analyses/${latest.id}`}
                  className="text-sm text-accent underline-offset-4 hover:underline"
                >
                  Ouvrir →
                </Link>
              ) : null
            }
          />
          <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            {latest ? (
              <div className="flex flex-wrap items-start gap-5">
                <span className="h-24 w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-black/40">
                  <img
                    src={`/api/analyses/${latest.id}/image`}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-content">
                      {orUnknown(latest.asset)}
                    </span>
                    {latest.timeframe && (
                      <span className="text-sm text-content-muted">{latest.timeframe}</span>
                    )}
                    <StatusBadge status={latest.status} />
                  </div>

                  {latest.status === 'COMPLETED' ? (
                    <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                      <Field label="Entry" value={formatRange(latest.entryMin, latest.entryMax)} />
                      <Field label="SL" value={formatPrice(latest.stopLoss)} tone="danger" />
                      <Field label="TP1" value={formatPrice(latest.takeProfit1)} tone="accent" />
                      <Field label="R:R" value={formatRiskReward(latest.riskReward)} />
                    </dl>
                  ) : null}

                  {latest.summary && (
                    <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-content-muted">
                      {latest.summary}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="Tu n'as encore aucune analyse."
                description="Importe une capture de ton graphique pour obtenir ton premier plan."
                action={<ButtonLink href="/analyses/nouvelle">Analyser mon chart</ButtonLink>}
                className="border-none bg-transparent py-8"
              />
            )}
          </div>
        </Card>
      </section>

      {recent.items.length > 0 && (
        <section aria-labelledby="recent-heading">
          <Card className="overflow-hidden">
            <CardHeader
              title={<span id="recent-heading">Analyses récentes</span>}
              action={
                <Link
                  href="/historique"
                  className="text-sm text-accent underline-offset-4 hover:underline"
                >
                  Tout voir
                </Link>
              }
            />
            <div className="mt-4 divide-y divide-border border-t border-border">
              {recent.items.map((item) => (
                <AnalysisRow key={item.id} item={item} />
              ))}
            </div>
          </Card>
        </section>
      )}

      <Disclaimer />
    </div>
  );
}

function Stat({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs uppercase tracking-[0.12em] text-content-faint">{label}</p>
      <p
        className={`numeric mt-2 text-metric font-semibold ${muted ? 'text-content-muted' : 'text-content'}`}
      >
        {value}
      </p>
    </Card>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'accent' | 'danger';
}) {
  const color =
    tone === 'accent' ? 'text-accent' : tone === 'danger' ? 'text-danger' : 'text-content';
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.1em] text-content-faint">{label}</dt>
      <dd className={`numeric mt-1 text-sm font-semibold ${color}`}>{value}</dd>
    </div>
  );
}
