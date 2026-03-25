import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import AnimatedBackground from '../components/AnimatedBackground';
import { db } from '../firebase';
import {
  doc, getDoc, collection, onSnapshot, query
} from 'firebase/firestore';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Sparkles, TrendingUp, TrendingDown, CalendarDays,
  BarChart2, PieChart as PieChartIcon, Wallet, Clock,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { DEFAULT_CATEGORIES, EXPANDED_COLORS as CHART_COLORS } from '../components/expense/expenseConfig';

// ── Color Palette ────────────────────────────────────────────────────────────
// Redundant local definitions removed to use those from expenseConfig.js

// ══════════════════════════════════════════════════════════════════════════════
// PURE REPORT FUNCTIONS — modular, no side effects
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a "YYYY-MM-DD" string into a local Date object
 */
function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  return new Date(dateStr + 'T00:00:00');
}

/**
 * Format a number as ₹ currency
 */
function formatCurrency(amount) {
  return `₹${Number(amount).toFixed(2)}`;
}

/**
 * Get the month name + year string from a Date
 */
function getMonthLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// ── 1. Monthly Report ────────────────────────────────────────────────────────
/**
 * Filter expenses for the current month, calculate total, group by category.
 * @param {Array} expenses - Array of expense objects
 * @returns {{ period: string, total: number, byCategory: Object, count: number }}
 */
function getMonthlyReport(expenses) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthExpenses = expenses.filter(exp => {
    const d = parseDate(exp.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const total = monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  const byCategory = getCategoryTotals(monthExpenses);

  return {
    period: getMonthLabel(now),
    total,
    byCategory,
    count: monthExpenses.length
  };
}

// ── 2. Weekly Report ─────────────────────────────────────────────────────────
/**
 * Filter expenses for the last 7 days, calculate total, provide daily breakdown.
 * @param {Array} expenses
 * @returns {{ total: number, dailyBreakdown: Object, count: number }}
 */
function getWeeklyReport(expenses) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const weekExpenses = expenses.filter(exp => {
    const d = parseDate(exp.date);
    return d >= sevenDaysAgo && d <= today;
  });

  const total = weekExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  // Build daily breakdown keyed by date string
  const dailyBreakdown = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    dailyBreakdown[key] = 0;
  }

  weekExpenses.forEach(exp => {
    if (dailyBreakdown.hasOwnProperty(exp.date)) {
      dailyBreakdown[exp.date] += exp.amount || 0;
    }
  });

  return { total, dailyBreakdown, count: weekExpenses.length };
}

// ── 3. Category Totals ───────────────────────────────────────────────────────
/**
 * Group expenses by categoryId and sum amounts.
 * @param {Array} expenses
 * @returns {Object} - { categoryId: totalAmount }
 */
function getCategoryTotals(expenses) {
  const totals = {};
  expenses.forEach(exp => {
    const catId = exp.categoryId || exp.category || 'uncategorized';
    totals[catId] = (totals[catId] || 0) + (exp.amount || 0);
  });
  return totals;
}

// ── 4. Trend Data (Last 3–6 months) ─────────────────────────────────────────
/**
 * Compare spending over the last 6 months, compute % change and direction.
 * @param {Array} expenses
 * @returns {{ months: Array, changePercent: string, direction: string }}
 */
function getTrendData(expenses) {
  const months = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth();
    const y = d.getFullYear();

    const monthExpenses = expenses.filter(exp => {
      const ed = parseDate(exp.date);
      return ed.getMonth() === m && ed.getFullYear() === y;
    });

    const total = monthExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    months.push({
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      fullLabel: getMonthLabel(d),
      total,
      count: monthExpenses.length
    });
  }

  // Percentage change: current month vs previous month
  const current = months[months.length - 1].total;
  const previous = months[months.length - 2].total;
  let changePercent = '0.0';
  let direction = 'flat';

  if (previous > 0) {
    changePercent = (((current - previous) / previous) * 100).toFixed(1);
    direction = current > previous ? 'up' : current < previous ? 'down' : 'flat';
  } else if (current > 0) {
    changePercent = '100.0';
    direction = 'up';
  }

  return { months, changePercent, direction };
}

// ══════════════════════════════════════════════════════════════════════════════
// REUSABLE UI PIECES
// ══════════════════════════════════════════════════════════════════════════════

