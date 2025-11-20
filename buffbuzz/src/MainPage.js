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

  useEffect(() => {
    // Check if user has a valid session (not expired)
    const userData = location.state?.user || getValidUser();
    
    if (!userData) {
      // Redirect to login if not logged in or session expired
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
      fetchPosts(userData.id);
    }
  }, [navigate, location]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profilePictureUrl) {
          setProfilePicture(data.profile.profilePictureUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const fetchPosts = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/posts?userId=${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
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
                />
              ))
            )}
          </div>
        </div>
        
        <RightSidebar />
      </div>
      <Footer />
    </div>
  );
}
