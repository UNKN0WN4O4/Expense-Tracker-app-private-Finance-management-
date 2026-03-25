import React, { useEffect, useRef, useState } from 'react';
import { Edit2 } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import EditExpense from './EditExpense';
import ExpenseNotificationStack from './expense/ExpenseNotificationStack';
import {
  DEFAULT_CATEGORIES,
  EXPENSE_NOTIFICATION_LIFETIME_MS,
  getExpenseTitle,
} from './expense/expenseConfig';

const SORT_OPTIONS = {
  DATE_DESC: 'date-desc',
  DATE_ASC: 'date-asc',
  NAME: 'name',
  AMOUNT_ASC: 'amount-asc',
  AMOUNT_DESC: 'amount-desc',
};

const PAGE_SIZE_OPTIONS = [5, 25, 50, 75, 100];

const getExpenseName = (expense) => (expense.note || 'Untitled expense').trim().toLowerCase();

const getExpenseAmount = (expense) => {
  if (typeof expense.amount === 'number') {
    return expense.amount;
  }

  if (typeof expense.amount === 'string') {
    const normalizedAmount = Number.parseFloat(expense.amount.replace(/,/g, '.'));
    return Number.isNaN(normalizedAmount) ? 0 : normalizedAmount;
  }

  return 0;
};

const getExpenseDateValue = (expense) => {
  if (!expense.date) {
    return 0;
  }

  const parsedDate = new Date(expense.date).getTime();
  return Number.isNaN(parsedDate) ? 0 : parsedDate;
};

const createDeleteNotification = (expense) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  expenseId: expense.id,
  type: 'delete',
  title: 'Expense deleted',
  message: `${getExpenseTitle(expense)} has been removed.`,
  createdAt: Date.now(),
  actionLabel: 'Undo',
  actionPendingLabel: 'Undoing...',
  actionDisabled: false,
  metaText: 'Expires in 1m 25s',
});

const createUpdateNotification = (expense) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  expenseId: expense.id,
  type: 'success',
  title: 'Expense updated successfully',
  message: `${getExpenseTitle(expense)} has been updated.`,
  createdAt: Date.now(),
  metaText: 'Saved changes',
});

