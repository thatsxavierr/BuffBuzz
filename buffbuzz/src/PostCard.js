import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './PostCard.css';
import CommentModel from './CommentModel';

export default function PostCard({ post, currentUserId, onDelete, friendIds = new Set() }) {
  const navigate = useNavigate();
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isLiked, setIsLiked] = useState(post.isLiked || false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(post._count?.likes || 0);
  const [commentCount, setCommentCount] = useState(post._count?.comments || 0);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debug: Log the post data
  console.log('Post data:', post);
  console.log('Image URL:', post.imageUrl);
  console.log('Image URL length:', post.imageUrl?.length);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleAuthorClick = () => {
    navigate('/profile', { state: { userId: post.author.id } });
  };

  const handleLike = async () => {
    try {
      if (isLiked) {
        const response = await fetch(`http://localhost:5000/api/posts/${post.id}/unlike`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        setIsLiked(false);
        setLikeCount(data.likeCount);
      } else {
        const response = await fetch(`http://localhost:5000/api/posts/${post.id}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId })
        });
        const data = await response.json();
        setIsLiked(true);
        setLikeCount(data.likeCount);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleShare = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/posts/${post.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });
      await response.json();
      alert('Post shared!');
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
  };

  // FIXED: Navigate to user's profile instead of showing alert
  const handleAdd = () => {
    navigate('/profile', { state: { userId: post.author.id } });
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete this post? This action cannot be undone.');
    
    if (!confirmDelete) {
      return;
    }

    setIsDeleting(true);
    
    try {
      const response = await fetch(`http://localhost:5000/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });

      const data = await response.json();

      if (response.ok) {
        // Call the onDelete callback to remove the post from the feed
        if (onDelete) {
          onDelete(post.id);
        }
      } else {
        alert(data.message || 'Failed to delete post');
        setIsDeleting(false);
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('An error occurred while deleting the post');
      setIsDeleting(false);
    }
  };

  const handleCommentAdded = () => {
    setCommentCount(commentCount + 1);
  };

  return (
    <>
      <div className="post-card">
        {/* Post Header */}
        <div className="post-header">
          <div className="author-section" onClick={handleAuthorClick} style={{ cursor: 'pointer' }}>
            <div className="author-avatar">
              {post.author.profile?.profilePictureUrl ? (
                <img src={post.author.profile.profilePictureUrl} alt={post.author.firstName} />
              ) : (
                <div className="avatar-placeholder">👤</div>
              )}
            </div>
            <div className="author-info">
              <div className="author-name-row">
                <span className="author-username" style={{ color: '#800000', fontWeight: '600' }}>
                  {post.author.firstName.toLowerCase()}{post.author.lastName.toLowerCase()}
                </span>
                <span className="post-time-dot">•</span>
                <span className="post-time">{formatDate(post.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="header-actions">
            {post.author.id !== currentUserId && !friendIds.has(post.author.id) && (
              <button className="add-button" onClick={handleAdd}>
                Add
              </button>
            )}
            {post.author.id === currentUserId && (
              <button 
                className="delete-button" 
                onClick={handleDelete}
                disabled={isDeleting}
                title="Delete post"
              >
                {isDeleting ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 6v6M12 18h.01"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Post Image - Fixed to handle base64 properly */}
        {post.imageUrl && (
          <div className="post-image-container">
            <img 
              src={post.imageUrl} 
              alt="Post content" 
              className="post-image"
              onError={(e) => {
                console.error('Image failed to load');
                console.error('Image src:', e.target.src);
                console.error('Starts with data:', post.imageUrl.startsWith('data:'));
                e.target.style.display = 'none';
              }}
              onLoad={() => {
                console.log('Image loaded successfully!');
              }}
            />
          </div>
        )}

        {/* Post Actions */}
        <div className="post-actions">
          <div className="actions-left">
            <button 
              className={`action-btn ${isLiked ? 'liked' : ''}`} 
              onClick={handleLike}
            >
              {isLiked ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#800000">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
              )}
            </button>
            <button className="action-btn" onClick={() => setIsCommentsOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
              </svg>
            </button>
            <button className="action-btn" onClick={handleShare}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
          <button className={`action-btn save-btn ${isSaved ? 'saved' : ''}`} onClick={handleSave}>
            {isSaved ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#800000">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            )}
          </button>
        </div>

        {/* Likes Count */}
        <div className="likes-section">
          <span className="likes-count">{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>
        </div>

        {/* Post Content */}
        <div className="post-content">
          <span 
            className="content-username" 
            onClick={handleAuthorClick}
            style={{ cursor: 'pointer', color: '#800000', fontWeight: '600' }}
          >
            {post.author.firstName.toLowerCase()}{post.author.lastName.toLowerCase()}
          </span>
          <span className="content-title"> {post.title}</span>
          {post.content && <p className="content-text">{post.content}</p>}
        </div>

        {/* View Comments */}
        {commentCount > 0 && (
          <button className="view-comments-btn" onClick={() => setIsCommentsOpen(true)}>
            View all {commentCount} comments
          </button>
        )}

        {/* Add Comment - Clicking opens modal */}
        <div className="add-comment" onClick={() => setIsCommentsOpen(true)}>
          <input
            type="text"
            placeholder="Add a comment..."
            readOnly
            style={{ cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Comment Modal */}
      <CommentModel 
        post={post}
        currentUserId={currentUserId}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        onCommentAdded={handleCommentAdded}
      />
    </>
  );
}