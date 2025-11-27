import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
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
import Friends from './Friends';
import FriendRequests from './FriendRequests';
import LostFound from './LostFound';
import Groups from './Groups';
import Marketplace from './Marketplace';
import Notifications from './Notifications';
import Jobs from './Jobs';
import SettingsPage from './SettingsPage';
import { getValidUser } from './sessionUtils';

function ProtectedRoute({ element }) {
  const user = getValidUser();
  return user ? element : <LoginPage />;
}

// Check session on app load and redirect accordingly
function RootRedirect() {
  const user = getValidUser();
  // If user has valid session, go to main page, otherwise welcome page
  return user ? <Navigate to="/main" replace /> : <WelcomePage />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/reset" element={<RequestResetPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/main" element={<ProtectedRoute element={<MainPage />} />} />
        <Route path="/create-post" element={<ProtectedRoute element={<CreatePost />} />} />
        <Route path="/profile" element={<ProtectedRoute element={<ProfileView />} />} />
        <Route path="/profile-view/:userId" element={<ProtectedRoute element={<ProfileView />} />} />
        <Route path="/profile-edit" element={<ProtectedRoute element={<ProfileEdit />} />} />
        <Route path="/friends" element={<ProtectedRoute element={<Friends />} />} />
        <Route path="/friend-requests" element={<ProtectedRoute element={<FriendRequests />} />} />
        <Route path="/settings" element={<ProtectedRoute element={<SettingsPage />} />} />
        <Route path="/lostfound" element={<LostFound />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/jobs" element={<Jobs />} />
      </Routes>
    </Router>
  );
}

export default App;