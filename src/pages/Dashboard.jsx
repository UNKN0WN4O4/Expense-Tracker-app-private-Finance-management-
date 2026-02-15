import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

export default function Dashboard() {
    const [error, setError] = useState('');
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        setError('');
        try {
            await logout();
            navigate('/login');
        } catch {
            setError('Failed to log out');
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
                            Dashboard
                        </h1>
                        <p className="text-slate-400 mt-1">
                            Welcome back, {currentUser?.email}
                        </p>
                    </div>
                    <Button variant="secondary" onClick={handleLogout}>
                        Log Out
                    </Button>
                </header>

                {error && <div className="bg-red-500/10 text-red-500 p-4 rounded mb-4">{error}</div>}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-lg">
                        <h3 className="text-lg font-medium text-slate-300 mb-2">Total Balance</h3>
                        <p className="text-4xl font-bold text-white">$0.00</p>
                    </div>
                    {/* More placeholders */}
                </div>
            </div>
        </div>
    );
}
