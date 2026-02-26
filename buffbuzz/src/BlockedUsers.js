import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './BlockedUsers.css';
import Header from './Header';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

const BlockedUsers = () => {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const currentUser = getValidUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    fetchBlockedUsers(currentUser.id);
  }, [navigate]);

  const fetchBlockedUsers = async (userId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/blocked/${userId}`);
      const data = await response.json();

      if (response.ok) {
        setBlockedUsers(data.blockedUsers);
      } else {
        setError(data.message || 'Failed to load blocked users');
      }
    } catch (err) {
      console.error('Error fetching blocked users:', err);
      setError('An error occurred while loading blocked users');
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to unblock ${userName}?`)) return;

    const currentUser = getValidUser();
    if (!currentUser) return;

    try {
      const response = await fetch(`http://localhost:5000/api/unblock/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUser.id })
      });

      if (response.ok) {
        setBlockedUsers(blockedUsers.filter(user => user.id !== userId));
        alert(`${userName} has been unblocked`);
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to unblock user');
      }
    } catch (err) {
      console.error('Error unblocking user:', err);
      alert('An error occurred');
    }
  };

  if (loading) {
    return (
      <div>
        <Header onBackClick={() => navigate('/main')} />
        <div className="blocked-users-container">
          <div className="loading">Loading blocked users...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header onBackClick={() => navigate('/main')} />
        <div className="blocked-users-container">
          <div className="error">{error}</div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header onBackClick={() => navigate('/main')} />
      
      <div className="blocked-users-container">
        <div className="blocked-users-header">
          <h1>Blocked Users</h1>
          <p className="blocked-count">
            {blockedUsers.length} {blockedUsers.length === 1 ? 'user' : 'users'} blocked
          </p>
        </div>

        {blockedUsers.length === 0 ? (
          <div className="no-blocked">
            <p>You haven't blocked anyone</p>
            <button onClick={() => navigate('/main')} className="back-button">
              Back to Home
            </button>
          </div>
        ) : (
          <div className="blocked-list">
            {blockedUsers.map((user) => (
              <div key={user.id} className="blocked-card">
                <div className="blocked-profile-pic">
                  {user.profile?.profilePictureUrl ? (
                    <img
                      src={user.profile.profilePictureUrl}
                      alt={`${user.firstName} ${user.lastName}`}
                    />
                  ) : (
                    <div className="profile-placeholder">
                      {user.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="blocked-info">
                  <h3>{user.firstName} {user.lastName}</h3>
                  <p className="blocked-email">{user.email}</p>
                </div>

                <button
                  className="unblock-button"
                  onClick={() => handleUnblock(user.id, `${user.firstName} ${user.lastName}`)}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default BlockedUsers;