import { getAIAnalysisService } from '@/lib/ai';
import { prisma } from '@/lib/db/prisma';
import { getStorage } from '@/lib/storage';
import { AnalysisService } from '@/features/analysis/service';
import { PrismaAnalysisRepository } from '@/features/analysis/prisma-repository';
import { usageRecorder } from './usage';

/**
 * Composition root.
 *
 * Route handlers and server components ask for a service here; they never
 * construct one. Swapping the storage driver or the AI provider is a change in
 * this file and nowhere else.
 */

let analysisService: AnalysisService | null = null;

export function getAnalysisService(): AnalysisService {
  if (analysisService) return analysisService;
  analysisService = new AnalysisService({
    repository: new PrismaAnalysisRepository(prisma),
    storage: getStorage(),
    aiFactory: getAIAnalysisService,
    usage: usageRecorder,
  });
  return analysisService;
}

/** Test helper. */
export function resetServices(): void {
  analysisService = null;
}
