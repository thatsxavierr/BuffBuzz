import { API_URL } from './config';
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
      const response = await fetch(`${API_URL}/api/profile/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profilePictureUrl) setProfilePicture(data.profile.profilePictureUrl);
      }
    } catch (error) { console.error('Error fetching profile picture:', error); }
  };

  const fetchNotifications = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) { console.error('Error fetching notifications:', error); }
    finally { setLoading(false); }
  };

  const handleBackClick = () => navigate('/main');

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        setNotifications(notifications.map(n => n.id === notificationId ? { ...n, read: true } : n));
      }
    } catch (error) { console.error('Error marking notification as read:', error); }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${user.id}/read-all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, read: true })));
        alert('All notifications marked as read');
      }
    } catch (error) { console.error('Error marking all as read:', error); }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}`, { method: 'DELETE' });
      if (response.ok) setNotifications(notifications.filter(n => n.id !== notificationId));
    } catch (error) { console.error('Error deleting notification:', error); }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    if (filter === 'group_join_request') return ['group_join_request', 'group_join_approved', 'group_join_denied'].includes(notification.type);
    if (filter === 'mention') return notification.type === 'mention' || notification.type === 'group_chat_mention';
    if (filter === 'lostfound_listing') return notification.type === 'lostfound_listing' || notification.type === 'lostfound_resolved';
    return notification.type === filter;
  });

  const getNotificationIcon = (type) => {
    const icons = {
      like: '❤️', comment: '💬', reply: '↩️', follow: '👤', mention: '📢',
      share: '🔄', group: '👥', group_join_request: '👥', group_join_approved: '✅',
      group_join_denied: '❌', direct_message: '✉️', group_message: '👥',
      group_chat_mention: '💬', event: '📅', message: '✉️',
      marketplace_listing: '🛒', lostfound_listing: '🔍', lostfound_resolved: '✅',
      platform_announcement: '📣', newsletter_post: '📰'
    };
    return icons[type] || '🔔';
  };

  const handleApproveGroupRequest = async (e, notification) => {
    e.stopPropagation();
    const { groupId, groupJoinRequestId } = notification;
    if (!groupId || !groupJoinRequestId) return;
    try {
      const response = await fetch(
        `${API_URL}/api/groups/${groupId}/join-requests/${groupJoinRequestId}/approve`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }
      );
      const data = await response.json();
      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notification.id));
        window.dispatchEvent(new Event('notificationsUpdated'));
      } else { alert(data.message || 'Failed to approve'); }
    } catch (err) { console.error('Approve request error:', err); alert('An error occurred'); }
  };

  const handleDenyGroupRequest = async (e, notification) => {
    e.stopPropagation();
    const { groupId, groupJoinRequestId } = notification;
    if (!groupId || !groupJoinRequestId) return;
    try {
      const response = await fetch(
        `${API_URL}/api/groups/${groupId}/join-requests/${groupJoinRequestId}/deny`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }
      );
      const data = await response.json();
      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notification.id));
        markAsRead(notification.id);
        window.dispatchEvent(new Event('notificationsUpdated'));
      } else { alert(data.message || 'Failed to deny'); }
    } catch (err) { console.error('Deny request error:', err); alert('An error occurred'); }
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

  if (!user) return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="notifications-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />

      <div className="notifications-container">
        <div className="notifications-header">
          <div className="header-top">
            <h1>Notifications</h1>
            {unreadCount > 0 && (
              <span className="unread-badge" aria-label={`${unreadCount} unread notifications`}>
                {unreadCount} new
              </span>
            )}
          </div>
          {notifications.length > 0 && unreadCount > 0 && (
            <button className="mark-all-read" onClick={markAllAsRead}>
              Mark all as read
            </button>
          )}
        </div>

        <div className="notifications-filters">
          {[
            { key: 'all',                  label: 'All' },
            { key: 'unread',               label: 'Unread' },
            { key: 'like',                 label: 'Likes' },
            { key: 'comment',              label: 'Comments' },
            { key: 'follow',               label: 'Follows' },
            { key: 'mention',              label: 'Mentions' },
            { key: 'reply',                label: 'Replies' },
            { key: 'marketplace_listing',  label: 'Marketplace' },
            { key: 'lostfound_listing',    label: 'Lost & Found' },
            { key: 'group_join_request',   label: 'Group requests' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`filter-btn ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="notifications-list" role="list">
          {loading ? (
            <div className="loading">Loading notifications...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="no-notifications">
              {/* Decorative bell — screen reader skips it */}
              <span className="no-notif-icon" aria-hidden="true">🔔</span>
              <h3>No notifications yet</h3>
              <p>When you get notifications, they'll show up here</p>
            </div>
          ) : (
            filteredNotifications.map(notification => (
              <div
                key={notification.id}
                role="listitem"
                className={`notification-item ${!notification.read ? 'unread' : ''}`}
                onClick={() => {
                  if (notification.type === 'group_chat_mention' && notification.conversationId) {
                    if (!notification.read) markAsRead(notification.id);
                    navigate('/main', { state: { openConversationId: notification.conversationId } });
                  } else if (notification.type === 'platform_announcement' || notification.type === 'newsletter_post') {
                    if (!notification.read) markAsRead(notification.id);
                    navigate('/newsletter');
                  } else if (!notification.read) {
                    markAsRead(notification.id);
                  }
                }}
              >
                {/* Decorative emoji icon — screen reader already gets the text below */}
                <div className="notification-icon" aria-hidden="true">
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="notification-content">
                  <div className="notification-main">
                    <span className="notification-user">{notification.userName}</span>
                    <span className="notification-text">{notification.message}</span>
                  </div>
                  <span className="notification-time">{getTimeAgo(notification.createdAt)}</span>
                </div>

                {/* Unread dot is purely visual; the "unread" class on the item conveys state */}
                {!notification.read && (
                  <div className="unread-dot" aria-hidden="true" />
                )}

                {notification.type === 'group_join_request' && !notification.read && notification.groupId && notification.groupJoinRequestId && (
                  <div className="notification-actions" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="notification-btn approve"
                      onClick={(e) => handleApproveGroupRequest(e, notification)}
                      aria-label="Approve group join request"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="notification-btn deny"
                      onClick={(e) => handleDenyGroupRequest(e, notification)}
                      aria-label="Deny group join request"
                    >
                      Deny
                    </button>
                  </div>
                )}

                <button
                  className="delete-notification"
                  onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                  aria-label="Dismiss this notification"
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