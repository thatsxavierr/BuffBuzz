import React, { useState, useEffect } from 'react';
import './RightSidebar.css';
import { getValidUser } from './sessionUtils';

export default function RightSidebar() {
  const [chatExpanded, setChatExpanded] = useState(false);
  const [openChats, setOpenChats] = useState([]);
  const [friends, setFriends] = useState([]);
  const [conversations, setConversations] = useState({});
  const [showGroupChatModal, setShowGroupChatModal] = useState(false);
  const [allConversations, setAllConversations] = useState([]);
  const user = getValidUser();

  const [loading, setLoading] = useState(true); // ADD this state

useEffect(() => {
  if (user) {
    fetchFriends();
    fetchAllConversations(); // Fetch groups on load
  }
}, [user]);

  const fetchFriends = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/friends/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setFriends(data.friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const fetchAllConversations = async () => {
  try {
    const response = await fetch(`http://localhost:5000/api/conversations/${user.id}`);
    if (response.ok) {
      const data = await response.json();
      setAllConversations(data.conversations || []);
      setLoading(false);
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
    setLoading(false);
  }
};

const openConversation = async (conversation) => {
  // Check if already open
  if (openChats.find(chat => chat.id === conversation.id)) {
    return;
  }

  // Create a chat object
  let chatInfo;
  if (conversation.isGroupChat) {
    // Group chat
    chatInfo = {
      id: conversation.id,
      firstName: conversation.name,
      lastName: '',
      isGroup: true,
      profile: conversation.imageUrl ? { profilePictureUrl: conversation.imageUrl } : null
    };
  } else {
    // Direct chat - find the other participant
    const otherParticipant = conversation.participants.find(p => p.userId !== user.id);
    if (!otherParticipant) return;
    
    chatInfo = {
      id: otherParticipant.user.id,
      firstName: otherParticipant.user.firstName,
      lastName: otherParticipant.user.lastName,
      profile: otherParticipant.user.profile
    };
  }

  // Add to open chats
  setOpenChats(prev => [...prev, chatInfo]);
  
  // Use conversation.id for group chats, user.id for direct chats
  const chatKey = conversation.isGroupChat ? conversation.id : chatInfo.id;
  
  // Fetch messages
  await fetchMessages(conversation.id, chatKey);
};

  const openChat = async (friend) => {
  // Check if chat is already open
  if (openChats.find(chat => chat.id === friend.id)) {
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/api/conversations/get-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        otherUserId: friend.id
      })
    });

    if (response.ok) {
      const data = await response.json();
      const conversation = data.conversation;
      
      // Add friend to open chats first
      setOpenChats(prev => [...prev, friend]);
      
      // Fetch messages (this will set the conversation with messages)
      await fetchMessages(conversation.id, friend.id);
    }
  } catch (error) {
    console.error('Error opening chat:', error);
  }
};

  const fetchMessages = async (conversationId, friendId) => {
  console.log('Fetching messages for:', { conversationId, friendId });
  try {
    const response = await fetch(`http://localhost:5000/api/conversations/${conversationId}/messages`);
    if (response.ok) {
      const data = await response.json();
      console.log('Messages received:', data.messages?.length || 0);
      
      // Update conversation with messages AND participant data
      setConversations(prev => {
        const existingConv = prev[friendId] || {};
        return {
          ...prev,
          [friendId]: {
            ...existingConv,
            id: conversationId,
            ...(data.conversation || {}),
            messages: data.messages || []
          }
        };
      });
      
      // Mark messages as read
      markAsRead(conversationId);
    }
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
};

  const markAsRead = async (conversationId) => {
    try {
      await fetch(`http://localhost:5000/api/conversations/${conversationId}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const closeChat = (friendId) => {
    setOpenChats(openChats.filter(chat => chat.id !== friendId));
  };

  const sendMessage = async (friendId, text, imageUrl = null, replyToId = null) => {
  if (!text.trim() && !imageUrl) return;

  const conversation = conversations[friendId];
  if (!conversation) {
    console.error('No conversation found for friend:', friendId);
    return;
  }

  try {
    const response = await fetch('http://localhost:5000/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: conversation.id,
        senderId: user.id,
        content: text,
        type: imageUrl ? 'IMAGE' : 'TEXT',
        imageUrl: imageUrl,
        replyToId: replyToId
      })
    });

    if (response.ok) {
      const data = await response.json();
      
      // Add message to existing messages
      setConversations(prev => ({
        ...prev,
        [friendId]: {
          ...prev[friendId],
          messages: [...(prev[friendId]?.messages || []), data.message]
        }
      }));
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

  const editMessage = async (friendId, messageId, newContent) => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${messageId}/edit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          content: newContent
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        setConversations(prev => ({
          ...prev,
          [friendId]: {
            ...prev[friendId],
            messages: prev[friendId].messages.map(msg => 
              msg.id === messageId ? data.message : msg
            )
          }
        }));
      }
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  const deleteMessage = async (friendId, messageId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      if (response.ok) {
        setConversations(prev => ({
          ...prev,
          [friendId]: {
            ...prev[friendId],
            messages: prev[friendId].messages.filter(msg => msg.id !== messageId)
          }
        }));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const createGroupChat = async (groupName, selectedFriendIds, imageUrl) => {
  try {
    const response = await fetch('http://localhost:5000/api/conversations/group/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorId: user.id,
        name: groupName,
        participantIds: selectedFriendIds,
        imageUrl: imageUrl
      })
    });

    if (response.ok) {
      const data = await response.json();
      alert('Group chat created successfully!');
      setShowGroupChatModal(false);
      
      // Create group info object
      const groupInfo = {
        id: data.conversation.id,
        firstName: groupName,
        lastName: '',
        isGroup: true,
        profile: imageUrl ? { profilePictureUrl: imageUrl } : null
      };
      
      // Add conversation with empty messages first
      setConversations(prev => ({
        ...prev,
        [data.conversation.id]: {
          ...data.conversation,
          messages: []
        }
      }));
      
      // Open the group chat
      setOpenChats(prev => [...prev, groupInfo]);
      
      // Fetch messages
      await fetchMessages(data.conversation.id, data.conversation.id);
    }
  } catch (error) {
    console.error('Error creating group chat:', error);
    alert('Failed to create group chat');
  }
};

  const reactToMessage = async (friendId, messageId, emoji) => {
  try {
    const response = await fetch(`http://localhost:5000/api/messages/${messageId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: user.id,
        emoji: emoji
      })
    });

    if (response.ok) {
      const data = await response.json();
      
      // Update the message reactions locally without refetching all messages
      setConversations(prev => ({
        ...prev,
        [friendId]: {
          ...prev[friendId],
          messages: prev[friendId].messages.map(msg => {
            if (msg.id === messageId) {
              // Get current reactions
              const currentReactions = msg.reactions || [];
              
              // Check if user already reacted
              const userReactionIndex = currentReactions.findIndex(r => r.userId === user.id);
              
              if (data.message === 'Reaction removed') {
                // Remove user's reaction
                return {
                  ...msg,
                  reactions: currentReactions.filter(r => r.userId !== user.id)
                };
              } else if (userReactionIndex >= 0) {
                // Update existing reaction
                const updatedReactions = [...currentReactions];
                updatedReactions[userReactionIndex] = {
                  ...data.reaction,
                  user: {
                    id: user.id,
                    firstName: user.firstName,
                    lastName: user.lastName
                  }
                };
                return {
                  ...msg,
                  reactions: updatedReactions
                };
              } else {
                // Add new reaction
                return {
                  ...msg,
                  reactions: [
                    ...currentReactions,
                    {
                      ...data.reaction,
                      user: {
                        id: user.id,
                        firstName: user.firstName,
                        lastName: user.lastName
                      }
                    }
                  ]
                };
              }
            }
            return msg;
          })
        }
      }));
    }
  } catch (error) {
    console.error('Error reacting to message:', error);
  }
};



  if (!user) return null;

  return (
    <>
      <aside className="right-sidebar">
        <button
          onClick={() => setChatExpanded(!chatExpanded)}
          className="chat-toggle-button"
        >
          <span>Messages</span>
          <span className="chat-icon">💬</span>
        </button>

        {chatExpanded && (
  <div className="friends-list">
    <div className="friends-header">
      <h3 className="friends-title">Messages</h3>
      <button 
        className="create-group-btn"
        onClick={() => setShowGroupChatModal(true)}
        title="Create group chat"
      >
        👥+
      </button>
    </div>

    {/* Combined list of friends and groups */}
    {loading ? (
      <p className="no-friends">Loading...</p>
    ) : (
      <>
        {/* Show Groups First */}
        {allConversations.filter(conv => conv.isGroupChat).map(conv => (
          <button
            key={conv.id}
            onClick={() => openConversation(conv)}
            className="friend-item"
          >
            <div className="friend-avatar-container">
              {conv.imageUrl ? (
                <img 
                  src={conv.imageUrl} 
                  alt={conv.name}
                  className="friend-avatar"
                />
              ) : (
                <div className="friend-avatar" style={{ 
                  background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}>
                  👥
                </div>
              )}
              {conv.unreadCount > 0 && (
                <div className="unread-badge">{conv.unreadCount}</div>
              )}
            </div>
            <div className="friend-info">
              <p className="friend-name">{conv.name}</p>
              <p className="friend-status">
                {conv.messages?.[0]?.content?.substring(0, 30) || 'No messages yet'}
              </p>
            </div>
          </button>
        ))}

        {/* Then Show Friends */}
        {friends.length === 0 && allConversations.filter(conv => conv.isGroupChat).length === 0 ? (
          <p className="no-friends">No friends or groups yet</p>
        ) : (
          friends.map(friend => (
            <button
              key={friend.id}
              onClick={() => openChat(friend)}
              className="friend-item"
            >
              <div className="friend-avatar-container">
                {friend.profile?.profilePictureUrl ? (
                  <img 
                    src={friend.profile.profilePictureUrl} 
                    alt={friend.firstName}
                    className="friend-avatar"
                  />
                ) : (
                  <div className="friend-avatar"></div>
                )}
                <div className="online-indicator"></div>
              </div>
              <div className="friend-info">
                <p className="friend-name">{friend.firstName} {friend.lastName}</p>
                <p className="friend-status">Online</p>
              </div>
            </button>
          ))
        )}
      </>
    )}
  </div>
)}
      </aside>

      {/* Chat Boxes */}
      <div className="chat-boxes-container">
        {openChats.map((friend, index) => (
          <ChatBox
            key={friend.id}
            friend={friend}
            conversation={conversations[friend.id]}
            messages={conversations[friend.id]?.messages || []}
            onClose={() => closeChat(friend.id)}
            onSend={(text, imageUrl, replyToId) => sendMessage(friend.id, text, imageUrl, replyToId)}
            onEdit={(messageId, newContent) => editMessage(friend.id, messageId, newContent)}
            onDelete={(messageId) => deleteMessage(friend.id, messageId)}
            onReact={(messageId, emoji) => reactToMessage(friend.id, messageId, emoji)}
            currentUserId={user.id}
            index={index}
          />
        ))}
      </div>

      {/* Group Chat Modal */}
      {showGroupChatModal && (
        <GroupChatModal 
          friends={friends}
          onClose={() => setShowGroupChatModal(false)}
          onCreate={createGroupChat}
        />
      )}
    </>
  );
}

