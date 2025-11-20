import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileView.css';
import Header from './Header';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

export default function ProfileView() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user with session validation (checks expiration)
    const userData = getValidUser();
    
    if (!userData) {
      navigate('/login');
      return;
    }
    
    setUser(userData);
    fetchProfile(userData.id);
  }, [navigate]);

  const fetchProfile = async (userId) => {
    try {
      // Get the current user's ID to pass as viewerId for privacy checks
      const currentUser = getValidUser();
      const viewerId = currentUser?.id;
      
      // Add viewerId as query parameter for privacy checking
      const url = viewerId 
        ? `http://localhost:5000/api/profile/${userId}?viewerId=${viewerId}`
        : `http://localhost:5000/api/profile/${userId}`;
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        
        // Show privacy notice if user can't see full profile
        if (!data.canViewFullProfile && data.privacy === 'FRIENDS_ONLY') {
          // You could set a state variable here to show a message
          console.log('This profile is set to Friends Only. Send a friend request to see more.');
        } else if (!data.canViewFullProfile && data.privacy === 'PRIVATE') {
          console.log('This profile is set to Private.');
        }
      } else if (response.status === 404) {
        // Profile doesn't exist yet
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
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
            <h2>No Profile Yet</h2>
            <p>Create your profile to get started!</p>
            <button onClick={handleEditProfile} className="create-profile-button">
              Create Profile
            </button>
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
        profilePictureUrl={profile.profilePictureUrl} 
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
              <h1>{profile.name || `${user.firstName} ${user.lastName}`}</h1>
              {profile.pronouns && (
                <p className="pronouns">({profile.pronouns})</p>
              )}
              <p className="email">{user.email}</p>
              <button onClick={handleEditProfile} className="edit-profile-button">
                ✏️ Edit Profile
              </button>
            </div>
          </div>

          {/* Bio Section */}
          {profile.bio ? (
            <div className="profile-section">
              <h2>About Me</h2>
              <p className="bio-text">{profile.bio}</p>
            </div>
          ) : profile.privacy === 'PRIVATE' && user?.id !== profile.userId ? (
            <div className="profile-section">
              <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                This profile is set to private. Only the profile owner can see this information.
              </p>
            </div>
          ) : null}

          {/* Academic Information */}
          {(profile.major || profile.department || profile.classification || profile.graduationYear) && (
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
          )}

          {/* Campus Life */}
          {profile.clubs && (
            <div className="profile-section">
              <h2>Clubs & Organizations</h2>
              <p className="clubs-text">{profile.clubs}</p>
            </div>
          )}

          {/* Social Media */}
          {(profile.instagramHandle || profile.linkedinUrl || profile.facebookHandle) && (
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
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
