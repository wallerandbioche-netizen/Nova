'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { apiRequest } from '@/features/auth/api-client';

/** Delete, with the confirmation the brief asks for (§15). */
export function DeleteAnalysisButton({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    const result = await apiRequest<void>(`/api/analyses/${analysisId}`, { method: 'DELETE' });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error.message);
      setOpen(false);
      return;
    }

    toast.success('Analyse supprimée.');
    setOpen(false);
    router.push('/historique');
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Supprimer
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Supprimer cette analyse ?"
        description="L'analyse et la capture associée seront définitivement effacées. Cette action est irréversible."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => void confirm()} loading={pending}>
              Supprimer définitivement
            </Button>
          </>
        }
      />
    </>
  );
}

/** Retry for an analysis whose scan never completed or failed. */
export function RunScanButton({ analysisId, label }: { analysisId: string; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    const result = await apiRequest<unknown>(`/api/analyses/${analysisId}/scan`, {
      method: 'POST',
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }

    router.refresh();
  }

  return (
    <Button onClick={() => void run()} loading={pending}>
      {label}
    </Button>
  );
}
