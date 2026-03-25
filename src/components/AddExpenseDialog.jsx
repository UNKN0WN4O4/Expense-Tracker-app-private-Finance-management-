import React, { useEffect, useRef, useState } from 'react';
import AddExpense from './AddExpense';
import { SUPPORTED_CURRENCIES } from './expense/expenseConfig';
import ExpenseNotificationStack from './expense/ExpenseNotificationStack';

export default function AddExpenseDialog({
  isOpen,
  categories,
  defaultCurrency,
  onCancel,
  onSaved,
}) {
  const [notifications, setNotifications] = useState([]);
  const [notificationClock, setNotificationClock] = useState(Date.now());
  const timeoutRefs = useRef(new Map());

  useEffect(() => () => {
    timeoutRefs.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutRefs.current.clear();
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

  const dismissNotification = (notificationId) => {
    const timeoutId = timeoutRefs.current.get(notificationId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutRefs.current.delete(notificationId);
    }

    setNotifications((current) => current.filter((notification) => notification.id !== notificationId));
  };

  const handleSaved = (savedExpense) => {
    const category = categories.find((item) => item.id === savedExpense.category);
    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: 'success',
      title: 'Expense added successfully',
      message: `${savedExpense.note || category?.name || 'Expense'} - ${savedExpense.currency}${savedExpense.amount}`,
      metaText: category?.name || 'Uncategorized',
      createdAt: Date.now(),
    };

    setNotifications((current) => [notification, ...current]);
    const timeoutId = window.setTimeout(() => {
      setNotifications((current) => current.filter((item) => item.id !== notification.id));
      timeoutRefs.current.delete(notification.id);
    }, 25000);
    timeoutRefs.current.set(notification.id, timeoutId);
    onSaved?.(savedExpense);
  };

  return (
    <>
      <ExpenseNotificationStack
        notifications={notifications}
        notificationClock={notificationClock}
        notificationLifetimeMs={25000}
        onDismiss={dismissNotification}
      />

      {isOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl">
            <AddExpense
              categories={categories}
              currencies={SUPPORTED_CURRENCIES}
              defaultCurrency={defaultCurrency}
              onCancel={onCancel}
              onSaved={handleSaved}
              showSuccessNotifications={false}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
