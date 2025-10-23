import React from 'react';
import './LeftSidebar.css';

export default function LeftSidebar() {
  return (
    <aside className="left-sidebar">
      <nav className="sidebar-nav">
        <button className="nav-button">
          <span className="nav-icon">💼</span>
          <span className="nav-text">Jobs</span>
        </button>
        
        <button className="nav-button">
          <span className="nav-icon">🛒</span>
          <span className="nav-text">Marketplace</span>
        </button>
        
        <button className="nav-button">
          <span className="nav-icon">🔍</span>
          <span className="nav-text">Lost & Found</span>
        </button>
        
        <button className="nav-button">
          <span className="nav-icon">📢</span>
          <span className="nav-text">Announcements</span>
        </button>
        
        <button className="nav-button">
          <span className="nav-icon">👥</span>
          <span className="nav-text">Groups</span>
        </button>
      </nav>
    </aside>
  );
}