import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LikesModal.css';

export default function LikesModal({ postId, likeCount, isOpen, onClose }) {
  const navigate = useNavigate();
  const [likers, setLikers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen || !postId) {
      setError(false);
      return;
    }
    setError(false);
    setLikers([]);
    const fetchLikers = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/posts/${postId}/likes`);
        const data = await response.json();
        if (response.ok) {
          setLikers(Array.isArray(data.likers) ? data.likers : []);
          setError(false);
        } else {
          setError(true);
          setLikers([]);
        }
      } catch (err) {
        console.error('Error fetching likers:', err);
        setError(true);
        setLikers([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLikers();
  }, [isOpen, postId]);

  const handleUserClick = (userId) => {
    onClose();
    navigate('/profile', { state: { userId } });
  };

  if (!isOpen) return null;

  return (
    <div className="likes-modal-overlay" onClick={onClose}>
      <div className="likes-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="likes-modal-header">
          <h3>Likes</h3>
          <button type="button" className="likes-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="likes-modal-list">
          {loading ? (
            <div className="likes-modal-loading">Loading...</div>
          ) : error ? (
            <div className="likes-modal-empty likes-modal-error">Couldn&apos;t load likes. Try again.</div>
          ) : likers.length === 0 ? (
            <div className="likes-modal-empty">No likes yet.</div>
          ) : (
            likers.map((user) => (
              <div
                key={user.id}
                className="likes-modal-item"
                onClick={() => handleUserClick(user.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleUserClick(user.id)}
              >
                <div className="likes-modal-avatar">
                  {user.profile?.profilePictureUrl ? (
                    <img src={user.profile.profilePictureUrl} alt="" />
                  ) : (
                    '👤'
                  )}
                </div>
                <span className="likes-modal-username">
                  {user.firstName?.toLowerCase()}{user.lastName?.toLowerCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
