import { db } from '../firebase/firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';

const USERS_COLLECTION = 'users';

// Save user record (create or update)
export const saveUserRecord = async (userId, userData) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    
    const dataToSave = {
      ...userData,
      updatedAt: serverTimestamp(),
    };
    
    // Check if new user
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      dataToSave.createdAt = serverTimestamp();
    }
    
    await setDoc(userRef, dataToSave, { merge: true });
    return { success: true };
  } catch (error) {
    console.error('Error saving user:', error);
    throw error;
  }
};

// Get user record
export const getUserRecord = async (userId) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { id: userSnap.id, ...userSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    throw error;
  }
};

// Update specific fields
export const updateUserRecord = async (userId, updates) => {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};