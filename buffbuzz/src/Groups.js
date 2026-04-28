import { API_URL } from './config';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Groups.css';
import Header from './Header.js';
import Footer from './Footer';
import ImageCarousel from './ImageCarousel';
import { getValidUser } from './sessionUtils';
import ReportModal from './ReportModal';

const POST_TYPES = [
  { value: 'POST',         label: '📝 Post',         desc: 'Share something with the group' },
  { value: 'ANNOUNCEMENT', label: '📣 Announcement',  desc: 'Important update for all members' },
  { value: 'EVENT',        label: '📅 Event',         desc: 'Invite members to an event' },
];

const postTypeBadge = (type) => {
  if (type === 'ANNOUNCEMENT') return <span className="post-type-badge announcement">📣 Announcement</span>;
  if (type === 'EVENT')        return <span className="post-type-badge event">📅 Event</span>;
  return null;
};

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
  const [detailTab, setDetailTab] = useState('about');

  // ── Member management state ──────────────────────────────────────
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [managingGroup, setManagingGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [manageTab, setManageTab] = useState('members');
  const [joinRequests, setJoinRequests] = useState([]);
  const [joinRequestsLoading, setJoinRequestsLoading] = useState(false);

  // ── Group post state ─────────────────────────────────────────────
  const [showGroupPostModal, setShowGroupPostModal] = useState(false);
  const [postingToGroup, setPostingToGroup] = useState(null);
  const [groupPostForm, setGroupPostForm] = useState({ title: '', content: '', postType: 'POST' });
  const [groupPostLoading, setGroupPostLoading] = useState(false);

  // ── Group posts feed state ───────────────────────────────────────
  const [groupPosts, setGroupPosts] = useState([]);
  const [groupPostsLoading, setGroupPostsLoading] = useState(false);

  // ── Comments state ───────────────────────────────────────────────
  const [expandedComments, setExpandedComments] = useState({});
  const [postComments, setPostComments] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'ACADEMIC',
    privacy: 'PUBLIC',
    imageUrl: ''
  });

  const [reportTarget, setReportTarget] = useState(null);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchGroups(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (detailGroup && detailTab === 'posts') {
      fetchGroupPosts(detailGroup.id);
    }
  }, [detailGroup, detailTab]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/profile/${userId}`);
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
      const url = `${API_URL}/api/groups${query ? `?${query}` : ''}`;
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

  const fetchGroupPosts = async (groupId) => {
    setGroupPostsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/groups/${groupId}/posts?userId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setGroupPosts(data.posts || []);
        setExpandedComments({});
        setPostComments({});
        setCommentInputs({});
      }
    } catch (error) {
      console.error('Error fetching group posts:', error);
    } finally {
      setGroupPostsLoading(false);
    }
  };

  // ── Like handler ─────────────────────────────────────────────────
  const handleLikePost = async (e, postId, isLiked) => {
    e.stopPropagation();
    if (!user) return;
    const url = isLiked
      ? `${API_URL}/api/posts/${postId}/unlike`
      : `${API_URL}/api/posts/${postId}/like`;
    const method = isLiked ? 'DELETE' : 'POST';
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (response.ok) {
        const data = await response.json();
        setGroupPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, isLiked: !isLiked, _count: { ...p._count, likes: data.likeCount } }
              : p
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  // ── Comment handlers ─────────────────────────────────────────────
  const handleToggleComments = async (e, postId) => {
    e.stopPropagation();
    const nowOpen = !expandedComments[postId];
    setExpandedComments(prev => ({ ...prev, [postId]: nowOpen }));
    if (nowOpen && !postComments[postId]) {
      await fetchComments(postId);
    }
  };

  const fetchComments = async (postId) => {
    try {
      const response = await fetch(`${API_URL}/api/posts/${postId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setPostComments(prev => ({ ...prev, [postId]: data.comments || [] }));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmitComment = async (e, postId) => {
    e.stopPropagation();
    const content = commentInputs[postId]?.trim();
    if (!content) return;
    setCommentLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const response = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content })
      });
      if (response.ok) {
        const data = await response.json();
        setPostComments(prev => ({
          ...prev,
          [postId]: [data.comment, ...(prev[postId] || [])]
        }));
        setGroupPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, _count: { ...p._count, comments: data.commentCount } }
              : p
          )
        );
        setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      }
    } catch (error) { console.error('Error submitting comment:', error); }
    finally { setCommentLoading(prev => ({ ...prev, [postId]: false })); }
  };

  // ── Member management handlers ───────────────────────────────────
  const fetchGroupMembers = async (groupId) => {
    setMembersLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/groups/${groupId}`);
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
    setJoinRequests([]);
    fetchGroupMembers(group.id);
    if (group.creatorId === user.id && group.privacy === 'PRIVATE') {
      fetchJoinRequests(group.id);
    }
  };

  const fetchJoinRequests = async (groupId) => {
    setJoinRequestsLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/groups/${groupId}/join-requests?userId=${encodeURIComponent(user.id)}`
      );
      if (response.ok) {
        const data = await response.json();
        setJoinRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching join requests:', err);
    } finally {
      setJoinRequestsLoading(false);
    }
  };

  const handleApproveJoinRequest = async (requestId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/groups/${managingGroup.id}/join-requests/${requestId}/approve`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }
      );
      const data = await response.json();
      if (response.ok) {
        setJoinRequests(prev => prev.filter(r => r.id !== requestId));
        fetchGroupMembers(managingGroup.id);
        fetchGroups(searchTerm);
      } else { alert(data.message || 'Failed to approve'); }
    } catch (err) { alert('An error occurred'); }
  };

  const handleDenyJoinRequest = async (requestId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/groups/${managingGroup.id}/join-requests/${requestId}/deny`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) }
      );
      const data = await response.json();
      if (response.ok) {
        setJoinRequests(prev => prev.filter(r => r.id !== requestId));
      } else { alert(data.message || 'Failed to deny'); }
    } catch (err) { alert('An error occurred'); }
  };

  const handleCloseMembersModal = () => {
    setShowMembersModal(false);
    setManagingGroup(null);
    setGroupMembers([]);
    setJoinRequests([]);
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!window.confirm(`Remove ${memberName} from the group?`)) return;
    try {
      const response = await fetch(
        `${API_URL}/api/groups/${managingGroup.id}/members/${memberId}`,
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: user.id }) }
      );
      const data = await response.json();
      if (response.ok) {
        setGroupMembers(prev => prev.filter(m => m.userId !== memberId));
        fetchGroups(searchTerm);
      } else { alert(data.message || 'Failed to remove member'); }
    } catch (error) { alert('An error occurred while removing the member'); }
  };

  const handleChangeRole = async (memberId, currentRole) => {
    const newRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    const label = newRole === 'ADMIN' ? 'promote to Admin' : 'demote to Member';
    if (!window.confirm(`Are you sure you want to ${label}?`)) return;
    try {
      const response = await fetch(
        `${API_URL}/api/groups/${managingGroup.id}/members/${memberId}/role`,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: user.id, role: newRole }) }
      );
      const data = await response.json();
      if (response.ok) {
        setGroupMembers(prev => prev.map(m => m.userId === memberId ? { ...m, role: newRole } : m));
      } else { alert(data.message || 'Failed to update role'); }
    } catch (error) { alert('An error occurred while updating the member role'); }
  };

  // ── Group post handler ───────────────────────────────────────────
  const handleCreateGroupPost = async (e) => {
    e.preventDefault();
    if (groupPostForm.postType === 'POLL') {
      if (!groupPostForm.title.trim()) {
        alert('Please enter a poll question.');
        return;
      }
      const opts = groupPostForm.pollOptions.map((o) => String(o).trim()).filter(Boolean);
      if (opts.length < 2 || opts.length > 5) {
        alert('Poll must have between 2 and 5 options.');
        return;
      }
    } else if (!groupPostForm.title.trim() || !groupPostForm.content.trim()) {
      return;
    }
    setGroupPostLoading(true);
    try {
      let payload = {
        title: groupPostForm.title,
        content: groupPostForm.postType === 'POLL' ? (groupPostForm.content.trim() || '') : groupPostForm.content,
        postType: groupPostForm.postType,
        authorId: user.id,
        groupId: postingToGroup.id
      };
      if (groupPostForm.postType === 'POLL') {
        const opts = groupPostForm.pollOptions.map((o) => String(o).trim()).filter(Boolean);
        payload = {
          ...payload,
          pollOptions: opts,
          anonymousVoting: groupPostForm.anonymousVoting,
          expiresAt: groupPostForm.expiresAt
            ? new Date(groupPostForm.expiresAt).toISOString()
            : undefined
        };
      }
      const response = await fetch(API_URL + '/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok) {
        const typeLabel =
          groupPostForm.postType === 'ANNOUNCEMENT'
            ? 'Announcement'
            : groupPostForm.postType === 'EVENT'
              ? 'Event'
              : groupPostForm.postType === 'POLL'
                ? 'Poll'
                : 'Post';
        alert(`${typeLabel} created in ${postingToGroup.name}! All group members have been notified.`);
        setShowGroupPostModal(false);
        setGroupPostForm({
          title: '',
          content: '',
          postType: 'POST',
          pollOptions: ['', ''],
          anonymousVoting: false,
          expiresAt: ''
        });
        if (detailGroup?.id === postingToGroup.id && detailTab === 'posts') {
          fetchGroupPosts(postingToGroup.id);
        }
        setPostingToGroup(null);
      } else {
        alert(data.message || 'Failed to create post');
      }
    } catch (error) {
      alert('An error occurred while creating the post');
    } finally {
      setGroupPostLoading(false);
    }
  };

  const handleCloseGroupPostModal = () => {
    setShowGroupPostModal(false);
    setGroupPostForm({
      title: '',
      content: '',
      postType: 'POST',
      pollOptions: ['', ''],
      anonymousVoting: false,
      expiresAt: ''
    });
    setPostingToGroup(null);
  };

  // ── Existing handlers ────────────────────────────────────────────
  const handleBackClick = () => navigate('/main');

  const hasUnsavedChanges = () => !!(
    formData.name?.trim() || formData.description?.trim() || formData.imageUrl ||
    formData.category !== 'ACADEMIC' || formData.privacy !== 'PUBLIC'
  );

  const handleCloseCreateModal = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your group will not be created.')) return;
    setShowCreateModal(false);
    setEditingGroupId(null);
    setFormData({ name: '', description: '', category: 'ACADEMIC', privacy: 'PUBLIC', imageUrl: '' });
  };

  const handleEditGroup = (group) => {
    setFormData({ name: group.name || '', description: group.description || '', category: group.category || 'ACADEMIC', privacy: group.privacy || 'PUBLIC', imageUrl: group.imageUrl || '' });
    setEditingGroupId(group.id);
    setShowCreateModal(true);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) { alert('Only image files are accepted (JPEG, PNG, GIF, WebP).'); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onloadend = () => setFormData(prev => ({ ...prev, imageUrl: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroupId) {
        const response = await fetch(`${API_URL}/api/groups/${editingGroupId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, userId: user.id })
        });
        const data = await response.json();
        if (response.ok) {
          alert('Group updated successfully!');
          setShowCreateModal(false); setEditingGroupId(null);
          setFormData({ name: '', description: '', category: 'ACADEMIC', privacy: 'PUBLIC', imageUrl: '' });
          fetchGroups(searchTerm);
        } else { alert(data.message || 'Failed to update group'); }
      } else {
        const response = await fetch(API_URL + '/api/groups/create', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, creatorId: user.id })
        });
        const data = await response.json();
        if (response.ok) {
          alert('Group created successfully!');
          setShowCreateModal(false);
          setFormData({ name: '', description: '', category: 'ACADEMIC', privacy: 'PUBLIC', imageUrl: '' });
          fetchGroups(searchTerm);
        } else { alert(data.message || 'Failed to create group'); }
      }
    } catch (error) { alert('An error occurred while saving the group'); }
  };

  const handleJoinGroup = async (group) => {
    const groupId = group?.id ?? group;
    const isPrivate = group?.privacy === 'PRIVATE';
    const url = isPrivate ? `${API_URL}/api/groups/${groupId}/request-join` : `${API_URL}/api/groups/${groupId}/join`;
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      const data = await response.json();
      if (response.ok) {
        alert(isPrivate ? 'Join request sent! The group owner will be notified.' : 'Successfully joined the group!');
        fetchGroups(searchTerm);
      } else { alert(data.message || 'Failed to join group'); }
    } catch (error) { alert('An error occurred while joining the group.'); }
  };

  const handleLeaveGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to leave this group?')) return;
    try {
      const response = await fetch(`${API_URL}/api/groups/${groupId}/leave`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      const data = await response.json();
      if (response.ok) { alert('Successfully left the group!'); fetchGroups(searchTerm); }
      else { alert(data.message || 'Failed to leave group'); }
    } catch (error) { alert('An error occurred while leaving the group'); }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    try {
      const response = await fetch(`${API_URL}/api/groups/${groupId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) });
      const data = await response.json();
      if (response.ok) { alert('Group deleted successfully!'); fetchGroups(searchTerm); }
      else { alert(data.message || 'Failed to delete group'); }
    } catch (error) { alert('An error occurred while deleting the group'); }
  };

  const formatCategory = (category) =>
    category.replace('_', ' ').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const formatTimeAgo = (timestamp) => {
    const diff = Math.floor((new Date() - new Date(timestamp)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

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

  const isMember = detailGroup && detailGroup.members?.includes(user?.id);

  const closeDetailModal = () => {
    setDetailGroup(null);
    setGroupPosts([]);
    setExpandedComments({});
    setPostComments({});
    setCommentInputs({});
  };

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
          <button className="create-group-button" onClick={() => setShowCreateModal(true)}>+ Create Group</button>
          <div className="filter-buttons">
            {[{ key: 'all', label: 'All Groups' }, { key: 'my-groups', label: 'My Groups' }, { key: 'discover', label: 'Discover' }].map(({ key, label }) => (
              <button key={key} className={`filter-btn ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="search-bar-wrapper" style={{ marginBottom: '24px' }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input type="text" className="search-input" placeholder="Search by group name or description…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {searchTerm && <button className="search-clear-btn" onClick={() => setSearchTerm('')}>✕</button>}
          </div>
        </div>

        {!loading && searchTerm.trim() && (
          <p className="search-results-summary">
            {filteredGroups.length === 0 ? `No results for "${searchTerm}"` : `${filteredGroups.length} result${filteredGroups.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </p>
        )}

        <div className="groups-grid">
          {loading ? (
            <div className="loading">Loading groups...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="no-groups">
              {searchTerm.trim() ? (<><h3>No groups found</h3><p>Try a different keyword or clear the search.</p></>) : (<><h3>No groups found</h3><p>Be the first to create a group!</p></>)}
            </div>
          ) : (
            filteredGroups.map(group => (
              <div
                key={group.id}
                ref={group.id === highlightGroupId ? highlightRef : null}
                className={`group-card group-card-clickable${group.id === highlightGroupId ? ' group-card-highlighted' : ''}`}
                onClick={() => { setDetailGroup(group); setDetailTab('about'); setGroupPosts([]); setExpandedComments({}); setPostComments({}); setCommentInputs({}); }}
              >
                {group.imageUrl ? (
                  <div className="group-image-wrapper"><ImageCarousel images={[group.imageUrl]} alt={group.name} className="group-image" /></div>
                ) : (
                  <div className="group-image-placeholder"><span className="placeholder-icon">👥</span></div>
                )}

                {user.id === group.creatorId && (
                  <div className="group-owner-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="manage-members-button" onClick={(e) => handleOpenMembersModal(group, e)} title="Manage group">👥</button>
                    <button className="delete-group-button" onClick={() => handleDeleteGroup(group.id)} title="Delete this group">🗑️</button>
                  </div>
                )}

                <div className="group-content">
                  <div className="group-header-info">
                    <h3>{group.name}</h3>
                    <span className={`privacy-badge ${group.privacy.toLowerCase()}`}>{group.privacy === 'PUBLIC' ? '🌐 Public' : '🔒 Private'}</span>
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
                        <button className="new-post-btn" onClick={(e) => { e.stopPropagation(); setPostingToGroup(group); setShowGroupPostModal(true); }}>✏️ Post</button>
                        {group.creatorId !== user.id && <button className="leave-button" onClick={() => handleLeaveGroup(group.id)}>Leave</button>}
                      </>
                    ) : (
                      <button className="join-button" onClick={() => handleJoinGroup(group)}>{group.privacy === 'PRIVATE' ? 'Request to Join' : 'Join Group'}</button>
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
                <input type="text" id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Computer Science Club" required />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="What is your group about?" rows="4" required />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} required>
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
                  {[{ value: 'PUBLIC', icon: '🌐', label: 'Public', desc: 'Anyone can join' }, { value: 'PRIVATE', icon: '🔒', label: 'Private', desc: 'Requires approval' }].map(({ value, icon, label, desc }) => (
                    <button key={value} type="button" className={`privacy-option ${formData.privacy === value ? 'selected' : ''}`} onClick={() => setFormData({ ...formData, privacy: value })}>
                      {icon} {label}<span className="privacy-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="image">Group Image (Optional)</label>
                <input type="file" id="image" accept="image/*" onChange={handleImageChange} className="file-input" />
                {formData.imageUrl && <div className="image-preview-small"><img src={formData.imageUrl} alt="Preview" /></div>}
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
        <div className="group-detail-overlay" onClick={closeDetailModal}>
          <div className="group-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="group-detail-close" onClick={closeDetailModal} title="Close" aria-label="Close">×</button>

            {detailGroup.imageUrl ? (
              <div className="group-detail-image-wrapper"><img src={detailGroup.imageUrl} alt={detailGroup.name} /></div>
            ) : (
              <div className="group-detail-image-placeholder"><span className="placeholder-icon">👥</span></div>
            )}

            <div className="group-detail-body">
              <h2 className="group-detail-name">{detailGroup.name}</h2>
              <div className="group-detail-meta">
                <span className={`privacy-badge ${detailGroup.privacy.toLowerCase()}`}>{detailGroup.privacy === 'PUBLIC' ? '🌐 Public' : '🔒 Private'}</span>
                <span className="category-tag">{formatCategory(detailGroup.category)}</span>
                <span className="member-count">👥 {detailGroup.memberCount || 0} members</span>
              </div>

              <div className="group-detail-actions" onClick={(e) => e.stopPropagation()}>
                {isMember ? (
                  <>
                    <button className="joined-button" disabled>✓ Joined</button>
                    <button className="new-post-btn" onClick={() => { closeDetailModal(); setPostingToGroup(detailGroup); setShowGroupPostModal(true); }}>✏️ Post</button>
                    {detailGroup.creatorId !== user.id && <button className="leave-button" onClick={() => { handleLeaveGroup(detailGroup.id); closeDetailModal(); }}>Leave</button>}
                  </>
                ) : (
                  <button className="join-button" onClick={() => { handleJoinGroup(detailGroup); closeDetailModal(); }}>{detailGroup.privacy === 'PRIVATE' ? 'Request to Join' : 'Join Group'}</button>
                )}
              </div>

              <button
                type="button"
                className="group-detail-report-link"
                onClick={(e) => {
                  e.stopPropagation();
                  setReportTarget({
                    targetType: 'GROUP',
                    targetId: detailGroup.id,
                    subjectLabel: 'this group',
                  });
                }}
              >
                Report group
              </button>

              <div className="detail-tabs">
                <button className={`detail-tab ${detailTab === 'about' ? 'active' : ''}`} onClick={() => setDetailTab('about')}>ℹ️ About</button>
                {isMember && <button className={`detail-tab ${detailTab === 'posts' ? 'active' : ''}`} onClick={() => setDetailTab('posts')}>📝 Posts</button>}
              </div>

              {detailTab === 'about' && (
                <div className="detail-tab-content">
                  <p className="group-detail-description">{detailGroup.description}</p>
                </div>
              )}

              {detailTab === 'posts' && isMember && (
                <div className="detail-tab-content">
                  {groupPostsLoading ? (
                    <div className="group-posts-loading">Loading posts...</div>
                  ) : groupPosts.length === 0 ? (
                    <div className="group-posts-empty">
                      <span>📭</span>
                      <p>No posts yet. Be the first to post!</p>
                      <button className="new-post-btn" onClick={() => { closeDetailModal(); setPostingToGroup(detailGroup); setShowGroupPostModal(true); }}>✏️ Create First Post</button>
                    </div>
                  ) : (
                    <div className="group-posts-list">
                      {groupPosts.map(post => (
                        <div key={post.id} className={`group-post-card ${post.postType === 'ANNOUNCEMENT' ? 'post-announcement' : post.postType === 'EVENT' ? 'post-event' : ''}`}>

                          {/* Post type badge */}
                          {postTypeBadge(post.postType)}

                          {/* Author row */}
                          <div className="group-post-author">
                            {post.author?.profile?.profilePictureUrl ? (
                              <img src={post.author.profile.profilePictureUrl} alt="" className="group-post-avatar" />
                            ) : (
                              <div className="group-post-avatar-placeholder">{post.author?.firstName?.[0]}{post.author?.lastName?.[0]}</div>
                            )}
                            <div className="group-post-author-info">
                              <span className="group-post-author-name">{post.author?.firstName} {post.author?.lastName}</span>
                              <span className="group-post-time">{formatTimeAgo(post.createdAt)}</span>
                            </div>
                          </div>

                          {/* Post content */}
                          <h4 className="group-post-title">{post.title}</h4>
                          <p className="group-post-content">{post.content}</p>

                          {/* Like / Comment action bar */}
                          <div className="group-post-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className={`group-post-action-btn ${post.isLiked ? 'liked' : ''}`}
                              onClick={(e) => handleLikePost(e, post.id, post.isLiked)}
                            >
                              {post.isLiked ? '❤️' : '🤍'} {post._count?.likes || 0}
                            </button>
                            <button
                              className={`group-post-action-btn ${expandedComments[post.id] ? 'active' : ''}`}
                              onClick={(e) => handleToggleComments(e, post.id)}
                            >
                              💬 {post._count?.comments || 0}
                            </button>
                            {post.author?.id && post.author.id !== user?.id && (
                              <button
                                type="button"
                                className="group-post-action-btn group-post-report-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReportTarget({
                                    targetType: 'POST',
                                    targetId: post.id,
                                    subjectLabel: 'this post',
                                  });
                                }}
                              >
                                Report
                              </button>
                            )}
                          </div>

                          {/* Comments section */}
                          {expandedComments[post.id] && (
                            <div className="group-post-comments" onClick={(e) => e.stopPropagation()}>
                              <div className="group-comment-input-row">
                                <input
                                  type="text"
                                  className="group-comment-input"
                                  placeholder="Write a comment…"
                                  value={commentInputs[post.id] || ''}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => { e.stopPropagation(); setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value })); }}
                                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(e, post.id); } }}
                                />
                                <button
                                  className="group-comment-submit"
                                  onClick={(e) => handleSubmitComment(e, post.id)}
                                  disabled={commentLoading[post.id] || !commentInputs[post.id]?.trim()}
                                >
                                  {commentLoading[post.id] ? '…' : 'Post'}
                                </button>
                              </div>
                              {!postComments[post.id] ? (
                                <div className="group-comments-loading">Loading comments…</div>
                              ) : postComments[post.id].length === 0 ? (
                                <div className="group-no-comments">No comments yet. Be the first!</div>
                              ) : (
                                postComments[post.id].map(comment => (
                                  <div key={comment.id} className="group-comment-item">
                                    {comment.author?.profile?.profilePictureUrl ? (
                                      <img src={comment.author.profile.profilePictureUrl} alt="" className="group-comment-avatar" />
                                    ) : (
                                      <div className="group-comment-avatar-placeholder">{comment.author?.firstName?.[0]}{comment.author?.lastName?.[0]}</div>
                                    )}
                                    <div className="group-comment-body">
                                      <span className="group-comment-author">{comment.author?.firstName} {comment.author?.lastName}</span>
                                      <span className="group-comment-time">{formatTimeAgo(comment.createdAt)}</span>
                                      {comment.author?.id && comment.author.id !== user?.id && (
                                        <button
                                          type="button"
                                          className="group-comment-report"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReportTarget({
                                              targetType: 'COMMENT',
                                              targetId: comment.id,
                                              subjectLabel: 'this comment',
                                            });
                                          }}
                                        >
                                          Report
                                        </button>
                                      )}
                                      <p className="group-comment-text">{comment.content}</p>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
              <button className={`manage-tab ${manageTab === 'members' ? 'active' : ''}`} onClick={() => setManageTab('members')}>👥 Members ({groupMembers.length})</button>
              <button className={`manage-tab ${manageTab === 'settings' ? 'active' : ''}`} onClick={() => setManageTab('settings')}>⚙️ Settings</button>
            </div>

            {manageTab === 'members' && (
              <div className="manage-members-body">
                {managingGroup.creatorId === user.id && managingGroup.privacy === 'PRIVATE' && (
                  <div className="join-requests-section">
                    <h3 className="join-requests-title">Pending join requests</h3>
                    {joinRequestsLoading ? <div className="members-loading">Loading requests...</div> : joinRequests.length === 0 ? <p className="no-join-requests">No pending requests.</p> : (
                      <ul className="join-requests-list">
                        {joinRequests.map((req) => (
                          <li key={req.id} className="join-request-item">
                            <span className="join-request-name">{req.user?.firstName} {req.user?.lastName}</span>
                            <div className="join-request-actions">
                              <button type="button" className="join-request-btn approve" onClick={() => handleApproveJoinRequest(req.id)}>Approve</button>
                              <button type="button" className="join-request-btn deny" onClick={() => handleDenyJoinRequest(req.id)}>Deny</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {membersLoading ? <div className="members-loading">Loading members...</div> : groupMembers.length === 0 ? <div className="no-members">No members found.</div> : (
                  <ul className="members-list">
                    {groupMembers.map((member) => {
                      const isOwner = member.userId === managingGroup.creatorId;
                      const isCurrentUser = member.userId === user.id;
                      return (
                        <li key={member.userId} className="member-item">
                          <div className="member-avatar">
                            {member.user?.profile?.profilePictureUrl ? <img src={member.user.profile.profilePictureUrl} alt="" /> : <div className="member-avatar-placeholder">{member.user?.firstName?.[0]}{member.user?.lastName?.[0]}</div>}
                          </div>
                          <div className="member-info">
                            <span className="member-name">{member.user?.firstName} {member.user?.lastName}{isCurrentUser && <span className="member-you-tag"> (you)</span>}</span>
                            <span className={`member-role-badge ${member.role?.toLowerCase()}`}>{isOwner ? '👑 Owner' : member.role === 'ADMIN' ? '🛡️ Admin' : '👤 Member'}</span>
                          </div>
                          {!isOwner && !isCurrentUser && (
                            <div className="member-actions">
                              <button className={`role-toggle-btn ${member.role === 'ADMIN' ? 'demote' : 'promote'}`} onClick={() => handleChangeRole(member.userId, member.role)}>{member.role === 'ADMIN' ? '⬇️ Demote' : '⬆️ Promote'}</button>
                              <button className="remove-member-btn" onClick={() => handleRemoveMember(member.userId, `${member.user?.firstName} ${member.user?.lastName}`)}>Remove</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {manageTab === 'settings' && (
              <div className="manage-settings-body">
                <p className="manage-settings-hint">Edit your group's name, description, category, privacy, and image.</p>
                <div className="manage-settings-actions">
                  <button className="submit-btn" onClick={() => { handleCloseMembersModal(); handleEditGroup(managingGroup); }}>✏️ Edit Group Details</button>
                  <button className="delete-group-btn-danger" onClick={() => { handleCloseMembersModal(); handleDeleteGroup(managingGroup.id); }}>🗑️ Delete Group</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Group Post Modal ───────────────────────────────────────── */}
      {showGroupPostModal && postingToGroup && (
        <div className="modal-overlay" onClick={handleCloseGroupPostModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Post in {postingToGroup.name}</h2>
              <button className="close-modal" onClick={handleCloseGroupPostModal}>×</button>
            </div>
            <form onSubmit={handleCreateGroupPost} style={{ padding: '24px' }}>

              {/* Post type selector */}
              <div className="form-group">
                <label>Post Type</label>
                <div className="post-type-selector">
                  {POST_TYPES.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      className={`post-type-option ${groupPostForm.postType === value ? 'selected' : ''}`}
                      onClick={() => setGroupPostForm(prev => ({ ...prev, postType: value }))}
                    >
                      <span className="post-type-label">{label}</span>
                      <span className="post-type-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="postTitle">Title *</label>
                <input
                  type="text"
                  id="postTitle"
                  value={groupPostForm.title}
                  onChange={(e) => setGroupPostForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={
                    groupPostForm.postType === 'ANNOUNCEMENT' ? 'e.g., Meeting rescheduled to Friday' :
                    groupPostForm.postType === 'EVENT' ? 'e.g., Study session – Thursday 6PM' :
                    'Post title'
                  }
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="postContent">Content *</label>
                <textarea
                  id="postContent"
                  value={groupPostForm.content}
                  onChange={(e) => setGroupPostForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder={
                    groupPostForm.postType === 'ANNOUNCEMENT' ? 'Share an important update with the group…' :
                    groupPostForm.postType === 'EVENT' ? 'Add event details, location, and what to bring…' :
                    'What do you want to share with the group?'
                  }
                  rows="5"
                  required
                />
              </div>

              <div className={`group-post-notice ${groupPostForm.postType === 'ANNOUNCEMENT' ? 'notice-announcement' : groupPostForm.postType === 'EVENT' ? 'notice-event' : ''}`}>
                {groupPostForm.postType === 'ANNOUNCEMENT' && '📣 '}
                {groupPostForm.postType === 'EVENT' && '📅 '}
                {groupPostForm.postType === 'POST' && '📝 '}
                All members of <strong>{postingToGroup.name}</strong> will be notified.
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={handleCloseGroupPostModal}>Cancel</button>
                <button type="submit" className="submit-btn" disabled={groupPostLoading}>
                  {groupPostLoading ? 'Posting...' : `Post ${groupPostForm.postType === 'ANNOUNCEMENT' ? 'Announcement' : groupPostForm.postType === 'EVENT' ? 'Event' : 'to Group'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        reporterId={user?.id}
        targetType={reportTarget?.targetType}
        targetId={reportTarget?.targetId}
        subjectLabel={reportTarget?.subjectLabel}
      />

      <Footer />
    </div>
  );
}