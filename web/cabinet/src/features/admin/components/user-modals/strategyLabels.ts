export const TRAFFIC_STRATEGY_KEYS: Record<string, string> = {
  DAY: 'admin.users.subscription.strategies.day',
  WEEK: 'admin.users.subscription.strategies.week',
  MONTH: 'admin.users.subscription.strategies.month',
  MONTH_ROLLING: 'admin.users.subscription.strategies.monthRolling',
  NO_RESET: 'admin.users.subscription.strategies.noReset',
}

export function trafficStrategyLabel(strategy: string, t: (key: string) => string): string {
  const key = TRAFFIC_STRATEGY_KEYS[strategy]
  return key ? t(key) : strategy
}
