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

interface RadarRow {
  pillar: string;
  [alternativeName: string]: string | number;
}

export function AhpRadarChart({ data, seriesNames }: { data: RadarRow[]; seriesNames: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RechartsRadarChart data={data} outerRadius="70%">
        <PolarGrid stroke="#333333" />
        <PolarAngleAxis dataKey="pillar" stroke="#9a9a94" fontSize={12} />
        <PolarRadiusAxis angle={30} domain={[0, 10]} stroke="#6b6b66" fontSize={10} tickCount={6} />
        <Tooltip
          contentStyle={{ background: "#1c1c1c", border: "1px solid #333333", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#f5f5f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9a9a94" }} />
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
