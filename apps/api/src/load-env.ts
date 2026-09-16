/**
 * Loads `.env` into `process.env`.
 *
 * This module exists to be imported **first** by every entrypoint: ES module imports are
 * evaluated in declaration order, so a side-effect import here runs before any module that
 * reads configuration. A plain function call in the entrypoint body would run *after* all of
 * its imports were evaluated, which is too late.
 *
 * Relying on another library's dotenv side-effect (Prisma loads one) is fragile: it works until
 * an import order changes, and then a variable silently disappears — which is exactly how a
 * missing CORS origin went unnoticed here. `process.loadEnvFile` is built into Node, so this
 * costs no dependency.
 *
 * Variables already present in the environment take precedence, which is what a container
 * or a CI runner provides.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file: the environment is expected to come from the platform. This is the normal
  // case in staging and production.
}

export {};
