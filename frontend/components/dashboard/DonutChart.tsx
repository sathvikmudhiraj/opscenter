import { PieChart, Pie, Tooltip, Legend, Cell, ResponsiveContainer } from "recharts";

const COLORS = ["#1d4ed8", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

interface DonutChartProps {
  title: string;
  data: { label: string; value: number }[];
  formatter?: (value: number, name: string) => string;
}

export function DonutChart({ title, data, formatter }: DonutChartProps) {
  // Calculate total for percentage (used in tooltip)
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {data.length ? (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                labelLine={false}
                // We remove the label property to avoid rendering labels on the slices
                fill={(payload: any, i: number) => COLORS[i % COLORS.length]}
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ payload }: any) => {
                  const [entry] = payload;
                  if (!entry) return null;
                  const { name, value } = entry;
                  const percentage = total > 0 ? ((value ?? 0) / total) * 100 : 0;
                  return (
                    <div className="text-left">
                      <p><strong>{name}</strong></p>
                      <p>Count: {value}</p>
                      <p>Percentage: {percentage.toFixed(1)}%</p>
                    </div>
                  );
                }}
              />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-500">
              No data available.
            </div>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}