'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

export function DeleteAccountButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const remove = async () => {
    if (!window.confirm('Supprimer définitivement votre compte et toutes vos données ?')) return;
    setPending(true);
    try {
      await api('/api/account', { method: 'DELETE' });
      router.push('/');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="danger" size="sm" disabled={pending} onClick={() => void remove()}>
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      Supprimer mon compte
    </Button>
  );
}
