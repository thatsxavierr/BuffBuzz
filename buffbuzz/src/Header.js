import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';

export default function Header({ onBackClick, profilePictureUrl }) {
  const navigate = useNavigate();
  
  const handleProfileClick = () => {
    navigate('/profile-edit');  // Changed from '/profile/edit' to '/profile-edit'
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
          <button className="header-button">🏠 Home</button>
          <button className="header-button">⚙️ Settings</button>
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
          <button className="header-button logout">Logout</button>
        </div>
      </div>
    </header>
  );
}