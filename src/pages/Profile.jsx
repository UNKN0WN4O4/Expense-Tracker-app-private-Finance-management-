import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Input from '../components/Input';
import Button from '../components/Button';
import AnimatedBackground from '../components/AnimatedBackground';
import { AlertCircle, CheckCircle, LogOut, ArrowLeft, User } from 'lucide-react';

export default function Profile() {
    const { currentUser, updateUserProfile, logout } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
    const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || '');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        if (loading) return;
        setError('');
        setMessage('');
        setLoading(true);
        try {
            await updateUserProfile(currentUser, { displayName, photoURL });
            setMessage('Profile updated successfully');
        } catch (err) {
            setError('Failed to update profile: ' + err.message);
        }
        setLoading(false);
    }

    async function handleLogout() {
        try { await logout(); navigate('/login'); }
        catch { setError('Failed to log out'); }
    }

    const initials = (displayName ? displayName[0] : currentUser?.email?.[0] || 'U').toUpperCase();

    return (
        <div className="min-h-screen text-slate-50 relative overflow-hidden">
            <AnimatedBackground />

            <div className="relative z-10 min-h-screen flex flex-col">
                {/* Top bar */}
                <div className="flex items-center justify-between p-6 max-w-2xl mx-auto w-full">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-slate-400 hover:text-purple-300 transition-colors text-sm"
                    >
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400
                                   bg-slate-900/50 hover:bg-red-500/10 border border-white/10 rounded-xl
                                   text-sm transition-all"
                    >
                        <LogOut size={15} /> Log Out
                    </button>
                </div>

                {/* Profile Card */}
                <div className="flex-1 flex items-start justify-center px-6 pb-12">
                    <div className="w-full max-w-md">
                        <div className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl p-8
                                        ring-1 ring-inset ring-white/5">

                            {/* Avatar */}
                            <div className="flex flex-col items-center mb-8">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600
                                                border border-white/10 flex items-center justify-center overflow-hidden mb-3
                                                shadow-lg shadow-purple-500/20">
                                    {photoURL ? (
                                        <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl font-bold text-white">{initials}</span>
                                    )}
                                </div>
                                <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                                    Edit Profile
                                </h2>
                                <p className="text-slate-500 text-sm mt-1">{currentUser?.email}</p>
                            </div>

                            {error && (
                                <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {message && (
                                <div className="mb-5 p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-3 text-purple-300 text-sm">
                                    <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{message}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <Input
                                    label="Display Name"
                                    type="text"
                                    placeholder="Your Name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                />
                                <Input
                                    label="Photo URL"
                                    type="url"
                                    placeholder="https://example.com/avatar.jpg"
                                    value={photoURL}
                                    onChange={(e) => setPhotoURL(e.target.value)}
                                />
                                <Button type="submit" className="w-full" isLoading={loading}>
                                    Update Profile
                                </Button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
