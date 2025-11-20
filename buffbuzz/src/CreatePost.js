import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreatePost.css';
import Header from './Header.js';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

export default function CreatePost() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get user with session validation (checks expiration)
    const userData = getValidUser();
    
    if (!userData) {
      // Redirect to login if not logged in or session expired
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
    }
  }, [navigate]);

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

  const handleBackClick = () => {
    navigate('/main');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      alert('You must be logged in to create a post');
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          imageUrl: imagePreview,
          authorId: user.id
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Post created successfully!');
        navigate('/main');
      } else {
        alert(data.message || 'Failed to create post');
      }
    } catch (error) {
      console.error('Create post error:', error);
      alert('An error occurred while creating the post');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/main');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="create-post-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />
      
      <div className="create-post-container">
        <div className="create-post-box">
          <h2 className="create-post-title">Create New Post</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title..."
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Content</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind?"
                rows="8"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="image">Add Image (Optional)</label>
              {!imagePreview ? (
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="image-input"
                  />
                  <label htmlFor="image" className="image-upload-label">
                    <span className="upload-icon">📷</span>
                    <span>Click to upload image</span>
                  </label>
                </div>
              ) : (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" className="image-preview" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="remove-image-button"
                  >
                    Remove Image
                  </button>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                onClick={handleCancel} 
                className="cancel-button"
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="submit-button"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Post'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}
