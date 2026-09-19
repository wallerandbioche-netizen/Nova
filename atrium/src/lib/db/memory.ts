import type { Project } from '@/types/domain';
import type { ProjectRepository } from './repository';

/**
 * Dépôt en mémoire.
 *
 * Suffisant pour le MVP : un projet vit le temps d'une génération, et les
 * fichiers produits, eux, sont bien sur le disque. Le stockage survit au
 * rechargement à chaud du serveur de développement grâce au registre global.
 */
export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects = new Map<string, Project>();
  /** Au-delà, les projets les plus anciens sont oubliés. */
  private readonly capacity = 200;

  async create(project: Project): Promise<Project> {
    this.projects.set(project.id, project);
    while (this.projects.size > this.capacity) {
      const oldest = this.projects.keys().next().value;
      if (oldest === undefined) break;
      this.projects.delete(oldest);
    }
    return project;
  }

  async find(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }

  async update(id: string, mutate: (project: Project) => void): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;
    mutate(project);
    project.updatedAt = new Date().toISOString();
    return project;
  }

  async list(limit = 20): Promise<Project[]> {
    return [...this.projects.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async remove(id: string): Promise<void> {
    this.projects.delete(id);
  }
}

const GLOBAL_KEY = Symbol.for('atrium.projectRepository');
type GlobalScope = typeof globalThis & { [GLOBAL_KEY]?: ProjectRepository };

export function projectRepository(): ProjectRepository {
  const scope = globalThis as GlobalScope;
  scope[GLOBAL_KEY] ??= new InMemoryProjectRepository();
  return scope[GLOBAL_KEY];
}
