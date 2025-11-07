import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreatePost.css';
import Header from './Header.js';
import Footer from './Footer';

export default function CreatePost() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const handleBackClick = () => {
    navigate('/main');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // TODO: Implement post creation logic (API call)
    console.log('Post submitted:', { title, content, image });
    // For now, just navigate back to main page
    navigate('/main');
  };

  const handleCancel = () => {
    navigate('/main');
  };

  return (
    <div className="create-post-page">
      <Header onBackClick={handleBackClick} />
      
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
              <button type="button" onClick={handleCancel} className="cancel-button">
                Cancel
              </button>
              <button type="submit" className="submit-button">
                Create Post
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}




