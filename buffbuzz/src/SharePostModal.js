import React, { useState, useEffect } from 'react';
import './SharePostModal.css';
import { serializeSharedPost } from './sharedPostMessageUtils';

export default function SharePostModal({ isOpen, onClose, post, currentUserId }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [lastSentName, setLastSentName] = useState(null);

  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setLastSentName(null);

    fetch(`http://localhost:5000/api/friends/${currentUserId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Could not load friends');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setFriends(data.friends || []);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setFetchError(err.message || 'Failed to load friends');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentUserId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const sendToFriend = async (friend) => {
    if (!post?.id || !currentUserId || sendingId) return;

    setSendingId(friend.id);
    setLastSentName(null);

    try {
      const convRes = await fetch('http://localhost:5000/api/conversations/get-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          otherUserId: friend.id,
        }),
      });

      if (!convRes.ok) {
        const err = await convRes.json().catch(() => ({}));
        throw new Error(err.message || 'Could not open chat');
      }

      const { conversation } = await convRes.json();
      const content = serializeSharedPost(post);

      const msgRes = await fetch('http://localhost:5000/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: conversation.id,
          senderId: currentUserId,
          content,
          type: 'TEXT',
        }),
      });

      if (!msgRes.ok) {
        const err = await msgRes.json().catch(() => ({}));
        throw new Error(err.message || 'Could not send message');
      }

      await fetch(`http://localhost:5000/api/posts/${post.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      }).catch(() => {});

      setLastSentName(`${friend.firstName} ${friend.lastName}`.trim());
    } catch (e) {
      console.error(e);
      alert(e.message || 'Something went wrong');
    } finally {
      setSendingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-post-overlay" role="dialog" aria-modal="true" aria-labelledby="share-post-title" onClick={onClose}>
      <div className="share-post-panel" onClick={(e) => e.stopPropagation()}>
        <div className="share-post-header">
          <h2 id="share-post-title">Share to a friend</h2>
          <button type="button" className="share-post-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="share-post-hint">Choose someone to send this post in a direct message.</p>

        {lastSentName && (
          <div className="share-post-success" role="status">
            Sent to {lastSentName}.
          </div>
        )}

        {loading && <p className="share-post-loading">Loading friends…</p>}
        {fetchError && <p className="share-post-error">{fetchError}</p>}

        {!loading && !fetchError && friends.length === 0 && (
          <p className="share-post-empty">You don&apos;t have any friends yet. Add friends from profiles to share posts.</p>
        )}

        {!loading && !fetchError && friends.length > 0 && (
          <ul className="share-post-friend-list">
            {friends.map((friend) => (
              <li key={friend.id}>
                <button
                  type="button"
                  className="share-post-friend-row"
                  onClick={() => sendToFriend(friend)}
                  disabled={!!sendingId}
                >
                  <span className="share-post-friend-avatar">
                    {friend.profile?.profilePictureUrl ? (
                      <img src={friend.profile.profilePictureUrl} alt="" />
                    ) : (
                      <span className="share-post-friend-placeholder">👤</span>
                    )}
                  </span>
                  <span className="share-post-friend-name">
                    {friend.firstName} {friend.lastName}
                  </span>
                  {sendingId === friend.id ? (
                    <span className="share-post-sending">Sending…</span>
                  ) : (
                    <span className="share-post-send-label">Send</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
