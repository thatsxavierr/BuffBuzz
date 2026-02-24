// SettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import "./SettingsPage.css";
import { getValidUser } from './sessionUtils';

const SettingsPage = () => {
  const navigate = useNavigate();
  const user = getValidUser();

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    postLikes: true,
    comments: true,
    newFollowers: true
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    fetch(`http://localhost:5000/api/settings/notifications/${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.preferences) {
          setNotifications(data.preferences);
        }
      })
      .catch(err => console.error('Error:', err));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const handleNotificationChange = (e) => {
    const name = e.target.name;
    const checked = e.target.checked;
    
    console.log(`Checkbox ${name} changed to ${checked}`); // Debug log
    
    setNotifications({
      ...notifications,
      [name]: checked
    });
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update password' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    console.log('Saving notifications:', notifications); // Debug log

    try {
      const response = await fetch('http://localhost:5000/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          ...notifications
        })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Preferences saved successfully!' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update preferences' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/main');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button onClick={handleBack} className="back-button">← Back</button>
        <h1>Settings</h1>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>{message.text}</div>
      )}

      {/* Password Section */}
      <section className="settings-section">
        <h2>Change Password</h2>
        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              type="password"
              id="currentPassword"
              name="currentPassword"
              value={passwordData.currentPassword}
              onChange={handlePasswordChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              name="newPassword"
              value={passwordData.newPassword}
              onChange={handlePasswordChange}
              required
              minLength="8"
            />
            <small>Must be at least 8 characters</small>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={passwordData.confirmPassword}
              onChange={handlePasswordChange}
              required
            />
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </section>

      {/* Notifications Section */}
      <section className="settings-section">
        <h2>Notification Preferences</h2>
        <form onSubmit={handleNotificationSubmit}>
          <div className="notification-group">
            <div className="notification-item">
              <input
                type="checkbox"
                id="emailNotifications"
                name="emailNotifications"
                checked={notifications.emailNotifications}
                onChange={handleNotificationChange}
              />
              <label htmlFor="emailNotifications">
                <strong>Email Notifications</strong>
                <span>Receive notifications via email</span>
              </label>
            </div>

            <div className="notification-item">
              <input
                type="checkbox"
                id="pushNotifications"
                name="pushNotifications"
                checked={notifications.pushNotifications}
                onChange={handleNotificationChange}
              />
              <label htmlFor="pushNotifications">
                <strong>Push Notifications</strong>
                <span>Receive push notifications in browser</span>
              </label>
            </div>

            <div className="notification-item">
              <input
                type="checkbox"
                id="postLikes"
                name="postLikes"
                checked={notifications.postLikes}
                onChange={handleNotificationChange}
              />
              <label htmlFor="postLikes">
                <strong>Post Likes</strong>
                <span>Get notified when someone likes your post</span>
              </label>
            </div>

            <div className="notification-item">
              <input
                type="checkbox"
                id="comments"
                name="comments"
                checked={notifications.comments}
                onChange={handleNotificationChange}
              />
              <label htmlFor="comments">
                <strong>Comments</strong>
                <span>Get notified when someone comments on your post</span>
              </label>
            </div>

            <div className="notification-item">
              <input
                type="checkbox"
                id="newFollowers"
                name="newFollowers"
                checked={notifications.newFollowers}
                onChange={handleNotificationChange}
              />
              <label htmlFor="newFollowers">
                <strong>New Followers</strong>
                <span>Get notified when someone follows you</span>
              </label>
            </div>
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default SettingsPage;