import React, { useState, useEffect } from 'react';
import './CommentModel.css';

export default function CommentModel({ post, currentUserId, isOpen, onClose, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      try {
        const response = await fetch(`http://localhost:5000/api/posts/${post.id}/comments`);
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments);
        }
      } catch (error) {
        console.error('Error fetching comments:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, post.id]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;
    return date.toLocaleDateString();
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      const response = await fetch(`http://localhost:5000/api/posts/${post.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          content: commentText
        })
      });
      const data = await response.json();
      setComments([data.comment, ...comments]);
      setCommentText('');
      if (onCommentAdded) {
        onCommentAdded();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <h3>Comments</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Post Preview */}
        <div className="modal-post-preview">
          <div className="preview-author">
            <div className="preview-avatar">
              {post.author.profile?.profilePictureUrl ? (
                <img src={post.author.profile.profilePictureUrl} alt={post.author.firstName} />
              ) : (
                '👤'
              )}
            </div>
            <div className="preview-info">
              <span className="preview-username">
                {post.author.firstName.toLowerCase()}{post.author.lastName.toLowerCase()}
              </span>
              <span className="preview-title">{post.title}</span>
            </div>
          </div>
          {post.content && <p className="preview-content">{post.content}</p>}
        </div>

        {/* Comments List */}
        <div className="modal-comments-list">
          {loading ? (
            <div className="loading-comments">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="no-comments-modal">
              <p>No comments yet.</p>
              <span>Start the conversation.</span>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="modal-comment-item">
                <div className="modal-comment-avatar">
                  {comment.author.profile?.profilePictureUrl ? (
                    <img src={comment.author.profile.profilePictureUrl} alt={comment.author.firstName} />
                  ) : (
                    '👤'
                  )}
                </div>
                <div className="modal-comment-content">
                  <div className="modal-comment-header">
                    <span className="modal-comment-username">
                      {comment.author.firstName.toLowerCase()}{comment.author.lastName.toLowerCase()}
                    </span>
                    <span className="modal-comment-text">{comment.content}</span>
                  </div>
                  <div className="modal-comment-footer">
                    <span className="modal-comment-time">{formatDate(comment.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Comment */}
        <div className="modal-add-comment">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            onKeyPress={(e) => e.key === 'Enter' && handleComment()}
          />
          <button 
            className="modal-post-btn" 
            onClick={handleComment}
            disabled={!commentText.trim()}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}