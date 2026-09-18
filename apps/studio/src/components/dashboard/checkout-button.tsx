'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, ApiRequestError } from '@/lib/api-client';

export function CheckoutButton({
  planId,
  packId,
  disabled,
}: {
  planId?: 'STARTER' | 'PRO';
  packId?: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkout = async () => {
    setPending(true);
    setError(null);
    try {
      const { url } = await api<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId, packId }),
      });
      window.location.href = url;
    } catch (checkoutError) {
      setError(
        checkoutError instanceof ApiRequestError
          ? checkoutError.error.message
          : 'Paiement indisponible.',
      );
      setPending(false);
    }
  };

  return (
    <div>
      <Button size="sm" className="w-full" disabled={disabled || pending} onClick={() => void checkout()}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Choisir
      </Button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
