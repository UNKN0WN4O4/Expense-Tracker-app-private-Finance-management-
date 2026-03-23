import React from 'react';
import AddExpense from './AddExpense';
import { SUPPORTED_CURRENCIES } from './expense/expenseConfig';

export default function EditExpense({
  expense,
  categories,
  onCancel,
  onSaved,
}) {
  if (!expense) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl">
        <AddExpense
          categories={categories}
          currencies={SUPPORTED_CURRENCIES}
          defaultCurrency={expense.currency || '₹'}
          initialExpense={expense}
          expenseId={expense.id}
          onSaved={onSaved}
          onCancel={onCancel}
        />
      </div>
    </div>
  );
}
