/** Shape returned by `/api/me`, shared by the hook and the components. */
export interface SubscriptionState {
  active: boolean;
  status: string;
  plan: 'mensuelle' | 'annuelle' | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface AccountState {
  /** False when the deployment has no database: the app runs in demo mode. */
  accountsEnabled: boolean;
  billingEnabled: boolean;
  account: { email: string } | null;
  subscription: SubscriptionState;
}

export const DEMO_ACCOUNT_STATE: AccountState = {
  accountsEnabled: false,
  billingEnabled: false,
  account: null,
  subscription: {
    active: false,
    status: 'none',
    plan: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  },
};