const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl ${className}`}>
    {children}
  </div>
);

const SectionHeading = ({ icon: Icon, children }) => (
  <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
    <span className="w-1.5 h-5 bg-gradient-to-b from-purple-500 to-blue-600 rounded-full" />
    {Icon && <Icon size={18} className="text-purple-400" />}
    {children}
  </h2>
);

// Custom tooltip for recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-purple-500/30 rounded-xl px-4 py-3 shadow-xl">
      <p className="text-slate-400 text-xs mb-1">{label || payload[0]?.name}</p>
      <p className="text-white font-semibold">{formatCurrency(payload[0]?.value)}</p>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYTICS COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function Analytics() {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  // ── Fetch data from Firestore ─────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const userId = currentUser.uid;

    // Load categories
    const loadCategories = async () => {
      try {
        const catRef = doc(db, 'users', userId, 'settings', 'categories');
        const catSnap = await getDoc(catRef);
        if (catSnap.exists()) {
          setCategories(catSnap.data().items || DEFAULT_CATEGORIES);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };

    // Real-time listener for expenses
    const expensesRef = collection(db, 'users', userId, 'expenses');
    const q = query(expensesRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenses(data);
      setLoading(false);
    }, (err) => {
      console.error('Expenses listener error:', err);
      setLoading(false);
    });

    loadCategories();
    return () => unsubscribe();
  }, [currentUser]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getCatById = (id) =>
    categories.find(c => c.id === id) || { name: 'Uncategorized', color: '#6B7280', icon: '❓' };

  // ── Compute reports (derived from state) ──────────────────────────────────
  const monthlyReport = getMonthlyReport(expenses);
  const weeklyReport  = getWeeklyReport(expenses);
  const trendData     = getTrendData(expenses);

  // Prepare chart data
  const categoryChartData = Object.entries(getCategoryTotals(expenses))
    .map(([catId, total]) => {
      const cat = getCatById(catId);
      return { name: cat.name, value: total, color: cat.color, icon: cat.icon };
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const dailyBarData = Object.entries(weeklyReport.dailyBreakdown)
    .map(([date, amount]) => {
      const d = new Date(date + 'T00:00:00');
      return {
        date,
        label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        fullLabel: d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }),
        amount
      };
    });

  const trendBarData = trendData.months.map(m => ({
    label: m.label,
    fullLabel: m.fullLabel,
    amount: m.total
  }));

  // ── Loading State ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-purple-400 text-lg font-medium">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden">
      <AnimatedBackground />

      <div className="relative z-10 pr-24 p-8">
        <div className="max-w-6xl mx-auto">

          {/* ── Page Header ── */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-xl">
                <Sparkles className="text-purple-400" size={20} />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Reports & Analytics
              </h1>
            </div>
            <p className="text-slate-400 ml-1">
              Insights into your spending patterns, trends, and category breakdowns.
            </p>
          </header>

          {/* ── Summary Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: 'This Month',
                value: formatCurrency(monthlyReport.total),
                sub: `${monthlyReport.count} transactions`,
                icon: CalendarDays,
                color: 'purple'
              },
              {
                label: 'Last 7 Days',
                value: formatCurrency(weeklyReport.total),
                sub: `${weeklyReport.count} transactions`,
                icon: Clock,
                color: 'blue'
              },
              {
                label: 'Categories',
                value: categoryChartData.length,
                sub: 'with spending',
                icon: PieChartIcon,
                color: 'indigo'
              },
              {
                label: 'Monthly Trend',
                value: `${trendData.changePercent}%`,
                sub: trendData.direction === 'up' ? 'increase' : trendData.direction === 'down' ? 'decrease' : 'no change',
                icon: trendData.direction === 'up' ? TrendingUp : trendData.direction === 'down' ? TrendingDown : Minus,
                color: trendData.direction === 'up' ? 'red' : 'green'
              }
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <GlassCard key={label} className={`p-5 border-${color === 'red' ? 'red' : color === 'green' ? 'green' : color}-500/20`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={16} className={`text-${color === 'red' ? 'red' : color === 'green' ? 'green' : color}-400`} />
                  <span className="text-xs text-slate-400 uppercase tracking-wider">{label}</span>
                </div>
                <p className={`text-2xl font-bold text-${color === 'red' ? 'red' : color === 'green' ? 'green' : color}-400`}>{value}</p>
                <p className="text-xs text-slate-500 mt-1">{sub}</p>
              </GlassCard>
            ))}
          </div>

          {/* ── Row 1: Monthly Report + Weekly Report ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Monthly Report Card */}
            <GlassCard className="p-6">
              <SectionHeading icon={CalendarDays}>Monthly Report</SectionHeading>

              {monthlyReport.count === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Wallet size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No expenses recorded this month.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-slate-400 text-sm">Period</span>
                      <span className="text-white font-medium text-sm">{monthlyReport.period}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-slate-400 text-sm">Transactions</span>
                      <span className="text-white font-medium text-sm">{monthlyReport.count}</span>
                    </div>

                    {/* Category breakdown */}
                    {Object.entries(monthlyReport.byCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([catId, amount]) => {
                        const cat = getCatById(catId);
                        return (
                          <div key={catId} className="flex justify-between items-center py-2 border-b border-white/5">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{cat.icon}</span>
                              <span className="text-slate-300 text-sm">{cat.name}</span>
                            </div>
                            <span className="font-semibold text-sm" style={{ color: cat.color }}>
                              {formatCurrency(amount)}
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-4 border-t-2 border-purple-500/30">
                    <span className="text-purple-300 font-semibold">Total</span>
                    <span className="text-2xl font-bold text-purple-400">{formatCurrency(monthlyReport.total)}</span>
                  </div>
                </>
              )}
            </GlassCard>

            {/* Weekly Report Card */}
            <GlassCard className="p-6">
              <SectionHeading icon={Clock}>Weekly Report (Last 7 Days)</SectionHeading>

              {weeklyReport.count === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Wallet size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No expenses in the last 7 days.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-white/5 mb-4">
                    <span className="text-slate-400 text-sm">Transactions</span>
                    <span className="text-white font-medium text-sm">{weeklyReport.count}</span>
                  </div>

                  {/* Daily breakdown boxes */}
                  <div className="grid grid-cols-7 gap-2 mb-4">
                    {dailyBarData.map(day => (
                      <div key={day.date} className="bg-slate-800/50 rounded-xl p-3 text-center border border-white/5">
                        <p className="text-[11px] text-slate-500 mb-1">{day.label}</p>
                        <p className="text-sm font-semibold text-white">
                          ₹{day.amount.toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center pt-4 border-t-2 border-blue-500/30">
                    <span className="text-blue-300 font-semibold">Total</span>
                    <span className="text-2xl font-bold text-blue-400">{formatCurrency(weeklyReport.total)}</span>
                  </div>
                </>
              )}
            </GlassCard>
          </div>

          {/* ── Row 2: Charts ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

            {/* Pie Chart — Category Distribution */}
            <GlassCard className="p-6">
              <SectionHeading icon={PieChartIcon}>Spending by Category</SectionHeading>

              {categoryChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <PieChartIcon size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Add expenses to see category breakdown</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={110}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {categoryChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.3)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Legend
                      iconType="circle"
                      wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* Bar Chart — Daily Spending (Last 7 Days) */}
            <GlassCard className="p-6">
              <SectionHeading icon={BarChart2}>Daily Spending (Last 7 Days)</SectionHeading>

              {weeklyReport.count === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <BarChart2 size={40} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No data to display</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="amount"
                      fill="url(#barGradient)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={50}
                    />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#3B82F6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>
          </div>

          {/* ── Row 3: Trends ── */}
          <GlassCard className="p-6 mb-6">
            <SectionHeading icon={TrendingUp}>Spending Trends (6 Months)</SectionHeading>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Trend bar chart */}
              <div className="lg:col-span-2">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={trendBarData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="amount"
                      fill="url(#trendGradient)"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={60}
                    />
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A78BFA" />
                        <stop offset="100%" stopColor="#6366F1" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Month-by-month breakdown + indicator */}
              <div className="space-y-3">
                {trendData.months.map((m, i) => (
                  <div key={i} className="bg-slate-800/40 rounded-xl p-3 border border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">{m.fullLabel}</span>
                      <span className="text-white font-semibold text-sm">{formatCurrency(m.total)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{m.count} transaction{m.count !== 1 ? 's' : ''}</p>
                  </div>
                ))}

                {/* Trend indicator */}
                <div className={`rounded-xl p-4 border ${
                  trendData.direction === 'up'
                    ? 'bg-red-500/10 border-red-500/20'
                    : trendData.direction === 'down'
                    ? 'bg-green-500/10 border-green-500/20'
                    : 'bg-slate-800/40 border-white/5'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {trendData.direction === 'up' ? (
                      <ArrowUpRight size={18} className="text-red-400" />
                    ) : trendData.direction === 'down' ? (
                      <ArrowDownRight size={18} className="text-green-400" />
                    ) : (
                      <Minus size={18} className="text-slate-400" />
                    )}
                    <span className={`text-sm font-semibold ${
                      trendData.direction === 'up' ? 'text-red-400' :
                      trendData.direction === 'down' ? 'text-green-400' : 'text-slate-400'
                    }`}>
                      {trendData.changePercent}% {trendData.direction === 'up' ? 'increase' : trendData.direction === 'down' ? 'decrease' : 'no change'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Compared to previous month</p>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* ── Row 4: Category Breakdown Table ── */}
          {categoryChartData.length > 0 && (
            <GlassCard className="p-6 mb-8">
              <SectionHeading icon={Wallet}>Detailed Category Breakdown</SectionHeading>
              <div className="space-y-3">
                {categoryChartData.map((cat, i) => {
                  const totalAll = categoryChartData.reduce((s, c) => s + c.value, 0);
                  const pct = totalAll > 0 ? ((cat.value / totalAll) * 100).toFixed(1) : 0;
                  return (
                    <div key={i} className="bg-slate-800/40 rounded-2xl p-4 border border-white/5 hover:border-purple-500/20 transition-colors">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{cat.icon}</span>
                          <div>
                            <p className="font-medium text-white text-sm">{cat.name}</p>
                            <p className="text-xs text-slate-500">{pct}% of total</p>
                          </div>
                        </div>
                        <p className="font-bold text-sm" style={{ color: cat.color }}>
                          {formatCurrency(cat.value)}
                        </p>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: cat.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

        </div>
      </div>
    </div>
  );
}
