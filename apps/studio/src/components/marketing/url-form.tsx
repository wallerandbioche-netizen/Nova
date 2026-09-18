'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** The landing page's single action: paste a link, get taken into the flow. */
export function UrlForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setPending(true);
    const target = `/dashboard/new?url=${encodeURIComponent(trimmed)}`;
    router.push(signedIn ? target : `/signup?next=${encodeURIComponent(target)}`);
  };

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-3 sm:flex-row">
      <Input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Collez le lien Airbnb, Booking ou votre annonce"
        aria-label="Lien de l'annonce"
        className="h-13 flex-1 text-base"
        inputMode="url"
      />
      <Button type="submit" variant="accent" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Générer
        {!pending ? <ArrowRight /> : null}
      </Button>
    </form>
  );
}
