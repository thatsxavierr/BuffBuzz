import React from 'react';
import './SharedPostChatCard.css';
import { payloadToPost } from './sharedPostMessageUtils';

export default function SharedPostChatCard({ payload, onOpen }) {
  const post = payloadToPost(payload);
  const thumb = post.imageUrls?.[0] || post.imageUrl;
  const authorName = [post.author.firstName, post.author.lastName].filter(Boolean).join(' ') || 'User';
  const title = (post.title || 'Post').trim() || 'Post';
  const excerpt = (post.content || '').replace(/\s+/g, ' ').trim().slice(0, 90);

  return (
    <button
      type="button"
      className="shared-post-chat-card"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(post);
      }}
    >
      <div className="shared-post-chat-card-thumb">
        {thumb ? (
          <img src={thumb} alt="" />
        ) : (
          <span className="shared-post-chat-card-thumb-fallback">📝</span>
        )}
      </div>
      <div className="shared-post-chat-card-body">
        <span className="shared-post-chat-card-label">Shared post</span>
        <span className="shared-post-chat-card-title">{title}</span>
        <span className="shared-post-chat-card-meta">{authorName}</span>
        {excerpt ? <span className="shared-post-chat-card-excerpt">{excerpt}{post.content?.length > 90 ? '…' : ''}</span> : null}
        <span className="shared-post-chat-card-cta">Tap to open</span>
      </div>
    </button>
  );
}
