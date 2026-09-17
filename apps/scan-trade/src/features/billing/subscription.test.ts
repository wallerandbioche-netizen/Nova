import { describe, expect, it } from 'vitest';
import { isSubscriptionActive, subscriptionDisplayState } from './subscription';

const NOW = new Date('2026-09-17T12:00:00Z');
const IN_A_WEEK = new Date('2026-09-24T12:00:00Z');
const SIX_HOURS_AGO = new Date('2026-09-17T06:00:00Z');
/** Exactly 24 h back — the far edge of the grace window. */
const EXACTLY_A_DAY_AGO = new Date('2026-09-16T12:00:00Z');
const LAST_MONTH = new Date('2026-08-17T12:00:00Z');

describe('isSubscriptionActive', () => {
  it('grants access while active', () => {
    expect(
      isSubscriptionActive(
        { status: 'ACTIVE', currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe(true);
  });

  it('grants access during a trial', () => {
    expect(
      isSubscriptionActive(
        { status: 'TRIALING', currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe(true);
  });

  it('still grants access when a cancellation is scheduled but the period runs', () => {
    expect(
      isSubscriptionActive(
        { status: 'ACTIVE', currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: true },
        NOW,
      ),
    ).toBe(true);
  });

  it('refuses access with no subscription at all', () => {
    expect(isSubscriptionActive(null, NOW)).toBe(false);
    expect(isSubscriptionActive(undefined, NOW)).toBe(false);
    expect(
      isSubscriptionActive(
        { status: 'NONE', currentPeriodEnd: null, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe(false);
  });

  it('refuses access on every non-entitling status', () => {
    for (const status of [
      'PAST_DUE',
      'UNPAID',
      'CANCELED',
      'INCOMPLETE',
      'INCOMPLETE_EXPIRED',
      'PAUSED',
    ] as const) {
      expect(
        isSubscriptionActive(
          { status, currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: false },
          NOW,
        ),
      ).toBe(false);
    }
  });

  it('keeps a paying user in during the short grace window after a lapsed period', () => {
    // The renewal webhook is late, not absent: locking them out mid-scan would
    // be worse than a few hours of slack.
    expect(
      isSubscriptionActive(
        { status: 'ACTIVE', currentPeriodEnd: SIX_HOURS_AGO, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe(true);
  });

  it('closes the grace window at 24 h exactly, not after', () => {
    expect(
      isSubscriptionActive(
        { status: 'ACTIVE', currentPeriodEnd: EXACTLY_A_DAY_AGO, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe(false);
  });

  it('closes the door once the grace window is well past', () => {
    expect(
      isSubscriptionActive(
        { status: 'ACTIVE', currentPeriodEnd: LAST_MONTH, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe(false);
  });

  it('treats a missing period end as entitling while the status says active', () => {
    expect(
      isSubscriptionActive(
        { status: 'ACTIVE', currentPeriodEnd: null, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe(true);
  });
});

describe('subscriptionDisplayState', () => {
  it('names each state the account page renders', () => {
    expect(subscriptionDisplayState(null, NOW)).toBe('none');
    expect(
      subscriptionDisplayState(
        { status: 'ACTIVE', currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe('active');
    expect(
      subscriptionDisplayState(
        { status: 'ACTIVE', currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: true },
        NOW,
      ),
    ).toBe('canceling');
    expect(
      subscriptionDisplayState(
        { status: 'PAST_DUE', currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe('past_due');
    expect(
      subscriptionDisplayState(
        { status: 'PAUSED', currentPeriodEnd: IN_A_WEEK, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe('paused');
    expect(
      subscriptionDisplayState(
        { status: 'CANCELED', currentPeriodEnd: LAST_MONTH, cancelAtPeriodEnd: false },
        NOW,
      ),
    ).toBe('canceled');
  });
});
