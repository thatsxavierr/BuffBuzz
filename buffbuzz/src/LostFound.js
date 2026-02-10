import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './LostFound.css';
import Header from './Header.js';
import Footer from './Footer';
import ImageCarousel from './ImageCarousel';
import { getValidUser } from './sessionUtils';

const MAX_LISTING_IMAGES = 5;

function getItemImages(item) {
  if (!item) return [];
  if (item.imageUrls && Array.isArray(item.imageUrls) && item.imageUrls.length > 0) return item.imageUrls;
  const raw = item.imageUrl;
  if (!raw) return [];
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(raw.trim());
      return Array.isArray(arr) ? arr : [raw];
    } catch (_) {
      return [raw];
    }
  }
  return [raw];
}

export default function LostFound() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const imageUrlsRef = useRef([]);
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

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const current = formData.imageUrls.length;
    const remaining = MAX_LISTING_IMAGES - current;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) {
      alert(`Maximum ${MAX_LISTING_IMAGES} images allowed.`);
      e.target.value = '';
      return;
    }
    toAdd.forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const next = [...imageUrlsRef.current, reader.result].slice(0, MAX_LISTING_IMAGES);
        imageUrlsRef.current = next;
        setFormData((prev) => ({ ...prev, imageUrls: next }));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (index) => {
    const next = formData.imageUrls.filter((_, i) => i !== index);
    imageUrlsRef.current = next;
    setFormData((prev) => ({ ...prev, imageUrls: next }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const urlsToSend = imageUrlsRef.current.length > 0 ? imageUrlsRef.current : formData.imageUrls;
    if (urlsToSend.length === 0 && formData.imageUrls.length > 0) {
      alert('Images are still loading. Please wait a moment and try again.');
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/lostfound/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          location: formData.location,
          date: formData.date,
          contactInfo: formData.contactInfo,
          imageUrls: urlsToSend,
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
        imageUrlsRef.current = [];
        fetchItems();
      } else {
        alert(data.message || 'Failed to post item');
      }
    } catch (error) {
      console.error('Error posting item:', error);
      alert('An error occurred while posting the item');
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
              const images = getItemImages(item);
              return (
              <div
                key={item.id}
                className="item-card item-card-clickable"
                onClick={() => setDetailItem(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailItem(item); } }}
                aria-label={`View ${item.title}`}
              >
                <div className={`item-badge ${item.category.toLowerCase()}`}>
                  {item.category === 'LOST' ? '🔍 Lost' : '✨ Found'}
                </div>
                
                {user.id === item.userId && (
                  <button
                    type="button"
                    className="delete-item-button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                    title="Delete this item"
                  >
                    🗑️
                  </button>
                )}
                
                {images.length > 0 ? (
                  <ImageCarousel images={images} alt={item.title} className="lostfound-carousel" />
                ) : null}
                
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
                    <button type="button" className="contact-button" onClick={(e) => e.stopPropagation()}>Contact</button>
                  </div>
                </div>
              </div>
            ); })
          )}
        </div>
      </div>

      {detailItem && (
        <div className="modal-overlay listing-detail-overlay" onClick={() => setDetailItem(null)}>
          <div className="listing-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="listing-detail-close" onClick={() => setDetailItem(null)} aria-label="Close">×</button>
            <div className="listing-detail-carousel-wrap">
              {getItemImages(detailItem).length > 0 ? (
                <ImageCarousel images={getItemImages(detailItem)} alt={detailItem.title} className="listing-detail-carousel" />
              ) : (
                <div className="listing-detail-placeholder"><span className="placeholder-icon">📦</span></div>
              )}
            </div>
            <div className="listing-detail-body">
              <div className={`item-badge ${detailItem.category?.toLowerCase()}`} style={{ marginBottom: 12 }}>
                {detailItem.category === 'LOST' ? '🔍 Lost' : '✨ Found'}
              </div>
              <h2 className="listing-detail-title">{detailItem.title}</h2>
              <p className="listing-detail-description">{detailItem.description}</p>
              <div className="item-details" style={{ marginBottom: 12 }}>
                {detailItem.location && (
                  <div className="detail-item">
                    <span className="detail-icon">📍</span>
                    <span>{detailItem.location}</span>
                  </div>
                )}
                {detailItem.date && (
                  <div className="detail-item">
                    <span className="detail-icon">📅</span>
                    <span>{new Date(detailItem.date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              <p className="listing-detail-seller">Posted by {detailItem.userName || 'Anonymous'}</p>
              <button type="button" className="listing-detail-message" onClick={(e) => e.stopPropagation()}>Contact</button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post Lost or Found Item</h2>
              <button 
                className="close-modal"
                onClick={() => setShowCreateModal(false)}
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
                <label htmlFor="lostfound-images">Photos (optional, up to {MAX_LISTING_IMAGES})</label>
                <input
                  type="file"
                  id="lostfound-images"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="file-input"
                />
                {formData.imageUrls.length > 0 && (
                  <div className="listing-preview-grid">
                    {formData.imageUrls.map((url, i) => (
                      <div key={i} className="listing-preview-wrap">
                        <img src={url} alt={`Preview ${i + 1}`} />
                        <button type="button" className="listing-preview-remove" onClick={() => removeImage(i)} aria-label="Remove photo">×</button>
                      </div>
                    ))}
                  </div>
                )}
                {formData.imageUrls.length >= MAX_LISTING_IMAGES && (
                  <p className="listing-image-hint">Maximum {MAX_LISTING_IMAGES} images.</p>
                )}
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Post Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
