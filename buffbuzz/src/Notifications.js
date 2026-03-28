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
    if (filter === 'group_join_request') {
      return ['group_join_request', 'group_join_approved', 'group_join_denied'].includes(notification.type);
    }
    if (filter === 'mention') {
      return notification.type === 'mention' || notification.type === 'group_chat_mention';
    }
    return notification.type === filter;
  });

  const getNotificationIcon = (type) => {
    const icons = {
      like: '❤️',
      comment: '💬',
      reply: '↩️',
      follow: '👤',
      mention: '📢',
      share: '🔄',
      group: '👥',
      group_join_request: '👥',
      group_join_approved: '✅',
      group_join_denied: '❌',
      direct_message: '✉️',
      group_message: '👥',
      group_chat_mention: '💬',
      event: '📅',
      message: '✉️',
      marketplace_listing: '🛒',
      lostfound_listing: '🔍'
    };
    return icons[type] || '🔔';
  };

  const handleApproveGroupRequest = async (e, notification) => {
    e.stopPropagation();
    const { groupId, groupJoinRequestId } = notification;
    if (!groupId || !groupJoinRequestId) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/groups/${groupId}/join-requests/${groupJoinRequestId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notification.id));
        window.dispatchEvent(new Event('notificationsUpdated'));
      } else {
        alert(data.message || 'Failed to approve');
      }
    } catch (err) {
      console.error('Approve request error:', err);
      alert('An error occurred');
    }
  };

  const handleDenyGroupRequest = async (e, notification) => {
    e.stopPropagation();
    const { groupId, groupJoinRequestId } = notification;
    if (!groupId || !groupJoinRequestId) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/groups/${groupId}/join-requests/${groupJoinRequestId}/deny`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notification.id));
        markAsRead(notification.id);
        window.dispatchEvent(new Event('notificationsUpdated'));
      } else {
        alert(data.message || 'Failed to deny');
      }
    } catch (err) {
      console.error('Deny request error:', err);
      alert('An error occurred');
    }
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
          <button 
            className={`filter-btn ${filter === 'mention' ? 'active' : ''}`}
            onClick={() => setFilter('mention')}
          >
            Mentions
          </button>
          <button 
            className={`filter-btn ${filter === 'reply' ? 'active' : ''}`}
            onClick={() => setFilter('reply')}
          >
            Replies
          </button>
          <button 
            className={`filter-btn ${filter === 'marketplace_listing' ? 'active' : ''}`}
            onClick={() => setFilter('marketplace_listing')}
          >
            Marketplace
          </button>
          <button 
            className={`filter-btn ${filter === 'lostfound_listing' ? 'active' : ''}`}
            onClick={() => setFilter('lostfound_listing')}
          >
            Lost & Found
          </button>
          <button 
            className={`filter-btn ${filter === 'group_join_request' ? 'active' : ''}`}
            onClick={() => setFilter('group_join_request')}
          >
            Group requests
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
                onClick={() => {
                  if (notification.type === 'group_chat_mention' && notification.conversationId) {
                    if (!notification.read) markAsRead(notification.id);
                    navigate('/main', { state: { openConversationId: notification.conversationId } });
                  } else if (!notification.read) {
                    markAsRead(notification.id);
                  }
                }}
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

                {notification.type === 'group_join_request' && !notification.read && notification.groupId && notification.groupJoinRequestId && (
                  <div className="notification-actions" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="notification-btn approve"
                      onClick={(e) => handleApproveGroupRequest(e, notification)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="notification-btn deny"
                      onClick={(e) => handleDenyGroupRequest(e, notification)}
                    >
                      Deny
                    </button>
                  </div>
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