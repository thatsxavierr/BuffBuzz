import { API_URL } from './config';
// AdminPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminPage.css';

const ADMIN_EMAIL = process.env.REACT_APP_ADMIN_EMAIL || 'buffbuzz2025@gmail.com';

export default function AdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });

  // ── Dashboard stats ──────────────────────────────────────────────
  const [stats, setStats] = useState(null);

  // ── Users ────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // ── Content (posts) ──────────────────────────────────────────────
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // ── Reports ──────────────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportFilter, setReportFilter] = useState('PENDING');

  // ── Platform announcements (newsletters) ─────────────────────────
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' });

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    if (!userData) { navigate('/login'); return; }
    if (userData.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      navigate('/main');
      return;
    }
    setUser(userData);
    fetchStats();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'content') fetchPosts();
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'announcements') fetchAnnouncements();
  }, [activeTab, user]);

  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch(API_URL + '/api/announcements');
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  const handlePublishAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) {
      showMsg('error', 'Title and content are required');
      return;
    }
    try {
      const res = await fetch(API_URL + '/api/admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUserId: user.id,
          title: announcementForm.title.trim(),
          content: announcementForm.content.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showMsg('success', 'Announcement published. All users were notified.');
        setAnnouncementForm({ title: '', content: '' });
        fetchAnnouncements();
        window.dispatchEvent(new Event('notificationsUpdated'));
      } else {
        showMsg('error', data.message || 'Failed to publish');
      }
    } catch (err) {
      showMsg('error', 'An error occurred');
    }
  };

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 3500);
  };

  // ── Fetch functions ──────────────────────────────────────────────
  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL + '/api/admin/stats');
      if (res.ok) setStats((await res.json()).stats);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchUsers = async (search = userSearch) => {
    setUsersLoading(true);
    try {
      const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
      const res = await fetch(`${API_URL}/api/admin/users${q}`);
      if (res.ok) setUsers((await res.json()).users || []);
    } catch (e) { console.error(e); }
    finally { setUsersLoading(false); }
  };

  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const res = await fetch(API_URL + '/api/admin/posts');
      if (res.ok) setPosts((await res.json()).posts || []);
    } catch (e) { console.error(e); }
    finally { setPostsLoading(false); }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/reports?status=${reportFilter}`);
      if (res.ok) setReports((await res.json()).reports || []);
    } catch (e) { console.error(e); }
    finally { setReportsLoading(false); }
  };

  useEffect(() => { if (activeTab === 'reports' && user) fetchReports(); }, [reportFilter]);

  // ── User actions ─────────────────────────────────────────────────
  const handleSuspendUser = async (userId, currentlySuspended) => {
    const action = currentlySuspended ? 'unsuspend' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} this user?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}/suspend`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: !currentlySuspended })
      });
      const data = await res.json();
      if (res.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended: !currentlySuspended } : u));
        showMsg('success', `User ${action}ed successfully`);
      } else { showMsg('error', data.message || `Failed to ${action} user`); }
    } catch (e) { showMsg('error', 'An error occurred'); }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Permanently delete ${userName}'s account? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        showMsg('success', 'User deleted successfully');
        fetchStats();
      } else { showMsg('error', data.message || 'Failed to delete user'); }
    } catch (e) { showMsg('error', 'An error occurred'); }
  };

  // ── Post actions ─────────────────────────────────────────────────
  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/posts/${postId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        showMsg('success', 'Post deleted successfully');
        fetchStats();
      } else { showMsg('error', data.message || 'Failed to delete post'); }
    } catch (e) { showMsg('error', 'An error occurred'); }
  };

  // ── Report actions ────────────────────────────────────────────────
  const handleUpdateReport = async (reportId, status) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== reportId));
        showMsg('success', `Report marked as ${status.toLowerCase()}`);
      } else { showMsg('error', data.message || 'Failed to update report'); }
    } catch (e) { showMsg('error', 'An error occurred'); }
  };

 const handleDeleteReportedPost = async (reportId, postId) => {
  if (!window.confirm('Delete this reported post? This cannot be undone.')) return;
  try {
    await fetch(`${API_URL}/api/admin/posts/${postId}`, { method: 'DELETE' });
    await fetch(`${API_URL}/api/admin/reports/${reportId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTION_TAKEN' })
    });
    setReports(prev => prev.filter(r => r.id !== reportId));
    showMsg('success', 'Post deleted and report resolved');
    fetchStats();
  } catch (e) { showMsg('error', 'An error occurred'); }
};

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTimeAgo = (ts) => {
    const diff = Math.floor((new Date() - new Date(ts)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const filteredUsers = users.filter(u =>
    !userSearch.trim() ||
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (!user) return null;

  return (
    <div className="admin-page">
      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <span className="admin-logo-text">BuffBuzz</span>
          <span className="admin-badge">Admin</span>
        </div>

        <nav className="admin-nav">
          {[
            { key: 'dashboard', icon: '📊', label: 'Dashboard' },
            { key: 'users',     icon: '👥', label: 'Users' },
            { key: 'content',   icon: '📝', label: 'Content' },
            { key: 'reports',   icon: '🚨', label: 'Reports' },
            { key: 'announcements', icon: '📣', label: 'Announcements' },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`admin-nav-item ${activeTab === key ? 'active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
              {key === 'reports' && reports.filter(r => r.status === 'PENDING').length > 0 && activeTab !== 'reports' && (
                <span className="nav-badge">{reports.filter(r => r.status === 'PENDING').length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            className="view-site-btn"
            onClick={() => navigate('/main')}
            title="Switch to regular site view"
          >
            🌐 View Site
          </button>
          <div className="admin-user-info">
            <span className="admin-user-name">{user.firstName} {user.lastName}</span>
            <span className="admin-user-email">{user.email}</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="admin-main">

        {/* Global message */}
        {message.text && (
          <div className={`admin-message ${message.type}`}>{message.text}</div>
        )}

        {/* ── DASHBOARD ── */}
        {activeTab === 'dashboard' && (
          <div className="admin-content">
            <div className="admin-content-header">
              <h1>Dashboard</h1>
              <button className="admin-refresh-btn" onClick={fetchStats}>↻ Refresh</button>
            </div>

            {loading ? (
              <div className="admin-loading">Loading stats...</div>
            ) : stats ? (
              <>
                <div className="stats-grid">
                  {[
                    { label: 'Total Users',       value: stats.totalUsers,       icon: '👤', color: 'blue' },
                    { label: 'Total Posts',        value: stats.totalPosts,       icon: '📝', color: 'green' },
                    { label: 'Total Groups',       value: stats.totalGroups,      icon: '👥', color: 'purple' },
                    { label: 'Jobs Posted',        value: stats.totalJobs,        icon: '💼', color: 'orange' },
                    { label: 'Marketplace Items',  value: stats.totalMarketplace, icon: '🛍️', color: 'teal' },
                    { label: 'Lost & Found',       value: stats.totalLostFound,   icon: '🔍', color: 'pink' },
                    { label: 'Suspended Users',    value: stats.suspendedUsers,   icon: '🚫', color: 'red' },
                    { label: 'Pending Reports',    value: stats.pendingReports,   icon: '🚨', color: 'yellow' },
                  ].map(({ label, value, icon, color }) => (
                    <div key={label} className={`stat-card stat-${color}`}>
                      <div className="stat-icon">{icon}</div>
                      <div className="stat-info">
                        <div className="stat-value">{value ?? '—'}</div>
                        <div className="stat-label">{label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="dashboard-bottom">
                  <div className="recent-section">
                    <h2>Recent Users</h2>
                    {stats.recentUsers?.length === 0 ? (
                      <p className="admin-empty">No recent users</p>
                    ) : (
                      <table className="admin-table">
                        <thead>
                          <tr><th>Name</th><th>Email</th><th>Type</th><th>Joined</th></tr>
                        </thead>
                        <tbody>
                          {stats.recentUsers?.map(u => (
                            <tr key={u.id}>
                              <td>{u.firstName} {u.lastName}</td>
                              <td>{u.email}</td>
                              <td><span className={`type-badge ${u.userType?.toLowerCase()}`}>{u.userType}</span></td>
                              <td>{formatDate(u.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="admin-empty">Could not load stats.</div>
            )}
          </div>
        )}

        {/* ── USERS ── */}
        {activeTab === 'users' && (
          <div className="admin-content">
            <div className="admin-content-header">
              <h1>Users <span className="count-badge">{users.length}</span></h1>
              <div className="admin-search-bar">
                <span>🔍</span>
                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); fetchUsers(e.target.value); }}
                />
                {userSearch && <button onClick={() => { setUserSearch(''); fetchUsers(''); }}>✕</button>}
              </div>
            </div>

            {usersLoading ? (
              <div className="admin-loading">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="admin-empty">No users found.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className={u.suspended ? 'row-suspended' : ''}>
                      <td className="user-name-cell">
                        <div className="user-avatar-small">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                        {u.firstName} {u.lastName}
                      </td>
                      <td>{u.email}</td>
                      <td><span className={`type-badge ${u.userType?.toLowerCase()}`}>{u.userType}</span></td>
                      <td>
                        <span className={`status-badge ${u.suspended ? 'suspended' : u.verificationStatus === 'VERIFIED' ? 'active' : 'pending'}`}>
                          {u.suspended ? '🚫 Suspended' : u.verificationStatus === 'VERIFIED' ? '✓ Active' : '⏳ Pending'}
                        </span>
                      </td>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>
                        <div className="action-btns">
                          <button
                            className={`action-btn ${u.suspended ? 'btn-unsuspend' : 'btn-suspend'}`}
                            onClick={() => handleSuspendUser(u.id, u.suspended)}
                            disabled={u.email === ADMIN_EMAIL}
                          >
                            {u.suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                          <button
                            className="action-btn btn-delete"
                            onClick={() => handleDeleteUser(u.id, `${u.firstName} ${u.lastName}`)}
                            disabled={u.email === ADMIN_EMAIL}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── CONTENT (POSTS) ── */}
        {activeTab === 'content' && (
          <div className="admin-content">
            <div className="admin-content-header">
              <h1>Posts <span className="count-badge">{posts.length}</span></h1>
              <button className="admin-refresh-btn" onClick={fetchPosts}>↻ Refresh</button>
            </div>

            {postsLoading ? (
              <div className="admin-loading">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="admin-empty">No posts found.</div>
            ) : (
              <div className="posts-list">
                {posts.map(post => (
                  <div key={post.id} className="admin-post-card">
                    <div className="admin-post-header">
                      <div className="admin-post-author">
                        <div className="user-avatar-small">{post.author?.firstName?.[0]}{post.author?.lastName?.[0]}</div>
                        <div>
                          <span className="post-author-name">{post.author?.firstName} {post.author?.lastName}</span>
                          <span className="post-time">{formatTimeAgo(post.createdAt)}</span>
                        </div>
                      </div>
                      <button
                        className="action-btn btn-delete"
                        onClick={() => handleDeletePost(post.id)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                    <h3 className="admin-post-title">{post.title}</h3>
                    <p className="admin-post-content">{post.content?.substring(0, 200)}{post.content?.length > 200 ? '…' : ''}</p>
                    <div className="admin-post-stats">
                      <span>❤️ {post._count?.likes || 0} likes</span>
                      <span>💬 {post._count?.comments || 0} comments</span>
                      {post.groupId && <span className="group-post-tag">👥 Group Post</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS ── */}
        {activeTab === 'announcements' && (
          <div className="admin-content">
            <div className="admin-content-header">
              <h1>Platform announcements</h1>
              <p style={{ margin: '8px 0 0', color: '#6b7280', fontSize: 15 }}>
                These appear in everyone&apos;s Newsletter feed and trigger a notification for all active users.
              </p>
            </div>

            <form
              onSubmit={handlePublishAnnouncement}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 24,
                marginBottom: 28,
                maxWidth: 720,
              }}
            >
              <h2 style={{ margin: '0 0 16px', fontSize: 18, color: '#800000' }}>New announcement</h2>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Title</label>
              <input
                type="text"
                value={announcementForm.title}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                placeholder="Short headline"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  marginBottom: 14,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 15,
                }}
                maxLength={200}
              />
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 14 }}>Message</label>
              <textarea
                value={announcementForm.content}
                onChange={(e) => setAnnouncementForm({ ...announcementForm, content: e.target.value })}
                placeholder="Full announcement text…"
                rows={8}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '10px 12px',
                  marginBottom: 16,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  fontSize: 15,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <button type="submit" className="admin-refresh-btn" style={{ cursor: 'pointer', border: 'none' }}>
                Publish to all users
              </button>
            </form>

            {announcementsLoading ? (
              <div className="admin-loading">Loading announcements…</div>
            ) : announcements.length === 0 ? (
              <div className="admin-empty">No announcements yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      padding: 20,
                      borderLeft: '4px solid #800000',
                    }}
                  >
                    <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                      {new Date(a.createdAt).toLocaleString()} · {a.author?.firstName} {a.author?.lastName}
                    </div>
                    <h3 style={{ margin: '0 0 10px', fontSize: 18 }}>{a.title}</h3>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#374151', lineHeight: 1.6 }}>{a.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="admin-content">
            <div className="admin-content-header">
              <h1>Reports</h1>
              <div className="report-filters">
                {['PENDING', 'REVIEWED', 'DISMISSED', 'ACTION_TAKEN'].map(s => (
  <button
    key={s}
    className={`filter-pill ${reportFilter === s ? 'active' : ''}`}
    onClick={() => setReportFilter(s)}
  >
    {s.replace('_', ' ')}
  </button>
))}
              </div>
            </div>

            {reportsLoading ? (
              <div className="admin-loading">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="admin-empty">
                <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>✅</span>
                No {reportFilter.toLowerCase()} reports.
              </div>
            ) : (
              <div className="reports-list">
                {reports.map(report => (
  <div key={report.id} className={`report-card ${report.status?.toLowerCase()}`}>
    <div className="report-meta">
      <span className={`report-status-badge ${report.status?.toLowerCase()}`}>{report.status}</span>
      <span className="report-time">{formatTimeAgo(report.createdAt)}</span>
    </div>

    <div className="report-body">
      <div className="report-section">
        <span className="report-label">Reported by</span>
        <span className="report-value">
          {report.reporter?.firstName} {report.reporter?.lastName} ({report.reporter?.email})
        </span>
      </div>
      <div className="report-section">
        <span className="report-label">Target Type</span>
        <span className="report-value">{report.targetType}</span>
      </div>
      <div className="report-section">
        <span className="report-label">Target ID</span>
        <span className="report-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>{report.targetId}</span>
      </div>
      <div className="report-section">
        <span className="report-label">Category</span>
        <span className="report-value">{report.category?.replace(/_/g, ' ')}</span>
      </div>
      {report.details && (
        <div className="report-section">
          <span className="report-label">Details</span>
          <span className="report-value">{report.details}</span>
        </div>
      )}
    </div>

    {report.status === 'PENDING' && (
      <div className="report-actions">
        {report.targetType === 'POST' && (
          <button
            className="action-btn btn-delete"
            onClick={() => handleDeleteReportedPost(report.id, report.targetId)}
          >
            🗑️ Delete Post & Resolve
          </button>
        )}
        {report.targetType === 'USER' && (
          <button
            className="action-btn btn-suspend"
            onClick={() => {
              handleSuspendUser(report.targetId, false);
              handleUpdateReport(report.id, 'ACTION_TAKEN');
            }}
          >
            🚫 Suspend User & Resolve
          </button>
        )}
        <button
          className="action-btn btn-unsuspend"
          onClick={() => handleUpdateReport(report.id, 'REVIEWED')}
        >
          👁️ Mark Reviewed
        </button>
        <button
          className="action-btn btn-dismiss"
          onClick={() => handleUpdateReport(report.id, 'DISMISSED')}
        >
          ✕ Dismiss
        </button>
      </div>
    )}
  </div>
))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}