import { API_URL } from './config';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ProfileView.css';
import Header from './Header';
import Footer from './Footer';
import PostCard from './PostCard';
import { getValidUser } from './sessionUtils';
import ReportModal from './ReportModal';

// Abbreviate a group name to 2-4 characters for the badge
// e.g. "Black Student Union" → "BSU", "ASO" → "ASO", "Computer Science Club" → "CSC"
function abbreviate(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return name.slice(0, 4).toUpperCase();
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 4);
}

// Pick a deterministic badge color from a small palette
const BADGE_COLORS = [
  { bg: '#800000', text: '#fff' },
  { bg: '#1e40af', text: '#fff' },
  { bg: '#065f46', text: '#fff' },
  { bg: '#7c3aed', text: '#fff' },
  { bg: '#b45309', text: '#fff' },
  { bg: '#be185d', text: '#fff' },
];
function badgeColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

function getPostPreviewImage(post) {
  if (post.imageUrls?.length) return post.imageUrls[0];
  if (post.imageUrl) return post.imageUrl;
  return null;
}

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
  const [currentUserProfilePictureUrl, setCurrentUserProfilePictureUrl] = useState(null);
  
  // Friendship states
  const [friendshipStatus, setFriendshipStatus] = useState('NONE');
  const [friendshipId, setFriendshipId] = useState(null);
  const [isSender, setIsSender] = useState(false);
  const [friendButtonLoading, setFriendButtonLoading] = useState(false);
  
  // Block states
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedBy, setIsBlockedBy] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Organization badges
  const [userGroups, setUserGroups] = useState([]);
  const [showReportProfile, setShowReportProfile] = useState(false);

  const [profilePosts, setProfilePosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [friendIds, setFriendIds] = useState(() => new Set());
  const [enhancedPostId, setEnhancedPostId] = useState(null);

  const enhancedPost = enhancedPostId
    ? profilePosts.find((p) => p.id === enhancedPostId)
    : null;

  // Scroll to top when navigating to this profile (e.g. from comment section or likes modal)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.state?.userId]);

  useEffect(() => {
    if (!enhancedPostId) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setEnhancedPostId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [enhancedPostId]);

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
        const url = `${API_URL}/api/profile/${targetUserId}?viewerId=${userData.id}`;
        
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

    const fetchUserGroups = async () => {
      try {
        const response = await fetch(API_URL + '/api/groups');
        if (response.ok) {
          const data = await response.json();
          // Keep groups this user is a member of
          const membered = (data.groups || []).filter(g =>
            g.members?.includes(targetUserId)
          );
          setUserGroups(membered);
        }
      } catch (error) {
        console.error('Error fetching groups for badges:', error);
      }
    };
    
    fetchProfile();
    fetchUserGroups();

    // When viewing someone else's profile, fetch current user's profile picture for the header
    if (targetUserId !== userData.id) {
      fetchFriendshipStatus(userData.id, targetUserId);
      fetchBlockStatus(userData.id, targetUserId);
      fetch(`${API_URL}/api/profile/${userData.id}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data?.profile?.profilePictureUrl) {
            setCurrentUserProfilePictureUrl(data.profile.profilePictureUrl);
          }
        })
        .catch(() => {});
    } else {
      setCurrentUserProfilePictureUrl(null);
    }
  }, [location.state?.userId, location.state?.refresh, navigate]);

  useEffect(() => {
    if (!currentUserId || !viewingUserId || !profile) {
      return;
    }
    if (!isOwnProfile && !canViewFullProfile) {
      setProfilePosts([]);
      return;
    }

    let cancelled = false;
    setPostsLoading(true);

    (async () => {
      try {
        const [postsRes, friendsRes] = await Promise.all([
          fetch(
            `${API_URL}/api/posts?authorId=${encodeURIComponent(viewingUserId)}&userId=${encodeURIComponent(currentUserId)}`
          ),
          fetch(`${API_URL}/api/friends/${currentUserId}`)
        ]);

        if (cancelled) return;

        if (postsRes.ok) {
          const data = await postsRes.json();
          setProfilePosts(data.posts || []);
        } else {
          setProfilePosts([]);
        }

        if (friendsRes.ok) {
          const fdata = await friendsRes.json();
          setFriendIds(new Set((fdata.friends || []).map(f => f.id)));
        }
      } catch (e) {
        console.error('Error loading profile posts:', e);
        if (!cancelled) setProfilePosts([]);
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, viewingUserId, currentUserId, isOwnProfile, canViewFullProfile]);

  const handleProfilePostDelete = (postId) => {
    setProfilePosts((prev) => prev.filter((p) => p.id !== postId));
    setEnhancedPostId((cur) => (cur === postId ? null : cur));
  };

  const handleProfilePostUpdate = (updatedPost) => {
    setProfilePosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  };

  const fetchFriendshipStatus = async (userId, otherUserId) => {
    try {
      const response = await fetch(`${API_URL}/api/friends/status/${userId}/${otherUserId}`);
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

  const fetchBlockStatus = async (userId, otherUserId) => {
    try {
      const response = await fetch(`${API_URL}/api/block-status/${userId}/${otherUserId}`);
      const data = await response.json();
      
      if (response.ok) {
        setIsBlocked(data.isBlocked);
        setIsBlockedBy(data.isBlockedBy);
      }
    } catch (err) {
      console.error('Error fetching block status:', err);
    }
  };

  const handleAddFriend = async () => {
    setFriendButtonLoading(true);
    try {
      const response = await fetch(API_URL + '/api/friends/request', {
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
      const response = await fetch(`${API_URL}/api/friends/reject/${friendshipId}`, {
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
        ? `${API_URL}/api/friends/accept/${friendshipId}`
        : `${API_URL}/api/friends/reject/${friendshipId}`;
      
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
      const response = await fetch(`${API_URL}/api/friends/remove/${friendshipId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });

      if (response.ok) {
        setFriendshipStatus('NONE');
        setFriendshipId(null);
        setIsSender(false);
        alert('Friend removed');
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

  const handleBlock = async () => {
    if (!window.confirm('Are you sure you want to block this user? This will remove any friendship and prevent future interactions.')) return;
    
    setBlockLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/block/${viewingUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUserId })
      });

      if (response.ok) {
        setIsBlocked(true);
        setFriendshipStatus('NONE');
        setFriendshipId(null);
        alert('User blocked successfully');
        navigate('/main');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to block user');
      }
    } catch (err) {
      console.error('Error blocking user:', err);
      alert('An error occurred');
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (!window.confirm('Are you sure you want to unblock this user?')) return;
    
    setBlockLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/unblock/${viewingUserId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUserId })
      });

      if (response.ok) {
        setIsBlocked(false);
        alert('User unblocked successfully');
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to unblock user');
      }
    } finally {
      setBlockLoading(false);
    }
  };

  const renderFriendButton = () => {
    if (isOwnProfile) return null;
    
    if (isBlockedBy) {
      return <p style={{ color: '#ccc', fontSize: '14px', margin: 0 }}>This user is unavailable</p>;
    }

    if (isBlocked) {
      return (
        <button 
          className="friend-button friend-decline" 
          onClick={handleUnblock}
          disabled={blockLoading}
        >
          {blockLoading ? 'Loading...' : 'Unblock User'}
        </button>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {friendButtonLoading ? (
          <button className="friend-button friend-loading" disabled>Loading...</button>
        ) : friendshipStatus === 'ACCEPTED' ? (
          <button className="friend-button friend-accepted" onClick={handleUnfriend}>
            ✓ Friends
          </button>
        ) : friendshipStatus === 'PENDING' ? (
          isSender ? (
            <button className="friend-button friend-pending" onClick={handleCancelRequest}>
              ⏱️ Request Sent
            </button>
          ) : (
            <div className="friend-request-buttons">
              <button className="friend-button friend-accept" onClick={() => handleRespondToRequest(true)}>
                ✓ Accept
              </button>
              <button className="friend-button friend-decline" onClick={() => handleRespondToRequest(false)}>
                ✗ Decline
              </button>
            </div>
          )
        ) : (
          <button className="friend-button friend-add" onClick={handleAddFriend}>
            + Add Friend
          </button>
        )}
        
        <button
          type="button"
          className="profile-report-button"
          onClick={() => setShowReportProfile(true)}
        >
          Report profile
        </button>

        <button 
          className="block-button"
          onClick={handleBlock}
          disabled={blockLoading}
        >
          {blockLoading ? 'Loading...' : '🚫 Block User'}
        </button>
      </div>
    );
  };

  const handleEditProfile = () => {
    navigate('/profile-edit');
  };

  if (loading) {
    return (
      <div>
        <Header 
          onBackClick={() => navigate('/main')} 
          profilePictureUrl={currentUserProfilePictureUrl}
          currentUserId={currentUserId}
        />
        <div className="profile-view-container">
          <div className="loading">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <Header 
          onBackClick={() => navigate('/main')} 
          profilePictureUrl={currentUserProfilePictureUrl}
          currentUserId={currentUserId}
        />
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
        profilePictureUrl={isOwnProfile ? profile.profilePictureUrl : currentUserProfilePictureUrl}
        currentUserId={currentUserId}
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
              {/* Name + org badges */}
              <div className="profile-name-row">
                <h1>{profile.name || `${profile.user?.firstName} ${profile.user?.lastName}`}</h1>
                {userGroups.length > 0 && (
                  <div className="org-badges">
                    {userGroups.map(group => {
                      const abbr = abbreviate(group.name);
                      const colors = badgeColor(group.name);
                      return (
                        <button
                          key={group.id}
                          className="org-badge"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                          title={group.name}
                          onClick={() => navigate('/groups', { state: { highlightGroupId: group.id } })}
                        >
                          {abbr}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

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

          {/* Posts (main feed only — same posts as home feed for this user) */}
          {(isOwnProfile || canViewFullProfile) && (
            <div className="profile-section profile-posts-section">
              <h2>Posts</h2>
              {postsLoading ? (
                <p className="profile-posts-placeholder">Loading posts…</p>
              ) : profilePosts.length === 0 ? (
                <p className="profile-posts-placeholder">
                  {isOwnProfile
                    ? 'You have not shared any posts on the main feed yet.'
                    : 'No posts on the main feed yet.'}
                </p>
              ) : (
                <div className="profile-posts-grid" role="list">
                  {profilePosts.map((post) => {
                    const previewUrl = getPostPreviewImage(post);
                    const snippet = [post.title, post.content].filter(Boolean).join(' ').slice(0, 80);
                    return (
                      <button
                        key={post.id}
                        type="button"
                        className="profile-post-tile"
                        onClick={() => setEnhancedPostId(post.id)}
                        aria-label={`Open post: ${post.title || 'Post'}`}
                      >
                        {previewUrl ? (
                          <img src={previewUrl} alt="" className="profile-post-tile-image" />
                        ) : (
                          <div className="profile-post-tile-text-only">
                            <span className="profile-post-tile-icon" aria-hidden>📝</span>
                            <span className="profile-post-tile-snippet">{snippet || 'Post'}</span>
                          </div>
                        )}
                        <span className="profile-post-tile-overlay" aria-hidden />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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

      <ReportModal
        isOpen={showReportProfile}
        onClose={() => setShowReportProfile(false)}
        reporterId={currentUserId}
        targetType="USER"
        targetId={viewingUserId}
        subjectLabel="this profile"
      />

      {enhancedPost && currentUserId && (
        <div
          className="profile-post-enhanced-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-post-enhanced-title"
          onClick={() => setEnhancedPostId(null)}
        >
          <div
            className="profile-post-enhanced-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-post-enhanced-header">
              <h3 id="profile-post-enhanced-title" className="profile-post-enhanced-heading">
                Post
              </h3>
              <button
                type="button"
                className="profile-post-enhanced-close"
                onClick={() => setEnhancedPostId(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="profile-post-enhanced-body">
              <PostCard
                post={enhancedPost}
                currentUserId={currentUserId}
                onDelete={handleProfilePostDelete}
                onUpdate={handleProfilePostUpdate}
                friendIds={friendIds}
              />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}