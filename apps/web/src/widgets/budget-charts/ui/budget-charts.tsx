import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Tags, TrendingDown } from 'lucide-react'
import type { BudgetSummaryDTO } from '@balance/contracts'
import { fmtDayMonth, formatMoney, formatMoneyShort } from '@/shared/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

/** Оттенки неба, розы и сланца из палитры «Баланса» */
const PIE_COLORS = ['#F39BBF', '#6EBBF0', '#B23A6E', '#1D6FA8', '#F8C6DA', '#A9D6F6', '#4A505C', '#9AA1AD']
const TOP_CATEGORIES = 7

interface PieDatum {
  name: string
  total: number
  color: string
}

function buildPieData(summary: BudgetSummaryDTO): PieDatum[] {
  const expenses = summary.byCategory.filter((c) => c.type === 'expense')
  const fallback = PIE_COLORS[PIE_COLORS.length - 1]!
  const data = expenses
    .slice(0, TOP_CATEGORIES)
    .map((c, i) => ({ name: c.category, total: c.total, color: PIE_COLORS[i] ?? fallback }))
  const rest = expenses.slice(TOP_CATEGORIES)
  if (rest.length)
    data.push({ name: 'Прочее', total: rest.reduce((s, c) => s + c.total, 0), color: fallback })
  return data
}

function TooltipBox({ title, value }: { title: string; value: string }) {
  return (
    <div className="glass-strong rounded-xl px-3 py-2 text-xs">
      <div className="font-medium">{title}</div>
      <div className="text-muted-foreground">{value}</div>
    </div>
  )
}

/** Структура расходов по категориям и динамика по дням */
export function BudgetCharts({ summary }: { summary: BudgetSummaryDTO }) {
  const pieData = buildPieData(summary)
  const dayTicks = summary.byDay.filter((d) => d.day % 3 === 1).map((d) => d.day)

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Tags className="size-4.5 text-primary" />
            Расходы по категориям
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="total"
                nameKey="name"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {pieData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  const datum = payload?.[0]?.payload as PieDatum | undefined
                  return active && datum ? (
                    <TooltipBox title={datum.name} value={formatMoney(datum.total)} />
                  ) : null
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto shrink-0 font-medium">{formatMoney(d.total)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="size-4.5 text-primary" />
            Динамика расходов
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={summary.byDay} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                strokeOpacity={0.12}
              />
              <XAxis
                dataKey="day"
                ticks={dayTicks}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fontSize: 11, fill: 'currentColor' }}
              />
              <YAxis
                width={64}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'currentColor' }}
                tickFormatter={(v: number) => formatMoneyShort(v)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  const datum = payload?.[0]?.payload as BudgetSummaryDTO['byDay'][number] | undefined
                  if (!active || !datum) return null
                  const date = `${summary.month}-${String(datum.day).padStart(2, '0')}`
                  return (
                    <TooltipBox title={fmtDayMonth(date)} value={`Расходы: ${formatMoney(datum.expense)}`} />
                  )
                }}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Расходы"
                stroke="var(--rose)"
                strokeWidth={2}
                fill="var(--rose)"
                fillOpacity={0.25}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
