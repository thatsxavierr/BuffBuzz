import React from 'react';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import WelcomePage from './welcomePage';
import LoginPage from './loginPage';
import SignupPage from './signUpPage';
import VerificationPage from './verificationPage';
import RequestResetPage from './RequestResetPage';
import ResetPasswordPage from './ResetPasswordPage';
import MainPage from './MainPage';
import CreatePost from './CreatePost';
import ProfileEdit from './ProfileEdit';
import ProfileView from './ProfileView';

function ProtectedRoute({ element }) {
  const user = JSON.parse(localStorage.getItem("user"));
  return user ? element : <LoginPage />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/reset" element={<RequestResetPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/main" element={<ProtectedRoute element={<MainPage />} />} />
        <Route path="/create-post" element={<ProtectedRoute element={<CreatePost />} />} />
        <Route path="/profile" element={<ProtectedRoute element={<ProfileView />} />} />
        <Route path="/profile-edit" element={<ProtectedRoute element={<ProfileEdit />} />} />

      </Routes>
    </Router>
  );
}

export default App;
