-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "InvestmentGoal" AS ENUM ('build_wealth', 'prepare_retirement', 'long_term_investing', 'generate_income', 'fund_a_project', 'other');

-- CreateEnum
CREATE TYPE "InvestmentHorizon" AS ENUM ('under_2_years', 'two_to_5_years', 'five_to_10_years', 'ten_to_20_years', 'over_20_years');

-- CreateEnum
CREATE TYPE "RiskTolerance" AS ENUM ('very_cautious', 'cautious', 'balanced', 'opportunistic');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('stock', 'etf', 'bond', 'fund', 'crypto', 'commodity', 'cash');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('north_america', 'europe', 'asia', 'emerging', 'global', 'other');

-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('macro', 'central_banks', 'company', 'sector', 'geopolitics', 'regulation', 'commodities', 'currencies', 'markets');

-- CreateEnum
CREATE TYPE "TimeHorizon" AS ENUM ('short_term', 'medium_term', 'long_term');

-- CreateEnum
CREATE TYPE "JournalAction" AS ENUM ('buy', 'sell', 'hold', 'watch', 'note');

-- CreateEnum
CREATE TYPE "ConvictionLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('not_started', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('daily_brief', 'important_news', 'learning', 'system');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('free', 'premium');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'trialing', 'past_due', 'canceled', 'incomplete');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('system', 'light', 'dark');

