import { prisma } from '../db';
import {
  CONFIG_KEYS,
  DEFAULT_CREDIT_COST_PER_VIDEO,
  DEFAULT_CREDIT_PACKS,
  DEFAULT_PLANS,
  DEFAULT_SIGNUP_BONUS_CREDITS,
  creditPackSchema,
  planSchema,
  type CreditPack,
  type Plan,
} from './pricing';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; expiresAt: number }>();

async function readConfig<T>(key: string, fallback: T, parse: (raw: unknown) => T): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  let value = fallback;
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    if (row) value = parse(row.value);
  } catch {
    // A missing or unreachable config row must never take the product down: defaults win.
    value = fallback;
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export async function getCreditCostPerVideo(): Promise<number> {
  return readConfig(CONFIG_KEYS.creditCostPerVideo, DEFAULT_CREDIT_COST_PER_VIDEO, (raw) => {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : DEFAULT_CREDIT_COST_PER_VIDEO;
  });
}

export async function getSignupBonusCredits(): Promise<number> {
  return readConfig(CONFIG_KEYS.signupBonusCredits, DEFAULT_SIGNUP_BONUS_CREDITS, (raw) => {
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : DEFAULT_SIGNUP_BONUS_CREDITS;
  });
}

export async function getPlans(): Promise<Plan[]> {
  return readConfig(CONFIG_KEYS.plans, DEFAULT_PLANS, (raw) => {
    const parsed = planSchema.array().safeParse(raw);
    return parsed.success ? parsed.data : DEFAULT_PLANS;
  });
}

export async function getCreditPacks(): Promise<CreditPack[]> {
  return readConfig(CONFIG_KEYS.creditPacks, DEFAULT_CREDIT_PACKS, (raw) => {
    const parsed = creditPackSchema.array().safeParse(raw);
    return parsed.success ? parsed.data : DEFAULT_CREDIT_PACKS;
  });
}

export function clearConfigCache(): void {
  cache.clear();
}
