import React from 'react';
import './Header.css';

export default function Header({ onBackClick }) {
  return (
    <header className="Header">
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
          <div className="profile-circle"></div>
          <button className="header-button logout">Logout</button>
        </div>
      </div>
    </header>
  );
}