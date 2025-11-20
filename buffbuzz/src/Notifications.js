import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Notifications.css';
import Header from './Header.js';
import Footer from './Footer';

export default function Notifications() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!userData) {
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
      fetchNotifications(userData.id);
    }
  }, [navigate]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profilePictureUrl) {
          setProfilePicture(data.profile.profilePictureUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const fetchNotifications = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate('/main');
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setNotifications(notifications.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        ));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${user.id}/read-all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        setNotifications(notifications.map(notif => ({ ...notif, read: true })));
        alert('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setNotifications(notifications.filter(notif => notif.id !== notificationId));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  const getNotificationIcon = (type) => {
    const icons = {
      like: '❤️',
      comment: '💬',
      follow: '👤',
      mention: '📢',
      share: '🔄',
      group: '👥',
      event: '📅',
      message: '✉️'
    };
    return icons[type] || '🔔';
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - notifTime) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return notifTime.toLocaleDateString();
  };

  if (!user) {
    return null;
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notifications-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />
      
      <div className="notifications-container">
        <div className="notifications-header">
          <div className="header-top">
            <h1>Notifications</h1>
            {unreadCount > 0 && (
              <span className="unread-badge">{unreadCount} new</span>
            )}
          </div>
          {notifications.length > 0 && unreadCount > 0 && (
            <button className="mark-all-read" onClick={markAllAsRead}>
              Mark all as read
            </button>
          )}
        </div>

        <div className="notifications-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
          </button>
          <button 
            className={`filter-btn ${filter === 'like' ? 'active' : ''}`}
            onClick={() => setFilter('like')}
          >
            Likes
          </button>
          <button 
            className={`filter-btn ${filter === 'comment' ? 'active' : ''}`}
            onClick={() => setFilter('comment')}
          >
            Comments
          </button>
          <button 
            className={`filter-btn ${filter === 'follow' ? 'active' : ''}`}
            onClick={() => setFilter('follow')}
          >
            Follows
          </button>
        </div>

        <div className="notifications-list">
          {loading ? (
            <div className="loading">Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="no-notifications">
              <span className="no-notif-icon">🔔</span>
              <h3>No notifications yet</h3>
              <p>When you get notifications, they'll show up here</p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div 
                key={notification.id} 
                className={`notification-item ${!notification.read ? 'unread' : ''}`}
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                <div className="notification-icon">
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="notification-content">
                  <div className="notification-main">
                    <span className="notification-user">{notification.userName}</span>
                    <span className="notification-text">{notification.message}</span>
                  </div>
                  <span className="notification-time">{getTimeAgo(notification.createdAt)}</span>
                </div>

                {!notification.read && (
                  <div className="unread-dot"></div>
                )}

                <button 
                  className="delete-notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}