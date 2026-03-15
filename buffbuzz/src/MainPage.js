import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './MainPage.css';
import Header from './Header.js';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import Footer from './Footer';
import PostCard from './PostCard';
import { getValidUser } from './sessionUtils';

export default function MainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friendIds, setFriendIds] = useState(new Set());

  useEffect(() => {
    const userData = location.state?.user || getValidUser();
    
    if (!userData) {
      navigate('/login');
    } else {
      setUser(userData);
      // Run fetches in parallel instead of sequentially
      Promise.all([
        fetch(`http://localhost:5000/api/profile/${userData.id}`).then(r => r.ok ? r.json() : null),
        fetch(`http://localhost:5000/api/posts?userId=${userData.id}`).then(r => r.ok ? r.json() : null),
        fetch(`http://localhost:5000/api/friends/${userData.id}`).then(r => r.ok ? r.json() : null)
      ]).then(([profileRes, postsRes, friendsRes]) => {
        if (profileRes?.profile?.profilePictureUrl) setProfilePicture(profileRes.profile.profilePictureUrl);
        if (postsRes?.posts) setPosts(postsRes.posts);
        if (friendsRes?.friends) setFriendIds(new Set(friendsRes.friends.map(f => f.id)));
      }).catch(err => console.error('Fetch error:', err)).finally(() => setLoading(false));
    }
  }, [navigate, location]);

  const handlePostDelete = (postId) => {
    setPosts(posts.filter(post => post.id !== postId));
  };

  const handlePostUpdate = (updatedPost) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handleBackClick = () => {
    navigate('/');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="main-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />
      
      <div className="main-body">
        <LeftSidebar />
        
        <div className="main-content">
          <div className="main-content-feed">
          <button 
            onClick={() => navigate('/create-post')} 
            className="create-post-button"
          >
            + Create New Post
          </button>
          
          {/* Posts Feed */}
          <div className="posts-feed">
            {loading ? (
              <div className="loading-posts">Loading posts...</div>
            ) : posts.length === 0 ? (
              <div className="no-posts">
                <h3>No posts yet</h3>
                <p>Be the first to share something!</p>
              </div>
            ) : (
              posts.map(post => (
                <PostCard 
                  key={post.id} 
                  post={post} 
                  currentUserId={user.id}
                  onDelete={handlePostDelete}
                  onUpdate={handlePostUpdate}
                  friendIds={friendIds}
                />
              ))
            )}
          </div>
          </div>
        </div>
        
        <RightSidebar initialOpenChat={location.state?.openChatWithUser} initialOpenConversationId={location.state?.openConversationId} />
      </div>
      <Footer />
    </div>
  );
}