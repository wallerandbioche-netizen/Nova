import type { LessonDifficulty, LessonStatus } from './enums.js';
import type { Iso8601 } from './common.js';

export interface QuizOption {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  /** Explanation shown after answering, whatever the answer. NOVA never scolds. */
  explanation: string;
}

export interface LessonSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: LessonDifficulty;
  estimatedMinutes: number;
  category: string;
  status: LessonStatus;
}

export interface LessonSection {
  heading: string;
  body: string;
}

export interface Lesson extends LessonSummary {
  sections: LessonSection[];
  keyTakeaways: string[];
  glossary: { term: string; definition: string }[];
  quiz: QuizQuestion[];
  relatedThemeKeys: string[];
}

export interface LearningProgress {
  lessonId: string;
  status: LessonStatus;
  quizScore: number | null;
  completedAt: Iso8601 | null;
}

export interface LearningProgressSummary {
  completedCount: number;
  totalCount: number;
  percent: number;
  entries: LearningProgress[];
}
