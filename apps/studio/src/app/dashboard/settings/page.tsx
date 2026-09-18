import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/utils';
import { DeleteAccountButton } from '@/components/dashboard/delete-account-button';

export default async function SettingsPage() {
  const user = await requireUser();
  const [account, counts] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { email: true, name: true, createdAt: true },
    }),
    prisma.$transaction([
      prisma.listing.count({ where: { userId: user.id } }),
      prisma.video.count({ where: { userId: user.id } }),
    ]),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-950">Paramètres</h1>

      <Card>
        <CardHeader>
          <CardTitle>Compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">E-mail</span>
            <span className="text-ink-900">{account.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Nom</span>
            <span className="text-ink-900">{account.name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Inscription</span>
            <span className="text-ink-900">{formatDate(account.createdAt)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vos données</CardTitle>
          <CardDescription>
            Vos photos et vos vidéos sont privées et servies par des liens temporaires signés.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-500">Annonces importées</span>
            <span className="tabular-nums text-ink-900">{counts[0]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Vidéos</span>
            <span className="tabular-nums text-ink-900">{counts[1]}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-red-200">
        <CardHeader>
          <CardTitle>Supprimer mon compte</CardTitle>
          <CardDescription>
            Supprime définitivement le compte, les annonces importées, les photos et les vidéos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountButton />
        </CardContent>
      </Card>
    </div>
  );
}
