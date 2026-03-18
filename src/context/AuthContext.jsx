import React, { useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

const AuthContext = React.createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Helper to save user to Firestore
    const saveUserToFirestore = async (user, additionalData = {}) => {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        const userData = {
            email: user.email,
            displayName: user.displayName || additionalData.displayName || "",
            photoURL: user.photoURL || "",
            phone: "",
            preferences: {
                currency: "₹",
                theme: "dark"
            },
            updatedAt: serverTimestamp(),
            ...additionalData
        };

        // Only add createdAt for new users
        if (!userSnap.exists()) {
            userData.createdAt = serverTimestamp();
        }

        await setDoc(userRef, userData, { merge: true });
        return userData;
    };

    // Helper to fetch user profile
    const fetchUserProfile = async (userId) => {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            return userSnap.data();
        }
        return null;
    };

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password);
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function logout() {
        return signOut(auth);
    }

    function resetPassword(email) {
        return sendPasswordResetEmail(auth, email);
    }

    function updateUserProfile(user, profile) {
        return updateProfile(user, profile);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            
            if (user) {
                // Try to fetch existing profile, if not exists create one
                let profile = await fetchUserProfile(user.uid);
                if (!profile) {
                    profile = await saveUserToFirestore(user);
                }
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
            
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userProfile,        // New: additional user data from Firestore
        signup,
        login,
        logout,
        resetPassword,
        updateUserProfile
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}