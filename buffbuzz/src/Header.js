import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';
import { clearSession } from './sessionUtils';

export default function Header({ onBackClick, profilePictureUrl }) {
  const navigate = useNavigate();
  
  const handleProfileClick = () => {
    navigate('/profile');
  };
  
  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleHomeClick = () => {
    navigate('/main');
  };

  const handleFriendsClick = () => {
    navigate('/friends');
  };

  const handleFriendRequestsClick = () => {
    navigate('/friend-requests');
  };
  
  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to logout?');
    
    if (confirmLogout) {
      // Clear session (user data and timestamp)
      clearSession();
      sessionStorage.clear();
      
      // Navigate to login page
      navigate('/login');
    }
  };
  
  return (
    <header className="header">
      <div className="header-content">
        {/* Left side */}
        <div className="header-left">
          <button className="header-button" onClick={onBackClick}>
            ← Back
          </button>
          <div className="logo-text">BuffBuzz</div>
        </div>

        {/* Center - Search */}
        <div className="header-center">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search for students, posts, groups..."
              className="search-input"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="header-right">
          <button className="header-button" onClick={handleHomeClick}>🏠 Home</button>
          <button className="header-button" onClick={handleFriendsClick}>👥 Friends</button>
          <button className="header-button" onClick={handleFriendRequestsClick}>📬 Requests</button>
          <button className="header-button" onClick={handleSettingsClick}>⚙️ Settings</button>
          <div 
            className="profile-circle" 
            onClick={handleProfileClick}
            style={{
              backgroundImage: profilePictureUrl ? `url(${profilePictureUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: 'pointer'
            }}
          >
            {!profilePictureUrl && '👤'}
          </div>
          <button className="header-button logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}