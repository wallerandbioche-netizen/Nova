import type { Project } from '@/types/domain';

/**
 * Accès aux projets. Le MVP garde tout en mémoire ; un adaptateur Prisma ou
 * Drizzle peut le remplacer sans changer une ligne des services.
 */
export interface ProjectRepository {
  create(project: Project): Promise<Project>;
  find(id: string): Promise<Project | null>;
  /** Applique une mutation et renvoie l'état résultant. */
  update(id: string, mutate: (project: Project) => void): Promise<Project | null>;
  list(limit?: number): Promise<Project[]>;
  remove(id: string): Promise<void>;
}
