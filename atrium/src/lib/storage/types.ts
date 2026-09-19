/**
 * Abstraction de stockage. Le MVP écrit sur disque ; un pilote S3/R2 peut
 * s'y substituer sans toucher au pipeline.
 */
export interface StorageDriver {
  /** Répertoire de travail absolu d'un projet, créé si nécessaire. */
  projectDir(projectId: string): Promise<string>;
  /** Chemin absolu pour une clé relative au projet (`src/photo_01.jpg`). */
  resolve(projectId: string, key: string): string;
  write(projectId: string, key: string, data: Buffer): Promise<string>;
  /** URL servie au navigateur pour une clé donnée. */
  publicUrl(projectId: string, key: string): string;
  size(projectId: string, key: string): Promise<number>;
  remove(projectId: string): Promise<void>;
}
