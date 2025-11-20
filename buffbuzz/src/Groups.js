import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Groups.css';
import Header from './Header.js';
import Footer from './Footer';

export default function Groups() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'my-groups', 'discover'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'academic',
    privacy: 'public',
    imageUrl: ''
  });

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!userData) {
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
      fetchGroups();
    }
  }, [navigate]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profilePictureUrl) {
          setProfilePicture(data.profile.profilePictureUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/groups');
      
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate('/main');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:5000/api/groups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          creatorId: user.id
        })
      });

      if (response.ok) {
        alert('Group created successfully!');
        setShowCreateModal(false);
        setFormData({
          name: '',
          description: '',
          category: 'academic',
          privacy: 'public',
          imageUrl: ''
        });
        fetchGroups();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to create group');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('An error occurred while creating the group');
    }
  };

  const handleJoinGroup = async (groupId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        alert('Successfully joined the group!');
        fetchGroups();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      alert('An error occurred while joining the group');
    }
  };

  const filteredGroups = groups.filter(group => {
    if (filter === 'all') return true;
    if (filter === 'my-groups') return group.members?.includes(user?.id);
    if (filter === 'discover') return !group.members?.includes(user?.id);
    return true;
  });

  if (!user) {
    return null;
  }

  return (
    <div className="groups-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />
      
      <div className="groups-container">
        <div className="groups-header">
          <h1>Groups</h1>
          <p>Connect with students who share your interests</p>
        </div>

        <div className="groups-actions">
          <button 
            className="create-group-button"
            onClick={() => setShowCreateModal(true)}
          >
            + Create Group
          </button>

          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Groups
            </button>
            <button 
              className={`filter-btn ${filter === 'my-groups' ? 'active' : ''}`}
              onClick={() => setFilter('my-groups')}
            >
              My Groups
            </button>
            <button 
              className={`filter-btn ${filter === 'discover' ? 'active' : ''}`}
              onClick={() => setFilter('discover')}
            >
              Discover
            </button>
          </div>
        </div>

        <div className="groups-grid">
          {loading ? (
            <div className="loading">Loading groups...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="no-groups">
              <h3>No groups found</h3>
              <p>Be the first to create a group!</p>
            </div>
          ) : (
            filteredGroups.map(group => (
              <div key={group.id} className="group-card">
                {group.imageUrl ? (
                  <div className="group-image" style={{backgroundImage: `url(${group.imageUrl})`}}></div>
                ) : (
                  <div className="group-image-placeholder">
                    <span className="placeholder-icon">👥</span>
                  </div>
                )}
                
                <div className="group-content">
                  <div className="group-header-info">
                    <h3>{group.name}</h3>
                    <span className={`privacy-badge ${group.privacy}`}>
                      {group.privacy === 'public' ? '🌐 Public' : '🔒 Private'}
                    </span>
                  </div>
                  
                  <p className="group-description">{group.description}</p>
                  
                  <div className="group-meta">
                    <span className="category-tag">{group.category}</span>
                    <span className="member-count">
                      👥 {group.memberCount || 0} members
                    </span>
                  </div>

                  <div className="group-footer">
                    {group.members?.includes(user.id) ? (
                      <button className="joined-button" disabled>
                        ✓ Joined
                      </button>
                    ) : (
                      <button 
                        className="join-button"
                        onClick={() => handleJoinGroup(group.id)}
                      >
                        Join Group
                      </button>
                    )}
                    <button className="view-button">View</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Group</h2>
              <button 
                className="close-modal"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Group Name *</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Computer Science Club"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is your group about?"
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label>Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                >
                  <option value="academic">Academic</option>
                  <option value="sports">Sports & Recreation</option>
                  <option value="arts">Arts & Culture</option>
                  <option value="social">Social</option>
                  <option value="professional">Professional</option>
                  <option value="volunteer">Volunteer & Service</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Privacy *</label>
                <div className="privacy-selector">
                  <button
                    type="button"
                    className={`privacy-option ${formData.privacy === 'public' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, privacy: 'public' })}
                  >
                    🌐 Public
                    <span className="privacy-desc">Anyone can join</span>
                  </button>
                  <button
                    type="button"
                    className={`privacy-option ${formData.privacy === 'private' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, privacy: 'private' })}
                  >
                    🔒 Private
                    <span className="privacy-desc">Requires approval</span>
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="image">Group Image (Optional)</label>
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
                />
                {formData.imageUrl && (
                  <div className="image-preview-small">
                    <img src={formData.imageUrl} alt="Preview" />
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}