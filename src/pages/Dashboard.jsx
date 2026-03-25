import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '../components/AnimatedBackground';
import { doc, getDoc } from 'firebase/firestore';
import AddExpenseDialog from '../components/AddExpenseDialog';
import { db } from '../firebase';
import { DEFAULT_CATEGORIES } from '../components/expense/expenseConfig';
import BudgetWidget from '../components/BudgetWidget';
import { 
  LayoutDashboard, Wallet, Tags, PieChart,
  Bell, User, LogOut, Sparkles,
  ArrowUpRight, BarChart2, ShieldCheck, Clock
} from 'lucide-react';

// ── Shared nav items — teammates add their path here ──────────────────────
const NAV_ITEMS = [
  { path: '/dashboard',              label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/expenses',               label: 'Expenses',   icon: Wallet },
  { path: '/expense-categorization', label: 'Categories', icon: Tags },
  { path: '/reports',                label: 'Reports',    icon: PieChart },
  { path: '/budgeting',              label: 'Budget',     icon: Bell },
  { path: '/profile',                label: 'Profile',    icon: User },
];

// ── Quick-access tiles teammates can extend ───────────────────────────────
const QUICK_TILES = [
  {
    path: '/expense-categorization',
    icon: Wallet,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/20',
    border: 'hover:border-blue-500/30',
    title: 'Add Expense',
    desc: 'Record a new transaction',
  },
  {
    path: '/expense-categorization',
    icon: Tags,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/20',
    border: 'hover:border-purple-500/30',
    title: 'Categories',
    desc: 'Manage spending categories',
  },
  {
    path: '/reports',
    icon: PieChart,
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/20',
    border: 'hover:border-indigo-500/30',
    title: 'View Reports',
    desc: 'Analytics & insights',
  },
  {
    path: '/budgeting',
    icon: Bell,
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/20',
    border: 'hover:border-violet-500/30',
    title: 'Set Budget',
    desc: 'Configure budget alerts',
  },
];

// ── Floating glass nav ─────────────────────────────────────────────────────

// ── Module placeholder card ────────────────────────────────────────────────
// Teammates drop their completed widget here instead of this placeholder
function ModuleSlot({ icon: Icon, title, hint }) {
  return (
    <div className="group bg-slate-900/30 backdrop-blur-xl border border-dashed border-white/10
                    rounded-3xl p-6 flex flex-col items-center justify-center gap-3 min-h-[160px]
                    hover:border-purple-500/30 transition-all duration-300 cursor-default">
      <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-purple-500/10 transition-colors">
        <Icon className="text-slate-500 group-hover:text-purple-400 transition-colors" size={24} />
      </div>
      <p className="text-slate-500 font-medium text-sm">{title}</p>
      <p className="text-slate-600 text-xs text-center">{hint}</p>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [error, setError] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const { currentUser, logout, userProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadCategories = async () => {
      if (!currentUser) {
        return;
      }

      try {
        const categorySnapshot = await getDoc(doc(db, 'users', currentUser.uid, 'settings', 'categories'));
        if (categorySnapshot.exists()) {
          setCategories(categorySnapshot.data().items || DEFAULT_CATEGORIES);
        }
      } catch {
        setCategories(DEFAULT_CATEGORIES);
      }
    };

    loadCategories();
  }, [currentUser]);

  async function handleLogout() {
    setError('');
    try { await logout(); navigate('/login'); }
    catch { setError('Failed to log out'); }
  }

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const defaultCurrency = userProfile?.preferences?.currency || '₹';

  return (
    <div className="min-h-screen text-slate-50 relative overflow-hidden">
      <AnimatedBackground />
      <AddExpenseDialog
        isOpen={showAddExpense}
        categories={categories}
        defaultCurrency={defaultCurrency}
        onCancel={() => setShowAddExpense(false)}
        onSaved={() => setShowAddExpense(false)}
      />

      <div className="relative z-10 pr-24 p-8">
        <div className="max-w-5xl mx-auto">

          {/* ── Header ── */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-xl">
                <Sparkles className="text-purple-400" size={20} />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Dashboard
              </h1>
            </div>
            <p className="text-slate-400 ml-1">
              {greeting()},{' '}
              <span className="text-slate-200 font-medium">
                {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User'}
              </span>
              ! Here's your expense overview.
            </p>
            {error && (
              <div className="mt-4 bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
                {error}
              </div>
            )}
          </header>

          {/* ── Summary Banner ── */}
          <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-indigo-600/20
                          backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-8
                          flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1">
              <p className="text-slate-400 text-sm uppercase tracking-wider mb-1">Month of March 2026</p>
              <p className="text-slate-300 text-sm">
                Navigate to <span className="text-purple-300 font-medium">Categories</span> to start tracking expenses,
                or <span className="text-blue-300 font-medium">Reports</span> to view analytics.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <button
                onClick={() => navigate('/expense-categorization')}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600
                           hover:from-purple-500 hover:to-blue-500 rounded-xl text-sm font-medium transition-all
                           shadow-lg shadow-purple-500/20"
              >
                <Tags size={16} /> Open Categories
              </button>
              <button
                onClick={() => setShowAddExpense(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 hover:bg-slate-700/60
                           border border-white/10 rounded-xl text-sm font-medium transition-all"
              >
                <Wallet size={16} /> Add Expense
              </button>
            </div>
          </div>

          {/* ── Quick Actions 2×2 grid ── */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-gradient-to-b from-purple-500 to-blue-600 rounded-full" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {QUICK_TILES.map(({ path, icon: Icon, iconColor, iconBg, border, title, desc }) => (
                <button
                  key={path}
                  onClick={() => {
                    if (title === 'Add Expense') {
                      setShowAddExpense(true);
                      return;
                    }

                    navigate(path);
                  }}
                  className={`group p-5 bg-slate-900/40 backdrop-blur-xl border border-white/8
                               ${border} rounded-3xl text-left transition-all duration-300 hover:-translate-y-0.5
                               hover:shadow-lg hover:bg-slate-900/60`}
                >
                  <div className={`p-2.5 ${iconBg} rounded-xl mb-3 w-fit group-hover:scale-110 transition-transform`}>
                    <Icon className={iconColor} size={20} />
                  </div>
                  <p className="text-white font-medium text-sm mb-0.5">{title}</p>
                  <p className="text-slate-500 text-xs">{desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* ── Module slots — teammates replace placeholders with real widgets ── */}
          <section>
            <h2 className="text-lg font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-gradient-to-b from-purple-500 to-blue-600 rounded-full" />
              Modules
              <span className="ml-2 text-xs text-slate-600 font-normal">— teammates add features here</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Expense Entry module — teammate fills this */}
              <ModuleSlot
                icon={Wallet}
                title="Expense Entry"
                hint="Add your expense management widget here"
              />
              {/* Reports & Analytics — teammate fills this */}
              <ModuleSlot
                icon={BarChart2}
                title="Reports & Analytics"
                hint="Add your reports/charts widget here"
              />
              {/* Budgeting & Notifications */}
              <BudgetWidget />
            </div>
          </section>

          {/* ── Footer info strip ── */}
          <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-purple-600" />
              Data stored securely
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-blue-600" />
              {new Date().toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <span>Currency: </span>
              <span className="text-purple-500 font-medium">₹ INR</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
