'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/features/auth/api-client';

/**
 * Both buttons hand off to Stripe: Scan Trade never renders a card field, and
 * never sees a card number (§5).
 */
function useStripeRedirect(endpoint: string) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  return {
    pending,
    async go() {
      setPending(true);
      const result = await apiRequest<{ url: string }>(endpoint, { method: 'POST' });

      if (!result.ok) {
        toast.error(result.error.message);
        setPending(false);
        return;
      }

      window.location.href = result.data.url;
    },
  };
}

export function SubscribeButton({ label = "S'abonner" }: { label?: string }) {
  const { pending, go } = useStripeRedirect('/api/stripe/create-checkout');
  return (
    <Button size="lg" className="w-full" loading={pending} onClick={() => void go()}>
      {label}
    </Button>
  );
}

export function ManageSubscriptionButton() {
  const { pending, go } = useStripeRedirect('/api/stripe/create-portal');
  return (
    <Button variant="secondary" className="w-full" loading={pending} onClick={() => void go()}>
      Gérer mon abonnement
    </Button>
  );
}
