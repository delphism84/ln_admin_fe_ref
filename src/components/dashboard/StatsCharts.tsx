'use client';

import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Panel } from '@/components/ui/adm';
import { fmtNumber } from '@/lib/format';

export type DayCount = { day: string; count: number };
export type NameValue = { name: string; value: number };

// 차트 색은 라이트·다크 두 테마 모두에서 읽히는 중간 명도로 고정한다. 축·격자는 글자색(currentColor)을 따른다.
const LINE_COLOR = '#1AA182';
const BAR_COLOR = '#3B82F6';
const PIE_COLORS = ['#1AA182', '#3B82F6', '#F59E0B'];

const AXIS_TICK = { fontSize: 11, fill: 'currentColor', opacity: 0.7 };
const TOOLTIP_STYLE = {
  background: 'oklch(var(--b1))',
  border: '1px solid oklch(var(--b3))',
  borderRadius: 8,
  fontSize: 12,
  color: 'oklch(var(--bc))',
};

/** 2026-09-30 → 09-30 */
const shortDay = (day: string) => day.slice(5);
const tooltipValue = (v: number | string, unit: string): [string, string] => [`${fmtNumber(Number(v))}${unit}`, ''];

function ChartBox({ empty, children }: { empty: boolean; children: React.ReactElement }) {
  if (empty) return <div className="h-[260px] flex items-center justify-center text-base-content/55">데이터가 없습니다</div>;
  return (
    <div className="h-[260px] text-base-content">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export default function StatsCharts({ lineUsers, barGlucose, pieDevices }: { lineUsers: DayCount[]; barGlucose: DayCount[]; pieDevices: NameValue[] }) {
  const pieTotal = pieDevices.reduce((s, p) => s + p.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      <Panel title="일별 신규 회원 (최근 14일)" bodyClass="p-3">
        <ChartBox empty={lineUsers.length === 0}>
          <LineChart data={lineUsers} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_TICK} stroke="currentColor" strokeOpacity={0.25} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} stroke="currentColor" strokeOpacity={0.25} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number | string) => tooltipValue(v, '명')} separator="" />
            <Line type="monotone" dataKey="count" stroke={LINE_COLOR} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
          </LineChart>
        </ChartBox>
      </Panel>

      <Panel title="일별 혈당 수집 건수 (최근 14일)" bodyClass="p-3">
        <ChartBox empty={barGlucose.length === 0}>
          <BarChart data={barGlucose} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_TICK} stroke="currentColor" strokeOpacity={0.25} />
            <YAxis allowDecimals={false} tick={AXIS_TICK} stroke="currentColor" strokeOpacity={0.25} tickFormatter={(v: number) => fmtNumber(v)} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'currentColor', fillOpacity: 0.06 }} formatter={(v: number | string) => tooltipValue(v, '건')} separator="" />
            <Bar dataKey="count" fill={BAR_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartBox>
      </Panel>

      <Panel title="회원당 기기 수" bodyClass="p-3" className="lg:col-span-2 xl:col-span-1">
        <ChartBox empty={pieTotal === 0}>
          <PieChart>
            <Pie
              data={pieDevices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={84}
              stroke="oklch(var(--b1))"
              label={({ name, value }: { name?: string; value?: number }) => (value ? `${name}: ${fmtNumber(value)}` : '')}
              labelLine={false}
              fontSize={11}
            >
              {pieDevices.map((p, i) => (
                <Cell key={p.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'oklch(var(--bc))' }} formatter={(v: number | string, name: string) => [`${fmtNumber(Number(v))}명`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartBox>
      </Panel>
    </div>
  );
}
