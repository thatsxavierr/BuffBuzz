import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LostFound.css';
import Header from './Header.js';
import Footer from './Footer';
import ImageCarousel from './ImageCarousel';
import { getValidUser } from './sessionUtils';

export default function LostFound() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'LOST',
    location: '',
    date: '',
    contactInfo: '',
    imageUrls: []
  });

  useEffect(() => {
    const userData = getValidUser();
    
    if (!userData) {
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
      fetchItems();
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

  const fetchItems = async (category = null) => {
    try {
      const url = category && category !== 'all' 
        ? `http://localhost:5000/api/lostfound?category=${category.toUpperCase()}`
        : 'http://localhost:5000/api/lostfound';
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching lost/found items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate('/main');
  };

  const hasUnsavedChanges = () => {
    return !!(
      formData.title?.trim() ||
      formData.description?.trim() ||
      formData.location?.trim() ||
      formData.date ||
      formData.contactInfo?.trim() ||
      (formData.imageUrls?.length > 0) ||
      formData.category !== 'LOST'
    );
  };

  const handleCloseCreateModal = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your listing will not be saved.')) {
      return;
    }
    setShowCreateModal(false);
    setEditingItemId(null);
    setFormData({
      title: '',
      description: '',
      category: 'LOST',
      location: '',
      date: '',
      contactInfo: '',
      imageUrls: []
    });
  };

  const handleEditItem = (item) => {
    const urls = item.imageUrls?.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
    const dateStr = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
    setFormData({
      title: item.title || '',
      description: item.description || '',
      category: item.category || 'LOST',
      location: item.location || '',
      date: dateStr,
      contactInfo: item.contactInfo || '',
      imageUrls: urls
    });
    setEditingItemId(item.id);
    setShowCreateModal(true);
  };

  const MAX_IMAGES = 5;
  const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per image
  const MAX_IMAGE_SIZE_MB = 5;

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const validTypes = files.filter(f => allowedTypes.includes(f.type));
    if (validTypes.length !== files.length) {
      alert('Only image files are accepted (JPEG, PNG, GIF, WebP).');
      e.target.value = '';
      return;
    }

    const overSize = validTypes.filter(f => f.size > MAX_IMAGE_SIZE_BYTES);
    if (overSize.length > 0) {
      alert(`Each image must be ${MAX_IMAGE_SIZE_MB}MB or smaller. ${overSize.length} image(s) were not added because they exceed the size limit.`);
      e.target.value = '';
      return;
    }

    const validFiles = validTypes;
    const current = formData.imageUrls || [];
    const remaining = MAX_IMAGES - current.length;
    const toAdd = validFiles.slice(0, remaining);
    if (toAdd.length < validFiles.length) {
      alert(`Maximum ${MAX_IMAGES} images per listing. ${validFiles.length - toAdd.length} image(s) not added.`);
    }

    const readers = toAdd.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(results => {
      setFormData(prev => ({
        ...prev,
        imageUrls: [...(prev.imageUrls || []), ...results].slice(0, MAX_IMAGES)
      }));
    });
    e.target.value = '';
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      imageUrls: (prev.imageUrls || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingItemId) {
        const response = await fetch(`http://localhost:5000/api/lostfound/${editingItemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            imageUrls: formData.imageUrls?.length > 0 ? formData.imageUrls : undefined,
            userId: user.id
          })
        });

        let data = {};
        try {
          data = await response.json();
        } catch (_) {}

        if (response.ok) {
          alert('Item updated successfully!');
          setShowCreateModal(false);
          setEditingItemId(null);
          setFormData({
            title: '',
            description: '',
            category: 'LOST',
            location: '',
            date: '',
            contactInfo: '',
            imageUrls: []
          });
          fetchItems(filter === 'all' ? null : filter);
        } else {
          alert(data.message || `Failed to update item (${response.status})`);
        }
      } else {
        const response = await fetch('http://localhost:5000/api/lostfound/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            imageUrls: formData.imageUrls?.length > 0 ? formData.imageUrls : undefined,
            userId: user.id
          })
        });

        const data = await response.json();

        if (response.ok) {
          alert('Item posted successfully!');
          setShowCreateModal(false);
          setFormData({
            title: '',
            description: '',
            category: 'LOST',
            location: '',
            date: '',
            contactInfo: '',
            imageUrls: []
          });
          fetchItems();
        } else {
          alert(data.message || 'Failed to post item');
        }
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('An error occurred while saving the item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/lostfound/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Item deleted successfully!');
        fetchItems(filter === 'all' ? null : filter);
      } else {
        alert(data.message || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('An error occurred while deleting the item');
    }
  };

  const handleContactPoster = (item) => {
    if (item.userId === user.id) return;
    const poster = item.user || {};
    navigate('/main', {
      state: {
        openChatWithUser: {
          id: item.userId,
          firstName: poster.firstName || 'User',
          lastName: poster.lastName || '',
          profile: poster.profile
        }
      }
    });
  };

  const handleMarkResolved = async (itemId, resolved) => {
    try {
      const response = await fetch(`http://localhost:5000/api/lostfound/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, resolved })
      });
      const data = await response.json();
      if (response.ok) {
        fetchItems(filter === 'all' ? null : filter);
        if (detailItem?.id === itemId) {
          setDetailItem(prev => ({ ...prev, resolved }));
        }
      } else {
        alert(data.message || 'Failed to update item');
      }
    } catch (error) {
      console.error('Error updating resolved status:', error);
      alert('An error occurred while updating the item');
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setLoading(true);
    fetchItems(newFilter);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="lostfound-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />
      
      <div className="lostfound-container">
        <div className="lostfound-header">
          <h1>Lost & Found</h1>
          <p>Help reunite items with their owners</p>
        </div>

        <div className="lostfound-actions">
          <button 
            className="post-item-button"
            onClick={() => setShowCreateModal(true)}
          >
            + Post Item
          </button>

          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              All Items
            </button>
            <button 
              className={`filter-btn ${filter === 'lost' ? 'active' : ''}`}
              onClick={() => handleFilterChange('lost')}
            >
              Lost
            </button>
            <button 
              className={`filter-btn ${filter === 'found' ? 'active' : ''}`}
              onClick={() => handleFilterChange('found')}
            >
              Found
            </button>
          </div>
        </div>

        <div className="items-grid">
          {loading ? (
            <div className="loading">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="no-items">
              <h3>No items to display</h3>
              <p>Be the first to post a lost or found item!</p>
            </div>
          ) : (
            items.map(item => {
              const images = item.imageUrls?.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
              return (
                <div
                  key={item.id}
                  className="item-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailItem(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailItem(item); } }}
                >
                  <div className="item-card-badges">
                    <div className={`item-badge ${item.category.toLowerCase()}`}>
                      {item.category === 'LOST' ? '🔍 Lost' : '✨ Found'}
                    </div>
                    {item.resolved && (
                      <span className="item-resolved-badge">✓ Resolved</span>
                    )}
                  </div>
                  {user.id === item.userId && (
                    <div className="item-owner-actions" onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="edit-item-button"
                        onClick={() => handleEditItem(item)}
                        title="Edit this item"
                      >
                        ✏️
                      </button>
                      <button 
                        className="delete-item-button"
                        onClick={() => handleDeleteItem(item.id)}
                        title="Delete this item"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                  {images.length > 0 ? (
                    <ImageCarousel
                      images={images}
                      alt={item.title}
                      className="item-image"
                    />
                  ) : (
                    <div className="item-image-placeholder">
                      <span className="placeholder-icon">📷</span>
                    </div>
                  )}
                  <div className="item-content">
                    <h3>{item.title}</h3>
                    <p className="item-description">{item.description}</p>
                    <div className="item-details">
                      {item.location && (
                        <div className="detail-item">
                          <span className="detail-icon">📍</span>
                          <span>{item.location}</span>
                        </div>
                      )}
                      {item.date && (
                        <div className="detail-item">
                          <span className="detail-icon">📅</span>
                          <span>{new Date(item.date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="item-footer">
                      <span className="posted-by">Posted by {item.userName || 'Anonymous'}</span>
                      {item.userId !== user.id && (
                        <button 
                          type="button"
                          className="contact-button"
                          onClick={(e) => { e.stopPropagation(); handleContactPoster(item); }}
                        >
                          Contact
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItemId ? 'Edit Item' : 'Post Lost or Found Item'}</h2>
              <button 
                className="close-modal"
                onClick={handleCloseCreateModal}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Category</label>
                <div className="category-selector">
                  <button
                    type="button"
                    className={`category-option ${formData.category === 'LOST' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, category: 'LOST' })}
                  >
                    🔍 Lost
                  </button>
                  <button
                    type="button"
                    className={`category-option ${formData.category === 'FOUND' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, category: 'FOUND' })}
                  >
                    ✨ Found
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="title">Item Name *</label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Blue Backpack, iPhone 13"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide details about the item..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="location">Location *</label>
                  <input
                    type="text"
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Library, Commons"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="date">Date *</label>
                  <input
                    type="date"
                    id="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="contactInfo">Contact Info *</label>
                <input
                  type="text"
                  id="contactInfo"
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({ ...formData, contactInfo: e.target.value })}
                  placeholder="Email or phone number"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="image">Add Images (Optional, up to 5)</label>
                <p className="image-size-hint">Each image must be 5MB or smaller.</p>
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="file-input"
                />
                {formData.imageUrls?.length > 0 && (
                  <div className="image-previews-grid">
                    {formData.imageUrls.map((src, index) => (
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

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={handleCloseCreateModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingItemId ? 'Save Changes' : 'Post Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailItem && (
        <div className="detail-modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="detail-modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="detail-modal-close" onClick={() => setDetailItem(null)} aria-label="Close">×</button>
            <div className="detail-modal-badges">
              <div className={`detail-modal-badge ${detailItem.category?.toLowerCase()}`}>
                {detailItem.category === 'LOST' ? '🔍 Lost' : '✨ Found'}
              </div>
              {detailItem.resolved && (
                <span className="detail-resolved-badge">✓ Resolved</span>
              )}
            </div>
            <div className="detail-modal-carousel">
              {(detailItem.imageUrls?.length > 0 || detailItem.imageUrl) ? (
                <ImageCarousel
                  images={detailItem.imageUrls?.length > 0 ? detailItem.imageUrls : [detailItem.imageUrl]}
                  alt={detailItem.title}
                  className="detail-carousel"
                />
              ) : (
                <div className="detail-modal-image-placeholder">
                  <span className="placeholder-icon">📷</span>
                </div>
              )}
            </div>
            <div className="detail-modal-info">
              <h2 className="detail-modal-title">{detailItem.title}</h2>
              <p className="detail-modal-description">{detailItem.description}</p>
              {detailItem.location && (
                <p className="detail-modal-meta-item"><span className="detail-icon">📍</span> {detailItem.location}</p>
              )}
              {detailItem.date && (
                <p className="detail-modal-meta-item"><span className="detail-icon">📅</span> {new Date(detailItem.date).toLocaleDateString()}</p>
              )}
              {detailItem.contactInfo && (
                <p className="detail-modal-contact-info">Contact: {detailItem.contactInfo}</p>
              )}
              {detailItem.userId === user.id && (
                <div className="detail-modal-resolve-actions">
                  {detailItem.resolved ? (
                    <button
                      type="button"
                      className="mark-active-button"
                      onClick={() => handleMarkResolved(detailItem.id, false)}
                    >
                      Mark as active again
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="mark-resolved-button"
                      onClick={() => handleMarkResolved(detailItem.id, true)}
                    >
                      Mark as resolved
                    </button>
                  )}
                </div>
              )}
              <div className="detail-modal-poster">
                <span className="detail-posted-by">Posted by {detailItem.userName || 'Anonymous'}</span>
                {detailItem.userId && (
                  <button
                    type="button"
                    className="detail-view-profile-btn"
                    onClick={() => { setDetailItem(null); navigate(`/profile-view/${detailItem.userId}`); }}
                  >
                    View poster profile
                  </button>
                )}
                {detailItem.userId && detailItem.userId !== user.id && (
                  <button
                    type="button"
                    className="contact-button"
                    onClick={() => { setDetailItem(null); handleContactPoster(detailItem); }}
                  >
                    Contact
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}