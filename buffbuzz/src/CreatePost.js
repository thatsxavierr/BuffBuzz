import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './CreatePost.css';
import Header from './Header.js';
import Footer from './Footer';
import ImageCropModal from './ImageCropModal';

const MAX_POST_IMAGES = 5;
const MAX_POLL_OPTIONS = 5;
const MIN_POLL_OPTIONS = 2;

export default function CreatePost() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [postKind, setPostKind] = useState('post');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [anonymousVoting, setAnonymousVoting] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [imagePreviews, setImagePreviews] = useState([]);
  /** Data URLs waiting to be cropped (FIFO). */
  const [cropQueue, setCropQueue] = useState([]);
  /** When set, next completed crop replaces this index instead of appending. */
  const [recropReplaceIndex, setRecropReplaceIndex] = useState(null);
  const previewsLenRef = useRef(0);
  previewsLenRef.current = imagePreviews.length;
  const cropQueueLenRef = useRef(0);
  cropQueueLenRef.current = cropQueue.length;
  const [loading, setLoading] = useState(false);

  const currentCropSrc = cropQueue[0] ?? null;
  const slotsLeftForNewImages = () =>
    MAX_POST_IMAGES - previewsLenRef.current - cropQueueLenRef.current;

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!userData) {
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

  const hasUnsavedChanges = () => {
    if (postKind === 'poll') {
      const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
      return !!(title?.trim() || content?.trim() || opts.length > 0 || expiresAt);
    }
    return !!(title?.trim() || content?.trim() || imagePreviews.length > 0);
  };

  const setPollOptionAt = (index, value) => {
    setPollOptions((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const addPollOption = () => {
    setPollOptions((prev) => (prev.length >= MAX_POLL_OPTIONS ? prev : [...prev, '']));
  };

  const removePollOption = (index) => {
    setPollOptions((prev) => {
      if (prev.length <= MIN_POLL_OPTIONS) return prev;
      return prev.filter((_, i) => i !== index);
    });
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

  const enqueueForCrop = (dataUrls) => {
    setCropQueue((prev) => {
      const slots = MAX_POST_IMAGES - previewsLenRef.current - prev.length;
      const slice = dataUrls.slice(0, Math.max(0, slots));
      if (dataUrls.length > slice.length) {
        alert(`Maximum ${MAX_POST_IMAGES} images per post. Extra image(s) were not added.`);
      }
      return [...prev, ...slice];
    });
  };

  const processFiles = (files, e) => {
    const readers = files.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((results) => enqueueForCrop(results));
    if (e) e.target.value = '';
  };

  const handleCropComplete = (croppedUrl) => {
    if (recropReplaceIndex !== null) {
      const idx = recropReplaceIndex;
      setImagePreviews((prev) => {
        const next = [...prev];
        if (idx >= 0 && idx < next.length) next[idx] = croppedUrl;
        return next;
      });
      setRecropReplaceIndex(null);
    } else {
      setImagePreviews((prev) => [...prev, croppedUrl].slice(0, MAX_POST_IMAGES));
    }
    setCropQueue((q) => q.slice(1));
  };

  /** Skip current uncropped file or cancel re-crop without changing the preview. */
  const handleCropClose = () => {
    setCropQueue((q) => q.slice(1));
    setRecropReplaceIndex(null);
  };

  const handleAdjustCrop = (index) => {
    if (cropQueue.length > 0) {
      alert('Finish cropping the current photo first.');
      return;
    }
    setRecropReplaceIndex(index);
    setCropQueue([imagePreviews[index]]);
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

    const slots = slotsLeftForNewImages();
    if (slots <= 0) {
      alert(`Maximum ${MAX_POST_IMAGES} images per post. Remove an image or finish cropping first.`);
      e.target.value = '';
      return;
    }

    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    const oversizedFiles = validFiles.filter(f => f.size > MAX_SIZE_BYTES);
    if (oversizedFiles.length > 0) {
      const names = oversizedFiles.map(f => `${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join(', ');
      alert(`The following image(s) exceed the ${MAX_SIZE_MB}MB limit and were not added:\n${names}`);
      const sizeValidFiles = validFiles.filter(f => f.size <= MAX_SIZE_BYTES);
      if (sizeValidFiles.length === 0) {
        e.target.value = '';
        return;
      }
      const toProcess = sizeValidFiles.slice(0, slots);
      if (toProcess.length < sizeValidFiles.length) {
        alert(`Only ${slots} more image slot(s) available. Extra file(s) were not added.`);
      }
      processFiles(toProcess, e);
      return;
    }

    const toProcess = validFiles.slice(0, slots);
    if (toProcess.length < validFiles.length) {
      alert(`Only ${slots} more image slot(s) available. Extra file(s) were not added.`);
    }
    processFiles(toProcess, e);
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

    if (cropQueue.length > 0) {
      alert('Finish cropping each photo (or skip with Cancel) before posting.');
      return;
    }

    setLoading(true);

    try {
      let body;
      if (postKind === 'poll') {
        const opts = pollOptions.map((o) => String(o).trim()).filter(Boolean);
        if (opts.length < MIN_POLL_OPTIONS || opts.length > MAX_POLL_OPTIONS) {
          alert(`Please provide between ${MIN_POLL_OPTIONS} and ${MAX_POLL_OPTIONS} poll options.`);
          setLoading(false);
          return;
        }
        if (!title.trim()) {
          alert('Please enter a poll question (title).');
          setLoading(false);
          return;
        }
        body = {
          title: title.trim(),
          content: content.trim(),
          postType: 'POLL',
          pollOptions: opts,
          anonymousVoting,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
          authorId: user.id
        };
      } else {
        body = {
          title,
          content,
          imageUrls: imagePreviews.length > 0 ? imagePreviews : undefined,
          authorId: user.id
        };
      }

      const response = await fetch('http://localhost:5000/api/posts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        alert(postKind === 'poll' ? 'Poll created successfully!' : 'Post created successfully!');
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

          <div className="form-group create-post-kind-toggle">
            <label>Type</label>
            <div className="create-post-kind-buttons">
              <button
                type="button"
                className={postKind === 'post' ? 'kind-active' : ''}
                onClick={() => setPostKind('post')}
              >
                Standard post
              </button>
              <button
                type="button"
                className={postKind === 'poll' ? 'kind-active' : ''}
                onClick={() => setPostKind('poll')}
              >
                Poll
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="title">{postKind === 'poll' ? 'Poll question *' : 'Title'}</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={postKind === 'poll' ? 'What do you want to ask?' : 'Enter post title...'}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">{postKind === 'poll' ? 'Description (optional)' : 'Content'}</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={postKind === 'poll' ? 'Add context for your poll…' : "What's on your mind?"}
                rows={postKind === 'poll' ? 4 : 8}
                required={postKind !== 'poll'}
              />
            </div>

            {postKind === 'poll' && (
              <>
                <div className="form-group">
                  <label>Options ({MIN_POLL_OPTIONS}–{MAX_POLL_OPTIONS})</label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="poll-option-input-row">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => setPollOptionAt(i, e.target.value)}
                        placeholder={`Option ${i + 1}`}
                        maxLength={200}
                      />
                      {pollOptions.length > MIN_POLL_OPTIONS && (
                        <button type="button" className="poll-remove-opt" onClick={() => removePollOption(i)}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < MAX_POLL_OPTIONS && (
                    <button type="button" className="poll-add-opt" onClick={addPollOption}>
                      + Add option
                    </button>
                  )}
                </div>
                <div className="form-group create-post-checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={anonymousVoting}
                      onChange={(e) => setAnonymousVoting(e.target.checked)}
                    />
                    Anonymous voting (hide names on results)
                  </label>
                </div>
                <div className="form-group">
                  <label htmlFor="expiresAt">End date & time (optional)</label>
                  <input
                    type="datetime-local"
                    id="expiresAt"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </>
            )}

            {postKind === 'post' && (
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
                  <span className="upload-main-text">Click to upload images (multiple allowed)</span>
                  <span className="upload-sub-text">
                    Max {MAX_POST_IMAGES} images · 5MB each · You’ll crop each photo (4:5) for the feed
                  </span>
                </label>
              </div>
              {imagePreviews.length > 0 && (
                <div className="image-previews-grid">
                  {imagePreviews.map((src, index) => (
                    <div key={index} className="image-preview-item">
                      <img src={src} alt={`Preview ${index + 1}`} className="image-preview" />
                      <button
                        type="button"
                        onClick={() => handleAdjustCrop(index)}
                        className="adjust-crop-button"
                        disabled={loading || cropQueue.length > 0}
                        title="Adjust crop"
                      >
                        Crop
                      </button>
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
            )}

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
                disabled={loading || cropQueue.length > 0}
              >
                {loading ? 'Creating...' : postKind === 'poll' ? 'Create Poll' : 'Create Post'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Footer />

      {currentCropSrc && (
        <ImageCropModal
          image={currentCropSrc}
          variant="post"
          onClose={handleCropClose}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}