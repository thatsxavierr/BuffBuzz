import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Friends.css';
import Header from './Header';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

const Friends = () => {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const currentUser = getValidUser();
    if (!currentUser) {
      navigate('/login');
      return;
    }

    fetchFriends(currentUser.id);
  }, [navigate]);

  const fetchFriends = async (userId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/friends/${userId}`);
      const data = await response.json();

      if (response.ok) {
        setFriends(data.friends);
      } else {
        setError(data.message || 'Failed to load friends');
      }
    } catch (err) {
      console.error('Error fetching friends:', err);
      setError('An error occurred while loading friends');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfriend = async (friendshipId, friendName) => {
    if (!window.confirm(`Are you sure you want to unfriend ${friendName}?`)) return;

    const currentUser = getValidUser();
    if (!currentUser) return;

    try {
      const response = await fetch(`http://localhost:5000/api/friends/remove/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (response.ok) {
        setFriends(friends.filter(friend => friend.friendshipId !== friendshipId));
        alert('Friend removed');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to unfriend');
      }
    } catch (err) {
      console.error('Error unfriending:', err);
      alert('An error occurred');
    }
  };

  const viewProfile = (userId) => {
    navigate('/profile', { state: { userId } });
  };

  if (loading) {
    return (
      <div>
        <Header onBackClick={() => navigate('/main')} />
        <div className="friends-container">
          <div className="loading">Loading friends...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header onBackClick={() => navigate('/main')} />
        <div className="friends-container">
          <div className="error">{error}</div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header onBackClick={() => navigate('/main')} />
      
      <div className="friends-container">
        <div className="friends-header">
          <h1>My Friends</h1>
          <p className="friend-count">
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
          </p>
        </div>

        {friends.length === 0 ? (
          <div className="no-friends">
            <p>You haven't added any friends yet</p>
            <button onClick={() => navigate('/main')} className="browse-button">
              Browse Posts to Connect
            </button>
          </div>
        ) : (
          <div className="friends-grid">
            {friends.map((friend) => (
              <div key={friend.id} className="friend-card">
                <div 
                  className="friend-profile-pic"
                  onClick={() => viewProfile(friend.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {friend.profile?.profilePictureUrl ? (
                    <img
                      src={friend.profile.profilePictureUrl}
                      alt={`${friend.firstName} ${friend.lastName}`}
                    />
                  ) : (
                    <div className="profile-placeholder">
                      {friend.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="friend-info">
                  <h3 
                    onClick={() => viewProfile(friend.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {friend.firstName} {friend.lastName}
                  </h3>
                  {friend.profile?.bio && (
                    <p className="friend-bio">{friend.profile.bio.substring(0, 80)}...</p>
                  )}
                </div>

                <div className="friend-actions">
                  <button
                    className="view-profile-button"
                    onClick={() => viewProfile(friend.id)}
                  >
                    View Profile
                  </button>
                  <button
                    className="unfriend-button"
                    onClick={() => handleUnfriend(friend.friendshipId, `${friend.firstName} ${friend.lastName}`)}
                  >
                    Unfriend
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Friends;