import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreatePost.css';
import Header from './Header.js';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

// Max image size for post uploads (5MB) – users are informed when exceeded
const MAX_POST_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_POST_IMAGE_SIZE_MB = 5;

export default function CreatePost() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [imageError, setImageError] = useState('');
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
    if (!file) return;

    setImageError('');

    if (!file.type.startsWith('image/')) {
      setImageError('Please select an image file (e.g. JPEG, PNG, GIF).');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_POST_IMAGE_SIZE_BYTES) {
      setImageError(`Image is too large. Maximum size is ${MAX_POST_IMAGE_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      setImagePreview(null);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageError('');
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
        const message = data.message || 'Failed to create post';
        if (response.status === 413) {
          setImageError(message);
          setImagePreview(null);
          const fileInput = document.getElementById('create-post-image-input');
          if (fileInput) fileInput.value = '';
        } else {
          alert(message);
        }
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
              <label htmlFor="create-post-image-input">Add Image (Optional)</label>
              <p className="create-post-image-hint">Maximum size: {MAX_POST_IMAGE_SIZE_MB}MB</p>
              {!imagePreview ? (
                <div className="image-upload-area">
                  <input
                    type="file"
                    id="create-post-image-input"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="image-input"
                  />
                  <label htmlFor="create-post-image-input" className="image-upload-label">
                    <span className="upload-icon">📷</span>
                    <span>Click to upload image</span>
                  </label>
                  {imageError && <p className="create-post-image-error" role="alert">{imageError}</p>}
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
