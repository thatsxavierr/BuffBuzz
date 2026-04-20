import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './Newsletter.css';
import Header from './Header.js';
import LeftSidebar from './LeftSidebar';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';
import LinkifiedText, { countWords } from './LinkifiedText';
import NewsletterShareModal from './NewsletterShareModal';

const API = 'http://localhost:5000';
const MAX_WORDS = 500;

export default function Newsletter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightRef = useRef(null);
  const skipNextFeedRefetch = useRef(true);
  const loadMineGenRef = useRef(0);
  const loadDiscoverGenRef = useRef(0);
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [tab, setTab] = useState('feed');
  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState([]);
  const [myNewsletter, setMyNewsletter] = useState(null);
  const [discover, setDiscover] = useState([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [highlightNlId, setHighlightNlId] = useState(null);

  const [createNl, setCreateNl] = useState({ title: '', description: '', coverImageUrl: null });
  const [editNl, setEditNl] = useState({ title: '', description: '', coverImageUrl: null });
  const [newPost, setNewPost] = useState({ title: '', content: '', imageUrl: null });

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const fetchProfilePicture = async (userId) => {
    try {
      const res = await fetch(`${API}/api/profile/${userId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.profile?.profilePictureUrl) setProfilePicture(data.profile.profilePictureUrl);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadFeed = useCallback(async (uid) => {
    try {
      const res = await fetch(`${API}/api/newsletters/feed?userId=${uid}`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data.feed || []);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadMine = useCallback(async (uid) => {
    const gen = ++loadMineGenRef.current;
    try {
      const res = await fetch(`${API}/api/newsletters/user/${uid}`);
      if (gen !== loadMineGenRef.current) return;
      if (res.ok) {
        const data = await res.json();
        const nl = data.newsletter;
        if (gen !== loadMineGenRef.current) return;
        setMyNewsletter({
          ...nl,
          posts: Array.isArray(nl.posts) ? nl.posts : []
        });
        setEditNl({
          title: nl.title || '',
          description: nl.description || '',
          coverImageUrl: nl.coverImageUrl || null
        });
      } else if (res.status === 404) {
        if (gen !== loadMineGenRef.current) return;
        setMyNewsletter(null);
      }
    } catch (e) {
      if (gen !== loadMineGenRef.current) return;
      setMyNewsletter(null);
    }
  }, []);

  const loadDiscover = useCallback(async (uid, q) => {
    const gen = ++loadDiscoverGenRef.current;
    try {
      const params = new URLSearchParams({ userId: uid });
      if (q && q.trim()) params.set('search', q.trim());
      const res = await fetch(`${API}/api/newsletters/discover?${params}`);
      if (gen !== loadDiscoverGenRef.current) return;
      if (res.ok) {
        const data = await res.json();
        if (gen !== loadDiscoverGenRef.current) return;
        const raw = data.newsletters || [];
        const sorted = [...raw].sort((a, b) => {
          if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
          return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
        });
        setDiscover(sorted);
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    const u = getValidUser();
    if (!u) {
      navigate('/login');
      return;
    }
    setUser(u);
    fetchProfilePicture(u.id);
    Promise.all([loadFeed(u.id), loadMine(u.id), loadDiscover(u.id, '')]).finally(() => setLoading(false));
  }, [navigate, loadFeed, loadMine, loadDiscover]);

  useEffect(() => {
    if (!user || tab !== 'feed') return;
    if (skipNextFeedRefetch.current) {
      skipNextFeedRefetch.current = false;
      return;
    }
    loadFeed(user.id);
  }, [tab, user, loadFeed]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      if (tab === 'discover') loadDiscover(user.id, search);
    }, 320);
    return () => clearTimeout(t);
  }, [search, tab, user, loadDiscover]);

  useEffect(() => {
    const nl = searchParams.get('nl');
    if (nl) {
      setTab('discover');
      setHighlightNlId(nl);
      const t = setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 500);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  const readImageFile = (file) =>
    new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Please choose an image file'));
        return;
      }
      if (file.size > 6 * 1024 * 1024) {
        reject(new Error('Image must be 6MB or smaller'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const handleBack = () => navigate('/main');

  const handleCreateNewsletter = async (e) => {
    e.preventDefault();
    if (!createNl.title.trim()) {
      showMsg('error', 'Please enter a newsletter name');
      return;
    }
    const desc = createNl.description.trim();
    if (desc && countWords(desc) > MAX_WORDS) {
      showMsg('error', `Description must be ${MAX_WORDS} words or fewer`);
      return;
    }
    try {
      const res = await fetch(`${API}/api/newsletters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: createNl.title.trim(),
          description: desc || null,
          coverImageUrl: createNl.coverImageUrl || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        const nl = data.newsletter;
        setMyNewsletter({
          ...nl,
          posts: Array.isArray(nl.posts) ? nl.posts : []
        });
        setEditNl({
          title: nl.title || '',
          description: nl.description || '',
          coverImageUrl: nl.coverImageUrl || null
        });
        setCreateNl({ title: '', description: '', coverImageUrl: null });
        showMsg('success', 'Your newsletter is live!');
        setTab('mine');
        loadDiscover(user.id, search);
        await loadMine(user.id);
      } else {
        showMsg('error', data.message || 'Could not create newsletter');
      }
    } catch (err) {
      showMsg('error', 'Something went wrong');
    }
  };

  const handleUpdateNewsletter = async (e) => {
    e.preventDefault();
    if (!myNewsletter) return;
    const desc = (editNl.description || '').trim();
    if (desc && countWords(desc) > MAX_WORDS) {
      showMsg('error', `Description must be ${MAX_WORDS} words or fewer`);
      return;
    }
    try {
      const res = await fetch(`${API}/api/newsletters/${myNewsletter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: editNl.title.trim(),
          description: editNl.description,
          coverImageUrl: editNl.coverImageUrl
        })
      });
      const data = await res.json();
      if (res.ok) {
        const nl = data.newsletter;
        setMyNewsletter({
          ...nl,
          posts: Array.isArray(nl.posts) ? nl.posts : []
        });
        showMsg('success', 'Newsletter updated');
        loadDiscover(user.id, search);
      } else {
        showMsg('error', data.message || 'Update failed');
      }
    } catch (err) {
      showMsg('error', 'Something went wrong');
    }
  };

  const handlePublishPost = async (e) => {
    e.preventDefault();
    if (!myNewsletter || !newPost.title.trim() || !newPost.content.trim()) {
      showMsg('error', 'Title and body are required');
      return;
    }
    const bodyText = newPost.content.trim();
    if (countWords(bodyText) > MAX_WORDS) {
      showMsg('error', `Each issue must be ${MAX_WORDS} words or fewer`);
      return;
    }
    try {
      const res = await fetch(`${API}/api/newsletters/${myNewsletter.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          title: newPost.title.trim(),
          content: bodyText,
          imageUrl: newPost.imageUrl || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setNewPost({ title: '', content: '', imageUrl: null });
        await loadMine(user.id);
        await loadFeed(user.id);
        showMsg('success', 'Post published — subscribers were notified');
        window.dispatchEvent(new Event('notificationsUpdated'));
      } else {
        showMsg('error', data.message || 'Could not publish');
      }
    } catch (err) {
      showMsg('error', 'Something went wrong');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!myNewsletter || !window.confirm('Delete this post?')) return;
    try {
      const res = await fetch(`${API}/api/newsletters/${myNewsletter.id}/posts/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (res.ok) {
        await loadMine(user.id);
        await loadFeed(user.id);
        showMsg('success', 'Post removed');
      }
    } catch (err) {
      showMsg('error', 'Could not delete');
    }
  };

  const handleSubscribe = async (newsletterId) => {
    try {
      const res = await fetch(`${API}/api/newsletters/${newsletterId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriberId: user.id })
      });
      const data = await res.json();
      if (res.ok) {
        showMsg('success', 'You are subscribed');
        loadDiscover(user.id, search);
        loadFeed(user.id);
      } else {
        showMsg('error', data.message || 'Could not subscribe');
      }
    } catch (err) {
      showMsg('error', 'Something went wrong');
    }
  };

  const handleUnsubscribe = async (newsletterId) => {
    try {
      const res = await fetch(`${API}/api/newsletters/${newsletterId}/subscribe`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriberId: user.id })
      });
      if (res.ok) {
        showMsg('success', 'Unsubscribed');
        loadDiscover(user.id, search);
        loadFeed(user.id);
      }
    } catch (err) {
      showMsg('error', 'Could not unsubscribe');
    }
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  if (!user) return null;

  return (
    <div className="newsletter-page">
      <Header onBackClick={handleBack} profilePictureUrl={profilePicture} />

      <div className="newsletter-body">
        <LeftSidebar />

        <div className="newsletter-main">
          <div className="newsletter-hero">
            <h1>Newsletters</h1>
            <p>
              <strong>Feed</strong> shows official announcements, new issues from newsletters you follow,
              and your own published issues. <strong>My newsletter</strong> is where you set up your channel
              and publish issues. <strong>Discover</strong> lists every newsletter, including yours.
            </p>
            <p className="newsletter-hero-note">
              You can have <strong>one newsletter per account</strong> (your channel name and description).
              You publish <strong>many issues</strong> over time—each issue is a separate post to subscribers.
            </p>
          </div>

          {msg.text && (
            <div
              className="nl-card"
              style={{
                marginBottom: 16,
                borderColor: msg.type === 'error' ? '#fecaca' : '#bbf7d0',
                background: msg.type === 'error' ? '#fef2f2' : '#f0fdf4'
              }}
            >
              {msg.text}
            </div>
          )}

          <div className="newsletter-tabs">
            <button type="button" className={tab === 'feed' ? 'active' : ''} onClick={() => setTab('feed')}>
              Feed
            </button>
            <button
              type="button"
              className={tab === 'mine' ? 'active' : ''}
              onClick={() => setTab('mine')}
            >
              My newsletter
            </button>
            <button
              type="button"
              className={tab === 'discover' ? 'active' : ''}
              onClick={() => setTab('discover')}
            >
              Discover
            </button>
          </div>

          {loading ? (
            <div className="nl-loading">Loading…</div>
          ) : (
            <>
              {tab === 'feed' && (
                <div className="newsletter-panel">
                  {feed.length === 0 ? (
                    <div className="nl-empty">
                      <span>📭</span>
                      <h3>Nothing in your feed yet</h3>
                      <p>
                        Announcements and new issues from newsletters you follow show here. If you have your
                        own newsletter, publish an issue under <strong>My newsletter</strong>—it will appear
                        here too. Pull to refresh by switching tabs or revisit this page after new posts.
                      </p>
                    </div>
                  ) : (
                    feed.map((item) =>
                      item.kind === 'announcement' ? (
                        <article key={`a-${item.id}`} className="nl-card nl-card-announcement">
                          <span className="nl-badge nl-badge-official">Official</span>
                          <h3>{item.title}</h3>
                          <div className="nl-meta">
                            BuffBuzz · {item.author ? `${item.author.firstName} ${item.author.lastName}` : 'Admin'} ·{' '}
                            {formatDate(item.createdAt)}
                          </div>
                          <div className="nl-body">
                            <LinkifiedText text={item.content} />
                          </div>
                        </article>
                      ) : (
                        <article key={`p-${item.id}`} className="nl-card nl-feed-issue">
                          <span
                            className={`nl-badge ${item.isOwnNewsletter ? 'nl-badge-own' : 'nl-badge-post'}`}
                          >
                            {item.isOwnNewsletter ? 'Your issue' : 'Subscribed'}
                          </span>
                          <div className="nl-feed-issue-inner">
                            {(item.imageUrl || item.newsletter?.coverImageUrl) && (
                              <button
                                type="button"
                                className="nl-cover-thumb nl-cover-thumb-lg"
                                onClick={() =>
                                  setLightboxUrl(item.imageUrl || item.newsletter?.coverImageUrl)
                                }
                                aria-label="View image"
                              >
                                <img src={item.imageUrl || item.newsletter?.coverImageUrl} alt="" />
                              </button>
                            )}
                            <div className="nl-feed-issue-text">
                              <h3>{item.title}</h3>
                              <div className="nl-meta">
                                {item.newsletter?.title} ·{' '}
                                {item.newsletter?.user
                                  ? `${item.newsletter.user.firstName} ${item.newsletter.user.lastName}`
                                  : ''}{' '}
                                · {formatDate(item.createdAt)}
                              </div>
                              <div className="nl-body">
                                <LinkifiedText text={item.content} />
                              </div>
                              <button
                                type="button"
                                className="nl-btn nl-btn-secondary nl-feed-share"
                                onClick={() =>
                                  setShareTarget({
                                    id: item.newsletter?.id,
                                    title: item.newsletter?.title || 'Newsletter'
                                  })
                                }
                              >
                                Share with a friend
                              </button>
                            </div>
                          </div>
                        </article>
                      )
                    )
                  )}
                </div>
              )}

              {tab === 'mine' && (
                <div className="newsletter-panel">
                  {!myNewsletter ? (
                    <>
                      <div className="nl-empty" style={{ marginBottom: 20 }}>
                        <span>✨</span>
                        <h3>Create your newsletter</h3>
                        <p>
                          One newsletter per account—your public channel. After you create it, you’ll publish
                          <strong> issues</strong> (individual posts). Subscribers see each new issue in their
                          Feed.
                        </p>
                      </div>
                      <form className="nl-form" onSubmit={handleCreateNewsletter}>
                        <h2>New newsletter</h2>
                        <label htmlFor="nl-title">Name</label>
                        <input
                          id="nl-title"
                          value={createNl.title}
                          onChange={(e) => setCreateNl({ ...createNl, title: e.target.value })}
                          placeholder="e.g. CS Study Tips Weekly"
                          maxLength={120}
                        />
                        <label htmlFor="nl-desc">Description (optional, max {MAX_WORDS} words)</label>
                        <textarea
                          id="nl-desc"
                          value={createNl.description}
                          onChange={(e) => setCreateNl({ ...createNl, description: e.target.value })}
                          placeholder="What will you write about? Paste links — they’ll be clickable."
                        />
                        <p
                          className={`nl-word-count ${
                            countWords(createNl.description) > MAX_WORDS ? 'nl-word-count-bad' : ''
                          }`}
                        >
                          {countWords(createNl.description)} / {MAX_WORDS} words
                        </p>
                        <label className="nl-file-label">
                          Optional cover image (shown beside your newsletter in Discover)
                          <input
                            type="file"
                            accept="image/*"
                            className="nl-file-input"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                const dataUrl = await readImageFile(f);
                                setCreateNl((prev) => ({ ...prev, coverImageUrl: dataUrl }));
                              } catch (err) {
                                showMsg('error', err.message || 'Invalid image');
                              }
                            }}
                          />
                        </label>
                        {createNl.coverImageUrl && (
                          <div className="nl-preview-row">
                            <button
                              type="button"
                              className="nl-cover-thumb"
                              onClick={() => setLightboxUrl(createNl.coverImageUrl)}
                            >
                              <img src={createNl.coverImageUrl} alt="Cover preview" />
                            </button>
                            <button
                              type="button"
                              className="nl-btn nl-btn-danger"
                              onClick={() => setCreateNl((p) => ({ ...p, coverImageUrl: null }))}
                            >
                              Remove image
                            </button>
                          </div>
                        )}
                        <button type="submit" className="nl-btn nl-btn-primary">
                          Create newsletter
                        </button>
                      </form>
                    </>
                  ) : (
                    <>
                      <form className="nl-form" onSubmit={handleUpdateNewsletter}>
                        <h2>Your newsletter</h2>
                        <p className="nl-explainer">
                          This is your channel (one per account). Edit the title or description anytime. New
                          content = publish an <strong>issue</strong> below—not a new newsletter.
                        </p>
                        <p className="nl-stats">
                          {myNewsletter._count?.subscriptions ?? 0} subscribers ·{' '}
                          {myNewsletter.posts?.length ?? 0} issues published
                        </p>
                        <label htmlFor="ed-title">Name</label>
                        <input
                          id="ed-title"
                          value={editNl.title}
                          onChange={(e) => setEditNl({ ...editNl, title: e.target.value })}
                          maxLength={120}
                        />
                        <label htmlFor="ed-desc">Description (max {MAX_WORDS} words)</label>
                        <textarea
                          id="ed-desc"
                          value={editNl.description}
                          onChange={(e) => setEditNl({ ...editNl, description: e.target.value })}
                          placeholder="Links in the description are clickable for readers."
                        />
                        <p
                          className={`nl-word-count ${
                            countWords(editNl.description || '') > MAX_WORDS ? 'nl-word-count-bad' : ''
                          }`}
                        >
                          {countWords(editNl.description || '')} / {MAX_WORDS} words
                        </p>
                        <label className="nl-file-label">
                          Cover image (optional)
                          <input
                            type="file"
                            accept="image/*"
                            className="nl-file-input"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                const dataUrl = await readImageFile(f);
                                setEditNl((prev) => ({ ...prev, coverImageUrl: dataUrl }));
                              } catch (err) {
                                showMsg('error', err.message || 'Invalid image');
                              }
                            }}
                          />
                        </label>
                        {editNl.coverImageUrl && (
                          <div className="nl-preview-row">
                            <button
                              type="button"
                              className="nl-cover-thumb"
                              onClick={() => setLightboxUrl(editNl.coverImageUrl)}
                            >
                              <img src={editNl.coverImageUrl} alt="Cover" />
                            </button>
                            <button
                              type="button"
                              className="nl-btn nl-btn-danger"
                              onClick={() => setEditNl((p) => ({ ...p, coverImageUrl: null }))}
                            >
                              Remove image
                            </button>
                          </div>
                        )}
                        <button type="submit" className="nl-btn nl-btn-primary">
                          Save changes
                        </button>
                      </form>

                      <form className="nl-form" onSubmit={handlePublishPost}>
                        <h2>Publish a new issue</h2>
                        <label htmlFor="post-title">Title</label>
                        <input
                          id="post-title"
                          value={newPost.title}
                          onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                          placeholder="Issue headline"
                          maxLength={200}
                        />
                        <label htmlFor="post-body">Content (max {MAX_WORDS} words)</label>
                        <textarea
                          id="post-body"
                          value={newPost.content}
                          onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                          placeholder="Write your update… URLs become clickable links."
                        />
                        <p
                          className={`nl-word-count ${
                            countWords(newPost.content) > MAX_WORDS ? 'nl-word-count-bad' : ''
                          }`}
                        >
                          {countWords(newPost.content)} / {MAX_WORDS} words
                        </p>
                        <label className="nl-file-label">
                          Optional image for this issue (shown beside the text)
                          <input
                            type="file"
                            accept="image/*"
                            className="nl-file-input"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              try {
                                const dataUrl = await readImageFile(f);
                                setNewPost((prev) => ({ ...prev, imageUrl: dataUrl }));
                              } catch (err) {
                                showMsg('error', err.message || 'Invalid image');
                              }
                            }}
                          />
                        </label>
                        {newPost.imageUrl && (
                          <div className="nl-preview-row">
                            <button
                              type="button"
                              className="nl-cover-thumb"
                              onClick={() => setLightboxUrl(newPost.imageUrl)}
                            >
                              <img src={newPost.imageUrl} alt="Issue attachment" />
                            </button>
                            <button
                              type="button"
                              className="nl-btn nl-btn-danger"
                              onClick={() => setNewPost((p) => ({ ...p, imageUrl: null }))}
                            >
                              Remove image
                            </button>
                          </div>
                        )}
                        <button type="submit" className="nl-btn nl-btn-primary">
                          Publish to subscribers
                        </button>
                      </form>

                      <h3 className="nl-past-heading">Past issues</h3>
                      {(myNewsletter.posts || []).length === 0 ? (
                        <div className="nl-empty">No posts yet — publish your first issue above.</div>
                      ) : (
                        (myNewsletter.posts || []).map((p) => (
                          <div key={p.id} className="nl-card nl-past-card">
                            <div className="nl-past-inner">
                              {p.imageUrl && (
                                <button
                                  type="button"
                                  className="nl-cover-thumb nl-cover-thumb-lg"
                                  onClick={() => setLightboxUrl(p.imageUrl)}
                                  aria-label="View issue image"
                                >
                                  <img src={p.imageUrl} alt="" />
                                </button>
                              )}
                              <div className="nl-past-copy">
                                <h4>{p.title}</h4>
                                <div className="nl-meta">{formatDate(p.createdAt)}</div>
                                <div className="nl-past-stats">{countWords(p.content)} words</div>
                                <div className="nl-body">
                                  <LinkifiedText text={p.content} />
                                </div>
                                <div className="nl-post-actions">
                                  <button
                                    type="button"
                                    className="nl-btn nl-btn-danger"
                                    onClick={() => handleDeletePost(p.id)}
                                  >
                                    Delete issue
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === 'discover' && (
                <div className="newsletter-panel">
                  <div className="nl-search">
                    <input
                      type="search"
                      placeholder="Search by title, description, or author name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search newsletters"
                    />
                  </div>

                  {discover.length === 0 ? (
                    <div className="nl-empty">
                      <span>🔎</span>
                      <p>No newsletters match your search yet, or none have been created.</p>
                    </div>
                  ) : (
                    discover.map((n) => (
                      <div
                        key={n.id}
                        ref={n.id === highlightNlId ? highlightRef : undefined}
                        className={`nl-card nl-discover-card ${n.id === highlightNlId ? 'nl-highlight' : ''}`}
                      >
                        <div className="nl-discover-row">
                          {n.coverImageUrl && (
                            <button
                              type="button"
                              className="nl-cover-thumb nl-cover-thumb-lg"
                              onClick={() => setLightboxUrl(n.coverImageUrl)}
                              aria-label="View cover image"
                            >
                              <img src={n.coverImageUrl} alt="" />
                            </button>
                          )}
                          <div className="nl-author nl-author-grow">
                            <div className="nl-avatar">
                              {n.user?.profile?.profilePictureUrl ? (
                                <img src={n.user.profile.profilePictureUrl} alt="" />
                              ) : (
                                `${n.user?.firstName?.[0] || '?'}${n.user?.lastName?.[0] || ''}`
                              )}
                            </div>
                            <div>
                              <h3 style={{ margin: '0 0 4px 0' }}>{n.title}</h3>
                              {n.isOwner && <span className="nl-badge nl-badge-yours">Yours</span>}
                              <div className="nl-meta">
                                {n.user ? `${n.user.firstName} ${n.user.lastName}` : 'Member'}
                              </div>
                              {n.description && (
                                <div className="nl-desc-block">
                                  <LinkifiedText text={n.description} />
                                </div>
                              )}
                              <div className="nl-stats">
                                {n._count?.subscriptions ?? 0} subscribers · {n._count?.posts ?? 0} posts
                              </div>
                            </div>
                          </div>
                          <div className="nl-discover-actions">
                            <button
                              type="button"
                              className="nl-btn nl-btn-secondary"
                              onClick={() => setShareTarget({ id: n.id, title: n.title })}
                            >
                              Share
                            </button>
                            {n.isOwner ? (
                              <button
                                type="button"
                                className="nl-btn nl-btn-primary"
                                onClick={() => setTab('mine')}
                              >
                                Manage
                              </button>
                            ) : n.isSubscribed ? (
                              <button
                                type="button"
                                className="nl-btn nl-btn-outline"
                                onClick={() => handleUnsubscribe(n.id)}
                              >
                                Unsubscribe
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="nl-btn nl-btn-primary"
                                onClick={() => handleSubscribe(n.id)}
                              >
                                Subscribe
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />

      {lightboxUrl && (
        <div
          className="nl-lightbox"
          onClick={() => setLightboxUrl(null)}
          role="presentation"
        >
          <button
            type="button"
            className="nl-lightbox-close"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxUrl(null);
            }}
          >
            ×
          </button>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {shareTarget && (
        <NewsletterShareModal
          open
          onClose={() => setShareTarget(null)}
          currentUserId={user.id}
          newsletterId={shareTarget.id}
          newsletterTitle={shareTarget.title}
        />
      )}
    </div>
  );
}
