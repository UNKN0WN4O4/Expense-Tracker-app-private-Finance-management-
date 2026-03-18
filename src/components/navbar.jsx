// navbar.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Wallet, 
  Tags, 
  PieChart,
  Target, 
  User, 
  LogOut 
} from 'lucide-react';

// ── Shared nav items — teammates add their path here ──────────────────────
const NAV_ITEMS = [
  { path: '/dashboard',              label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/expenses',               label: 'Expenses',   icon: Wallet },
  { path: '/expense-categorization', label: 'Categories', icon: Tags },
  { path: '/reports',                label: 'Reports',    icon: PieChart },
  { path: '/budgeting',              label: 'Budget',     icon: Target },
  { path: '/profile',                label: 'Profile',    icon: User },
];

// ── Floating Glass Nav ─────────────────────────────────────────────────────
export default function FloatingNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, currentUser, userProfile } = useAuth();
  
  // Get user display info
  const displayName = userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'User';
  const photoURL = userProfile?.photoURL || currentUser?.photoURL || '';
  
  const isActive = (path) => location.pathname === path;

  const handleLogout = async () => {
    try { 
      await logout(); 
      navigate('/login'); 
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <nav className="fixed right-6 top-0 bottom-0 flex items-center z-50">
      {/* Enhanced glass panel - consistent sizing */}
      <div className="bg-slate-900/60 backdrop-blur-3xl border border-white/10
                      rounded-3xl p-4 shadow-2xl shadow-black/60
                      ring-1 ring-inset ring-white/5
                      flex flex-col items-center gap-4">
        
        {/* User Profile Section - At top of navbar */}
        <div className="flex flex-col items-center gap-2 pb-3 border-b border-white/10 w-full">
          <div className="relative">
            {photoURL ? (
              <img 
                src={photoURL} 
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border-2 border-purple-500/50"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 
                              flex items-center justify-center text-white font-semibold text-sm
                              border-2 border-purple-500/50">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* Online indicator */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full 
                           border-2 border-slate-900"></span>
          </div>
          <span className="text-xs text-slate-300 font-medium text-center max-w-[80px] truncate">
            {displayName}
          </span>
        </div>

        {/* Navigation Items */}
        <div className="flex flex-col gap-2 flex-1">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const active = isActive(path);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`group relative p-3 rounded-2xl transition-all duration-300 ${
                  active
                    ? 'bg-gradient-to-br from-purple-500 to-blue-600 text-white shadow-lg shadow-purple-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}>
                <Icon size={21} />
                {/* Tooltip */}
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2
                                 bg-slate-900/95 backdrop-blur-xl text-white text-xs px-3 py-1.5 rounded-lg
                                 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                                 whitespace-nowrap border border-white/10 pointer-events-none shadow-xl z-50">
                  {label}
                </span>
                {/* Active dot - positioned correctly on the right edge */}
                {active && (
                  <span className="absolute -right-[18px] top-1/2 -translate-y-1/2 w-1.5 h-6
                                   bg-purple-400 rounded-l-full shadow-[0_0_8px_rgba(167,139,250,0.7)]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Logout at bottom */}
        <div className="pt-3 border-t border-white/10 w-full flex justify-center">
          <button
            onClick={handleLogout}
            className="group relative p-3 rounded-2xl transition-all duration-300
                       text-slate-400 hover:text-red-400 hover:bg-red-500/10">
            <LogOut size={21} />
            <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2
                             bg-slate-900/95 backdrop-blur-xl text-white text-xs px-3 py-1.5 rounded-lg
                             opacity-0 group-hover:opacity-100 transition-opacity duration-200
                             whitespace-nowrap border border-white/10 pointer-events-none shadow-xl">
              Logout
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}