// Group Chat Modal Component
function GroupChatModal({ friends, onClose, onCreate }) {
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [groupImage, setGroupImage] = useState(null);

  const toggleFriend = (friendId) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }
    if (selectedFriends.length === 0) {
      alert('Please select at least one friend');
      return;
    }
    onCreate(groupName, selectedFriends, groupImage);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content group-chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Group Chat</h2>
          <button className="close-modal" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Group Name *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="group-name-input"
            />
          </div>

          <div className="form-group">
            <label>Group Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="file-input"
            />
            {groupImage && (
              <div className="image-preview-small">
                <img src={groupImage} alt="Preview" />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Select Friends ({selectedFriends.length} selected)</label>
            <div className="friends-selection-list">
              {friends.map(friend => (
                <div 
                  key={friend.id}
                  className={`friend-select-item ${selectedFriends.includes(friend.id) ? 'selected' : ''}`}
                  onClick={() => toggleFriend(friend.id)}
                >
                  {friend.profile?.profilePictureUrl ? (
                    <img 
                      src={friend.profile.profilePictureUrl} 
                      alt={friend.firstName}
                      className="friend-select-avatar"
                    />
                  ) : (
                    <div className="friend-select-avatar"></div>
                  )}
                  <span className="friend-select-name">
                    {friend.firstName} {friend.lastName}
                  </span>
                  {selectedFriends.includes(friend.id) && (
                    <span className="checkmark">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="submit-btn" onClick={handleCreate}>Create Group</button>
        </div>
      </div>
    </div>
  );
}

// Chat Box Component (continued in next message due to length...)
function ChatBox({ friend, conversation, messages, onClose, onSend, onEdit, onDelete, onReact, currentUserId, index }) {
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingContent, setEditingContent] = useState('');
  const [showReactions, setShowReactions] = useState(null);
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = () => {
    if (input.trim() || imagePreview) {
      onSend(input || 'Sent an image', imagePreview, replyTo?.id);
      setInput('');
      setImagePreview(null);
      setReplyTo(null);
    }
  };

  const handleReply = (message) => {
    setReplyTo(message);
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const startEditing = (message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const saveEdit = (messageId) => {
    if (editingContent.trim()) {
      onEdit(messageId, editingContent);
      setEditingMessageId(null);
      setEditingContent('');
    }
  };

  const handleReaction = (messageId, emoji) => {
    onReact(messageId, emoji);
    setShowReactions(null);
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getReactionSummary = (reactions) => {
    if (!reactions || reactions.length === 0) return null;
    
    const emojiCounts = {};
    reactions.forEach(reaction => {
      emojiCounts[reaction.emoji] = (emojiCounts[reaction.emoji] || 0) + 1;
    });
    
    return Object.entries(emojiCounts).map(([emoji, count]) => ({
      emoji,
      count,
      users: reactions.filter(r => r.emoji === emoji).map(r => r.user)
    }));
  };

  const reactions = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

  const handleLeaveGroup = async () => {
  if (!window.confirm('Are you sure you want to leave this group?')) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/conversations/${conversation.id}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });

    if (response.ok) {
      alert('You have left the group');
      onClose(); // Close the chat
      window.location.reload();
    } else {
      const data = await response.json();
      alert(data.message || 'Failed to leave group');
    }
  } catch (error) {
    console.error('Error leaving group:', error);
    alert('An error occurred while leaving the group');
  }
};

const handleDeleteGroup = async () => {
  if (!window.confirm('Are you sure you want to delete this group? This action cannot be undone and will remove the group for all members.')) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/conversations/${conversation.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId })
    });

    if (response.ok) {
      alert('Group deleted successfully');
      onClose(); // Close the chat
      window.location.reload();
    } else {
      const data = await response.json();
      alert(data.message || 'Failed to delete group');
    }
  } catch (error) {
    console.error('Error deleting group:', error);
    alert('An error occurred while deleting the group');
  }
};


  return (
    <div className="chat-box" style={{ right: `${16 + (index * 336)}px` }}>
      {/* Chat Header */}
      <div className="chat-header">
  <div className="chat-header-info">
    {friend.profile?.profilePictureUrl ? (
      <img 
        src={friend.profile.profilePictureUrl} 
        alt={friend.firstName}
        className="chat-avatar"
      />
    ) : (
      <div className="chat-avatar"></div>
    )}
    <span className="chat-name">
      {friend.firstName} {friend.lastName}
      {friend.isGroup && ' (Group)'}
    </span>
  </div>
  <div className="chat-header-actions">
    {friend.isGroup && conversation && (
      <>
        <button 
          onClick={() => handleLeaveGroup()}
          className="chat-action-btn"
          title="Leave group"
        >
          🚪
        </button>
        {/* Only show delete button if user is the creator */}
        {conversation.creatorId === currentUserId && (
          <button 
            onClick={() => handleDeleteGroup()}
            className="chat-action-btn"
            title="Delete group"
          >
          🗑️
        </button>
        )}
      </>
    )}
    <button onClick={onClose} className="chat-close-button">×</button>
  </div>
</div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <p className="no-messages">No messages yet. Say hi! 👋</p>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`message ${msg.senderId === currentUserId ? 'message-sent' : 'message-received'}`}
            >
              {/* Reply Preview */}
              {msg.replyTo && (
                <div className="reply-preview">
                  <div className="reply-line"></div>
                  <div className="reply-content">
                    <span className="reply-sender">{msg.replyTo.sender.firstName}</span>
                    <span className="reply-text">{msg.replyTo.content}</span>
                  </div>
                </div>
              )}
              
              <div className="message-bubble">
                {msg.type === 'IMAGE' && msg.imageUrl && (
                  <img 
                    src={msg.imageUrl} 
                    alt="Shared image" 
                    className="message-image"
                    onClick={() => setEnlargedImage(msg.imageUrl)}
                  />
                )}
                
                {/* Editing Mode */}
                {editingMessageId === msg.id ? (
                  <div className="edit-message-container">
                    <input
                      type="text"
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="edit-message-input"
                      autoFocus
                    />
                    <div className="edit-actions">
                      <button onClick={cancelEditing} className="edit-cancel-btn">Cancel</button>
                      <button onClick={() => saveEdit(msg.id)} className="edit-save-btn">Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p>{msg.content}</p>
                    {msg.editedAt && (
                      <span className="edited-badge">(edited)</span>
                    )}
                  </>
                )}
                
                <span className="message-time">{formatTime(msg.createdAt)}</span>
                
                {/* Read Receipt */}
                {msg.senderId === currentUserId && (
                  <span className="read-receipt" title={
                    conversation?.participants?.find(p => 
                      p.userId !== currentUserId && 
                      p.lastReadAt && 
                      new Date(p.lastReadAt) >= new Date(msg.createdAt)
                    ) ? 'Seen' : 'Delivered'
                  }>
                    {conversation?.participants?.find(p => 
                      p.userId !== currentUserId && 
                      p.lastReadAt && 
                      new Date(p.lastReadAt) >= new Date(msg.createdAt)
                    ) ? (
                      <span style={{ color: '#10b981' }}>✓✓</span>
                    ) : (
                      <span style={{ opacity: 0.5 }}>✓✓</span>
                    )}
                  </span>
                )}
                
                {/* Reactions Summary */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="reactions-summary">
                    {getReactionSummary(msg.reactions)?.map((reaction, idx) => (
                      <span 
                        key={idx} 
                        className="reaction-item"
                        title={reaction.users.map(u => u.firstName).join(', ')}
                      >
                        {reaction.emoji} {reaction.count}
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Message Actions */}
                {!editingMessageId && (
                  <div className="message-actions">
                    <button 
                      onClick={() => setShowReactions(msg.id)}
                      className="message-action-btn"
                      title="React"
                    >
                      😀
                    </button>
                    <button 
                      onClick={() => handleReply(msg)}
                      className="message-action-btn"
                      title="Reply"
                    >
                      ↩️
                    </button>
                    {msg.senderId === currentUserId && (
                      <>
                        <button 
                          onClick={() => startEditing(msg)}
                          className="message-action-btn"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => onDelete(msg.id)}
                          className="message-action-btn"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                )}
                
                {/* Reaction Picker */}
                {showReactions === msg.id && (
                  <div className="reaction-picker">
                    {reactions.map((emoji, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className="reaction-emoji-btn"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview in Input */}
      {replyTo && (
        <div className="replying-to">
          <div className="replying-to-content">
            <span className="replying-label">Replying to {replyTo.sender.firstName}:</span>
            <span className="replying-text">{replyTo.content}</span>
          </div>
          <button onClick={cancelReply} className="cancel-reply">×</button>
        </div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="image-preview-container">
          <img src={imagePreview} alt="Preview" className="image-preview" />
          <button onClick={() => setImagePreview(null)} className="remove-image">×</button>
        </div>
      )}

      {/* Chat Input */}
      <div className="chat-input-container">
        <label htmlFor={`image-upload-${friend.id}`} className="image-upload-btn">
          📎
        </label>
        <input
          type="file"
          id={`image-upload-${friend.id}`}
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="chat-input"
        />
        <button onClick={handleSend} className="chat-send-button">
          ➤
        </button>
      </div>

      {/* Image Modal */}
      {enlargedImage && (
        <div className="image-modal-overlay" onClick={() => setEnlargedImage(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-image-modal" onClick={() => setEnlargedImage(null)}>
              ×
            </button>
            <img src={enlargedImage} alt="Enlarged view" className="enlarged-image" />
          </div>
        </div>
      )}
    </div>
  );
}