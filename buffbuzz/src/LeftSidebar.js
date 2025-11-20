import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LeftSidebar.css';

export default function LeftSidebar() {
  const navigate = useNavigate();

  return (
    <aside className="left-sidebar">
      <nav className="sidebar-nav">
        <button className="nav-button" onClick={() => navigate('/jobs')}>
          <span className="nav-icon">💼</span>
          <span className="nav-text">Jobs</span>
        </button>
        
        <button className="nav-button" onClick={() => navigate('/marketplace')}>
          <span className="nav-icon">🛒</span>
          <span className="nav-text">Marketplace</span>
        </button>
        
        <button className="nav-button" onClick={() => navigate('/lostfound')}>
          <span className="nav-icon">🔍</span>
          <span className="nav-text">Lost & Found</span>
        </button>
        
        <button className="nav-button" onClick={() => navigate('/notifications')}>
          <span className="nav-icon">📢</span>
          <span className="nav-text">Notifications</span>
        </button>
        
        <button className="nav-button" onClick={() => navigate('/groups')}>
          <span className="nav-icon">👥</span>
          <span className="nav-text">Groups</span>
        </button>
      </nav>
    </aside>
  );
}