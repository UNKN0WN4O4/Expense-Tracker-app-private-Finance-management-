import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Input from '../components/Input';
import Button from '../components/Button';
import AnimatedBackground from '../components/AnimatedBackground';
import { AlertCircle, ArrowLeft, Camera, CameraOff, CheckCircle, LogOut, Upload, User } from 'lucide-react';

const PROFILE_IMAGE_MAX_DIMENSION = 512;

const resizeImageFileToDataUrl = async (file) => {
    const imageUrl = URL.createObjectURL(file);

    try {
        const image = await new Promise((resolve, reject) => {
            const nextImage = new Image();
            nextImage.onload = () => resolve(nextImage);
            nextImage.onerror = () => reject(new Error('Unable to load image.'));
            nextImage.src = imageUrl;
        });

        const longestSide = Math.max(image.width, image.height);
        const scale = longestSide > PROFILE_IMAGE_MAX_DIMENSION
            ? PROFILE_IMAGE_MAX_DIMENSION / longestSide
            : 1;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL('image/jpeg', 0.9);
    } finally {
        URL.revokeObjectURL(imageUrl);
    }
};

export default function Profile() {
    const { currentUser, userProfile, updateUserProfile, logout } = useAuth();
    const navigate = useNavigate();

    const [displayName, setDisplayName] = useState(currentUser?.displayName || userProfile?.displayName || '');
    const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || userProfile?.photoURL || '');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [isStartingCamera, setIsStartingCamera] = useState(false);
    const fileInputRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    useEffect(() => {
        setDisplayName(currentUser?.displayName || userProfile?.displayName || '');
        setPhotoURL(currentUser?.photoURL || userProfile?.photoURL || '');
    }, [currentUser?.displayName, currentUser?.photoURL, userProfile?.displayName, userProfile?.photoURL]);

    useEffect(() => () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

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

    async function handlePhotoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            setError('Please choose an image file for your profile photo.');
            event.target.value = '';
            return;
        }

        try {
            setError('');
            const nextPhotoUrl = await resizeImageFileToDataUrl(file);
            setPhotoURL(nextPhotoUrl);
            setMessage('Profile photo ready to save.');
        } catch {
            setError('Unable to process this image. Please try another one.');
        } finally {
            event.target.value = '';
        }
    }

    function closeCamera() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsCameraOpen(false);
        setIsStartingCamera(false);
        setCameraError('');
    }

    async function openCamera() {
        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError('Camera access is not supported in this browser.');
            setIsCameraOpen(true);
            return;
        }

        setCameraError('');
        setIsCameraOpen(true);
        setIsStartingCamera(true);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'user' } },
                audio: false,
            });

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
        } catch {
            setCameraError('Unable to access the camera. Please allow permission or upload a photo instead.');
        } finally {
            setIsStartingCamera(false);
        }
    }

    async function capturePhoto() {
        if (!videoRef.current) {
            return;
        }

        const canvas = document.createElement('canvas');
        const width = videoRef.current.videoWidth || 720;
        const height = videoRef.current.videoHeight || 720;
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.drawImage(videoRef.current, 0, 0, width, height);

        const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });

        if (!blob) {
            setError('Unable to capture a photo right now.');
            return;
        }

        const capturedFile = new File([blob], `profile-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const nextPhotoUrl = await resizeImageFileToDataUrl(capturedFile);
        setPhotoURL(nextPhotoUrl);
        setMessage('Camera photo ready to save.');
        closeCamera();
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
                                <div className="space-y-3">
                                    <p className="ml-1 text-sm font-medium text-slate-400">Profile Photo</p>
                                    <div className="flex flex-wrap gap-3">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="gap-2"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <Upload size={16} />
                                            Upload Photo
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="gap-2"
                                            onClick={openCamera}
                                        >
                                            <Camera size={16} />
                                            Take Photo
                                        </Button>
                                    </div>
                                </div>
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

            {isCameraOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h4 className="text-lg font-semibold text-white">Capture Profile Photo</h4>
                                <p className="mt-1 text-sm text-slate-400">Take a photo and use it as your avatar.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeCamera}
                                className="rounded-xl border border-white/10 bg-white/5 p-3 text-slate-300 transition hover:bg-white/10 hover:text-white"
                            >
                                <CameraOff size={18} />
                            </button>
                        </div>

                        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
                            {cameraError ? (
                                <div className="flex min-h-[320px] items-center justify-center p-6 text-center text-sm text-red-300">
                                    {cameraError}
                                </div>
                            ) : (
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="max-h-[60vh] w-full bg-black object-cover"
                                />
                            )}
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                            <Button
                                type="button"
                                className="gap-2"
                                onClick={capturePhoto}
                                isLoading={isStartingCamera}
                                disabled={Boolean(cameraError)}
                            >
                                <Camera size={16} />
                                {isStartingCamera ? 'Starting camera...' : 'Capture Photo'}
                            </Button>
                            <Button type="button" variant="secondary" onClick={closeCamera}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
