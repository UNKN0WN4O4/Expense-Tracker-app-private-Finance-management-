import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import FloatingNav from './components/navbar'; // Fixed import path
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import ExpenseCategorization from './pages/ExpenseCategorization';
import Analytics from './pages/Analytics';

// Pages where navbar should be hidden
const HIDE_NAVBAR_PATHS = ['/login', '/register', '/forgot-password'];

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  const location = useLocation();
  const shouldShowNavbar = !HIDE_NAVBAR_PATHS.includes(location.pathname);
  
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      {shouldShowNavbar && <FloatingNav />}
      {children}
    </>
  );
}

function AppContent() {
  return (
    <Routes>
      {/* Public routes - NO navbar */}
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Protected routes - WITH navbar */}
      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        }
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/expense-categorization"
        element={
          <PrivateRoute>
            <ExpenseCategorization />
          </PrivateRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <PrivateRoute>
            <Analytics />
          </PrivateRoute>
        }
      />

      {/* Catch all redirect */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;