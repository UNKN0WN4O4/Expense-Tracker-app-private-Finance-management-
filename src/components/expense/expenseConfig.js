export const DEFAULT_CATEGORIES = [
  { id: 'food',          name: 'Food',          color: '#8B5CF6', icon: '🍔', type: 'default' },
  { id: 'travel',        name: 'Travel',        color: '#3B82F6', icon: '✈️', type: 'default' },
  { id: 'rent',          name: 'Rent',          color: '#6366F1', icon: '🏠', type: 'default' },
  { id: 'utilities',     name: 'Utilities',     color: '#A78BFA', icon: '⚡', type: 'default' },
  { id: 'entertainment', name: 'Entertainment', color: '#60A5FA', icon: '🎬', type: 'default' },
  { id: 'shopping',      name: 'Shopping',      color: '#818CF8', icon: '🛍️', type: 'default' },
  { id: 'health',        name: 'Health',        color: '#7C3AED', icon: '⚕️', type: 'default' },
  { id: 'transport',     name: 'Transport',     color: '#4F46E5', icon: '🚗', type: 'default' },
  { id: 'education',     name: 'Education',     color: '#EC4899', icon: '📚', type: 'default' },
  { id: 'gifts',         name: 'Gifts',         color: '#F59E0B', icon: '🎁', type: 'default' },
  { id: 'fitness',       name: 'Fitness',       color: '#10B981', icon: '🏋️', type: 'default' },
  { id: 'other',         name: 'Other',          color: '#6B7280', icon: '🏷️', type: 'default' },
];

export const EXPANDED_COLORS = [
  '#8B5CF6', '#3B82F6', '#6366F1', '#A78BFA', '#60A5FA', 
  '#818CF8', '#7C3AED', '#4F46E5', '#EC4899', '#DB2777', 
  '#F59E0B', '#EF4444', '#10B981', '#06B6D4', '#6366F1',
  '#F43F5E', '#8B5CF6', '#3B82F6', '#14B8A6', '#F97316'
];

export const SUPPORTED_CURRENCIES = ['₹', '$', '€', '£', '¥'];

export const EXPENSE_NOTIFICATION_LIFETIME_MS = 85000;

export const getExpenseTitle = (expense) =>
  (expense.note || expense.description || 'Untitled expense').trim() || 'Untitled expense';
