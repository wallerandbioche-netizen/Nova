export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushResult {
  token: string;
  delivered: boolean;
  /** Set when the device token is no longer valid and should be removed. */
  invalidToken?: boolean;
  error?: string;
}

/** Notification transport contract (rule #36). */
export interface NotificationProvider {
  readonly name: string;
  readonly isDemo: boolean;
  send(messages: PushMessage[]): Promise<PushResult[]>;
}
