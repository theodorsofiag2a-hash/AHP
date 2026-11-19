"use client";

import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart as RechartsRadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { categoricalColor } from "@/lib/chart-colors";
import { CHART_THEME, CHART_TOOLTIP_STYLE } from "@/lib/chart-theme";

interface RadarRow {
  pillar: string;
  [alternativeName: string]: string | number;
}

export function AhpRadarChart({ data, seriesNames }: { data: RadarRow[]; seriesNames: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsRadarChart data={data} outerRadius="70%" startAngle={90} endAngle={-270}>
        <PolarGrid stroke={CHART_THEME.grid} />
        <PolarAngleAxis dataKey="pillar" stroke={CHART_THEME.axis} fontSize={12} />
        {/* A teia começa no topo (90°); a escala 0–10 fica sobre a ponta de cima, alinhada com ela. */}
        <PolarRadiusAxis
          angle={90}
          domain={[0, 10]}
          tickCount={6}
          axisLine={false}
          tick={{ fontSize: 10, fill: CHART_THEME.axisFaint }}
        />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelStyle={{ color: CHART_THEME.text }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          // Texto da legenda em cor de texto; a cor da série fica só no marcador.
          formatter={(value) => <span style={{ color: CHART_THEME.axis }}>{value}</span>}
        />
        {seriesNames.map((name, i) => (
          <Radar
            key={name}
            name={name}
            dataKey={name}
            stroke={categoricalColor(i)}
            fill={categoricalColor(i)}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
      </RechartsRadarChart>
    </ResponsiveContainer>
  );
}
