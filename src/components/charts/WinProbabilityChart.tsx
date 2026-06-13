import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface WinProbabilityChartProps {
  teamAName: string
  teamBName: string
  teamAProbability: number
  teamBProbability: number
  gameColor: string
}

export function WinProbabilityChart({
  teamAName,
  teamBName,
  teamAProbability,
  teamBProbability,
  gameColor,
}: WinProbabilityChartProps) {
  const data = [
    {
      name: teamAName,
      value: Math.round(teamAProbability * 100),
      color: '#00FFAA',
    },
    {
      name: teamBName,
      value: Math.round(teamBProbability * 100),
      color: gameColor,
    },
  ]

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1A1A1A',
              border: '1px solid hsl(0 0% 20%)',
              borderRadius: '0.75rem',
              color: '#f5f5f5',
            }}
            formatter={(value: number) => [`${value}%`, 'Вероятность']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 -mt-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">
              {entry.name}: <strong className="text-foreground">{entry.value}%</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
