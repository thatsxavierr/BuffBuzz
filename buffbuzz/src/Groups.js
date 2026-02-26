import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Groups.css';
import Header from './Header.js';
import Footer from './Footer';
import ImageCarousel from './ImageCarousel';
import { getValidUser } from './sessionUtils';

export default function Groups() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [detailGroup, setDetailGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'ACADEMIC',
    privacy: 'PUBLIC',
    imageUrl: ''
  });

  useEffect(() => {
    const userData = getValidUser();
    
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

  const hasUnsavedChanges = () => {
    return !!(
      formData.name?.trim() ||
      formData.description?.trim() ||
      formData.imageUrl ||
      formData.category !== 'ACADEMIC' ||
      formData.privacy !== 'PUBLIC'
    );
  };

  const handleCloseCreateModal = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your group will not be created.')) {
      return;
    }
    setShowCreateModal(false);
    setEditingGroupId(null);
    setFormData({
      name: '',
      description: '',
      category: 'ACADEMIC',
      privacy: 'PUBLIC',
      imageUrl: ''
    });
  };

  const handleEditGroup = (group) => {
    setFormData({
      name: group.name || '',
      description: group.description || '',
      category: group.category || 'ACADEMIC',
      privacy: group.privacy || 'PUBLIC',
      imageUrl: group.imageUrl || ''
    });
    setEditingGroupId(group.id);
    setShowCreateModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Only image files are accepted (JPEG, PNG, GIF, WebP). Please select an image file.');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingGroupId) {
        const response = await fetch(`http://localhost:5000/api/groups/${editingGroupId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            userId: user.id
          })
        });

        const data = await response.json();

        if (response.ok) {
          alert('Group updated successfully!');
          setShowCreateModal(false);
          setEditingGroupId(null);
          setFormData({
            name: '',
            description: '',
            category: 'ACADEMIC',
            privacy: 'PUBLIC',
            imageUrl: ''
          });
          fetchGroups();
        } else {
          alert(data.message || 'Failed to update group');
        }
      } else {
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

        const data = await response.json();

        if (response.ok) {
          alert('Group created successfully!');
          setShowCreateModal(false);
          setFormData({
            name: '',
            description: '',
            category: 'ACADEMIC',
            privacy: 'PUBLIC',
            imageUrl: ''
          });
          fetchGroups();
        } else {
          alert(data.message || 'Failed to create group');
        }
      }
    } catch (error) {
      console.error('Error saving group:', error);
      alert('An error occurred while saving the group');
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

      const data = await response.json();

      if (response.ok) {
        alert('Successfully joined the group!');
        fetchGroups();
      } else {
        alert(data.message || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      alert('An error occurred while joining the group');
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}/leave`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Successfully left the group!');
        fetchGroups();
      } else {
        alert(data.message || 'Failed to leave group');
      }
    } catch (error) {
      console.error('Error leaving group:', error);
      alert('An error occurred while leaving the group');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Group deleted successfully!');
        fetchGroups();
      } else {
        alert(data.message || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('An error occurred while deleting the group');
    }
  };

  const formatCategory = (category) => {
    return category.replace('_', ' ').toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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
              <div 
                key={group.id} 
                className="group-card group-card-clickable"
                onClick={() => setDetailGroup(group)}
              >
                {group.imageUrl ? (
                  <div className="group-image-wrapper">
                    <ImageCarousel images={[group.imageUrl]} alt={group.name} className="group-image" />
                  </div>
                ) : (
                  <div className="group-image-placeholder">
                    <span className="placeholder-icon">👥</span>
                  </div>
                )}
                
                {user.id === group.creatorId && (
                  <div className="group-owner-actions" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="edit-group-button"
                      onClick={() => handleEditGroup(group)}
                      title="Edit this group"
                    >
                      ✏️
                    </button>
                    <button 
                      className="delete-group-button"
                      onClick={() => handleDeleteGroup(group.id)}
                      title="Delete this group"
                    >
                      🗑️
                    </button>
                  </div>
                )}
                
                <div className="group-content">
                  <div className="group-header-info">
                    <h3>{group.name}</h3>
                    <span className={`privacy-badge ${group.privacy.toLowerCase()}`}>
                      {group.privacy === 'PUBLIC' ? '🌐 Public' : '🔒 Private'}
                    </span>
                  </div>
                  
                  <p className="group-description">{group.description}</p>
                  
                  <div className="group-meta">
                    <span className="category-tag">{formatCategory(group.category)}</span>
                    <span className="member-count">
                      👥 {group.memberCount || 0} members
                    </span>
                  </div>

                  <div className="group-footer" onClick={(e) => e.stopPropagation()}>
                    {group.members?.includes(user.id) ? (
                      <>
                        <button className="joined-button" disabled>
                          ✓ Joined
                        </button>
                        {group.creatorId !== user.id && (
                          <button 
                            className="leave-button"
                            onClick={() => handleLeaveGroup(group.id)}
                          >
                            Leave
                          </button>
                        )}
                      </>
                    ) : (
                      <button 
                        className="join-button"
                        onClick={() => handleJoinGroup(group.id)}
                      >
                        {group.privacy === 'PRIVATE' ? 'Request to Join' : 'Join Group'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGroupId ? 'Edit Group' : 'Create New Group'}</h2>
              <button 
                className="close-modal"
                onClick={handleCloseCreateModal}
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
                  <option value="ACADEMIC">Academic</option>
                  <option value="SPORTS">Sports & Recreation</option>
                  <option value="ARTS">Arts & Culture</option>
                  <option value="SOCIAL">Social</option>
                  <option value="PROFESSIONAL">Professional</option>
                  <option value="VOLUNTEER">Volunteer & Service</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Privacy *</label>
                <div className="privacy-selector">
                  <button
                    type="button"
                    className={`privacy-option ${formData.privacy === 'PUBLIC' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, privacy: 'PUBLIC' })}
                  >
                    🌐 Public
                    <span className="privacy-desc">Anyone can join</span>
                  </button>
                  <button
                    type="button"
                    className={`privacy-option ${formData.privacy === 'PRIVATE' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, privacy: 'PRIVATE' })}
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
                  onClick={handleCloseCreateModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingGroupId ? 'Save Changes' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group detail modal */}
      {detailGroup && (
        <div className="group-detail-overlay" onClick={() => setDetailGroup(null)}>
          <div className="group-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="group-detail-close" 
              onClick={() => setDetailGroup(null)}
              title="Close"
              aria-label="Close"
            >
              ×
            </button>
            {detailGroup.imageUrl ? (
              <div className="group-detail-image-wrapper">
                <img src={detailGroup.imageUrl} alt={detailGroup.name} />
              </div>
            ) : (
              <div className="group-detail-image-placeholder">
                <span className="placeholder-icon">👥</span>
              </div>
            )}
            <div className="group-detail-body">
              <h2 className="group-detail-name">{detailGroup.name}</h2>
              <span className={`privacy-badge ${detailGroup.privacy.toLowerCase()}`}>
                {detailGroup.privacy === 'PUBLIC' ? '🌐 Public' : '🔒 Private'}
              </span>
              <p className="group-detail-description">{detailGroup.description}</p>
              <div className="group-detail-meta">
                <span className="category-tag">{formatCategory(detailGroup.category)}</span>
                <span className="member-count">👥 {detailGroup.memberCount || 0} members</span>
              </div>
              <div className="group-detail-actions" onClick={(e) => e.stopPropagation()}>
                {detailGroup.members?.includes(user.id) ? (
                  <>
                    <button className="joined-button" disabled>✓ Joined</button>
                    {detailGroup.creatorId !== user.id && (
                      <button 
                        className="leave-button"
                        onClick={() => { handleLeaveGroup(detailGroup.id); setDetailGroup(null); }}
                      >
                        Leave
                      </button>
                    )}
                  </>
                ) : (
                  <button 
                    className="join-button"
                    onClick={() => { handleJoinGroup(detailGroup.id); setDetailGroup(null); }}
                  >
                    {detailGroup.privacy === 'PRIVATE' ? 'Request to Join' : 'Join Group'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}