export default function ExpenseList() {
  const { currentUser } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingExpenseIds, setDeletingExpenseIds] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationClock, setNotificationClock] = useState(Date.now());
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.DATE_DESC);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingExpense, setEditingExpense] = useState(null);
  const timeoutRefs = useRef(new Map());
  const deletionActionRefs = useRef(new Map());

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!currentUser) {
        setExpenses([]);
        setError('You must be signed in to view expenses.');
        setIsLoading(false);
        return;
      }

      try {
        setError('');
        const [querySnapshot, categorySnapshot] = await Promise.all([
          getDocs(collection(db, 'users', currentUser.uid, 'expenses')),
          getDoc(doc(db, 'users', currentUser.uid, 'settings', 'categories')),
        ]);
        const expenseItems = querySnapshot.docs.map((expenseDoc) => ({
          id: expenseDoc.id,
          ...expenseDoc.data(),
        }));

        setExpenses(expenseItems);
        setCategories(categorySnapshot.exists()
          ? categorySnapshot.data().items || DEFAULT_CATEGORIES
          : DEFAULT_CATEGORIES);
      } catch {
        setError('Unable to load expenses right now.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpenses();
  }, [currentUser]);

  useEffect(() => () => {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    deletionActionRefs.current.clear();
  }, []);

  useEffect(() => {
    if (notifications.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNotificationClock(Date.now());
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [notifications.length]);

  const clearNotificationTimeout = (notificationId) => {
    const timeoutId = timeoutRefs.current.get(notificationId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutRefs.current.delete(notificationId);
    }
  };

  const dismissNotification = (notificationId) => {
    clearNotificationTimeout(notificationId);
    setNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId));

    const action = deletionActionRefs.current.get(notificationId);
    if (action) {
      action.dismissed = true;

      if (action.status !== 'deleting') {
        deletionActionRefs.current.delete(notificationId);
      }
    }
  };

  const scheduleNotificationRemoval = (notificationId) => {
    clearNotificationTimeout(notificationId);

    const timeoutId = window.setTimeout(() => {
      dismissNotification(notificationId);
    }, EXPENSE_NOTIFICATION_LIFETIME_MS);

    timeoutRefs.current.set(notificationId, timeoutId);
  };

  const restoreDeletedExpense = async (notificationId) => {
    const action = deletionActionRefs.current.get(notificationId);

    if (!currentUser || !action || action.status === 'restoring') {
      return;
    }

    if (action.status === 'deleting') {
      action.pendingUndo = true;
      setNotifications((current) =>
        current.map((notification) => (
          notification.id === notificationId
            ? { ...notification, actionDisabled: true }
            : notification
        )));
      return;
    }

    action.status = 'restoring';
    setNotifications((current) =>
      current.map((notification) => (
        notification.id === notificationId
          ? { ...notification, actionDisabled: true }
          : notification
      )));

    try {
      const { id, ...expenseData } = action.expense;
      await setDoc(doc(db, 'users', currentUser.uid, 'expenses', id), expenseData);
      setExpenses((current) => {
        if (current.some((item) => item.id === id)) {
          return current;
        }

        return [action.expense, ...current];
      });
      dismissNotification(notificationId);
      deletionActionRefs.current.delete(notificationId);
    } catch {
      action.status = 'deleted';
      setDeleteError('Unable to restore this expense right now.');
      setNotifications((current) =>
        current.map((notification) => (
          notification.id === notificationId
            ? { ...notification, actionDisabled: false }
            : notification
        )));
      scheduleNotificationRemoval(notificationId);
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (!currentUser) {
      setDeleteError('You must be signed in to delete expenses.');
      return;
    }

    try {
      setDeleteError('');
      setExpenses((currentExpenses) => currentExpenses.filter((item) => item.id !== expense.id));
      setDeletingExpenseIds((current) => [...current, expense.id]);

      const notification = createDeleteNotification(expense);
      deletionActionRefs.current.set(notification.id, {
        dismissed: false,
        expense,
        pendingUndo: false,
        status: 'deleting',
      });
      setNotifications((current) => [notification, ...current]);
      scheduleNotificationRemoval(notification.id);

      await deleteDoc(doc(db, 'users', currentUser.uid, 'expenses', expense.id));

      const action = deletionActionRefs.current.get(notification.id);
      if (action) {
        action.status = 'deleted';

        if (action.pendingUndo) {
          await restoreDeletedExpense(notification.id);
        } else if (action.dismissed) {
          deletionActionRefs.current.delete(notification.id);
        }
      }
    } catch {
      setDeleteError('Unable to delete this expense right now.');
      setExpenses((currentExpenses) => {
        if (currentExpenses.some((item) => item.id === expense.id)) {
          return currentExpenses;
        }

        return [expense, ...currentExpenses];
      });
      const notificationEntry = Array.from(deletionActionRefs.current.entries())
        .find(([, action]) => action.expense.id === expense.id);

      if (notificationEntry) {
        const [notificationId] = notificationEntry;
        dismissNotification(notificationId);
        deletionActionRefs.current.delete(notificationId);
      }
    } finally {
      setDeletingExpenseIds((current) => current.filter((id) => id !== expense.id));
    }
  };

  const handleEditSaved = (updatedExpense) => {
    setExpenses((current) =>
      current.map((item) => (item.id === updatedExpense.id ? { ...item, ...updatedExpense } : item)));
    const notification = createUpdateNotification(updatedExpense);
    setNotifications((current) => [notification, ...current]);
    scheduleNotificationRemoval(notification.id);
    setEditingExpense(null);
  };

  const sortedExpenses = [...expenses].sort((left, right) => {
    switch (sortBy) {
      case SORT_OPTIONS.DATE_ASC:
        return getExpenseDateValue(left) - getExpenseDateValue(right);
      case SORT_OPTIONS.NAME:
        return getExpenseName(left).localeCompare(getExpenseName(right));
      case SORT_OPTIONS.AMOUNT_ASC:
        return getExpenseAmount(left) - getExpenseAmount(right);
      case SORT_OPTIONS.AMOUNT_DESC:
        return getExpenseAmount(right) - getExpenseAmount(left);
      case SORT_OPTIONS.DATE_DESC:
      default:
        return getExpenseDateValue(right) - getExpenseDateValue(left);
    }
  });

  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedExpenses = sortedExpenses.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <EditExpense
        expense={editingExpense}
        categories={categories}
        onSaved={handleEditSaved}
        onCancel={() => setEditingExpense(null)}
      />

      <ExpenseNotificationStack
        notifications={notifications}
        notificationClock={notificationClock}
        notificationLifetimeMs={EXPENSE_NOTIFICATION_LIFETIME_MS}
        onDismiss={dismissNotification}
        onAction={restoreDeletedExpense}
      />

      <div className="relative z-10 pr-28 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6 backdrop-blur-xl">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="text-xl font-semibold text-white">Expense List</h3>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <span>Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(event) => {
                      setSortBy(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value={SORT_OPTIONS.DATE_DESC}>Date: Newest first</option>
                    <option value={SORT_OPTIONS.DATE_ASC}>Date: Oldest first</option>
                    <option value={SORT_OPTIONS.NAME}>Name</option>
                    <option value={SORT_OPTIONS.AMOUNT_ASC}>Amount: Low to high</option>
                    <option value={SORT_OPTIONS.AMOUNT_DESC}>Amount: High to low</option>
                  </select>
                </label>

                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={(event) => {
                      setItemsPerPage(Number(event.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500 focus:outline-none"
                  >
                    {PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {deleteError ? (
              <p className="mb-4 text-sm text-red-400">{deleteError}</p>
            ) : null}

            {isLoading ? (
              <p className="text-sm text-slate-300">Loading expenses...</p>
            ) : null}

            {!isLoading && error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}

            {!isLoading && !error && expenses.length === 0 ? (
              <p className="text-sm text-slate-400">No expenses found.</p>
            ) : null}

            {!isLoading && !error && expenses.length > 0 ? (
              <>
                <ul className="space-y-3">
                  {paginatedExpenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-slate-200"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-medium text-white">{expense.note || 'Untitled expense'}</p>
                          <p className="text-sm text-slate-400">
                            Amount: {expense.currency || ''}{expense.amount ?? 'N/A'}
                          </p>
                          <p className="text-sm text-slate-400">
                            Category: {expense.category || expense.categoryId || 'Uncategorized'}
                          </p>
                          <p className="text-sm text-slate-400">Date: {expense.date || 'N/A'}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingExpense(expense)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                          >
                            <Edit2 size={16} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(expense)}
                            disabled={deletingExpenseIds.includes(expense.id)}
                            className="inline-flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingExpenseIds.includes(expense.id) ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-400">
                    Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedExpenses.length)} of {sortedExpenses.length}
                  </p>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={safeCurrentPage === 1}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>

                    <span className="text-sm text-slate-300">
                      Page {safeCurrentPage} of {totalPages}
                    </span>

                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
