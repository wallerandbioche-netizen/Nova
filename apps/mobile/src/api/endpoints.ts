import type {
  AiChatResult,
  AiConversation,
  AppNotification,
  DailyBrief,
  DashboardPayload,
  InvestorProfile,
  JournalEntry,
  JournalLookback,
  Lesson,
  LessonSummary,
  LearningProgressSummary,
  MarketOverview,
  MarketRadar,
  NewsAnalysis,
  NewsItem,
  NotificationPreferences,
  Paginated,
  PersonalizedNewsItem,
  PlanDefinition,
  PortfolioAnalytics,
  PriceSeries,
  PublicUser,
  SubscriptionState,
  ValuedPosition,
} from '@nova/types';
import type { ApiClient } from './client';

/**
 * Typed API surface.
 *
 * One function per endpoint of the documented contract, so screens never build URLs by hand
 * and response shapes stay checked against the shared domain types.
 */
export interface AuthResponse {
  user: PublicUser;
  tokens: { accessToken: string; refreshToken: string; expiresIn: number; tokenType: 'Bearer' };
}

export interface SessionResponse {
  user: PublicUser;
  investorProfile: InvestorProfile | null;
  onboardingCompleted: boolean;
  subscription: SubscriptionState;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  baseCurrency: string;
  isDefault: boolean;
  positionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioDetail {
  portfolio: {
    id: string;
    name: string;
    baseCurrency: string;
    createdAt: string;
    updatedAt: string;
  };
  analytics: PortfolioAnalytics;
  positions: ValuedPosition[];
}

export function createEndpoints(client: ApiClient) {
  return {
    auth: {
      register: (body: {
        email: string;
        password: string;
        firstName: string;
        acceptedTerms: true;
      }) => client.post<AuthResponse>('/auth/register', body, { anonymous: true }),
      login: (body: { email: string; password: string }) =>
        client.post<AuthResponse>('/auth/login', body, { anonymous: true }),
      logout: (refreshToken?: string) => client.post<void>('/auth/logout', { refreshToken }),
      forgotPassword: (email: string) =>
        client.post<{ message: string }>('/auth/forgot-password', { email }, { anonymous: true }),
      resetPassword: (body: { token: string; password: string }) =>
        client.post<void>('/auth/reset-password', body, { anonymous: true }),
      me: () => client.get<SessionResponse>('/auth/me'),
    },

    profile: {
      get: () => client.get<PublicUser>('/profile'),
      update: (
        body: Partial<Pick<PublicUser, 'firstName' | 'locale' | 'theme' | 'contentDepth'>>,
      ) => client.patch<PublicUser>('/profile', body),
      getInvestor: () =>
        client.get<{ profile: InvestorProfile | null; disclaimer: string }>('/profile/investor'),
      saveInvestor: (body: Record<string, unknown>) =>
        client.put<{ profile: InvestorProfile; disclaimer: string }>('/profile/investor', body),
      completeOnboarding: () => client.post<PublicUser>('/profile/onboarding/complete'),
      getNotificationPreferences: () =>
        client.get<NotificationPreferences>('/profile/notifications'),
      updateNotificationPreferences: (body: Partial<NotificationPreferences>) =>
        client.patch<NotificationPreferences>('/profile/notifications', body),
      changePassword: (body: { currentPassword: string; newPassword: string }) =>
        client.post<void>('/profile/password', body),
    },

    portfolios: {
      list: () => client.get<{ items: PortfolioSummary[] }>('/portfolios'),
      create: (body: { name: string; baseCurrency: string }) =>
        client.post<PortfolioSummary>('/portfolios', body),
      detail: (id: string) => client.get<PortfolioDetail>(`/portfolios/${id}`),
      update: (id: string, body: { name?: string; baseCurrency?: string }) =>
        client.patch<PortfolioSummary>(`/portfolios/${id}`, body),
      remove: (id: string) => client.delete<void>(`/portfolios/${id}`),
      positions: (id: string) =>
        client.get<{ items: ValuedPosition[] }>(`/portfolios/${id}/positions`),
      addPosition: (
        id: string,
        body: {
          symbol?: string;
          assetId?: string;
          quantity: number;
          averagePrice: number;
          currency?: string;
        },
      ) => client.post<{ id: string }>(`/portfolios/${id}/positions`, body),
      updatePosition: (
        positionId: string,
        body: { quantity?: number; averagePrice?: number; currency?: string },
      ) => client.patch<{ id: string }>(`/positions/${positionId}`, body),
      removePosition: (positionId: string) => client.delete<void>(`/positions/${positionId}`),
    },

    markets: {
      overview: () => client.get<MarketOverview>('/markets/overview'),
      radar: () => client.get<MarketRadar>('/markets/radar'),
      searchAssets: (query: string) =>
        client.get<Paginated<{ id: string; symbol: string; name: string; assetType: string }>>(
          `/assets?query=${encodeURIComponent(query)}&limit=20`,
        ),
      asset: (id: string) =>
        client.get<{
          asset: {
            id: string;
            symbol: string;
            name: string;
            sector: { label: string } | null;
            currency: string;
            isDemo: boolean;
          };
          position: { quantity: number; averagePrice: number } | null;
        }>(`/assets/${id}`),
      prices: (id: string, range: string) =>
        client.get<PriceSeries>(`/assets/${id}/prices?range=${range}`),
    },

    news: {
      list: (options: { limit?: number; cursor?: string; category?: string } = {}) => {
        const params = new URLSearchParams({ limit: String(options.limit ?? 20) });
        if (options.cursor) params.set('cursor', options.cursor);
        if (options.category) params.set('category', options.category);
        return client.get<Paginated<PersonalizedNewsItem> & { personalized: boolean }>(
          `/news?${params.toString()}`,
        );
      },
      detail: (id: string) => client.get<NewsItem>(`/news/${id}`),
      analysis: (id: string, depth: 'simple' | 'detailed') =>
        client.get<NewsAnalysis>(`/news/${id}/analysis?depth=${depth}`),
    },

    brief: {
      today: () => client.get<DailyBrief>('/brief/today'),
      history: (cursor?: string) =>
        client.get<Paginated<{ id: string; date: string; headline: string; itemCount: number }>>(
          `/brief/history?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        ),
      detail: (id: string) => client.get<DailyBrief>(`/brief/${id}`),
    },

    dashboard: {
      get: () => client.get<DashboardPayload>('/dashboard'),
    },

    ai: {
      chat: (body: {
        message: string;
        conversationId?: string;
        depth: 'simple' | 'detailed';
        context?: { newsId?: string; assetId?: string; portfolioId?: string };
      }) => client.post<AiChatResult>('/ai/chat', body),
      conversations: () =>
        client.get<{ items: { id: string; title: string; updatedAt: string }[] }>(
          '/ai/conversations',
        ),
      conversation: (id: string) => client.get<AiConversation>(`/ai/conversations/${id}`),
      explainPortfolio: (body: {
        portfolioId: string;
        question?: string;
        depth: 'simple' | 'detailed';
      }) => client.post('/ai/explain-portfolio', body),
    },

    learning: {
      list: () => client.get<{ items: LessonSummary[] }>('/learning'),
      detail: (id: string) => client.get<Lesson>(`/learning/${id}`),
      complete: (id: string, answers: Record<string, string>) =>
        client.post<{
          status: string;
          score: number | null;
          corrections: { questionId: string; correct: boolean; explanation: string }[];
        }>(`/learning/${id}/complete`, { answers }),
      progress: () => client.get<LearningProgressSummary>('/learning/progress'),
      daily: () =>
        client.get<{ lesson: { id: string; title: string; estimatedMinutes: number } | null }>(
          '/learning/daily',
        ),
    },

    journal: {
      list: (cursor?: string) =>
        client.get<Paginated<JournalEntry>>(
          `/journal?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        ),
      lookbacks: () => client.get<{ items: JournalLookback[] }>('/journal/lookbacks'),
      create: (body: Record<string, unknown>) => client.post<JournalEntry>('/journal', body),
      detail: (id: string) => client.get<JournalLookback>(`/journal/${id}`),
      update: (id: string, body: Record<string, unknown>) =>
        client.patch<JournalEntry>(`/journal/${id}`, body),
      remove: (id: string) => client.delete<void>(`/journal/${id}`),
    },

    notifications: {
      list: () =>
        client.get<Paginated<AppNotification> & { unreadCount: number }>('/notifications?limit=30'),
      markRead: (id: string) => client.patch<AppNotification>(`/notifications/${id}/read`),
      markAllRead: () => client.post<{ updated: number }>('/notifications/read-all'),
      registerDevice: (body: { token: string; platform: 'ios' | 'android' | 'web' }) =>
        client.post<void>('/notifications/devices', body),
    },

    subscriptions: {
      plans: () =>
        client.get<{
          items: (PlanDefinition & { isPurchasable: boolean })[];
          paymentEnabled: boolean;
        }>('/subscriptions/plans'),
      me: () => client.get<SubscriptionState>('/subscriptions/me'),
      checkout: (body: { plan: 'premium'; interval: 'month' | 'year' }) =>
        client.post<{ url: string | null }>('/subscriptions/checkout', body),
    },

    account: {
      exportData: () => client.get<Record<string, unknown>>('/account/export'),
      remove: (body: { password: string; confirmation: 'SUPPRIMER' }) =>
        client.delete<void>('/account', body),
    },
  };
}

export type NovaApi = ReturnType<typeof createEndpoints>;
