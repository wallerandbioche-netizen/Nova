import type { ContentDepth } from './enums.js';
import type { Iso8601, SourceReference } from './common.js';

/** The single shape every NOVA financial answer takes, validated before it reaches the UI. */
export interface AiAnswer {
  shortAnswer: string;
  whatWeKnow: string[];
  whyItMatters: string;
  portfolioRelevance: string | null;
  uncertainties: string[];
  sources: SourceReference[];
  /** Model-reported confidence in [0, 1]. Never presented as a probability of an outcome. */
  confidence: number;
  disclaimer: string;
  generatedBy: {
    provider: string;
    model: string;
    isFallback: boolean;
  };
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answer: AiAnswer | null;
  createdAt: Iso8601;
}

export interface AiConversation {
  id: string;
  title: string;
  messages: AiMessage[];
  createdAt: Iso8601;
  updatedAt: Iso8601;
}

export interface AiChatResult {
  conversationId: string;
  message: AiMessage;
  depth: ContentDepth;
  /** Remaining questions in the current rate-limit window, for a calm quota display. */
  remainingQuota: number | null;
}
