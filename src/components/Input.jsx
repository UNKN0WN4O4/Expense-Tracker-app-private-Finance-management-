import React, { forwardRef } from 'react';

const Input = forwardRef(({ label, error, className = '', ...props }, ref) => {
    return (
        <div className="w-full space-y-2">
            {label && (
                <label className="block text-sm font-medium text-slate-400 ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <input
                    ref={ref}
                    className={`
            w-full px-4 py-3 
            bg-slate-800/50 backdrop-blur-sm
            border ${error ? 'border-red-500/50' : 'border-slate-700'} 
            rounded-xl 
            text-slate-200 placeholder-slate-500
            transition-all duration-300
            focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
            hover:border-slate-600
            disabled:opacity-50 disabled:cursor-not-allowed
            ${className}
          `}
                    {...props}
                />
            </div>
            {error && (
                <p className="text-xs text-red-400 ml-1 animate-fadeIn">
                    {error}
                </p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
