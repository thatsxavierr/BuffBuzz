export const SHARED_POST_PREFIX = '__BUZZ_SHARED_POST_V1__';

const MAX_CONTENT_CHARS = 8000;
const MAX_IMAGE_URLS = 5;

/**
 * Serialize a feed post into message content (stored as TEXT).
 */
export function serializeSharedPost(post) {
  const rawUrls = post.imageUrls?.length
    ? post.imageUrls
    : post.imageUrl
      ? [post.imageUrl]
      : [];
  const imageUrls = rawUrls.slice(0, MAX_IMAGE_URLS);

  const payload = {
    v: 1,
    postId: post.id,
    title: (post.title || '').slice(0, 500),
    content: (post.content || '').slice(0, MAX_CONTENT_CHARS),
    createdAt: post.createdAt,
    author: post.author
      ? {
          id: post.author.id,
          firstName: post.author.firstName,
          lastName: post.author.lastName,
          profile: post.author.profile
            ? { profilePictureUrl: post.author.profile.profilePictureUrl || null }
            : {}
        }
      : {},
    imageUrls,
    _count: {
      likes: post._count?.likes ?? 0,
      comments: post._count?.comments ?? 0,
      shares: post._count?.shares ?? 0
    }
  };

  return SHARED_POST_PREFIX + JSON.stringify(payload);
}

export function parseSharedPostMessage(content) {
  if (typeof content !== 'string' || !content.startsWith(SHARED_POST_PREFIX)) {
    return null;
  }
  try {
    const payload = JSON.parse(content.slice(SHARED_POST_PREFIX.length));
    if (payload.v !== 1 || !payload.postId) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Shape expected by PostCard */
export function payloadToPost(payload) {
  const imageUrls = payload.imageUrls || [];
  return {
    id: payload.postId,
    title: payload.title || '',
    content: payload.content || '',
    createdAt: payload.createdAt,
    author: {
      id: payload.author?.id,
      firstName: payload.author?.firstName || '',
      lastName: payload.author?.lastName || '',
      profile: payload.author?.profile || {}
    },
    imageUrls: imageUrls.length ? imageUrls : null,
    imageUrl: imageUrls[0] || null,
    _count: payload._count || { likes: 0, comments: 0, shares: 0 },
    isLiked: false
  };
}

export function isSharedPostMessage(content) {
  return parseSharedPostMessage(content) != null;
}

export function getMessagePreviewLine(content) {
  const p = parseSharedPostMessage(content);
  if (p) return '📎 Shared a post';
  if (typeof content !== 'string') return '';
  return content.replace(/\s+/g, ' ').trim().slice(0, 42) || 'Message';
}

export function getReplyPreviewText(content) {
  const p = parseSharedPostMessage(content);
  if (p) return '📎 Shared post';
  if (typeof content !== 'string') return '';
  return content.length > 100 ? `${content.slice(0, 100)}…` : content;
}