-- CreateEnum
CREATE TYPE "ContentDepth" AS ENUM ('simple', 'detailed');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ios', 'android', 'web');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fr',
    "theme" "ThemePreference" NOT NULL DEFAULT 'system',
    "contentDepth" "ContentDepth" NOT NULL DEFAULT 'simple',
    "acceptedTermsAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "investmentGoal" "InvestmentGoal" NOT NULL,
    "investmentHorizon" "InvestmentHorizon" NOT NULL,
    "experienceLevel" "ExperienceLevel" NOT NULL,
    "riskTolerance" "RiskTolerance" NOT NULL,
    "knowledgeLevel" "ExperienceLevel" NOT NULL DEFAULT 'beginner',
    "interestedAssetTypes" "AssetType"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "dailyBrief" BOOLEAN NOT NULL DEFAULT true,
    "importantNews" BOOLEAN NOT NULL DEFAULT true,
    "learning" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER NOT NULL DEFAULT 22,
    "quietHoursEnd" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipHash" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "exchange" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "country" TEXT,
    "region" "Region" NOT NULL DEFAULT 'global',
    "sectorId" UUID,
    "isin" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "open" DECIMAL(24,8) NOT NULL,
    "high" DECIMAL(24,8) NOT NULL,
    "low" DECIMAL(24,8) NOT NULL,
    "close" DECIMAL(24,8) NOT NULL,
    "volume" DECIMAL(24,4),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_indices" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "region" "Region" NOT NULL DEFAULT 'global',

    CONSTRAINT "market_indices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_index_quotes" (
    "id" UUID NOT NULL,
    "indexId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(24,8) NOT NULL,
    "previousClose" DECIMAL(24,8),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_index_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" UUID NOT NULL,
    "currency" TEXT NOT NULL,
    "rate" DECIMAL(24,8) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "averagePrice" DECIMAL(24,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "externalId" TEXT,
    "contentHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_assets" (
    "newsId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "relevance" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "news_assets_pkey" PRIMARY KEY ("newsId","assetId")
);

-- CreateTable
CREATE TABLE "news_sectors" (
    "newsId" UUID NOT NULL,
    "sectorId" UUID NOT NULL,
    "relevance" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "news_sectors_pkey" PRIMARY KEY ("newsId","sectorId")
);

-- CreateTable
CREATE TABLE "news_analysis" (
    "id" UUID NOT NULL,
    "newsId" UUID NOT NULL,
    "importanceScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "horizon" "TimeHorizon" NOT NULL DEFAULT 'short_term',
    "themeKeys" TEXT[],
    "analysis" JSONB NOT NULL,
    "scoringVersion" TEXT NOT NULL DEFAULT 'nova-scoring-v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_briefs" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "content" JSONB NOT NULL,
    "dataAsOf" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "daily_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_brief_items" (
    "id" UUID NOT NULL,
    "briefId" UUID NOT NULL,
    "newsId" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "takeaway" TEXT NOT NULL,
    "relevanceReason" TEXT,
    "portfolioRelevanceScore" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daily_brief_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_lessons" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "difficulty" "ExperienceLevel" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 2,
    "category" TEXT NOT NULL,
    "themeKeys" TEXT[],
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_progress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'not_started',
    "quizScore" INTEGER,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "portfolioId" UUID,
    "assetId" UUID,
    "action" "JournalAction" NOT NULL,
    "quantity" DECIMAL(24,8),
    "price" DECIMAL(24,8),
    "currency" TEXT,
    "reason" TEXT NOT NULL,
    "horizon" "InvestmentHorizon",
    "conviction" "ConvictionLevel",
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'none',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'free',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'active',
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "answer" JSONB,
    "provider" TEXT,
    "model" TEXT,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "error" TEXT,
    "metadata" JSONB,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "investor_profiles_userId_key" ON "investor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_token_key" ON "devices"("token");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sectors_key_key" ON "sectors"("key");

-- CreateIndex
CREATE UNIQUE INDEX "assets_symbol_key" ON "assets"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "assets_isin_key" ON "assets"("isin");

-- CreateIndex
CREATE INDEX "assets_assetType_idx" ON "assets"("assetType");

-- CreateIndex
CREATE INDEX "assets_sectorId_idx" ON "assets"("sectorId");

-- CreateIndex
CREATE INDEX "assets_name_idx" ON "assets"("name");

-- CreateIndex
CREATE INDEX "market_prices_assetId_timestamp_idx" ON "market_prices"("assetId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "market_prices_timestamp_idx" ON "market_prices"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "market_prices_assetId_timestamp_key" ON "market_prices"("assetId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "market_indices_key_key" ON "market_indices"("key");

-- CreateIndex
CREATE INDEX "market_index_quotes_indexId_timestamp_idx" ON "market_index_quotes"("indexId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "market_index_quotes_indexId_timestamp_key" ON "market_index_quotes"("indexId", "timestamp");

-- CreateIndex
CREATE INDEX "fx_rates_currency_timestamp_idx" ON "fx_rates"("currency", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_currency_timestamp_key" ON "fx_rates"("currency", "timestamp");

-- CreateIndex
CREATE INDEX "portfolios_userId_idx" ON "portfolios"("userId");

-- CreateIndex
CREATE INDEX "positions_portfolioId_idx" ON "positions"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "positions_portfolioId_assetId_key" ON "positions"("portfolioId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "news_externalId_key" ON "news"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "news_contentHash_key" ON "news"("contentHash");

-- CreateIndex
CREATE INDEX "news_publishedAt_idx" ON "news"("publishedAt" DESC);

-- CreateIndex
CREATE INDEX "news_category_publishedAt_idx" ON "news"("category", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "news_assets_assetId_idx" ON "news_assets"("assetId");

-- CreateIndex
CREATE INDEX "news_sectors_sectorId_idx" ON "news_sectors"("sectorId");

-- CreateIndex
CREATE UNIQUE INDEX "news_analysis_newsId_key" ON "news_analysis"("newsId");

-- CreateIndex
CREATE INDEX "news_analysis_importanceScore_idx" ON "news_analysis"("importanceScore" DESC);

-- CreateIndex
CREATE INDEX "daily_briefs_userId_date_idx" ON "daily_briefs"("userId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_briefs_userId_date_key" ON "daily_briefs"("userId", "date");

-- CreateIndex
CREATE INDEX "daily_brief_items_briefId_rank_idx" ON "daily_brief_items"("briefId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "daily_brief_items_briefId_newsId_key" ON "daily_brief_items"("briefId", "newsId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_lessons_slug_key" ON "learning_lessons"("slug");

-- CreateIndex
CREATE INDEX "learning_lessons_difficulty_orderIndex_idx" ON "learning_lessons"("difficulty", "orderIndex");

-- CreateIndex
CREATE INDEX "learning_progress_userId_idx" ON "learning_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_progress_userId_lessonId_key" ON "learning_progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "journal_entries_userId_createdAt_idx" ON "journal_entries"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "journal_entries_userId_occurredAt_idx" ON "journal_entries"("userId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_providerSubscriptionId_key" ON "subscriptions"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_providerCustomerId_idx" ON "subscriptions"("providerCustomerId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_updatedAt_idx" ON "ai_conversations"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "job_runs_jobName_startedAt_idx" ON "job_runs"("jobName", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_index_quotes" ADD CONSTRAINT "market_index_quotes_indexId_fkey" FOREIGN KEY ("indexId") REFERENCES "market_indices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_assets" ADD CONSTRAINT "news_assets_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_assets" ADD CONSTRAINT "news_assets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_sectors" ADD CONSTRAINT "news_sectors_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_sectors" ADD CONSTRAINT "news_sectors_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "sectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_analysis" ADD CONSTRAINT "news_analysis_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_briefs" ADD CONSTRAINT "daily_briefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_brief_items" ADD CONSTRAINT "daily_brief_items_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "daily_briefs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_brief_items" ADD CONSTRAINT "daily_brief_items_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "news"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "learning_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
