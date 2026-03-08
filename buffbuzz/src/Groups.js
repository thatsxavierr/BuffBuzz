import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Groups.css';
import Header from './Header.js';
import Footer from './Footer';
import ImageCarousel from './ImageCarousel';
import { getValidUser } from './sessionUtils';

export default function Groups() {
  const navigate = useNavigate();
  const location = useLocation();
  const highlightGroupId = location.state?.highlightGroupId || null;
  const highlightRef = useRef(null);
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [detailGroup, setDetailGroup] = useState(null);

  // ── Member management state ──────────────────────────────────────
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [managingGroup, setManagingGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [manageTab, setManageTab] = useState('members'); // 'members' | 'settings'

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

  // Debounced search — re-runs whenever searchTerm changes (filter is client-side for groups)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchGroups(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profilePictureUrl) setProfilePicture(data.profile.profilePictureUrl);
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const fetchGroups = async (search = '') => {
    try {
      const params = new URLSearchParams();
      if (search && search.trim()) params.set('search', search.trim());
      const query = params.toString();
      const url = `http://localhost:5000/api/groups${query ? `?${query}` : ''}`;

      const response = await fetch(url);
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

  // ── Member management handlers ───────────────────────────────────

  const fetchGroupMembers = async (groupId) => {
    setMembersLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}`);
      if (response.ok) {
        const data = await response.json();
        setGroupMembers(data.group?.members || []);
      }
    } catch (error) {
      console.error('Error fetching group members:', error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleOpenMembersModal = (group, e) => {
    e.stopPropagation();
    setManagingGroup(group);
    setManageTab('members');
    setShowMembersModal(true);
    fetchGroupMembers(group.id);
  };

  const handleCloseMembersModal = () => {
    setShowMembersModal(false);
    setManagingGroup(null);
    setGroupMembers([]);
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from the group?`)) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/groups/${managingGroup.id}/members/${memberId}`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId: user.id })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setGroupMembers(prev => prev.filter(m => m.userId !== memberId));
        fetchGroups(searchTerm);
      } else {
        alert(data.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('An error occurred while removing the member');
    }
  };

  const handleChangeRole = async (memberId, currentRole) => {
    const newRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    const label = newRole === 'ADMIN' ? 'promote to Admin' : 'demote to Member';
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    try {
      const response = await fetch(
        `http://localhost:5000/api/groups/${managingGroup.id}/members/${memberId}/role`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminId: user.id, role: newRole })
        }
      );
      const data = await response.json();
      if (response.ok) {
        setGroupMembers(prev =>
          prev.map(m => m.userId === memberId ? { ...m, role: newRole } : m)
        );
      } else {
        alert(data.message || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error changing role:', error);
      alert('An error occurred while updating the member role');
    }
  };

  // ── Existing handlers (unchanged from your original) ─────────────

  const handleBackClick = () => navigate('/main');

  const hasUnsavedChanges = () => !!(
    formData.name?.trim() ||
    formData.description?.trim() ||
    formData.imageUrl ||
    formData.category !== 'ACADEMIC' ||
    formData.privacy !== 'PUBLIC'
  );

  const handleCloseCreateModal = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your group will not be created.')) return;
    setShowCreateModal(false);
    setEditingGroupId(null);
    setFormData({ name: '', description: '', category: 'ACADEMIC', privacy: 'PUBLIC', imageUrl: '' });
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
        alert('Only image files are accepted (JPEG, PNG, GIF, WebP).');
        e.target.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, imageUrl: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroupId) {
        const response = await fetch(`http://localhost:5000/api/groups/${editingGroupId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, userId: user.id })
        });
        const data = await response.json();
        if (response.ok) {
          alert('Group updated successfully!');
          setShowCreateModal(false);
          setEditingGroupId(null);
          setFormData({ name: '', description: '', category: 'ACADEMIC', privacy: 'PUBLIC', imageUrl: '' });
          fetchGroups(searchTerm);
        } else {
          alert(data.message || 'Failed to update group');
        }
      } else {
        const response = await fetch('http://localhost:5000/api/groups/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, creatorId: user.id })
        });
        const data = await response.json();
        if (response.ok) {
          alert('Group created successfully!');
          setShowCreateModal(false);
          setFormData({ name: '', description: '', category: 'ACADEMIC', privacy: 'PUBLIC', imageUrl: '' });
          fetchGroups(searchTerm);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await response.json();
      if (response.ok) {
        alert('Successfully joined the group!');
        fetchGroups(searchTerm);
      } else {
        alert(data.message || 'Failed to join group');
      }
    } catch (error) {
      console.error('Error joining group:', error);
      alert('An error occurred while joining the group');
    }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}/leave`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await response.json();
      if (response.ok) {
        alert('Successfully left the group!');
        fetchGroups(searchTerm);
      } else {
        alert(data.message || 'Failed to leave group');
      }
    } catch (error) {
      console.error('Error leaving group:', error);
      alert('An error occurred while leaving the group');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await response.json();
      if (response.ok) {
        alert('Group deleted successfully!');
        fetchGroups(searchTerm);
      } else {
        alert(data.message || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('An error occurred while deleting the group');
    }
  };

  const formatCategory = (category) => {
    return category.replace('_', ' ').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // Scroll to highlighted group when arriving from a profile badge
  useEffect(() => {
    if (!loading && highlightGroupId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [loading, highlightGroupId]);
  const filteredGroups = groups.filter(group => {
    if (filter === 'my-groups') return group.members?.includes(user?.id);
    if (filter === 'discover') return !group.members?.includes(user?.id);
    return true;
  });

  if (!user) return null;

  return (
    <div className="groups-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />

      <div className="groups-container">
        <div className="groups-header">
          <h1>Groups</h1>
          <p>Connect with students who share your interests</p>
        </div>

        <div className="groups-actions">
          <button className="create-group-button" onClick={() => setShowCreateModal(true)}>
            + Create Group
          </button>

          <div className="filter-buttons">
            {[
              { key: 'all', label: 'All Groups' },
              { key: 'my-groups', label: 'My Groups' },
              { key: 'discover', label: 'Discover' }
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`filter-btn ${filter === key ? 'active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar-wrapper" style={{ marginBottom: '24px' }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by group name or description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>
        </div>

        {/* Results summary */}
        {!loading && searchTerm.trim() && (
          <p className="search-results-summary">
            {filteredGroups.length === 0
              ? `No results for "${searchTerm}"`
              : `${filteredGroups.length} result${filteredGroups.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </p>
        )}

        <div className="groups-grid">
          {loading ? (
            <div className="loading">Loading groups...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="no-groups">
              {searchTerm.trim() ? (
                <>
                  <h3>No groups found</h3>
                  <p>Try a different keyword or clear the search.</p>
                </>
              ) : (
                <>
                  <h3>No groups found</h3>
                  <p>Be the first to create a group!</p>
                </>
              )}
            </div>
          ) : (
            filteredGroups.map(group => (
              <div
                key={group.id}
                ref={group.id === highlightGroupId ? highlightRef : null}
                className={`group-card group-card-clickable${group.id === highlightGroupId ? ' group-card-highlighted' : ''}`}
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
                      className="manage-members-button"
                      onClick={(e) => handleOpenMembersModal(group, e)}
                      title="Manage group"
                    >
                      👥
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
                    <span className="member-count">👥 {group.memberCount || 0} members</span>
                  </div>
                  <div className="group-footer" onClick={(e) => e.stopPropagation()}>
                    {group.members?.includes(user.id) ? (
                      <>
                        <button className="joined-button" disabled>✓ Joined</button>
                        {group.creatorId !== user.id && (
                          <button className="leave-button" onClick={() => handleLeaveGroup(group.id)}>Leave</button>
                        )}
                      </>
                    ) : (
                      <button className="join-button" onClick={() => handleJoinGroup(group.id)}>
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

      {/* ── Create / Edit Group Modal ──────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGroupId ? 'Edit Group' : 'Create New Group'}</h2>
              <button className="close-modal" onClick={handleCloseCreateModal}>×</button>
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
                  {[
                    { value: 'PUBLIC', icon: '🌐', label: 'Public', desc: 'Anyone can join' },
                    { value: 'PRIVATE', icon: '🔒', label: 'Private', desc: 'Requires approval' }
                  ].map(({ value, icon, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      className={`privacy-option ${formData.privacy === value ? 'selected' : ''}`}
                      onClick={() => setFormData({ ...formData, privacy: value })}
                    >
                      {icon} {label}
                      <span className="privacy-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="image">Group Image (Optional)</label>
                <input type="file" id="image" accept="image/*" onChange={handleImageChange} className="file-input" />
                {formData.imageUrl && (
                  <div className="image-preview-small">
                    <img src={formData.imageUrl} alt="Preview" />
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={handleCloseCreateModal} className="cancel-btn">Cancel</button>
                <button type="submit" className="submit-btn">{editingGroupId ? 'Save Changes' : 'Create Group'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Group Detail Modal ─────────────────────────────────────── */}
      {detailGroup && (
        <div className="group-detail-overlay" onClick={() => setDetailGroup(null)}>
          <div className="group-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="group-detail-close" onClick={() => setDetailGroup(null)} title="Close" aria-label="Close">×</button>
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
                      <button className="leave-button" onClick={() => { handleLeaveGroup(detailGroup.id); setDetailGroup(null); }}>Leave</button>
                    )}
                  </>
                ) : (
                  <button className="join-button" onClick={() => { handleJoinGroup(detailGroup.id); setDetailGroup(null); }}>
                    {detailGroup.privacy === 'PRIVATE' ? 'Request to Join' : 'Join Group'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Members Modal ───────────────────────────────────── */}
      {showMembersModal && managingGroup && (
        <div className="modal-overlay" onClick={handleCloseMembersModal}>
          <div className="manage-members-modal" onClick={(e) => e.stopPropagation()}>

            <div className="manage-members-header">
              <div className="manage-members-title">
                <span className="manage-members-group-name">{managingGroup.name}</span>
                <h2>Manage Group</h2>
              </div>
              <button className="close-modal" onClick={handleCloseMembersModal}>×</button>
            </div>

            <div className="manage-tabs">
              <button
                className={`manage-tab ${manageTab === 'members' ? 'active' : ''}`}
                onClick={() => setManageTab('members')}
              >
                👥 Members ({groupMembers.length})
              </button>
              <button
                className={`manage-tab ${manageTab === 'settings' ? 'active' : ''}`}
                onClick={() => setManageTab('settings')}
              >
                ⚙️ Settings
              </button>
            </div>

            {/* Members Tab */}
            {manageTab === 'members' && (
              <div className="manage-members-body">
                {membersLoading ? (
                  <div className="members-loading">Loading members...</div>
                ) : groupMembers.length === 0 ? (
                  <div className="no-members">No members found.</div>
                ) : (
                  <ul className="members-list">
                    {groupMembers.map((member) => {
                      const isOwner = member.userId === managingGroup.creatorId;
                      const isCurrentUser = member.userId === user.id;
                      return (
                        <li key={member.userId} className="member-item">
                          <div className="member-avatar">
                            {member.user?.profile?.profilePictureUrl ? (
                              <img src={member.user.profile.profilePictureUrl} alt="" />
                            ) : (
                              <div className="member-avatar-placeholder">
                                {member.user?.firstName?.[0]}{member.user?.lastName?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="member-info">
                            <span className="member-name">
                              {member.user?.firstName} {member.user?.lastName}
                              {isCurrentUser && <span className="member-you-tag"> (you)</span>}
                            </span>
                            <span className={`member-role-badge ${member.role?.toLowerCase()}`}>
                              {isOwner ? '👑 Owner' : member.role === 'ADMIN' ? '🛡️ Admin' : '👤 Member'}
                            </span>
                          </div>
                          {!isOwner && !isCurrentUser && (
                            <div className="member-actions">
                              <button
                                className={`role-toggle-btn ${member.role === 'ADMIN' ? 'demote' : 'promote'}`}
                                onClick={() => handleChangeRole(member.userId, member.role)}
                                title={member.role === 'ADMIN' ? 'Demote to Member' : 'Promote to Admin'}
                              >
                                {member.role === 'ADMIN' ? '⬇️ Demote' : '⬆️ Promote'}
                              </button>
                              <button
                                className="remove-member-btn"
                                onClick={() => handleRemoveMember(
                                  member.userId,
                                  `${member.user?.firstName} ${member.user?.lastName}`
                                )}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {manageTab === 'settings' && (
              <div className="manage-settings-body">
                <p className="manage-settings-hint">
                  Edit your group's name, description, category, privacy, and image.
                </p>
                <div className="manage-settings-actions">
                  <button
                    className="submit-btn"
                    onClick={() => {
                      handleCloseMembersModal();
                      handleEditGroup(managingGroup);
                    }}
                  >
                    ✏️ Edit Group Details
                  </button>
                  <button
                    className="delete-group-btn-danger"
                    onClick={() => {
                      handleCloseMembersModal();
                      handleDeleteGroup(managingGroup.id);
                    }}
                  >
                    🗑️ Delete Group
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}