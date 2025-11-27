import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ProfileView.css';
import Header from './Header';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

export default function ProfileView() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canViewFullProfile, setCanViewFullProfile] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [viewingUserId, setViewingUserId] = useState(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  
  // Friendship states
  const [friendshipStatus, setFriendshipStatus] = useState('NONE');
  const [friendshipId, setFriendshipId] = useState(null);
  const [isSender, setIsSender] = useState(false);
  const [friendButtonLoading, setFriendButtonLoading] = useState(false);

  useEffect(() => {
    const userData = getValidUser();
    
    if (!userData) {
      navigate('/login');
      return;
    }
    
    setCurrentUserId(userData.id);
    const targetUserId = location.state?.userId || userData.id;
    setViewingUserId(targetUserId);
    setIsOwnProfile(targetUserId === userData.id);
    
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const url = `http://localhost:5000/api/profile/${targetUserId}?viewerId=${userData.id}`;
        
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);
          setCanViewFullProfile(data.canViewFullProfile);
          setPrivacyLevel(data.privacy);
        } else if (response.status === 404) {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();

    // Fetch friendship status if viewing another user's profile
    if (targetUserId !== userData.id) {
      fetchFriendshipStatus(userData.id, targetUserId);
    }
  }, [location.state?.userId, location.state?.refresh, navigate]);

  const fetchFriendshipStatus = async (userId, otherUserId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/friends/status/${userId}/${otherUserId}`);
      const data = await response.json();
      
      if (response.ok) {
        setFriendshipStatus(data.status);
        setFriendshipId(data.friendshipId);
        setIsSender(data.isSender);
      }
    } catch (err) {
      console.error('Error fetching friendship status:', err);
    }
  };

  const handleAddFriend = async () => {
    setFriendButtonLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          receiverId: viewingUserId
        })
      });

      const data = await response.json();

      if (response.ok) {
        setFriendshipStatus('PENDING');
        setFriendshipId(data.friendship.id);
        setIsSender(true);
        alert('Friend request sent!');
      } else {
        alert(data.message || 'Failed to send friend request');
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
      alert('An error occurred');
    } finally {
      setFriendButtonLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!friendshipId) return;
    
    setFriendButtonLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/friends/reject/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });

      if (response.ok) {
        setFriendshipStatus('NONE');
        setFriendshipId(null);
        setIsSender(false);
        alert('Friend request cancelled');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to cancel request');
      }
    } catch (err) {
      console.error('Error cancelling request:', err);
      alert('An error occurred');
    } finally {
      setFriendButtonLoading(false);
    }
  };

  const handleRespondToRequest = async (accept) => {
    if (!friendshipId) return;
    
    setFriendButtonLoading(true);
    try {
      const url = accept 
        ? `http://localhost:5000/api/friends/accept/${friendshipId}`
        : `http://localhost:5000/api/friends/reject/${friendshipId}`;
      
      const method = accept ? 'PUT' : 'DELETE';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });

      if (response.ok) {
        if (accept) {
          setFriendshipStatus('ACCEPTED');
          alert('Friend request accepted!');
          // Refresh profile to update privacy view
          window.location.reload();
        } else {
          setFriendshipStatus('NONE');
          setFriendshipId(null);
          setIsSender(false);
          alert('Friend request declined');
        }
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to process request');
      }
    } catch (err) {
      console.error('Error responding to request:', err);
      alert('An error occurred');
    } finally {
      setFriendButtonLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!friendshipId) return;
    
    if (!window.confirm('Are you sure you want to unfriend this person?')) return;
    
    setFriendButtonLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/friends/remove/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });

      if (response.ok) {
        setFriendshipStatus('NONE');
        setFriendshipId(null);
        setIsSender(false);
        alert('Friend removed');
        // Refresh profile to update privacy view
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to unfriend');
      }
    } catch (err) {
      console.error('Error unfriending:', err);
      alert('An error occurred');
    } finally {
      setFriendButtonLoading(false);
    }
  };

  const renderFriendButton = () => {
    if (isOwnProfile) return null;

    if (friendButtonLoading) {
      return <button className="friend-button friend-loading" disabled>Loading...</button>;
    }

    if (friendshipStatus === 'ACCEPTED') {
      return (
        <button className="friend-button friend-accepted" onClick={handleUnfriend}>
          ✓ Friends
        </button>
      );
    }

    if (friendshipStatus === 'PENDING') {
      if (isSender) {
        return (
          <button className="friend-button friend-pending" onClick={handleCancelRequest}>
            ⏱️ Request Sent
          </button>
        );
      } else {
        return (
          <div className="friend-request-buttons">
            <button className="friend-button friend-accept" onClick={() => handleRespondToRequest(true)}>
              ✓ Accept
            </button>
            <button className="friend-button friend-decline" onClick={() => handleRespondToRequest(false)}>
              ✗ Decline
            </button>
          </div>
        );
      }
    }

    return (
      <button className="friend-button friend-add" onClick={handleAddFriend}>
        + Add Friend
      </button>
    );
  };

  const handleEditProfile = () => {
    navigate('/profile-edit');
  };

  if (loading) {
    return (
      <div>
        <Header onBackClick={() => navigate('/main')} />
        <div className="profile-view-container">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <Header onBackClick={() => navigate('/main')} />
        <div className="profile-view-container">
          <div className="no-profile-card">
            <h2>{isOwnProfile ? 'No Profile Yet' : 'Profile Not Found'}</h2>
            <p>{isOwnProfile ? 'Create your profile to get started!' : 'This user has not created a profile yet.'}</p>
            {isOwnProfile && (
              <button onClick={handleEditProfile} className="create-profile-button">
                Create Profile
              </button>
            )}
            {!isOwnProfile && (
              <button onClick={() => navigate('/main')} className="create-profile-button">
                Back to Home
              </button>
            )}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div>
      <Header 
        onBackClick={() => navigate('/main')} 
        profilePictureUrl={isOwnProfile ? profile.profilePictureUrl : null} 
      />
      
      <div className="profile-view-container">
        <div className="profile-view-card">
          {/* Profile Header */}
          <div className="profile-header">
            <div className="profile-picture-large">
              {profile.profilePictureUrl ? (
                <img src={profile.profilePictureUrl} alt="Profile" />
              ) : (
                <div className="profile-placeholder-large">👤</div>
              )}
            </div>
            <div className="profile-header-info">
              <h1>{profile.name || `${profile.user?.firstName} ${profile.user?.lastName}`}</h1>
              {profile.pronouns && (
                <p className="pronouns">({profile.pronouns})</p>
              )}
              {(isOwnProfile || canViewFullProfile) && profile.user?.email && (
                <p className="email">{profile.user.email}</p>
              )}
              <div className="profile-action-buttons">
                {isOwnProfile ? (
                  <button onClick={handleEditProfile} className="edit-profile-button">
                    ✏️ Edit Profile
                  </button>
                ) : (
                  renderFriendButton()
                )}
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          {!canViewFullProfile && !isOwnProfile && (
            <div className="privacy-notice-section">
              <div className="privacy-notice">
                🔒 This profile is {privacyLevel === 'FRIENDS_ONLY' ? 'Friends Only' : 'Private'}. 
                {privacyLevel === 'FRIENDS_ONLY' 
                  ? ' Send a friend request to see more information.' 
                  : ' Only limited information is available.'}
              </div>
            </div>
          )}

          {/* Bio Section */}
          {(isOwnProfile || canViewFullProfile) && profile.bio ? (
            <div className="profile-section">
              <h2>About Me</h2>
              <p className="bio-text">{profile.bio}</p>
            </div>
          ) : (isOwnProfile || canViewFullProfile) && !profile.bio ? (
            <div className="profile-section">
              <h2>About Me</h2>
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                {isOwnProfile ? 'Add a bio to tell people about yourself!' : 'This user hasn\'t added a bio yet.'}
              </p>
            </div>
          ) : !isOwnProfile && !canViewFullProfile ? (
            <div className="profile-section">
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                {privacyLevel === 'PRIVATE' 
                  ? 'This profile is set to private.' 
                  : 'This information is only visible to friends.'}
              </p>
            </div>
          ) : null}

          {/* Academic Information */}
          {(isOwnProfile || canViewFullProfile) && (profile.major || profile.department || profile.classification || profile.graduationYear) ? (
            <div className="profile-section">
              <h2>Academic Information</h2>
              <div className="info-grid">
                {profile.major && (
                  <div className="info-item">
                    <span className="info-label">Major:</span>
                    <span className="info-value">{profile.major}</span>
                  </div>
                )}
                {profile.department && (
                  <div className="info-item">
                    <span className="info-label">Department:</span>
                    <span className="info-value">{profile.department}</span>
                  </div>
                )}
                {profile.classification && (
                  <div className="info-item">
                    <span className="info-label">Year:</span>
                    <span className="info-value">
                      {profile.classification.charAt(0).toUpperCase() + profile.classification.slice(1)}
                    </span>
                  </div>
                )}
                {profile.graduationYear && (
                  <div className="info-item">
                    <span className="info-label">Graduation Year:</span>
                    <span className="info-value">{profile.graduationYear}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (isOwnProfile || canViewFullProfile) ? (
            <div className="profile-section">
              <h2>Academic Information</h2>
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                {isOwnProfile ? 'Add your academic information!' : 'No academic information added yet.'}
              </p>
            </div>
          ) : null}

          {/* Campus Life */}
          {(isOwnProfile || canViewFullProfile) && profile.clubs ? (
            <div className="profile-section">
              <h2>Clubs & Organizations</h2>
              <p className="clubs-text">{profile.clubs}</p>
            </div>
          ) : (isOwnProfile || canViewFullProfile) ? (
            <div className="profile-section">
              <h2>Clubs & Organizations</h2>
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                {isOwnProfile ? 'Add the clubs and organizations you\'re part of!' : 'No clubs or organizations listed yet.'}
              </p>
            </div>
          ) : null}

          {/* Social Media */}
          {(isOwnProfile || canViewFullProfile) && (profile.instagramHandle || profile.linkedinUrl || profile.facebookHandle) ? (
            <div className="profile-section">
              <h2>Connect With Me</h2>
              <div className="social-links">
                {profile.instagramHandle && (
                  <a 
                    href={`https://instagram.com/${profile.instagramHandle}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link instagram"
                  >
                    📷 @{profile.instagramHandle}
                  </a>
                )}
                {profile.linkedinUrl && (
                  <a 
                    href={profile.linkedinUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link linkedin"
                  >
                    💼 LinkedIn
                  </a>
                )}
                {profile.facebookHandle && (
                  <a 
                    href={`https://facebook.com/${profile.facebookHandle}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="social-link facebook"
                  >
                    📘 {profile.facebookHandle}
                  </a>
                )}
              </div>
            </div>
          ) : (isOwnProfile || canViewFullProfile) ? (
            <div className="profile-section">
              <h2>Connect With Me</h2>
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                {isOwnProfile ? 'Add your social media handles to connect with others!' : 'No social media links added yet.'}
              </p>
            </div>
          ) : null}

          {/* Privacy Info for Own Profile */}
          {isOwnProfile && (
            <div className="profile-section">
              <h2>Privacy Settings</h2>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                Your profile is set to: <strong style={{ color: '#800000' }}>{privacyLevel}</strong>
                <br />
                <small>Change this in Edit Profile</small>
              </p>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}