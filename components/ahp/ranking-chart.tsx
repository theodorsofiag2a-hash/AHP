"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoricalColor } from "@/lib/chart-colors";
import { CHART_THEME, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";

interface ChartRow {
  name: string;
  [pillarName: string]: string | number;
}

export function RankingChart({ data, pillarNames }: { data: ChartRow[]; pillarNames: string[] }) {
  const height = Math.max(220, data.length * 56);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
        <XAxis type="number" stroke={CHART_THEME.axis} fontSize={12} tickLine={false} axisLine={{ stroke: CHART_THEME.grid }} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          stroke={CHART_THEME.axis}
          fontSize={12}
          tickLine={false}
          axisLine={{ stroke: CHART_THEME.grid }}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelStyle={{ color: CHART_THEME.text }}
          cursor={{ fill: CHART_THEME.cursor }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_THEME.axis }} />
        {pillarNames.map((pillarName, i) => (
          <Bar key={pillarName} dataKey={pillarName} stackId="score" fill={categoricalColor(i)} stroke={CHART_THEME.surface} strokeWidth={1} radius={0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
