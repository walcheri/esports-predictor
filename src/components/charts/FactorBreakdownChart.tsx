import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { FactorBreakdown } from '@/types'

interface FactorBreakdownChartProps {
  factors: FactorBreakdown[]
  teamAName: string
  teamBName: string
  gameColor: string
}

export function FactorBreakdownChart({
  factors,
  teamAName,
  teamBName,
  gameColor,
}: FactorBreakdownChartProps) {
  const data = factors.map((f) => ({
    name: f.name,
    [teamAName]: f.teamA,
    [teamBName]: f.teamB,
  }))

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 20%)" />
          <XAxis type="number" domain={[0, 100]} stroke="hsl(0 0% 60%)" fontSize={12} />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            stroke="hsl(0 0% 60%)"
            fontSize={11}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1A1A',
              border: '1px solid hsl(0 0% 20%)',
              borderRadius: '0.75rem',
              color: '#f5f5f5',
            }}
            formatter={(value: number) => [`${value}%`, '']}
          />
          <Legend />
          <Bar dataKey={teamAName} fill="#00FFAA" radius={[0, 4, 4, 0]} />
          <Bar dataKey={teamBName} fill={gameColor} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
