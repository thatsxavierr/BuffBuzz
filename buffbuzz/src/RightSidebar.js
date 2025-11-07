import React, { useState } from 'react';
import './RightSidebar.css';

export default function RightSidebar() {
  const [chatExpanded, setChatExpanded] = useState(false);
  const [openChats, setOpenChats] = useState([]);
  const [messages, setMessages] = useState({});
  
  const friends = [
    { id: 1, name: 'Cecil', online: true },
    { id: 2, name: 'Valerie', online: true },
    { id: 3, name: 'Kenton', online: false },
  ];

  const openChat = (friend) => {
    if (!openChats.find(chat => chat.id === friend.id)) {
      setOpenChats([...openChats, friend]);
      if (!messages[friend.id]) {
        setMessages({ ...messages, [friend.id]: [] });
      }
    }
  };

  const closeChat = (friendId) => {
    setOpenChats(openChats.filter(chat => chat.id !== friendId));
  };

  const sendMessage = (friendId, text) => {
    if (text.trim()) {
      setMessages({
        ...messages,
        [friendId]: [...(messages[friendId] || []), { text, sender: 'me', time: new Date() }]
      });
    }
  };

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
            <h3 className="friends-title">Friends</h3>
            {friends.map(friend => (
              <button
                key={friend.id}
                onClick={() => openChat(friend)}
                className="friend-item"
              >
                <div className="friend-avatar-container">
                  <div className="friend-avatar"></div>
                  {friend.online && <div className="online-indicator"></div>}
                </div>
                <div className="friend-info">
                  <p className="friend-name">{friend.name}</p>
                  <p className="friend-status">{friend.online ? 'Online' : 'Offline'}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Chat Boxes */}
      <div className="chat-boxes-container">
        {openChats.map((friend, index) => (
          <ChatBox
            key={friend.id}
            friend={friend}
            messages={messages[friend.id] || []}
            onClose={() => closeChat(friend.id)}
            onSend={(text) => sendMessage(friend.id, text)}
            index={index}
          />
        ))}
      </div>
    </>
  );
}

function ChatBox({ friend, messages, onClose, onSend, index }) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput('');
    }
  };

  return (
    <div className="chat-box" style={{ right: `${16 + (index * 336)}px` }}>
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar"></div>
          <span className="chat-name">{friend.name}</span>
        </div>
        <button onClick={onClose} className="chat-close-button">×</button>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {messages.length === 0 ? (
          <p className="no-messages">No messages yet</p>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.sender === 'me' ? 'message-sent' : 'message-received'}`}>
              <div className="message-bubble">
                <p>{msg.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Chat Input */}
      <div className="chat-input-container">
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
    </div>
  );
}