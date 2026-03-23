import React from 'react';
import { Check, X } from 'lucide-react';

const VARIANT_STYLES = {
  delete: {
    container: 'border border-amber-400/20 bg-slate-900/92 shadow-black/40',
    progress: 'bg-gradient-to-r from-amber-300 via-orange-300 to-red-300',
    actionText: 'text-amber-200',
    metaText: 'text-slate-500',
    icon: null,
  },
  success: {
    container: 'border border-emerald-400/20 bg-slate-900/92 shadow-emerald-950/30',
    progress: 'bg-gradient-to-r from-emerald-400 via-green-300 to-cyan-300',
    actionText: 'text-emerald-200',
    metaText: 'text-emerald-300/80',
    icon: Check,
  },
};

export default function ExpenseNotificationStack({
  notifications,
  notificationClock,
  notificationLifetimeMs,
  onDismiss,
  onAction,
}) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed left-1/2 top-4 z-[100] flex w-[min(92vw,30rem)] -translate-x-1/2 flex-col gap-3">
      {notifications.map((notification) => {
        const styles = VARIANT_STYLES[notification.type] || VARIANT_STYLES.success;
        const elapsed = notificationClock - notification.createdAt;
        const progress = Math.max(0, 100 - (elapsed / notificationLifetimeMs) * 100);
        const Icon = styles.icon;

        return (
          <div
            key={notification.id}
            className={`group overflow-hidden rounded-2xl shadow-2xl backdrop-blur-xl ${styles.container}`}
          >
            <div className="flex items-start gap-3 px-4 py-3">
              {Icon ? (
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Icon size={18} />
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{notification.title}</p>
                <p className="mt-1 text-sm text-slate-300">{notification.message}</p>

                {notification.actionLabel ? (
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onAction?.(notification.id)}
                      disabled={notification.actionDisabled}
                      className={`rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60 ${styles.actionText}`}
                    >
                      {notification.actionPendingLabel && notification.actionDisabled
                        ? notification.actionPendingLabel
                        : notification.actionLabel}
                    </button>

                    <span className={`text-xs uppercase tracking-[0.18em] ${styles.metaText}`}>
                      {notification.metaText || `Expires in ${Math.ceil(notificationLifetimeMs / 1000)}s`}
                    </span>
                  </div>
                ) : notification.metaText ? (
                  <p className={`mt-3 text-xs uppercase tracking-[0.18em] ${styles.metaText}`}>
                    {notification.metaText}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                aria-label="Close notification"
                onClick={() => onDismiss(notification.id)}
                className="rounded-lg p-1.5 text-slate-500 opacity-0 transition-all duration-200 hover:bg-white/10 hover:text-white group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>

            <div className="h-1 w-full bg-white/5">
              <div
                className={`h-full rounded-r-full transition-[width] duration-100 ${styles.progress}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
