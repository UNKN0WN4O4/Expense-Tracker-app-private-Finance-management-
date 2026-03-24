import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Bell, AlertTriangle, CheckCircle, IndianRupee, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BudgetWidget() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [budget, setBudget] = useState(0);
  const [warningThreshold, setWarningThreshold] = useState(80);
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;

      try {
        const budgetDoc = await getDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'));
        if (budgetDoc.exists()) {
          const data = budgetDoc.data();
          setBudget(data.amount || 0);
          setWarningThreshold(data.warningThreshold || 80);
        }

        const expensesRef = collection(db, 'users', currentUser.uid, 'expenses');
        const expensesSnap = await getDocs(expensesRef);
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let total = 0;
        expensesSnap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.date) {
            const expDate = new Date(data.date);
            if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
              const amount = typeof data.amount === 'string' 
                ? parseFloat(data.amount.replace(/,/g, '')) 
                : data.amount;
              total += (amount || 0);
            }
          }
        });
        
        setCurrentMonthExpenses(total);
      } catch (error) {
        console.error("Error fetching data for budget widget:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="bg-slate-900/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 flex items-center justify-center min-h-[160px] animate-pulse">
        <p className="text-slate-500 text-sm">Loading budget data...</p>
      </div>
    );
  }

  if (budget === 0) {
    return (
      <button 
        onClick={() => navigate('/budgeting')}
        className="group w-full bg-slate-900/30 backdrop-blur-xl border border-dashed border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 min-h-[160px] hover:border-violet-500/30 transition-all duration-300 text-left"
      >
        <div className="p-3 bg-white/5 rounded-2xl group-hover:bg-violet-500/10 transition-colors">
          <Bell className="text-slate-500 group-hover:text-violet-400 transition-colors" size={24} />
        </div>
        <p className="text-slate-500 font-medium text-sm group-hover:text-slate-300 transition-colors">Setup Monthly Budget</p>
        <p className="text-slate-600 text-xs text-center">Track spending and get alerts</p>
      </button>
    );
  }

  const spentPercentage = (currentMonthExpenses / budget) * 100;
  const isOverBudget = currentMonthExpenses > budget;
  const isNearBudget = spentPercentage >= warningThreshold && !isOverBudget;
  const remainingBudget = Math.max(0, budget - currentMonthExpenses);

  return (
    <div 
      onClick={() => navigate('/budgeting')}
      className="group w-full bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-5 hover:bg-slate-900/60 hover:border-violet-500/30 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[160px]"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {isOverBudget ? (
            <div className="p-1.5 bg-red-500/20 rounded-lg"><AlertTriangle size={16} className="text-red-400" /></div>
          ) : isNearBudget ? (
            <div className="p-1.5 bg-amber-500/20 rounded-lg"><Bell size={16} className="text-amber-400" /></div>
          ) : (
            <div className="p-1.5 bg-emerald-500/20 rounded-lg"><CheckCircle size={16} className="text-emerald-400" /></div>
          )}
          <h3 className="text-slate-200 font-medium text-sm">Budget Tracker</h3>
        </div>
        <ArrowRight size={16} className="text-slate-600 group-hover:text-violet-400 transition-colors group-hover:translate-x-1" />
      </div>

      <div>
        <div className="flex justify-between items-end mb-1">
          <p className="text-2xl font-bold tracking-tight text-white">
            ₹{currentMonthExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-slate-400 font-medium mb-1">
            / ₹{budget.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="relative pt-1 mb-2">
          <div className="overflow-hidden h-1.5 text-xs flex rounded-full bg-slate-800">
            <div
              style={{ width: `${Math.min(100, spentPercentage)}%` }}
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                isOverBudget ? 'bg-red-500' : isNearBudget ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            ></div>
          </div>
        </div>
        
        <p className={`text-xs font-medium ${isOverBudget ? 'text-red-400' : 'text-slate-400'}`}>
          {isOverBudget 
            ? `₹${(currentMonthExpenses - budget).toLocaleString('en-IN')} over budget` 
            : `₹${remainingBudget.toLocaleString('en-IN')} remaining`}
        </p>
      </div>
    </div>
  );
}
