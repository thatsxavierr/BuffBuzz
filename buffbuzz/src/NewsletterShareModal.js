import { API_URL } from './config';
import React, { useEffect, useState } from 'react';
import './NewsletterShareModal.css';

const API = API_URL;

export default function NewsletterShareModal({ open, onClose, currentUserId, newsletterId, newsletterTitle }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !currentUserId) return;
    setError('');
    setLoading(true);
    fetch(`${API}/api/friends/${currentUserId}`)
      .then((r) => r.json())
      .then((d) => setFriends(d.friends || []))
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [open, currentUserId]);

  if (!open) return null;

  const shareUrl = `${window.location.origin}/newsletter?nl=${encodeURIComponent(newsletterId)}`;
  const messageBody = `📰 I wanted to share this BuffBuzz newsletter with you:\n"${newsletterTitle}"\n${shareUrl}`;

  const sendToFriend = async (friendId) => {
    setSendingId(friendId);
    setError('');
    try {
      const convRes = await fetch(`${API}/api/conversations/get-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, otherUserId: friendId })
      });
      const convData = await convRes.json();
      if (!convRes.ok) {
        throw new Error(convData.message || 'Could not open conversation');
      }
      const conversationId = convData.conversation?.id;
      if (!conversationId) throw new Error('No conversation id');

      const msgRes = await fetch(`${API}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          senderId: currentUserId,
          content: messageBody
        })
      });
      const msgData = await msgRes.json();
      if (!msgRes.ok) {
        throw new Error(msgData.message || 'Could not send message');
      }
      onClose();
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div
      className="nl-share-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nl-share-title"
      onClick={onClose}
    >
      <div className="nl-share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nl-share-header">
          <h2 id="nl-share-title">Share via message</h2>
          <button type="button" className="nl-share-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <p className="nl-share-sub">Choose a friend to send a link to this newsletter.</p>
        {error && <div className="nl-share-error">{error}</div>}
        <div className="nl-share-list">
          {loading ? (
            <div className="nl-share-loading">Loading friends…</div>
          ) : friends.length === 0 ? (
            <div className="nl-share-empty">You don&apos;t have any friends to share with yet.</div>
          ) : (
            friends.map((f) => (
              <button
                key={f.id}
                type="button"
                className="nl-share-friend"
                onClick={() => sendToFriend(f.id)}
                disabled={!!sendingId}
              >
                <span className="nl-share-friend-avatar">
                  {f.profile?.profilePictureUrl ? (
                    <img src={f.profile.profilePictureUrl} alt="" />
                  ) : (
                    `${f.firstName?.[0] || '?'}${f.lastName?.[0] || ''}`
                  )}
                </span>
                <span className="nl-share-friend-name">
                  {f.firstName} {f.lastName}
                </span>
                {sendingId === f.id ? <span className="nl-share-sending">Sending…</span> : <span className="nl-share-chev">→</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
