import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = ({
    children,
    variant = 'primary',
    type = 'button',
    isLoading = false,
    className = '',
    disabled,
    ...props
}) => {
    const baseStyles = "relative flex items-center justify-center px-6 py-3 text-sm font-medium transition-all duration-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]";

    const variants = {
        primary: "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/20 focus:ring-emerald-500 border border-emerald-400/20",
        secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-lg shadow-black/20 focus:ring-slate-500",
        danger: "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/20 focus:ring-red-500 border border-red-400/20",
        ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-transparent"
    };

    return (
        <button
            type={type}
            className={`${baseStyles} ${variants[variant]} ${className}`}
            disabled={isLoading || disabled}
            {...props}
        >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {children}
        </button>
    );
};

export default Button;
