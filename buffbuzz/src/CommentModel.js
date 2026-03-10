import React, { useState, useEffect } from 'react';
import './CommentModel.css';

export default function CommentModel({ post, currentUserId, isOpen, onClose, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState([]);
  const [mentionUsers, setMentionUsers] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

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

  // When user types @, search for users and show dropdown
  useEffect(() => {
    const lastAtIndex = commentText.lastIndexOf('@');
    if (lastAtIndex === -1) {
      setShowMentionDropdown(false);
      setMentionUsers([]);
      return;
    }
    const afterAt = commentText.slice(lastAtIndex + 1);
    const query = (afterAt.split(/\s/)[0] || '').trim();
    if (query.includes('@')) return;
    if (query.length < 1) {
      setShowMentionDropdown(false);
      setMentionUsers([]);
      return;
    }
    const searchUsers = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/search-users?query=${encodeURIComponent(query)}`);
        const data = await res.json();
        const users = (data.users || []).filter(u => u.id !== currentUserId);
        setMentionUsers(users);
        setShowMentionDropdown(users.length > 0);
      } catch (err) {
        setMentionUsers([]);
      }
    };
    const t = setTimeout(searchUsers, 200);
    return () => clearTimeout(t);
  }, [commentText, currentUserId]);

  const handleSelectMention = (user) => {
    const lastAtIndex = commentText.lastIndexOf('@');
    const beforeAt = commentText.slice(0, lastAtIndex);
    const afterAt = commentText.slice(lastAtIndex + 1);
    const query = afterAt.split(/\s/)[0];
    const afterQuery = afterAt.slice(query.length);
    const newText = `${beforeAt}@${user.fullName} ${afterQuery}`;
    setCommentText(newText);
    setMentionedUserIds(prev => prev.includes(user.id) ? prev : [...prev, user.id]);
    setShowMentionDropdown(false);
    setMentionUsers([]);
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;

    try {
      if (replyingTo) {
        const response = await fetch(`http://localhost:5000/api/comments/${replyingTo.id}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            content: commentText,
            mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined
          })
        });
        const data = await response.json();
        if (response.ok && data.reply) {
          const addReplyToComments = (list, parentId, newReply) => {
            return list.map(item => {
              if (item.id === parentId) {
                return { ...item, replies: [...(item.replies || []), newReply] };
              }
              if (item.replies?.length) {
                return { ...item, replies: addReplyToComments(item.replies, parentId, newReply) };
              }
              return item;
            });
          };
          setComments(addReplyToComments(comments, replyingTo.id, data.reply));
        }
      } else {
        const response = await fetch(`http://localhost:5000/api/posts/${post.id}/comment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            content: commentText,
            mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined
          })
        });
        const data = await response.json();
        if (response.ok && data.comment) {
          setComments([{ ...data.comment, replies: [] }, ...comments]);
        }
      }
      setCommentText('');
      setMentionedUserIds([]);
      setReplyingTo(null);
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
              <div key={comment.id} className="modal-comment-block">
                <div className="modal-comment-item">
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
                      <button
                        type="button"
                        className="modal-comment-reply-btn"
                        onClick={() => setReplyingTo(replyingTo?.id === comment.id ? null : comment)}
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                </div>
                {comment.replies?.map((reply) => (
                  <div key={reply.id} className="modal-reply-thread">
                    <div className="modal-comment-item modal-comment-reply">
                      <div className="modal-comment-avatar">
                        {reply.author?.profile?.profilePictureUrl ? (
                          <img src={reply.author.profile.profilePictureUrl} alt={reply.author.firstName} />
                        ) : (
                          '👤'
                        )}
                      </div>
                      <div className="modal-comment-content">
                        <div className="modal-comment-header">
                          <span className="modal-comment-username">
                            {reply.author?.firstName?.toLowerCase()}{reply.author?.lastName?.toLowerCase()}
                          </span>
                          <span className="modal-comment-text">{reply.content}</span>
                        </div>
                        <div className="modal-comment-footer">
                          <span className="modal-comment-time">{formatDate(reply.createdAt)}</span>
                          <button
                            type="button"
                            className="modal-comment-reply-btn"
                            onClick={() => setReplyingTo(replyingTo?.id === reply.id ? null : reply)}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                    {reply.replies?.map((nestedReply) => (
                      <div key={nestedReply.id} className="modal-comment-item modal-comment-reply modal-comment-nested">
                        <div className="modal-comment-avatar">
                          {nestedReply.author?.profile?.profilePictureUrl ? (
                            <img src={nestedReply.author.profile.profilePictureUrl} alt={nestedReply.author.firstName} />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div className="modal-comment-content">
                          <div className="modal-comment-header">
                            <span className="modal-comment-username">
                              {nestedReply.author?.firstName?.toLowerCase()}{nestedReply.author?.lastName?.toLowerCase()}
                            </span>
                            <span className="modal-comment-text">{nestedReply.content}</span>
                          </div>
                          <div className="modal-comment-footer">
                            <span className="modal-comment-time">{formatDate(nestedReply.createdAt)}</span>
                            <button
                              type="button"
                              className="modal-comment-reply-btn"
                              onClick={() => setReplyingTo(replyingTo?.id === nestedReply.id ? null : nestedReply)}
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Add Comment */}
        <div className="modal-add-comment-wrapper">
          <div className="modal-add-comment">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={replyingTo ? `Reply to ${replyingTo.author?.firstName || 'comment'}... (type @ to mention)` : 'Add a comment... (type @ to mention)'}
              onKeyPress={(e) => e.key === 'Enter' && !showMentionDropdown && handleComment()}
            />
            {replyingTo && (
              <button
                type="button"
                className="modal-cancel-reply-btn"
                onClick={() => { setReplyingTo(null); setCommentText(''); setMentionedUserIds([]); }}
                aria-label="Cancel reply"
              >
                Cancel
              </button>
            )}
            <button 
              className="modal-post-btn" 
              onClick={handleComment}
              disabled={!commentText.trim()}
            >
              Post
            </button>
          </div>
          {showMentionDropdown && mentionUsers.length > 0 && (
            <div className="mention-dropdown">
              {mentionUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="mention-dropdown-item"
                  onClick={() => handleSelectMention(user)}
                >
                  {user.profilePictureUrl ? (
                    <img src={user.profilePictureUrl} alt="" className="mention-avatar" />
                  ) : (
                    <span className="mention-avatar-placeholder">👤</span>
                  )}
                  <span className="mention-name">{user.fullName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}