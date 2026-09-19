'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectView } from '@/types/api';

const POLL_INTERVAL_MS = 900;

/**
 * Suit l'avancement d'un projet.
 *
 * L'interrogation régulière s'arrête d'elle-même dès que le projet est terminé
 * ou en échec, et reprend lorsqu'une nouvelle génération est lancée.
 */
export function useProject(id: string): {
  project: ProjectView | null;
  missing: boolean;
  resume: (next?: ProjectView) => void;
} {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [missing, setMissing] = useState(false);
  const [generation, setGeneration] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
        if (cancelled) return;
        if (response.status === 404) {
          setMissing(true);
          return;
        }
        if (!response.ok) throw new Error(String(response.status));

        const data = (await response.json()) as ProjectView;
        if (cancelled) return;
        setProject(data);
        if (data.status === 'queued' || data.status === 'running') {
          timer.current = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch {
        // Une interruption réseau ponctuelle ne doit pas arrêter le suivi.
        if (!cancelled) timer.current = setTimeout(tick, POLL_INTERVAL_MS * 2);
      }
    };

    void tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id, generation]);

  const resume = useCallback((next?: ProjectView) => {
    if (next) setProject(next);
    setGeneration((value) => value + 1);
  }, []);

  return { project, missing, resume };
}
