# BuffBuzz Notifications - Implementation Guide

This document describes the notifications feature implemented for BuffBuzz. When a user's post is **liked** or **commented on**, they receive a notification that appears on the Notifications page.

---

## Table of Contents

1. [Overview](#overview)
2. [Files Modified](#files-modified)
3. [Database Schema](#database-schema)
4. [Backend (server.js)](#backend-serverjs)
5. [Frontend (Notifications.js)](#frontend-notificationsjs)
6. [Setup for Teammates](#setup-for-teammates)

---

## Overview

**What was built:**
- Users receive a notification when someone likes their post
- Users receive a notification when someone comments on their post
- Users receive a notification when someone **mentions them** in a comment (type `@` + name to mention)
- Users receive a notification when someone **replies to their comment**
- **All users except the owner** receive a notification when a new **marketplace listing** is created
- **All users except the owner** receive a notification when a new **lost & found listing** is created
- Notifications appear on the Notifications page (`/notifications`)
- Users can mark notifications as read, mark all as read, and delete individual notifications
- No notification is created when a user likes or comments on their **own** post
- No mention notification for the post author (they already get a "comment" notification)
- No reply notification when replying to your own comment
- New marketplace and lost & found listings notify all users except the creator

---

## Files Modified

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added `Notification` model; `commentId`, `marketplaceItemId`, `lostFoundItemId` to Notification; `parentId` and replies on Comment |
| `server.js` | Added notification API endpoints; modified like and comment endpoints; added mention and reply notification logic; added `POST /api/comments/:commentId/reply` |
| `buffbuzz/src/Notifications.js` | Added "Mentions", "Replies", "Marketplace", "Lost & Found" filter buttons; icons for all types |
| `buffbuzz/src/Notifications.css` | No changes |
| `buffbuzz/src/CommentModel.js` | Added @mention UI; added Reply button and nested reply UI |
| `buffbuzz/src/CommentModel.css` | Added styles for mention dropdown, reply button, nested replies |

---

## Database Schema

### New Model: `Notification`

**File:** `prisma/schema.prisma`

```prisma
model Notification {
  id          String   @id @default(uuid())
  recipientId String
  actorId     String
  type        String   // 'like', 'comment', etc.
  postId      String?
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())

  recipient   User     @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor       User     @relation("NotificationActor", fields: [actorId], references: [id], onDelete: Cascade)

  @@index([recipientId])
  @@index([createdAt])
  @@map("notifications")
}
```

**Field explanations:**

| Field | Meaning |
|-------|---------|
| `recipientId` | The user who receives the notification (the post author) |
| `actorId` | The user who performed the action (who liked or commented) |
| `type` | `'like'`, `'comment'`, `'mention'`, `'reply'`, `'marketplace_listing'`, `'lostfound_listing'` — identifies the notification type |
| `postId` | The post that was liked, commented on, or replied in (for future "view post" linking) |
| `commentId` | The comment that was replied to (for "reply" type notifications) |
| `marketplaceItemId` | The marketplace listing (for "marketplace_listing" type) |
| `lostFoundItemId` | The lost & found item (for "lostfound_listing" type) |
| `read` | Whether the user has seen the notification |
| `recipient` | Prisma relation to the User who receives the notification |
| `actor` | Prisma relation to the User who performed the action |

### User Model Additions

```prisma
notificationsReceived   Notification[]  @relation("NotificationRecipient")
notificationsSent      Notification[]  @relation("NotificationActor")
```

- `notificationsReceived` — notifications where this user is the recipient
- `notificationsSent` — notifications where this user is the actor (who liked/commented)

---

## Backend (server.js)

### 1. Create Notification on Like

**Location:** Inside `POST /api/posts/:postId/like`

```javascript
// Create notification for post author (don't notify if they liked their own post)
if (post.authorId !== userId) {
  await prisma.notification.create({
    data: {
      recipientId: post.authorId,
      actorId: userId,
      type: 'like',
      postId
    }
  });
}
```

**Explanation:**
- `post.authorId !== userId` — Only create a notification if the liker is not the post author. No self-notifications.
- `recipientId: post.authorId` — The post author gets the notification.
- `actorId: userId` — The person who clicked like.
- `type: 'like'` — Used by the frontend to show the correct icon and message.
- `postId` — Stored so we can link to the post later (e.g., "View post").

---

### 2. Create Notification on Comment

**Location:** Inside `POST /api/posts/:postId/comment`

```javascript
// Create notification for post author (don't notify if they commented on their own post)
if (post.authorId !== userId) {
  await prisma.notification.create({
    data: {
      recipientId: post.authorId,
      actorId: userId,
      type: 'comment',
      postId
    }
  });
}
```

**Explanation:** Same logic as likes — notify the post author only when someone else comments.

---

### 3. Create Notification on Mention

**Location:** Inside `POST /api/posts/:postId/comment` (after comment notification)

```javascript
// Create mention notifications for each mentioned user
const mentionedIds = Array.isArray(mentionedUserIds) ? [...new Set(mentionedUserIds)].filter(Boolean) : [];
for (const mentionedId of mentionedIds) {
  if (mentionedId === userId) continue; // Don't notify yourself
  if (mentionedId === post.authorId) continue; // Post author already gets "comment" notification
  await prisma.notification.create({
    data: {
      recipientId: mentionedId,
      actorId: userId,
      type: 'mention',
      postId
    }
  });
}
```

**Explanation:**
- `mentionedUserIds` — Optional array sent from the frontend when the user types `@Name` and selects someone from the dropdown.
- `[...new Set(mentionedUserIds)]` — Removes duplicate IDs.
- `mentionedId === userId` — Skips if the commenter mentions themselves.
- `mentionedId === post.authorId` — Skips if the post author is mentioned (they already get a "comment" notification).

---

### 4. Create Notification on Reply

**Endpoint:** `POST /api/comments/:commentId/reply`

When a user replies to a comment, the comment owner receives a notification:

```javascript
// Create notification for comment owner (don't notify if replying to your own comment)
if (parentComment.authorId !== userId) {
  await prisma.notification.create({
    data: {
      recipientId: parentComment.authorId,
      actorId: userId,
      type: 'reply',
      postId: parentComment.postId,
      commentId
    }
  });
}
```

**Explanation:**
- `parentComment.authorId` — The user who wrote the comment being replied to.
- `commentId` — The comment that was replied to (stored for future "view comment" linking).
- No notification when replying to your own comment.

---

### 5. Get Notifications

**Endpoint:** `GET /api/notifications/:userId`

```javascript
const notifications = await prisma.notification.findMany({
  where: { recipientId: userId },
  include: {
    actor: {
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    }
  },
  orderBy: { createdAt: 'desc' }
});

const formatted = notifications.map(n => ({
  id: n.id,
  type: n.type,
  read: n.read,
  postId: n.postId,
  createdAt: n.createdAt,
  userName: `${n.actor.firstName} ${n.actor.lastName}`,
  message: n.type === 'like' ? 'liked your post' : n.type === 'comment' ? 'commented on your post' : n.type
}));

res.status(200).json({ notifications: formatted });
```

**Explanation:**
- `where: { recipientId: userId }` — Only fetch notifications for this user.
- `include: { actor: ... }` — Load the actor's name for display.
- `orderBy: { createdAt: 'desc' }` — Newest first.
- `formatted` — Shapes the response for the frontend: `userName` (actor's name) and `message` (e.g., "liked your post", "commented on your post", "mentioned you in a comment", "replied to your comment").

---

### 6. Mark Notification as Read

**Endpoint:** `PUT /api/notifications/:notificationId/read`

```javascript
await prisma.notification.update({
  where: { id: notificationId },
  data: { read: true }
});
```

**Explanation:** Sets `read` to `true` for the given notification.

---

### 7. Mark All as Read

**Endpoint:** `PUT /api/notifications/:userId/read-all`

```javascript
await prisma.notification.updateMany({
  where: { recipientId: userId },
  data: { read: true }
});
```

**Explanation:** Marks every notification for that user as read.

---

### 8. Delete a Notification

**Endpoint:** `DELETE /api/notifications/:notificationId`

```javascript
await prisma.notification.delete({
  where: { id: notificationId }
});
```

**Explanation:** Removes the notification from the database.

---

## Frontend (Notifications.js)

The Notifications page was already implemented and works with the new API. Key parts:

### Fetching Notifications

```javascript
const fetchNotifications = async (userId) => {
  const response = await fetch(`http://localhost:5000/api/notifications/${userId}`);
  if (response.ok) {
    const data = await response.json();
    setNotifications(data.notifications || []);
  }
};
```

Calls `GET /api/notifications/:userId` and stores the result in state.

### Expected Data Shape

Each notification from the API has:
- `id` — Notification ID
- `type` — `'like'` or `'comment'`
- `read` — Boolean
- `postId` — Post ID (for future use)
- `createdAt` — Timestamp
- `userName` — Actor's full name (e.g., "John Doe")
- `message` — Human-readable text (e.g., "liked your post", "mentioned you in a comment", "replied to your comment")

### Filtering

```javascript
const filteredNotifications = notifications.filter(notification => {
  if (filter === 'all') return true;
  if (filter === 'unread') return !notification.read;
  return notification.type === filter;
});
```

- **All** — Show every notification
- **Unread** — Only unread
- **Likes** / **Comments** / **Mentions** / **Replies** / **Marketplace** / **Lost & Found** — Filter by `type`

### Icons

```javascript
const getNotificationIcon = (type) => {
  const icons = {
    like: '❤️',
    comment: '💬',
    // ... other types for future use
  };
  return icons[type] || '🔔';
};
```

Maps `type` to an emoji for display.

---

## Setup for Teammates

After pulling the code, run:

```bash
# 1. Install dependencies (if needed)
npm install

# 2. Sync database schema (creates the notifications table)
npx prisma db push

# 3. Restart the backend server
npm start
```

The `notifications` table must exist for the feature to work. `npx prisma db push` applies the schema changes to the database.

---

## API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications/:userId` | Get all notifications for a user |
| PUT | `/api/notifications/:notificationId/read` | Mark one notification as read |
| PUT | `/api/notifications/:userId/read-all` | Mark all notifications as read |
| DELETE | `/api/notifications/:notificationId` | Delete a notification |
| POST | `/api/comments/:commentId/reply` | Reply to a comment (creates reply notification) |

---

## Mention Feature (CommentModel.js)

When adding a comment, users can type `@` followed by a name to mention another user:

1. Type `@` and then start typing a name (e.g., `@John`).
2. A dropdown appears with matching users from the search API.
3. Click a user to insert their full name (e.g., `@John Doe`) and add them to the mention list.
4. When the comment is posted, `mentionedUserIds` is sent to the backend.
5. Each mentioned user receives a "mentioned you in a comment" notification.

---

## Reply Feature

Users can reply to comments (and replies) on a post:

1. Click **Reply** on any comment or reply.
2. The input shows "Reply to [name]..." and a **Cancel** button appears.
3. Type your reply (supports @mentions).
4. Click **Post** or press Enter.
5. The comment owner receives a "replied to your comment" notification.

**API:** `POST /api/comments/:commentId/reply` — Creates a reply with `parentId` set to the comment being replied to. Supports nested replies (reply to a reply).

**Schema:** Comments have optional `parentId`; replies are nested under their parent. Notifications have optional `commentId` for reply-type notifications.

---

## New Listing Notifications (Marketplace & Lost & Found)

When a user creates a new marketplace listing or lost & found item, **all other users** receive a notification:

- **Marketplace:** "X listed a new item for sale" — notifies everyone except the seller
- **Lost & Found:** "X posted a new lost & found item" — notifies everyone except the poster

**Implementation:** After creating the item, the server fetches all user IDs except the owner and uses `prisma.notification.createMany()` to create one notification per user. The notification stores `marketplaceItemId` or `lostFoundItemId` for future "view listing" linking.

---

## Future Enhancements

Possible additions:
- Click notification to navigate to the post
- Notification preferences (e.g., turn off like notifications)
- Real-time notifications (WebSockets)
- Notifications for follows, shares
