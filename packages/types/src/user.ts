import type {
  AssetType,
  ContentDepth,
  ExperienceLevel,
  InvestmentGoal,
  InvestmentHorizon,
  Locale,
  RiskTolerance,
  ThemePreference,
} from './enums.js';
import type { Iso8601 } from './common.js';

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  locale: Locale;
  theme: ThemePreference;
  contentDepth: ContentDepth;
  onboardingCompletedAt: Iso8601 | null;
  createdAt: Iso8601;
}

export interface InvestorProfile {
  id: string;
  userId: string;
  investmentGoal: InvestmentGoal;
  investmentHorizon: InvestmentHorizon;
  experienceLevel: ExperienceLevel;
  riskTolerance: RiskTolerance;
  /** Self-declared knowledge, kept separate from experience: someone can read a lot and invest little. */
  knowledgeLevel: ExperienceLevel;
  interestedAssetTypes: AssetType[];
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface NotificationPreferences {
  dailyBrief: boolean;
  importantNews: boolean;
  learning: boolean;
  /** Local time (Europe/Paris by default) at which the daily brief notification may be sent. */
  quietHoursStart: number;
  quietHoursEnd: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface SessionPayload {
  user: PublicUser;
  investorProfile: InvestorProfile | null;
  onboardingCompleted: boolean;
}
