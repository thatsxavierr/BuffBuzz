import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreatePost.css';
import Header from './Header.js';
import Footer from './Footer';

export default function CreatePost() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get user from localStorage
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!userData) {
      // Redirect to login if not logged in
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
    }
  }, [navigate]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/profile/${userId}`);
      
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

  const hasUnsavedChanges = () => {
    return !!(title?.trim() || content?.trim() || imagePreviews.length > 0);
  };

  const handleBackClick = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your post will not be saved.')) {
      return;
    }
    navigate('/main');
  };

  const handleCancel = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your post will not be saved.')) {
      return;
    }
    navigate('/main');
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validFiles = files.filter(f => allowedTypes.includes(f.type));
    if (validFiles.length !== files.length) {
      alert('Only image files are accepted (JPEG, PNG, GIF, WebP).');
      e.target.value = '';
      return;
    }

    const maxImages = 5;
    const remaining = maxImages - imagePreviews.length;
    const toAdd = validFiles.slice(0, remaining);
    if (toAdd.length < validFiles.length) {
      alert(`Maximum ${maxImages} images per post. ${validFiles.length - toAdd.length} image(s) not added.`);
    }

    const readers = toAdd.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(results => {
      setImagePreviews(prev => {
        const combined = [...prev, ...results];
        return combined.slice(0, maxImages);
      });
    });
    e.target.value = '';
  };

  const handleRemoveImage = (index) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
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
      const response = await fetch('http://localhost:3000/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          content,
          imageUrls: imagePreviews.length > 0 ? imagePreviews : undefined,
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
              <label htmlFor="image">Add Images (Optional)</label>
              <div className="image-upload-area">
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="image-input"
                />
                <label htmlFor="image" className="image-upload-label">
                  <span className="upload-icon">📷</span>
                  <span>Click to upload images (multiple allowed)</span>
                </label>
              </div>
              {imagePreviews.length > 0 && (
                <div className="image-previews-grid">
                  {imagePreviews.map((src, index) => (
                    <div key={index} className="image-preview-item">
                      <img src={src} alt={`Preview ${index + 1}`} className="image-preview" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="remove-image-button"
                        aria-label="Remove image"
                      >
                        ×
                      </button>
                    </div>
                  ))}
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