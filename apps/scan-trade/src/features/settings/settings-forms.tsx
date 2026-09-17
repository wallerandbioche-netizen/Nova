'use client';

import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { InlineError } from '@/components/ui/error-state';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/features/auth/api-client';

const MARKET_OPTIONS = [
  { value: 'CRYPTO', label: 'Crypto' },
  { value: 'FOREX', label: 'Forex' },
  { value: 'INDICES', label: 'Indices' },
  { value: 'STOCKS', label: 'Actions' },
  { value: 'COMMODITIES', label: 'Matières premières' },
  { value: 'OTHER', label: 'Autre' },
];

const STYLE_OPTIONS = [
  { value: 'SCALPING', label: 'Scalping' },
  { value: 'DAY_TRADING', label: 'Day trading' },
  { value: 'SWING_TRADING', label: 'Swing trading' },
  { value: 'OTHER', label: 'Autre' },
];

export interface ProfileFormProps {
  name: string | null;
  marketPreference: string | null;
  tradingStyle: string | null;
}

export function ProfileForm({ name, marketPreference, tradingStyle }: ProfileFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState({
    name: name ?? '',
    marketPreference: marketPreference ?? '',
    tradingStyle: tradingStyle ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await apiRequest<unknown>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        name: values.name.trim() || null,
        marketPreference: values.marketPreference || null,
        tradingStyle: values.tradingStyle || null,
      }),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    toast.success('Préférences enregistrées.');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <InlineError message={error} />}

      <Input
        label="Prénom affiché"
        value={values.name}
        onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
        maxLength={80}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Marché principal"
          value={values.marketPreference}
          onChange={(event) => setValues((current) => ({ ...current, marketPreference: event.target.value }))}
          options={MARKET_OPTIONS}
          placeholder="Non précisé"
        />
        <Select
          label="Style de trading"
          value={values.tradingStyle}
          onChange={(event) => setValues((current) => ({ ...current, tradingStyle: event.target.value }))}
          options={STYLE_OPTIONS}
          placeholder="Non précisé"
        />
      </div>

      <p className="text-xs leading-relaxed text-content-faint">
        Ces préférences cadrent la formulation de l&apos;analyse. Elles ne servent jamais à compléter une information
        absente du graphique.
      </p>

      <Button type="submit" loading={pending}>
        Enregistrer
      </Button>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!hasPassword) {
    return (
      <p className="text-sm leading-relaxed text-content-muted">
        Ce compte a été créé via Google et n&apos;a pas de mot de passe. Utilise « mot de passe oublié » depuis la page
        de connexion pour en définir un.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const result = await apiRequest<unknown>('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    toast.success('Mot de passe mis à jour.');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <InlineError message={error} />}
      <Input
        label="Mot de passe actuel"
        type="password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <Input
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        required
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
        hint="Au moins 10 caractères, dont une lettre et un chiffre."
      />
      <Button type="submit" loading={pending}>
        Mettre à jour
      </Button>
    </form>
  );
}

/**
 * Account deletion (§26).
 *
 * The confirmation is the user's own e-mail, typed out: a modal with a single
 * red button is too easy to dismiss by reflex for something irreversible.
 */
export function DeleteAccountSection({ email }: { email: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function confirmDelete() {
    setError(null);
    setPending(true);

    const result = await apiRequest<unknown>('/api/account/delete', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    });

    if (!result.ok) {
      setError(result.error.message);
      setPending(false);
      return;
    }

    toast.success('Compte supprimé.');
    await signOut({ callbackUrl: '/' });
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-content-muted">
        La suppression efface définitivement ton compte, toutes tes analyses et les captures associées, et résilie
        l&apos;abonnement en cours. Cette action est irréversible.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        Supprimer mon compte
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Supprimer définitivement ton compte ?"
        description={
          <span>
            Saisis <span className="font-medium text-content">{email}</span> pour confirmer. Tes analyses et tes
            captures seront effacées, et ton abonnement résilié.
          </span>
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button
              variant="danger"
              loading={pending}
              disabled={confirmation.trim().toLowerCase() !== email.toLowerCase()}
              onClick={() => void confirmDelete()}
            >
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {error && <InlineError message={error} />}
          <Input
            label="Ton adresse e-mail"
            type="email"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={email}
          />
        </div>
      </Modal>
    </>
  );
}

export function SignOutButton() {
  return (
    <Button variant="secondary" onClick={() => void signOut({ callbackUrl: '/' })}>
      Se déconnecter
    </Button>
  );
}
