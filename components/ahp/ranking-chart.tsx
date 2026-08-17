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

interface ChartRow {
  name: string;
  [pillarName: string]: string | number;
}

export function RankingChart({ data, pillarNames }: { data: ChartRow[]; pillarNames: string[] }) {
  const height = Math.max(220, data.length * 56);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333333" horizontal={false} />
        <XAxis type="number" stroke="#9a9a94" fontSize={12} tickLine={false} axisLine={{ stroke: "#333333" }} />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          stroke="#9a9a94"
          fontSize={12}
          tickLine={false}
          axisLine={{ stroke: "#333333" }}
        />
        <Tooltip
          contentStyle={{ background: "#1c1c1c", border: "1px solid #333333", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#f5f5f0" }}
          cursor={{ fill: "#242424" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9a9a94" }} />
        {pillarNames.map((pillarName, i) => (
          <Bar key={pillarName} dataKey={pillarName} stackId="score" fill={categoricalColor(i)} radius={0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
