import type {
  Lesson,
  LessonSummary,
  LearningProgressSummary,
  PersonalizedNewsItem,
  QuizQuestion,
} from '@nova/types';
import { CACHE_TTL } from '@nova/config';
import type { Cache } from '../../infrastructure/cache/index.js';
import { cacheKey } from '../../infrastructure/cache/index.js';
import type { Database } from '../../infrastructure/database/prisma.js';
import { notFound } from '../../http/errors.js';

interface LessonContent {
  sections: { heading: string; body: string }[];
  keyTakeaways: string[];
  glossary: { term: string; definition: string }[];
  quiz: (QuizQuestion & { correctOptionId: string })[];
}

/**
 * Learning module.
 *
 * Lessons are authored content stored in the database (see prisma/seed.ts), adapted to the
 * user's declared level. Quiz answers are graded server-side: the correct option never leaves
 * the backend before the user has answered.
 */
export class LearningService {
  constructor(
    private readonly db: Database,
    private readonly cache: Cache,
  ) {}

  private toSummary(
    row: { id: string; slug: string; title: string; description: string; difficulty: string; estimatedMinutes: number; category: string },
    status: LessonSummary['status'],
  ): LessonSummary {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty as LessonSummary['difficulty'],
      estimatedMinutes: row.estimatedMinutes,
      category: row.category,
      status,
    };
  }

  async list(
    userId: string,
    filters: { difficulty?: string; category?: string } = {},
  ): Promise<LessonSummary[]> {
    const [lessons, progress, profile] = await Promise.all([
      this.db.learningLesson.findMany({
        where: {
          ...(filters.difficulty ? { difficulty: filters.difficulty as never } : {}),
          ...(filters.category ? { category: filters.category } : {}),
        },
        orderBy: [{ orderIndex: 'asc' }, { title: 'asc' }],
      }),
      this.db.learningProgress.findMany({ where: { userId } }),
      this.db.investorProfile.findUnique({ where: { userId } }),
    ]);

    const statusByLesson = new Map(progress.map((entry) => [entry.lessonId, entry.status]));

    const level = profile?.knowledgeLevel ?? 'beginner';
    const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 } as const;

    return lessons
      .map((lesson) =>
        this.toSummary(lesson, (statusByLesson.get(lesson.id) ?? 'not_started') as LessonSummary['status']),
      )
      // Lessons at or below the user's level first, harder ones after: nothing is hidden,
      // but the order matches where they are.
      .sort((a, b) => {
        const distanceA = Math.abs(levelOrder[a.difficulty] - levelOrder[level]);
        const distanceB = Math.abs(levelOrder[b.difficulty] - levelOrder[level]);
        return distanceA - distanceB;
      });
  }

  async getById(lessonId: string, userId: string): Promise<Lesson> {
    const lesson = await this.db.learningLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw notFound('Leçon introuvable');

    const progress = await this.db.learningProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    // Opening a lesson marks it as started, so the "reprendre" state is accurate.
    if (!progress) {
      await this.db.learningProgress.create({
        data: { userId, lessonId, status: 'in_progress', startedAt: new Date() },
      });
    }

    const content = lesson.content as unknown as LessonContent;

    return {
      ...this.toSummary(lesson, (progress?.status ?? 'in_progress') as LessonSummary['status']),
      sections: content.sections,
      keyTakeaways: content.keyTakeaways,
      glossary: content.glossary,
      // The correct answer is stripped: grading happens server-side.
      quiz: content.quiz.map(({ correctOptionId: _correct, ...question }) => question),
      relatedThemeKeys: lesson.themeKeys,
    };
  }

  /** Grades the quiz server-side and records completion. */
  async complete(
    lessonId: string,
    userId: string,
    answers: Record<string, string> = {},
  ): Promise<{ status: 'completed'; score: number | null; corrections: { questionId: string; correct: boolean; explanation: string }[] }> {
    const lesson = await this.db.learningLesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw notFound('Leçon introuvable');

    const content = lesson.content as unknown as LessonContent;
    const corrections = content.quiz.map((question) => ({
      questionId: question.id,
      correct: answers[question.id] === question.correctOptionId,
      explanation: question.explanation,
    }));

    const answered = corrections.filter((correction) => answers[correction.questionId]);
    const score =
      answered.length > 0
        ? Math.round((answered.filter((correction) => correction.correct).length / answered.length) * 100)
        : null;

    await this.db.learningProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        status: 'completed',
        quizScore: score,
        startedAt: new Date(),
        completedAt: new Date(),
      },
      update: { status: 'completed', quizScore: score, completedAt: new Date() },
    });

    return { status: 'completed', score, corrections };
  }

  async getProgress(userId: string): Promise<LearningProgressSummary> {
    const [entries, total] = await Promise.all([
      this.db.learningProgress.findMany({ where: { userId } }),
      this.db.learningLesson.count(),
    ]);

    const completed = entries.filter((entry) => entry.status === 'completed');
    return {
      completedCount: completed.length,
      totalCount: total,
      percent: total > 0 ? Math.round((completed.length / total) * 100) : 0,
      entries: entries.map((entry) => ({
        lessonId: entry.lessonId,
        status: entry.status as LearningProgressSummary['entries'][number]['status'],
        quizScore: entry.quizScore,
        completedAt: entry.completedAt?.toISOString() ?? null,
      })),
    };
  }

  /**
   * Lesson of the day: the not-yet-completed lesson whose themes best match today's news,
   * falling back to the next lesson at the user's level.
   */
  async suggestLesson(
    userId: string,
    todaysNews: PersonalizedNewsItem[] = [],
  ): Promise<{ id: string; title: string; estimatedMinutes: number } | null> {
    const key = cacheKey('learning', 'suggestion', userId, new Date().toISOString().slice(0, 10));
    const cached = await this.cache.get<{ id: string; title: string; estimatedMinutes: number } | null>(key);
    if (cached !== null) return cached;

    const [lessons, progress, profile] = await Promise.all([
      this.db.learningLesson.findMany({ orderBy: { orderIndex: 'asc' } }),
      this.db.learningProgress.findMany({ where: { userId, status: 'completed' } }),
      this.db.investorProfile.findUnique({ where: { userId } }),
    ]);

    const completed = new Set(progress.map((entry) => entry.lessonId));
    const available = lessons.filter((lesson) => !completed.has(lesson.id));
    if (available.length === 0) return null;

    const newsIds = todaysNews.map((item) => item.id);
    const themes = new Set<string>();
    if (newsIds.length > 0) {
      const analyses = await this.db.newsAnalysis.findMany({
        where: { newsId: { in: newsIds } },
        select: { themeKeys: true },
      });
      for (const analysis of analyses) {
        for (const theme of analysis.themeKeys) themes.add(theme);
      }
    }

    const level = profile?.knowledgeLevel ?? 'beginner';
    const best =
      available.find(
        (lesson) =>
          lesson.difficulty === level && lesson.themeKeys.some((theme) => themes.has(theme)),
      ) ??
      available.find((lesson) => lesson.themeKeys.some((theme) => themes.has(theme))) ??
      available.find((lesson) => lesson.difficulty === level) ??
      available[0];

    const suggestion = best
      ? { id: best.id, title: best.title, estimatedMinutes: best.estimatedMinutes }
      : null;

    await this.cache.set(key, suggestion, CACHE_TTL.lessons);
    return suggestion;
  }
}
