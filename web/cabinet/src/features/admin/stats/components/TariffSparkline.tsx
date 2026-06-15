import { Bar, BarChart, ResponsiveContainer } from 'recharts'

import { STATS_CHART_COLORS } from '../utils/statsChartTheme'

interface TariffSparklineProps {
  values: number[]
  color?: string
}

export function TariffSparkline({ values, color = STATS_CHART_COLORS.cyan }: TariffSparklineProps) {
  const data = values.map((value, i) => ({ i, value }))
  const hasData = values.some((v) => v > 0)
  if (!hasData) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="mx-auto h-8 w-20">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} maxBarSize={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
