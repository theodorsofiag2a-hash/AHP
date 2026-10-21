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
      <RechartsRadarChart data={data} outerRadius="70%">
        <PolarGrid stroke={CHART_THEME.grid} />
        <PolarAngleAxis dataKey="pillar" stroke={CHART_THEME.axis} fontSize={12} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} stroke={CHART_THEME.axisFaint} fontSize={10} tickCount={6} />
        <Tooltip
          contentStyle={CHART_TOOLTIP_STYLE}
          labelStyle={{ color: CHART_THEME.text }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_THEME.axis }} />
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
