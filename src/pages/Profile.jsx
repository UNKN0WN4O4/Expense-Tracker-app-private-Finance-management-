import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Input from '../components/Input';
import Button from '../components/Button';
import { AlertCircle, CheckCircle, ArrowLeft, LogOut } from 'lucide-react';

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
            await updateUserProfile(currentUser, {
                displayName: displayName,
                photoURL: photoURL
            });
            setMessage('Profile updated successfully');
        } catch (err) {
            setError('Failed to update profile: ' + err.message);
        }
        setLoading(false);
    }

    async function handleLogout() {
        try {
            await logout();
            navigate('/login');
        } catch {
            setError('Failed to log out');
        }
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-50 p-6">
            <div className="max-w-2xl mx-auto">
                <div className="mb-8 flex items-center justify-between">
                    <Link to="/" className="flex items-center text-slate-400 hover:text-emerald-400 transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Back to Dashboard
                    </Link>
                    <Button variant="ghost" onClick={handleLogout} className="!px-3">
                        <LogOut className="w-5 h-5 mr-2" />
                        Log Out
                    </Button>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-8">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent mb-6">
                        Edit Profile
                    </h2>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {message && (
                        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-emerald-400 text-sm">
                            <CheckCircle className="w-5 h-5 shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-24 h-24 rounded-full bg-slate-700 border-2 border-emerald-500/30 flex items-center justify-center overflow-hidden mb-4">
                                {photoURL ? (
                                    <img src={photoURL} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-4xl text-emerald-500 font-bold">
                                        {displayName ? displayName.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-400 text-sm">{currentUser.email}</p>
                        </div>

                        <Input
                            label="Display Name"
                            type="text"
                            placeholder="John Doe"
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

                        <Button
                            type="submit"
                            className="w-full"
                            isLoading={loading}
                        >
                            Update Profile
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
