import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './FriendRequests.css';
import Header from './Header';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

const FriendRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const currentUser = getValidUser();
    console.log('Current user from session:', currentUser);
    
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setCurrentUserId(currentUser.id);

    // Fetch current user's profile for the header using the CORRECT endpoint
    fetch(`http://localhost:5000/api/profile/${currentUser.id}?viewerId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        console.log('Full API response:', data);
        console.log('Profile data:', data.profile);
        console.log('Profile picture URL:', data.profile?.profilePictureUrl);
        
        if (data.profile?.profilePictureUrl) {
          setCurrentUserProfile(data.profile.profilePictureUrl);
          console.log('Set profile picture to:', data.profile.profilePictureUrl);
        } else {
          console.log('No profile picture URL found in response');
        }
      })
      .catch(err => console.error('Error fetching user profile:', err));

    fetchRequests(currentUser.id);
  }, [navigate]);

  const fetchRequests = async (userId) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/friends/requests/${userId}`);
      const data = await response.json();

      if (response.ok) {
        setRequests(data.requests);
      } else {
        setError(data.message || 'Failed to load friend requests');
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('An error occurred while loading requests');
    } finally {
      setLoading(false);
    }
  };

  const refreshHeaderCount = () => {
    // Trigger a custom event that Header listens to
    window.dispatchEvent(new Event('friendRequestsUpdated'));
  };

  const handleAccept = async (friendshipId) => {
    const currentUser = getValidUser();
    if (!currentUser) return;

    try {
      const response = await fetch(`http://localhost:5000/api/friends/accept/${friendshipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (response.ok) {
        setRequests(requests.filter(req => req.id !== friendshipId));
        refreshHeaderCount(); // Update header count
        alert('Friend request accepted!');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to accept request');
      }
    } catch (err) {
      console.error('Error accepting request:', err);
      alert('An error occurred');
    }
  };

  const handleDecline = async (friendshipId) => {
    const currentUser = getValidUser();
    if (!currentUser) return;

    try {
      const response = await fetch(`http://localhost:5000/api/friends/reject/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });

      if (response.ok) {
        setRequests(requests.filter(req => req.id !== friendshipId));
        refreshHeaderCount(); // Update header count
        alert('Friend request declined');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to decline request');
      }
    } catch (err) {
      console.error('Error declining request:', err);
      alert('An error occurred');
    }
  };

  const viewProfile = (userId) => {
    navigate('/profile', { state: { userId } });
  };

  console.log('Rendering FriendRequests component with profilePictureUrl:', currentUserProfile);

  if (loading) {
    return (
      <div>
        <Header 
          onBackClick={() => navigate('/main')} 
          profilePictureUrl={currentUserProfile}
          currentUserId={currentUserId}
        />
        <div className="friend-requests-container">
          <div className="loading">Loading friend requests...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header 
          onBackClick={() => navigate('/main')} 
          profilePictureUrl={currentUserProfile}
          currentUserId={currentUserId}
        />
        <div className="friend-requests-container">
          <div className="error">{error}</div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header 
        onBackClick={() => navigate('/main')} 
        profilePictureUrl={currentUserProfile}
        currentUserId={currentUserId}
      />
      
      <div className="friend-requests-container">
        <div className="friend-requests-header">
          <h1>Friend Requests</h1>
          <p className="request-count">
            {requests.length} {requests.length === 1 ? 'request' : 'requests'}
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="no-requests">
            <p>No pending friend requests</p>
          </div>
        ) : (
          <div className="requests-list">
            {requests.map((request) => (
              <div key={request.id} className="request-card">
                <div 
                  className="request-profile-pic"
                  onClick={() => viewProfile(request.sender.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {request.sender.profile?.profilePictureUrl ? (
                    <img
                      src={request.sender.profile.profilePictureUrl}
                      alt={`${request.sender.firstName} ${request.sender.lastName}`}
                    />
                  ) : (
                    <div className="profile-placeholder">
                      {request.sender.firstName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="request-info">
                  <h3 
                    onClick={() => viewProfile(request.sender.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {request.sender.firstName} {request.sender.lastName}
                  </h3>
                  {request.sender.profile?.bio && (
                    <p className="request-bio">{request.sender.profile.bio.substring(0, 100)}...</p>
                  )}
                  <p className="request-time">
                    {new Date(request.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="request-actions">
                  <button
                    className="accept-button"
                    onClick={() => handleAccept(request.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="decline-button"
                    onClick={() => handleDecline(request.id)}
                  >
                    Decline
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

export default FriendRequests;