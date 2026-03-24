import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import AnimatedBackground from '../components/AnimatedBackground';
import { Bell, Save, AlertTriangle, CheckCircle, IndianRupee } from 'lucide-react';

export default function Budgeting() {
  const { currentUser } = useAuth();
  const [budget, setBudget] = useState(0);
  const [warningThreshold, setWarningThreshold] = useState(80);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [currentMonthExpenses, setCurrentMonthExpenses] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser) return;

      try {
        // Fetch budget
        const budgetDoc = await getDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'));
        if (budgetDoc.exists()) {
          const data = budgetDoc.data();
          setBudget(data.amount || 0);
          setWarningThreshold(data.warningThreshold || 80);
        }

        // Fetch expenses
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
        console.error("Error fetching budget and expenses:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const handleSaveBudget = async () => {
    if (!currentUser) return;
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'settings', 'budget'), {
        amount: Number(budget),
        warningThreshold: Number(warningThreshold),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setMessage({ text: 'Budget saved successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: 'Failed to save budget.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center text-white">
        <AnimatedBackground />
        <div className="z-10 text-xl font-medium">Loading budget data...</div>
      </div>
    );
  }

  const remainingBudget = Math.max(0, budget - currentMonthExpenses);
  const spentPercentage = budget > 0 ? (currentMonthExpenses / budget) * 100 : 0;
  const isOverBudget = currentMonthExpenses > budget && budget > 0;
  const isNearBudget = spentPercentage >= warningThreshold && !isOverBudget;

  return (
    <div className="min-h-screen text-slate-50 relative overflow-hidden">
      <AnimatedBackground />
      
      <div className="relative z-10 pr-24 p-8">
        <div className="max-w-4xl mx-auto">
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-500/20 rounded-xl">
                <Bell className="text-violet-400" size={24} />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                Budget & Alerts
              </h1>
            </div>
            <p className="text-slate-400 ml-1">
              Set your monthly budget and configure spending warnings.
            </p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Setup Form */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-gradient-to-b from-violet-500 to-indigo-600 rounded-full" />
                Budget Configuration
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Monthly Budget Limit
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <IndianRupee className="text-slate-500" size={18} />
                    </div>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-700/50 rounded-xl focus:outline-none focus:border-violet-500 transition-colors text-white"
                      placeholder="e.g. 50000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Alert Threshold (%)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={warningThreshold}
                      onChange={(e) => setWarningThreshold(e.target.value)}
                      className="w-full accent-violet-500 cursor-pointer"
                    />
                    <span className="text-lg font-semibold text-violet-400 min-w-[3rem] text-right">
                      {warningThreshold}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    We'll notify you when you've spent {warningThreshold}% of your budget.
                  </p>
                </div>

                {message.text && (
                  <div className={`p-4 rounded-xl flex items-center gap-3 ${
                    message.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/10 border border-red-500/20 text-red-400'
                  }`}>
                    {message.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                    <span className="text-sm font-medium">{message.text}</span>
                  </div>
                )}

                <button
                  onClick={handleSaveBudget}
                  disabled={saving}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-xl text-white font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-500/25 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>

            {/* Budget Tracker */}
            <div className="bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-gradient-to-b from-blue-500 to-cyan-600 rounded-full" />
                  Current Month Overview
                </h2>

                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-slate-400 mb-1">Spent so far</p>
                      <p className="text-3xl font-bold tracking-tight">
                        ₹{currentMonthExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400 mb-1">Budget</p>
                      <p className="text-xl font-medium text-slate-300">
                        ₹{Number(budget).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="relative pt-2">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-400 bg-blue-500/10">
                          Usage
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-blue-400">
                          {Math.min(100, spentPercentage).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-800">
                      <div
                        style={{ width: `${Math.min(100, spentPercentage)}%` }}
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                          isOverBudget 
                            ? 'bg-red-500' 
                            : isNearBudget 
                              ? 'bg-amber-500' 
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                        }`}
                      ></div>
                    </div>
                  </div>

                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800/50">
                    <p className="text-sm text-slate-400 mb-1">Remaining Budget</p>
                    <p className={`text-2xl font-bold ${
                      isOverBudget ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      ₹{remainingBudget.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              <div className="mt-8">
                {isOverBudget ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-red-400 font-medium text-sm">Target Exceeded!</p>
                      <p className="text-red-400/80 text-xs mt-1">
                        You have exceeded your monthly budget by ₹{(currentMonthExpenses - budget).toLocaleString('en-IN')}. Please review your expenses.
                      </p>
                    </div>
                  </div>
                ) : isNearBudget ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <Bell className="text-amber-400 shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-amber-400 font-medium text-sm">Warning: Approaching Limit</p>
                      <p className="text-amber-400/80 text-xs mt-1">
                        You have spent {spentPercentage.toFixed(1)}% of your monthly budget. Slow down to avoid overspending.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
                    <CheckCircle className="text-emerald-400 shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-emerald-400 font-medium text-sm">On Track</p>
                      <p className="text-emerald-400/80 text-xs mt-1">
                        Your spending is well within the budget limit. Keep it up!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
