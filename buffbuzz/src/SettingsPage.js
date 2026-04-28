import { API_URL } from './config';
// SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "./SettingsPage.css";
import { getValidUser } from './sessionUtils';
import { useTheme } from './Theme';

const NOTIFICATION_ITEMS = [
  {
    group: 'Posts & Comments',
    items: [
      { name: 'postLikes',      label: 'Post Likes',         desc: 'Get notified when someone likes your post' },
      { name: 'comments',       label: 'Comments',           desc: 'Get notified when someone comments on your post' },
      { name: 'mentions',       label: 'Mentions',           desc: 'Get notified when you are mentioned in a post or comment' },
      { name: 'commentReplies', label: 'Comment Replies',    desc: 'Get notified when someone replies to your comment' },
    ]
  },
  {
    group: 'Groups',
    items: [
      { name: 'groupJoinRequests', label: 'Join Requests',         desc: 'Get notified when someone requests to join your private group' },
      { name: 'groupJoinResponse', label: 'Join Request Response', desc: 'Get notified when your request to join a group is approved or denied' },
      { name: 'groupNewPost',      label: 'New Group Posts',       desc: 'Get notified when a new post is created in a group you belong to' },
    ]
  },
  {
    group: 'Lost & Found',
    items: [
      { name: 'lostFoundNew',      label: 'New Listings',    desc: 'Get notified when a new Lost & Found posting is created' },
      { name: 'lostFoundContact',  label: 'Listing Enquiry', desc: 'Get notified when someone contacts you about your Lost & Found listing' },
      { name: 'lostFoundResolved', label: 'Marked Resolved', desc: 'Get notified when a Lost & Found item you interacted with is marked as resolved' },
    ]
  },
  {
    group: 'General',
    items: [
      { name: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
      { name: 'pushNotifications',  label: 'Push Notifications',  desc: 'Receive push notifications in browser' },
      { name: 'newFollowers',       label: 'New Followers',       desc: 'Get notified when someone follows you' },
    ]
  },
];

const DEFAULT_NOTIFICATIONS = {
  muteAll:              false,
  emailNotifications:   true,
  pushNotifications:    true,
  postLikes:            true,
  comments:             true,
  mentions:             true,
  commentReplies:       true,
  groupJoinRequests:    true,
  groupJoinResponse:    true,
  groupNewPost:         true,
  lostFoundNew:         false,
  lostFoundContact:     true,
  lostFoundResolved:    true,
  newFollowers:         true,
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const user = getValidUser();
  const { theme, toggleTheme } = useTheme();

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [muteUntil, setMuteUntil] = useState(null);
  const [muteLoading, setMuteLoading] = useState(false);
  const [deleteAccountData, setDeleteAccountData] = useState({ password: '', confirmText: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch(`${API_URL}/api/settings/notifications/${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.preferences) {
          setNotifications(prev => ({ ...prev, ...data.preferences }));
          setMuteUntil(data.preferences.muteUntil ? new Date(data.preferences.muteUntil) : null);
        }
      })
      .catch(err => console.error('Error:', err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasswordChange = (e) =>
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });

  const handleNotificationChange = (e) => {
    const { name, checked } = e.target;
    setNotifications(prev => ({ ...prev, [name]: checked }));
  };

  const handleDeleteAccountChange = (e) =>
    setDeleteAccountData({ ...deleteAccountData, [e.target.name]: e.target.value });

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' }); return;
    }
    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' }); return;
    }
    if (/\s/.test(passwordData.newPassword)) {
      setMessage({ type: 'error', text: 'Password cannot contain spaces' }); return;
    }
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword: passwordData.currentPassword, newPassword: passwordData.newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update password' });
      }
    } catch { setMessage({ type: 'error', text: 'An error occurred. Please try again.' }); }
    finally { setLoading(false); }
  };

  const handleNotificationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await fetch(API_URL + '/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ...notifications })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });
        setNotifOpen(false);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update preferences' });
      }
    } catch { setMessage({ type: 'error', text: 'An error occurred. Please try again.' }); }
    finally { setLoading(false); }
  };

  const handleTemporaryMute = async (hours) => {
    setMuteLoading(true);
    try {
      const response = await fetch(API_URL + '/api/settings/notifications/mute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, hours })
      });
      const data = await response.json();
      if (response.ok) {
        setMuteUntil(hours > 0 ? new Date(data.muteUntil) : null);
        setMessage({ type: 'success', text: data.message });
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setMuteLoading(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    if (deleteAccountData.confirmText !== 'DELETE') {
      setMessage({ type: 'error', text: 'Please type DELETE to confirm' }); return;
    }
    if (!deleteAccountData.password) {
      setMessage({ type: 'error', text: 'Please enter your password' }); return;
    }
    setLoading(true);
    try {
      const response = await fetch(API_URL + '/api/settings/delete-account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, password: deleteAccountData.password })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Account deleted successfully. Redirecting to login...' });
        setShowDeleteModal(false);
        sessionStorage.clear();
        localStorage.clear();
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to delete account' });
      }
    } catch { setMessage({ type: 'error', text: 'An error occurred. Please try again.' }); }
    finally { setLoading(false); }
  };

  const isMutedTemporarily = muteUntil && muteUntil > new Date();
  const allItems = NOTIFICATION_ITEMS.flatMap(g => g.items);
  const enabledCount = allItems.filter(i => notifications[i.name]).length;
  const totalCount = allItems.length;

  if (!user) return null;

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button onClick={() => navigate('/main')} className="settings-back-button">← Back</button>
        <h1>Settings</h1>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* ── Appearance ── */}
      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="appearance-row">
          <div className="appearance-info">
            <span className="appearance-label">
              {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
            </span>
            <p className="appearance-desc">
              {theme === 'dark'
                ? 'Dark mode is on. Easy on the eyes at night.'
                : 'Light mode is on. Switch to dark for a darker look.'}
            </p>
          </div>
          <button
            className="theme-toggle settings-theme-toggle"
            onClick={toggleTheme}
            title="Toggle dark mode"
          >
            <span className="theme-toggle-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <div className={`theme-toggle-track ${theme === 'dark' ? 'active' : ''}`}>
              <div className="theme-toggle-knob" />
            </div>
            <span className="theme-toggle-label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </section>

      {/* ── Password ── */}
      <section className="settings-section">
        <h2>Change Password</h2>
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input type="password" id="currentPassword" name="currentPassword"
              value={passwordData.currentPassword} onChange={handlePasswordChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input type="password" id="newPassword" name="newPassword"
              value={passwordData.newPassword} onChange={handlePasswordChange} required minLength="8" />
            <small>Must be at least 8 characters</small>
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input type="password" id="confirmPassword" name="confirmPassword"
              value={passwordData.confirmPassword} onChange={handlePasswordChange} required />
          </div>
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* ── Notifications — collapsible ── */}
      <section className="settings-section notif-section">
        <button
          type="button"
          className="notif-toggle"
          onClick={() => setNotifOpen(prev => !prev)}
          aria-expanded={notifOpen}
        >
          <div className="notif-toggle-left">
            <h2>Notification Preferences</h2>
            <span className="notif-summary">
              {isMutedTemporarily
                ? `⏰ Muted until ${muteUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : `${enabledCount} of ${totalCount} enabled`}
            </span>
          </div>
          <span className={`notif-chevron ${notifOpen ? 'open' : ''}`}>▾</span>
        </button>

        {notifOpen && (
          <form onSubmit={handleNotificationSubmit} className="notif-form">
            <div className="temp-mute-block">
              <div className="temp-mute-header">
                <span className="temp-mute-icon">⏰</span>
                <div>
                  <strong>Mute Temporarily</strong>
                  {isMutedTemporarily ? (
                    <span className="mute-active-text">
                      Muted until {muteUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' '}({muteUntil.toLocaleDateString()})
                    </span>
                  ) : (
                    <span className="mute-inactive-text">Not currently muted</span>
                  )}
                </div>
              </div>
              <div className="temp-mute-buttons">
                <button type="button" className="mute-duration-btn" onClick={() => handleTemporaryMute(1)} disabled={muteLoading}>1 hour</button>
                <button type="button" className="mute-duration-btn" onClick={() => handleTemporaryMute(4)} disabled={muteLoading}>4 hours</button>
                <button type="button" className="mute-duration-btn" onClick={() => handleTemporaryMute(8)} disabled={muteLoading}>8 hours</button>
                <button type="button" className="mute-duration-btn" onClick={() => handleTemporaryMute(24)} disabled={muteLoading}>24 hours</button>
                {isMutedTemporarily && (
                  <button type="button" className="mute-cancel-btn" onClick={() => handleTemporaryMute(0)} disabled={muteLoading}>Unmute now</button>
                )}
              </div>
            </div>

            {NOTIFICATION_ITEMS.map(({ group, items }) => (
              <div key={group} className="notif-group-block">
                <p className="notif-group-label">{group}</p>
                <div className="notification-group">
                  {items.map(({ name, label, desc }) => (
                    <div className="notification-item" key={name}>
                      <input
                        type="checkbox"
                        id={name}
                        name={name}
                        checked={notifications[name]}
                        onChange={handleNotificationChange}
                        disabled={isMutedTemporarily}
                      />
                      <label htmlFor={name}>
                        <strong>{label}</strong>
                        <span>{desc}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Saving...' : 'Save Preferences'}
            </button>
          </form>
        )}
      </section>

      {/* ── Danger Zone ── */}
      <section className="settings-section danger-zone">
        <h2>Danger Zone</h2>
        <div className="danger-content">
          <div className="danger-info">
            <h3>Delete Account</h3>
            <p>Once you delete your account, there is no going back. This will permanently delete:</p>
            <ul>
              <li>Your profile and personal information</li>
              <li>All your posts and comments</li>
              <li>Your likes and shares</li>
              <li>All friend connections</li>
              <li>Your notification preferences</li>
            </ul>
          </div>
          <button onClick={() => setShowDeleteModal(true)} className="delete-account-button">
            Delete Account
          </button>
        </div>
      </section>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Account</h2>
            <p className="modal-warning">
              ⚠️ This action cannot be undone. All your data will be permanently deleted.
            </p>
            <form onSubmit={handleDeleteAccount}>
              <div className="form-group">
                <label htmlFor="deletePassword">Enter your password to confirm</label>
                <input type="password" id="deletePassword" name="password"
                  value={deleteAccountData.password} onChange={handleDeleteAccountChange}
                  placeholder="Enter your password" required />
              </div>
              <div className="form-group">
                <label htmlFor="confirmText">Type "DELETE" to confirm</label>
                <input type="text" id="confirmText" name="confirmText"
                  value={deleteAccountData.confirmText} onChange={handleDeleteAccountChange}
                  placeholder="Type DELETE" required />
              </div>
              <div className="modal-buttons">
                <button type="button"
                  onClick={() => { setShowDeleteModal(false); setDeleteAccountData({ password: '', confirmText: '' }); }}
                  className="cancel-button" disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="confirm-delete-button" disabled={loading}>
                  {loading ? 'Deleting...' : 'Delete My Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;