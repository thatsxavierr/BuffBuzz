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
    // Check if user has a valid session (not expired)
    const userData = location.state?.user || getValidUser();
    
    if (!userData) {
      // Redirect to login if not logged in or session expired
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
      fetchPosts(userData.id);
      fetchFriends(userData.id);
    }
  }, [navigate, location]);

  const [searchResults, setSearchResults] = useState([]);
const [searching, setSearching] = useState(false);

const handleSearch = async (query) => {
  if (!query.trim()) {
    setSearchResults([]);
    return;
  }

  setSearching(true);

  try {
    const res = await fetch(`http://localhost:5000/api/search?q=${query}`);
    const data = await res.json();
    setSearchResults(data.users);
  } catch (err) {
    console.error("Search error:", err);
  }

  setSearching(false);
};


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

  const fetchFriends = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/friends/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        // Create a Set of friend IDs for quick lookup
        const friendIdSet = new Set(data.friends.map(friend => friend.id));
        setFriendIds(friendIdSet);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  const handlePostDelete = (postId) => {
    // Remove the deleted post from the posts array
    setPosts(posts.filter(post => post.id !== postId));
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
                  friendIds={friendIds}
                />
              ))
            )}
            </div>
          </div>
        </div>
        
        <RightSidebar />
      </div>
      <Footer />
    </div>
  );
}
