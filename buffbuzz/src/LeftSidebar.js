import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LeftSidebar.css';
import { getValidUser } from './sessionUtils';

export default function LeftSidebar() {
  const navigate = useNavigate();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const user = getValidUser();
      if (!user || !user.id) return;

      const userId = user.id;
      try {
        const response = await fetch(`http://localhost:5000/api/notifications/${userId}/unread-count`);
        if (response.ok) {
          const data = await response.json();
          const count = typeof data.unreadCount === 'number' ? data.unreadCount : 0;
          setUnreadNotificationsCount(count);
          return;
        }
        // Fallback: if unread-count endpoint missing or fails, use full list
        const listRes = await fetch(`http://localhost:5000/api/notifications/${userId}`);
        if (listRes.ok) {
          const listData = await listRes.json();
          const list = listData.notifications || [];
          const count = list.filter(n => n.read === false || n.read === null).length;
          setUnreadNotificationsCount(count);
        }
      } catch (error) {
        console.error('Error fetching unread notifications count:', error);
      }
    };

    fetchUnreadCount();

    const intervalId = setInterval(fetchUnreadCount, 50000);

    const handleNotificationsUpdated = () => {
      fetchUnreadCount();
    };

    window.addEventListener('notificationsUpdated', handleNotificationsUpdated);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
    };
  }, []);

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
          <span className="nav-icon">
            📢
            {unreadNotificationsCount > 0 && (
              <span className="nav-badge">{unreadNotificationsCount}</span>
            )}
          </span>
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