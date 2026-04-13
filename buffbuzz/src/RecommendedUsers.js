// RecommendedUsers.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './RecommendedUsers.css';

export default function RecommendedUsers({ currentUserId }) {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestedIds, setRequestedIds] = useState(new Set());
  const [dismissedIds, setDismissedIds] = useState(new Set());

  useEffect(() => {
    if (!currentUserId) return;
    fetchRecommendations();
  }, [currentUserId]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/users/recommendations/${currentUserId}?limit=6`
      );
      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = async (e, userId) => {
    e.stopPropagation();
    try {
      const res = await fetch('http://localhost:5000/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUserId, receiverId: userId })
      });
      if (res.ok) {
        setRequestedIds(prev => new Set([...prev, userId]));
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
    }
  };

  const handleDismiss = (e, userId) => {
    e.stopPropagation();
    setDismissedIds(prev => new Set([...prev, userId]));
  };

  const handleViewProfile = (userId) => {
    navigate('/profile', { state: { userId } });
  };

  const visible = recommendations.filter(u => !dismissedIds.has(u.id));

  if (loading) {
    return (
      <div className="recommended-users">
        <h3 className="recommended-title">Suggested for you</h3>
        <div className="recommended-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="recommended-skeleton">
              <div className="skeleton-avatar" />
              <div className="skeleton-lines">
                <div className="skeleton-line wide" />
                <div className="skeleton-line narrow" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="recommended-users">
        <h3 className="recommended-title">Suggested for you</h3>
        <p className="recommended-empty">No suggestions right now. Check back later!</p>
      </div>
    );
  }

  return (
    <div className="recommended-users">
      <div className="recommended-header">
        <h3 className="recommended-title">Suggested for you</h3>
        <button
          className="recommended-refresh"
          onClick={fetchRecommendations}
          title="Refresh suggestions"
        >
          ↻
        </button>
      </div>

      <ul className="recommended-list">
        {visible.map(user => (
          <li
            key={user.id}
            className="recommended-item"
            onClick={() => handleViewProfile(user.id)}
          >
            {/* Avatar */}
            <div className="recommended-avatar">
              {user.profilePictureUrl ? (
                <img src={user.profilePictureUrl} alt="" />
              ) : (
                <div className="recommended-avatar-placeholder">
                  {user.firstName?.[0]}{user.lastName?.[0]}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="recommended-info">
              <span className="recommended-name">
                {user.firstName} {user.lastName}
              </span>
              {user.major ? (
                <span className="recommended-sub">{user.major}</span>
              ) : user.department ? (
                <span className="recommended-sub">{user.department}</span>
              ) : (
                <span className="recommended-sub recommended-sub-type">
                  {user.userType === 'PROFESSOR' ? 'Professor' : 'Student'}
                </span>
              )}
              {user.mutualFriends && (
                <span className="recommended-mutual">👥 Mutual friends</span>
              )}
            </div>

            {/* Actions */}
            <div className="recommended-actions" onClick={e => e.stopPropagation()}>
              {requestedIds.has(user.id) ? (
                <span className="recommended-requested">Requested</span>
              ) : (
                <button
                  className="recommended-add-btn"
                  onClick={(e) => handleAddFriend(e, user.id)}
                >
                  + Add
                </button>
              )}
              <button
                className="recommended-dismiss-btn"
                onClick={(e) => handleDismiss(e, user.id)}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}