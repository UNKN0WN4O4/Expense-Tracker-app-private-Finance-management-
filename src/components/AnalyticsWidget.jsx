import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, onSnapshot, query } from 'firebase/firestore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { PieChart as PieChartIcon, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_CATEGORIES } from './expense/expenseConfig';

export default function AnalyticsWidget() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const userId = currentUser.uid;

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

  const getCatById = (id) =>
    categories.find(c => c.id === id) || { name: 'Uncategorized', color: '#6B7280', icon: '❓' };

  const getCategoryTotals = (exps) => {
    const totals = {};
    exps.forEach(exp => {
      const catId = exp.categoryId || exp.category || 'uncategorized';
      totals[catId] = (totals[catId] || 0) + (exp.amount || 0);
    });
    return totals;
  };

  const chartData = Object.entries(getCategoryTotals(expenses))
    .map(([catId, total]) => {
      const cat = getCatById(catId);
      return { name: cat.name, value: total, color: cat.color };
    })
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (loading) {
    return (
      <div className="bg-slate-900/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center justify-center min-h-[160px] animate-pulse">
        <p className="text-slate-500 text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <button 
        onClick={() => navigate('/reports')}
        className="group w-full bg-slate-900/30 backdrop-blur-xl border border-dashed border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 min-h-[160px] hover:border-indigo-500/30 transition-all duration-300"
      >
        <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-indigo-500/10 transition-colors">
          <PieChartIcon className="text-slate-500 group-hover:text-indigo-400 transition-colors" size={24} />
        </div>
        <p className="text-slate-500 font-medium text-sm group-hover:text-slate-300 transition-colors">Spending Analytics</p>
        <p className="text-slate-600 text-xs text-center">Add expenses to see breakdown</p>
      </button>
    );
  }

  return (
    <div 
      onClick={() => navigate('/reports')}
      className="group w-full bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-5 hover:bg-slate-900/60 hover:border-indigo-500/30 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg">
            <PieChartIcon size={16} className="text-indigo-400" />
          </div>
          <h3 className="text-slate-200 font-medium text-sm">Spending Breakdown</h3>
        </div>
        <ArrowRight size={16} className="text-slate-600 group-hover:text-indigo-400 transition-colors group-hover:translate-x-1" />
      </div>

      <div className="flex-1 h-24 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData.slice(0, 5)} // Only top 5
              cx="50%" cy="50%"
              innerRadius={25} outerRadius={40}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.slice(0, 5).map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
              ))}
            </Pie>
            <RechartsTooltip 
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(139,92,246,0.3)', borderRadius: '8px', fontSize: '10px' }}
              itemStyle={{ padding: '0px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center mt-2">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Top Categories</p>
        <p className="text-[10px] text-indigo-400 font-semibold group-hover:underline">View Details</p>
      </div>
    </div>
  );
}
