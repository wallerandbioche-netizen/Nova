import type { NotificationType } from './enums.js';
import type { Iso8601 } from './common.js';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app deep link, e.g. "/brief/2026-09-16". */
  link: string | null;
  readAt: Iso8601 | null;
  createdAt: Iso8601;
}
