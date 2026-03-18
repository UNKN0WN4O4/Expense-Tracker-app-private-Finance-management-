import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Input from '../components/Input';
import Button from '../components/Button';
import AnimatedBackground from '../components/AnimatedBackground';
import { AlertCircle, Wallet } from 'lucide-react';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError('Passwords do not match');
        }
        try {
            setError('');
            setLoading(true);
            await signup(email, password);
            navigate('/');
        } catch (err) {
            setError('Failed to create an account: ' + err.message);
        }
        setLoading(false);
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            <AnimatedBackground />

            <div className="relative z-10 w-full max-w-md">
                {/* Logo mark */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl shadow-lg shadow-purple-500/30">
                            <Wallet className="text-white" size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">ExpenseTracker</h1>
                            <p className="text-xs text-slate-500">Smart Finance Management</p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8
                                ring-1 ring-inset ring-white/5">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                            Create Account
                        </h2>
                        <p className="text-slate-400 mt-1.5 text-sm">Start tracking your expenses today</p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Email Address"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <Input
                            label="Password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <Input
                            label="Confirm Password"
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <Button type="submit" className="w-full" isLoading={loading}>
                            Sign Up
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
                            Log In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
