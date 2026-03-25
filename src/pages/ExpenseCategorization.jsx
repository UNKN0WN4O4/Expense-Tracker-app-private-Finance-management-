import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AnimatedBackground from '../components/AnimatedBackground';
import AddExpenseDialog from '../components/AddExpenseDialog';
import { db } from '../firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection,
  deleteDoc,
  updateDoc,
  query,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend 
} from 'recharts';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  Tag, 
  LayoutGrid, 
  List, 
  DollarSign,
  Filter,
  TrendingUp,
  Wallet,
  LayoutDashboard,
  Tags,
  Bell,
  User,
  LogOut,
  Sparkles,
  ArrowUpRight,
  AlertCircle,
  Search,
} from 'lucide-react';
import { DEFAULT_CATEGORIES, EXPANDED_COLORS as COLORS } from '../components/expense/expenseConfig';

// ── Unified Theme Tokens ────────────────────────────────────────────────────
// Primary gradient : purple-600 → blue-600
// Heading gradient : purple-400 → blue-400 → indigo-400
// Background       : bg-slate-950
// Cards            : bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl
// Orbs             : violet-500/20, blue-500/20, purple-500/10

// Redundant local definitions removed to use those from expenseConfig.js

const NAV_ITEMS = [
  { path: '/dashboard',              label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/expenses',               label: 'Expenses',   icon: Wallet },
  { path: '/expense-categorization', label: 'Categories', icon: Tags },
  { path: '/reports',                label: 'Reports',    icon: PieChart },
  { path: '/budgeting',              label: 'Budget',     icon: Bell },
  { path: '/profile',                label: 'Profile',    icon: User },
];

// ── Floating Glass Nav (same as Dashboard) ──────────────────────────────────

// ── Glass Card Base ──────────────────────────────────────────────────────────
const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl ${className}`}>
    {children}
  </div>
);

// ── Section Heading ──────────────────────────────────────────────────────────
const SectionHeading = ({ children }) => (
  <h2 className="text-2xl font-semibold flex items-center gap-2 text-white">
    <span className="w-1.5 h-5 bg-gradient-to-b from-purple-500 to-blue-600 rounded-full" />
    {children}
  </h2>
);

// ── Main Component ───────────────────────────────────────────────────────────
const ExpenseCategorization = () => {
  const { currentUser, userProfile } = useAuth();
  const location = useLocation();
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [activeTab,               setActiveTab]               = useState(location.pathname === '/expenses' ? 'expenses' : 'categories');
  const [showAddCategory,         setShowAddCategory]         = useState(false);
  const [showAddExpense,          setShowAddExpense]          = useState(false);
  const [editingCategory,         setEditingCategory]         = useState(null);
  const [viewMode,                setViewMode]                = useState('grid');
  const [selectedCategoryFilter,  setSelectedCategoryFilter]  = useState('all');
  const [expenseSearch,           setExpenseSearch]           = useState('');
  const [newCategoryName,         setNewCategoryName]         = useState('');
  const [newCategoryColor,        setNewCategoryColor]        = useState(COLORS[0]);
  const [newCategoryIcon,         setNewCategoryIcon]         = useState('🏷️');
  const [categoryError,           setCategoryError]           = useState('');
  const getExpenseCategoryId = (expense) => expense.category || expense.categoryId || 'uncategorized';

  // ── Load data from Firebase on mount ──────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    const userId = currentUser.uid;
    
    // Load categories
    const loadCategories = async () => {
      const catRef = doc(db, 'users', userId, 'settings', 'categories');
      const catSnap = await getDoc(catRef);
      if (catSnap.exists()) {
        setCategories(catSnap.data().items || DEFAULT_CATEGORIES);
      } else {
        // Save defaults if not exists
        await setDoc(catRef, { items: DEFAULT_CATEGORIES });
      }
    };

    // Real-time listener for expenses
    const expensesRef = collection(db, 'users', userId, 'expenses');
    const q = query(expensesRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(expensesData);
      setLoading(false);
    });

    loadCategories();

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (location.pathname === '/expenses') {
      setActiveTab('expenses');
      return;
    }

    if (location.pathname === '/expense-categorization') {
      setActiveTab('categories');
    }
  }, [location.pathname]);

  // ── Save categories to Firebase ───────────────────────────────────────────
  const saveCategories = async (newCategories) => {
    if (!currentUser) return;
    const catRef = doc(db, 'users', currentUser.uid, 'settings', 'categories');
    await setDoc(catRef, { items: newCategories, updatedAt: serverTimestamp() });
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateCategoryName = (name) => {
    if (!name.trim())     return 'Category name is required';
    if (name.length < 2)  return 'Must be at least 2 characters';
    if (name.length > 20) return 'Must be less than 20 characters';
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== editingCategory?.id))
      return 'Category name already exists';
    return '';
  };

  // ── Category CRUD ──────────────────────────────────────────────────────────
  const handleAddCategory = async () => {
    const err = validateCategoryName(newCategoryName);
    if (err) { setCategoryError(err); return; }
    
    const newCategory = { 
      id: `custom-${Date.now()}`, 
      name: newCategoryName.trim(), 
      color: newCategoryColor, 
      icon: newCategoryIcon, 
      type: 'custom' 
    };
    
    const updatedCategories = [...categories, newCategory];
    setCategories(updatedCategories);
    await saveCategories(updatedCategories);
    resetCategoryForm();
  };

  const handleEditCategory = (cat) => {
    setEditingCategory(cat);
    setNewCategoryName(cat.name);
    setNewCategoryColor(cat.color);
    setNewCategoryIcon(cat.icon);
    setShowAddCategory(true);
  };

  const handleUpdateCategory = async () => {
    const err = validateCategoryName(newCategoryName);
    if (err) { setCategoryError(err); return; }
    
    const updatedCategories = categories.map(c => 
      c.id === editingCategory.id 
        ? { ...c, name: newCategoryName.trim(), color: newCategoryColor, icon: newCategoryIcon } 
        : c
    );
    
    setCategories(updatedCategories);
    await saveCategories(updatedCategories);
    resetCategoryForm();
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('Delete this category? Expenses will become uncategorized.')) {
      const updatedCategories = categories.filter(c => c.id !== id);
      setCategories(updatedCategories);
      await saveCategories(updatedCategories);
      
      // Update expenses that used this category
      const expensesToUpdate = expenses.filter(e => getExpenseCategoryId(e) === id);
      for (const exp of expensesToUpdate) {
        const expRef = doc(db, 'users', currentUser.uid, 'expenses', exp.id);
        await updateDoc(expRef, { category: 'uncategorized', categoryId: 'uncategorized' });
      }
    }
  };

  const resetCategoryForm = () => {
    setNewCategoryName(''); setNewCategoryColor(COLORS[0]); setNewCategoryIcon('🏷️');
    setCategoryError(''); setEditingCategory(null); setShowAddCategory(false);
  };

  // ── Expense CRUD ───────────────────────────────────────────────────────────
  const defaultCurrency = userProfile?.preferences?.currency || '₹';
  const formatAmount = (amount, currency = defaultCurrency) => `${currency}${Number(amount).toFixed(2)}`;

  const handleDeleteExpense = async (id) => {
    if (!currentUser) return;
    await deleteDoc(doc(db, 'users', currentUser.uid, 'expenses', id));
  };

  // ── Derived Data ───────────────────────────────────────────────────────────
  const getCatById     = (id) => categories.find(c => c.id === id) || { name: 'Uncategorized', color: '#6B7280', icon: '❓' };
  const getCatStats    = () => {
    const stats = {};
    expenses.forEach(e => {
      const categoryId = getExpenseCategoryId(e);
      if (!stats[categoryId]) stats[categoryId] = { total: 0, count: 0 };
      stats[categoryId].total += e.amount;
      stats[categoryId].count += 1;
    });
    return stats;
  };

  const catStats      = getCatStats();
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const chartData     = Object.entries(catStats).map(([id, d]) => ({ name: getCatById(id).name, value: d.total, color: getCatById(id).color })).filter(i => i.value > 0);

  const filteredExpenses = (selectedCategoryFilter === 'all' ? expenses : expenses.filter(e => getExpenseCategoryId(e) === selectedCategoryFilter))
    .filter(e => (e.note || e.description || '').toLowerCase().includes(expenseSearch.toLowerCase()));

  const ICON_OPTS = ['🏷️','🎯','💡','🔥','⭐','🎁','🏋️','📚','🎵','💊','🌿','🚀'];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-purple-400 text-xl">Loading...</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white relative overflow-x-hidden">
      <AnimatedBackground />


      <div className="relative z-10 pr-24 p-8">
        <div className="max-w-7xl mx-auto">

          {/* ── Page Header ── */}
          <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-purple-500/20 rounded-xl">
                  <Sparkles className="text-purple-400" size={20} />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Expense Categorization
                </h1>
              </div>
              <p className="text-slate-400 ml-1">Manage categories, assign expenses, and explore analytics</p>
            </div>

            {/* Header Stats */}
            <div className="flex gap-3 flex-wrap">
              {[
                { label: 'Total Spent', value: formatAmount(totalExpenses),    icon: Wallet,     color: 'purple', border: 'border-purple-500/20', text: 'text-purple-400' },
                { label: 'Categories',  value: categories.length,               icon: Tags,       color: 'blue',   border: 'border-blue-500/20',   text: 'text-blue-400' },
                { label: 'Transactions',value: expenses.length,                  icon: DollarSign, color: 'indigo', border: 'border-indigo-500/20', text: 'text-indigo-400' },
              ].map(({ label, value, icon: Icon, border, text }) => (
                <div key={label} className={`bg-slate-900/50 backdrop-blur-xl rounded-2xl p-4 border ${border}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon size={15} className={text} />
                    <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
                  </div>
                  <p className={`text-2xl font-bold ${text}`}>{value}</p>
                </div>
              ))}
            </div>
          </header>

          {/* ── Tabs ── */}
          <div className="flex gap-2 mb-8 bg-slate-900/50 backdrop-blur-xl p-1.5 rounded-2xl border border-white/10 w-fit">
            {[
              { id: 'categories', label: 'Categories',    icon: LayoutGrid },
              { id: 'expenses',   label: 'Assign Expenses', icon: Tag },
              { id: 'analytics',  label: 'Analytics',     icon: TrendingUp },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 text-sm ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1 — CATEGORIES
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Toolbar */}
              <div className="flex justify-between items-center">
                <SectionHeading>Manage Categories</SectionHeading>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                    className="p-2.5 rounded-xl bg-slate-900/50 hover:bg-slate-800/80 border border-white/10 transition-all backdrop-blur-sm text-slate-400 hover:text-white"
                    title="Toggle view"
                  >
                    {viewMode === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}
                  </button>
                  <button
                    onClick={() => setShowAddCategory(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium text-sm transition-all shadow-lg shadow-purple-500/25"
                  >
                    <Plus size={18} /> Add Category
                  </button>
                </div>
              </div>

              {/* Add / Edit Category Form */}
              {showAddCategory && (
                <GlassCard className="p-6 border-purple-500/20">
                  <h3 className="text-xl font-semibold mb-5 flex items-center gap-2">
                    <span className="w-1.5 h-5 bg-gradient-to-b from-purple-500 to-blue-600 rounded-full" />
                    {editingCategory ? 'Edit Category' : 'Create Custom Category'}
                  </h3>
                  <div className="space-y-5">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Category Name</label>
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={e => { setNewCategoryName(e.target.value); setCategoryError(''); }}
                        placeholder="e.g., Freelance, Gym, Education"
                        className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 rounded-xl 
                                   focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 
                                   transition-all text-white placeholder-slate-500 text-sm"
                      />
                      {categoryError && (
                        <p className="mt-2 text-sm text-red-400 flex items-center gap-1.5">
                          <AlertCircle size={14} /> {categoryError}
                        </p>
                      )}
                    </div>

                    {/* Icon */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Icon</label>
                      <div className="flex gap-2 flex-wrap">
                        {ICON_OPTS.map(ic => (
                          <button
                            key={ic}
                            onClick={() => setNewCategoryIcon(ic)}
                            className={`w-10 h-10 rounded-xl text-xl transition-all flex items-center justify-center ${
                              newCategoryIcon === ic
                                ? 'bg-purple-500/30 ring-2 ring-purple-500/60 scale-110'
                                : 'bg-slate-800/60 hover:bg-slate-700/60 border border-white/5'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">Color</label>
                      <div className="flex gap-3 flex-wrap">
                        {COLORS.map(color => (
                          <button
                            key={color}
                            onClick={() => setNewCategoryColor(color)}
                            className={`w-9 h-9 rounded-full transition-all ${
                              newCategoryColor === color ? 'ring-4 ring-white/40 scale-110' : 'hover:scale-105'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-white/5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: newCategoryColor + '30' }}>
                        {newCategoryIcon}
                      </div>
                      <div>
                        <p className="font-medium" style={{ color: newCategoryColor }}>{newCategoryName || 'Preview'}</p>
                        <p className="text-xs text-slate-500">Custom Category</p>
                      </div>
                      <div className="ml-auto w-6 h-6 rounded-full" style={{ backgroundColor: newCategoryColor }} />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={editingCategory ? handleUpdateCategory : handleAddCategory}
                        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-sm"
                      >
                        <Check size={18} /> {editingCategory ? 'Update Category' : 'Create Category'}
                      </button>
                      <button
                        onClick={resetCategoryForm}
                        className="px-6 py-3 bg-slate-800/60 hover:bg-slate-700/60 border border-white/10 rounded-xl font-medium transition-all text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </GlassCard>
              )}

              {/* Categories Grid / List */}
              {categories.length === 0 ? (
                <GlassCard className="p-12 text-center">
                  <Tags size={48} className="mx-auto mb-4 text-slate-600" />
                  <p className="text-slate-400">No categories yet. Create your first one!</p>
                </GlassCard>
              ) : (
                <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4' : 'space-y-3'}>
                  {categories.map(cat => {
                    const stats    = catStats[cat.id] || { total: 0, count: 0 };
                    const pct      = totalExpenses > 0 ? (stats.total / totalExpenses) * 100 : 0;
                    return (
                      <div
                        key={cat.id}
                        className={`group relative bg-slate-900/40 backdrop-blur-xl border border-white/10 
                                    hover:border-purple-500/40 rounded-3xl p-5 transition-all duration-300 
                                    hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10
                                    ${viewMode === 'list' ? 'flex items-center gap-4' : ''}`}
                      >
                        {/* Hover glow */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="relative flex items-start justify-between mb-3 w-full">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl" style={{ backgroundColor: cat.color + '22' }}>
                              {cat.icon}
                            </div>
                            <div>
                              <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">{cat.name}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                cat.type === 'default' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                              }`}>
                                {cat.type === 'default' ? 'Default' : 'Custom'}
                              </span>
                            </div>
                          </div>
                          {cat.type === 'custom' && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditCategory(cat)} className="p-2 hover:bg-purple-500/20 rounded-lg text-slate-400 hover:text-purple-300 transition-colors">
                                <Edit2 size={15} />
                              </button>
                              <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>

                        {viewMode === 'grid' && (
                          <div className="relative">
                            <div className="h-1.5 w-full rounded-full bg-slate-800/80 mb-3 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: cat.color }}
                              />
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">{stats.count} expense{stats.count !== 1 ? 's' : ''}</span>
                              <span className="font-semibold" style={{ color: cat.color }}>{formatAmount(stats.total)}</span>
                            </div>
                            {pct > 0 && (
                              <p className="text-xs text-slate-500 mt-1 text-right">{pct.toFixed(1)}% of total</p>
                            )}
                          </div>
                        )}

                        {viewMode === 'list' && (
                          <div className="flex items-center gap-4 ml-auto">
                            <span className="text-sm text-slate-400">{stats.count} exp.</span>
                            <span className="font-semibold" style={{ color: cat.color }}>{formatAmount(stats.total)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2 — EXPENSES (ASSIGN)
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'expenses' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <SectionHeading>Assign Categories to Expenses</SectionHeading>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl font-medium text-sm transition-all shadow-lg shadow-purple-500/25"
                >
                  <Plus size={18} /> Add Expense
                </button>
              </div>

              {/* Add Expense Form */}
              <AddExpenseDialog
                isOpen={showAddExpense}
                categories={categories}
                defaultCurrency={defaultCurrency}
                onCancel={() => setShowAddExpense(false)}
                onSaved={() => setShowAddExpense(false)}
              />

              {/* Filter & Search Bar */}
              <GlassCard className="p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={expenseSearch}
                      onChange={e => setExpenseSearch(e.target.value)}
                      placeholder="Search expenses..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-800/60 border border-white/10 rounded-xl 
                                 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 
                                 text-white placeholder-slate-500 text-sm transition-all"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400 shrink-0" />
                    <select
                      value={selectedCategoryFilter}
                      onChange={e => setSelectedCategoryFilter(e.target.value)}
                      className="px-3 py-2.5 bg-slate-800/60 border border-white/10 rounded-xl 
                                 focus:outline-none focus:border-purple-500 text-sm text-white cursor-pointer transition-all"
                    >
                      <option value="all" className="bg-slate-900">All Categories</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </GlassCard>

              {/* Expenses List */}
              <GlassCard className="overflow-hidden">
                <div className="divide-y divide-white/5">
                  {filteredExpenses.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                      <DollarSign size={40} className="mx-auto mb-4 opacity-30" />
                      <p className="font-medium">No expenses found</p>
                      <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or add a new expense</p>
                    </div>
                  ) : (
                    filteredExpenses.map(exp => {
                      const cat = getCatById(getExpenseCategoryId(exp));
                      return (
                        <div key={exp.id} className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors group">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: cat.color + '22' }}>
                            {cat.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{exp.note || exp.description || 'Untitled expense'}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: cat.color + '30', color: cat.color }}>
                                {cat.name}
                              </span>
                              <span className="text-slate-500 text-xs">•</span>
                              <span className="text-slate-500 text-xs">{exp.date}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-white">{formatAmount(exp.amount, exp.currency)}</span>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {filteredExpenses.length > 0 && (
                  <div className="px-4 py-3 border-t border-white/5 flex justify-between text-sm text-slate-400">
                    <span>{filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}</span>
                    <span className="font-semibold text-purple-400">{formatAmount(filteredExpenses.reduce((s, e) => s + e.amount, 0))} total</span>
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3 — ANALYTICS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <SectionHeading>Category-wise Analytics</SectionHeading>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <GlassCard className="p-6">
                  <h3 className="text-lg font-semibold mb-1 text-center text-white">Spending Distribution</h3>
                  <p className="text-xs text-slate-500 text-center mb-4">All-time breakdown by category</p>
                  {chartData.length === 0 ? (
                    <div className="h-64 flex items-center justify-center text-slate-500">
                      <div className="text-center">
                        <PieChart size={40} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Add expenses to see analytics</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%" cy="50%"
                          innerRadius={70} outerRadius={110}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {chartData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.2)" strokeWidth={2} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '12px', color: '#fff' }}
                          formatter={v => [formatAmount(v), 'Amount']}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </GlassCard>

                {/* Category Summary */}
                <GlassCard className="p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Category Summary</h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {Object.entries(catStats)
                      .sort(([, a], [, b]) => b.total - a.total)
                      .map(([id, data]) => {
                        const cat = getCatById(id);
                        const pct = totalExpenses > 0 ? ((data.total / totalExpenses) * 100).toFixed(1) : 0;
                        return (
                          <div key={id} className="bg-slate-800/40 rounded-2xl p-4 border border-white/5 hover:border-purple-500/20 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xl">{cat.icon}</span>
                                <div>
                                  <p className="font-medium text-white text-sm">{cat.name}</p>
                                  <p className="text-xs text-slate-500">{data.count} transaction{data.count !== 1 ? 's' : ''}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-sm" style={{ color: cat.color }}>{formatAmount(data.total)}</p>
                                <p className="text-xs text-slate-500">{pct}%</p>
                              </div>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                            </div>
                          </div>
                        );
                      })}
                    {Object.keys(catStats).length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <p className="text-sm">No data yet. Add expenses to see summary!</p>
                      </div>
                    )}
                  </div>
                </GlassCard>
              </div>

              {/* Detailed Breakdown Grid */}
              <GlassCard className="overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-gradient-to-b from-purple-500 to-blue-600 rounded-full" />
                  <h3 className="text-lg font-semibold text-white">Detailed Breakdown by Category</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                  {categories.map(cat => {
                    const catExps  = expenses.filter(e => getExpenseCategoryId(e) === cat.id);
                    const catTotal = catExps.reduce((s, e) => s + e.amount, 0);
                    if (catExps.length === 0) return null;
                    return (
                      <div key={cat.id} className="bg-slate-800/40 rounded-2xl p-4 border border-white/5 hover:border-purple-500/20 transition-all">
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                          <span className="text-xl">{cat.icon}</span>
                          <h4 className="font-semibold text-sm" style={{ color: cat.color }}>{cat.name}</h4>
                          <div className="flex items-center gap-1 ml-auto">
                            <ArrowUpRight size={12} className="text-slate-500" />
                            <span className="text-xs text-slate-400 font-medium">{formatAmount(catTotal)}</span>
                          </div>
                        </div>
                        <div className="space-y-2 max-h-36 overflow-y-auto">
                          {catExps.map(exp => (
                            <div key={exp.id} className="flex justify-between text-xs py-0.5">
                              <span className="text-slate-400 truncate flex-1 mr-2">{exp.note || exp.description || 'Untitled expense'}</span>
                              <span className="text-white font-medium">{formatAmount(exp.amount, exp.currency)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ExpenseCategorization;
