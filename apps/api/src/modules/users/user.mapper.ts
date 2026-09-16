import type { InvestorProfile as InvestorProfileDto, PublicUser } from '@nova/types';
import type { InvestorProfile, User } from '@prisma/client';

/** Enum values differ between Prisma (identifier-safe) and the API contract (spec wording). */
const HORIZON_TO_API = {
  under_2_years: 'under_2_years',
  two_to_5_years: '2_to_5_years',
  five_to_10_years: '5_to_10_years',
  ten_to_20_years: '10_to_20_years',
  over_20_years: 'over_20_years',
} as const;

const HORIZON_TO_DB = {
  under_2_years: 'under_2_years',
  '2_to_5_years': 'two_to_5_years',
  '5_to_10_years': 'five_to_10_years',
  '10_to_20_years': 'ten_to_20_years',
  over_20_years: 'over_20_years',
} as const;

export type ApiHorizon = keyof typeof HORIZON_TO_DB;
export type DbHorizon = keyof typeof HORIZON_TO_API;

export function horizonToApi(value: DbHorizon): ApiHorizon {
  return HORIZON_TO_API[value];
}

export function horizonToDb(value: ApiHorizon): DbHorizon {
  return HORIZON_TO_DB[value];
}

/** Maps a database user to the payload sent to the client — never exposes the password hash. */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    locale: (user.locale === 'en' ? 'en' : 'fr') as PublicUser['locale'],
    theme: user.theme,
    contentDepth: user.contentDepth,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toInvestorProfile(profile: InvestorProfile): InvestorProfileDto {
  return {
    id: profile.id,
    userId: profile.userId,
    investmentGoal: profile.investmentGoal,
    investmentHorizon: horizonToApi(profile.investmentHorizon),
    experienceLevel: profile.experienceLevel,
    riskTolerance: profile.riskTolerance,
    knowledgeLevel: profile.knowledgeLevel,
    interestedAssetTypes: profile.interestedAssetTypes,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
