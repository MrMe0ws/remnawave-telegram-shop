export const STATS_CHART_COLORS = {
  blue: '#4d94ff',
  pink: '#ff4d94',
  purple: '#944dff',
  violet: '#a78bfa',
  cyan: '#22d3ee',
  emerald: '#34d399',
  amber: '#fbbf24',
  rose: '#fb7185',
} as const

export const STATS_CHART_PALETTE = [
  STATS_CHART_COLORS.blue,
  STATS_CHART_COLORS.pink,
  STATS_CHART_COLORS.purple,
  STATS_CHART_COLORS.cyan,
  STATS_CHART_COLORS.emerald,
  STATS_CHART_COLORS.amber,
  STATS_CHART_COLORS.rose,
  STATS_CHART_COLORS.violet,
] as const

export const statsChartTooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: '12px',
  color: 'hsl(var(--card-foreground))',
  boxShadow: '0 8px 24px hsl(var(--foreground) / 0.08)',
} as const

export const statsChartTooltipLabelStyle = {
  color: 'hsl(var(--card-foreground))',
} as const

export const statsChartTooltipItemStyle = {
  color: 'hsl(var(--card-foreground))',
} as const

export const statsChartAxisTick = {
  fontSize: 10,
  fill: 'hsl(var(--muted-foreground))',
} as const
