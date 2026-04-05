import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Marketplace.css';
import Header from './Header.js';
import Footer from './Footer.js';
import ImageCarousel from './ImageCarousel';
import { getValidUser } from './sessionUtils';
import ReportModal from './ReportModal';

export default function Marketplace() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [reportListingId, setReportListingId] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [profilePrivacy, setProfilePrivacy] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'TEXTBOOKS',
    condition: 'NEW',
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

  // Debounced search — re-runs whenever searchTerm or filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchItems(filter === 'all' ? null : filter, searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filter]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profilePictureUrl) setProfilePicture(data.profile.profilePictureUrl);
        setProfilePrivacy(data.profile?.privacy || 'PUBLIC');
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const fetchItems = async (category = null, search = '') => {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category.toUpperCase());
      if (search && search.trim()) params.set('search', search.trim());
      const query = params.toString();
      const url = `http://localhost:5000/api/marketplace${query ? `?${query}` : ''}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => navigate('/main');

  const hasUnsavedChanges = () => !!(
    formData.title?.trim() ||
    formData.description?.trim() ||
    formData.price?.trim() ||
    (formData.imageUrls?.length > 0) ||
    formData.category !== 'TEXTBOOKS' ||
    formData.condition !== 'NEW'
  );

  const handleCloseCreateModal = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your listing will not be saved.')) return;
    setShowCreateModal(false);
    setEditingItemId(null);
    setFormData({ title: '', description: '', price: '', category: 'TEXTBOOKS', condition: 'NEW', imageUrls: [] });
  };

  const handleEditItem = (item) => {
    const urls = item.imageUrls?.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
    setFormData({
      title: item.title || '',
      description: item.description || '',
      price: item.price?.toString() || '',
      category: item.category || 'TEXTBOOKS',
      condition: item.condition || 'NEW',
      imageUrls: urls
    });
    setEditingItemId(item.id);
    setShowCreateModal(true);
  };

  const MAX_IMAGES = 5;
  const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
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
      alert(`Each image must be ${MAX_IMAGE_SIZE_MB}MB or smaller. ${overSize.length} image(s) were not added.`);
      e.target.value = '';
      return;
    }

    const current = formData.imageUrls || [];
    const remaining = MAX_IMAGES - current.length;
    const toAdd = validTypes.slice(0, remaining);
    if (toAdd.length < validTypes.length) {
      alert(`Maximum ${MAX_IMAGES} images per listing. ${validTypes.length - toAdd.length} image(s) not added.`);
    }

    Promise.all(toAdd.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    }))).then(results => {
      setFormData(prev => ({ ...prev, imageUrls: [...(prev.imageUrls || []), ...results].slice(0, MAX_IMAGES) }));
    });
    e.target.value = '';
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({ ...prev, imageUrls: (prev.imageUrls || []).filter((_, i) => i !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItemId) {
        const response = await fetch(`http://localhost:5000/api/marketplace/${editingItemId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, imageUrls: formData.imageUrls?.length > 0 ? formData.imageUrls : undefined, userId: user.id })
        });
        let data = {};
        try { data = await response.json(); } catch (_) {}
        if (response.ok) {
          alert('Item updated successfully!');
          setShowCreateModal(false);
          setEditingItemId(null);
          setFormData({ title: '', description: '', price: '', category: 'TEXTBOOKS', condition: 'NEW', imageUrls: [] });
          fetchItems(filter === 'all' ? null : filter, searchTerm);
        } else {
          alert(data.message || `Failed to update item (${response.status})`);
        }
      } else {
        const response = await fetch('http://localhost:5000/api/marketplace/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, imageUrls: formData.imageUrls?.length > 0 ? formData.imageUrls : undefined, sellerId: user.id })
        });
        const data = await response.json();
        if (response.ok) {
          alert('Item listed successfully!');
          setShowCreateModal(false);
          setFormData({ title: '', description: '', price: '', category: 'TEXTBOOKS', condition: 'NEW', imageUrls: [] });
          fetchItems(filter === 'all' ? null : filter, searchTerm);
        } else {
          alert(data.message || 'Failed to list item');
        }
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('An error occurred while saving the item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/marketplace/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await response.json();
      if (response.ok) {
        alert('Item deleted successfully!');
        fetchItems(filter === 'all' ? null : filter, searchTerm);
      } else {
        alert(data.message || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('An error occurred while deleting the item');
    }
  };

  const handleMessageSeller = (item) => {
    if (item.sellerId === user.id) return;
    const seller = item.seller || {};
    navigate('/main', { state: { openChatWithUser: { id: item.sellerId, firstName: seller.firstName || 'User', lastName: seller.lastName || '', profile: seller.profile } } });
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setLoading(true);
    fetchItems(newFilter === 'all' ? null : newFilter, searchTerm);
  };

  const formatCondition = (condition) => {
    const map = { 'NEW': '✨ New', 'LIKE_NEW': '⭐ Like New', 'GOOD': '👍 Good', 'FAIR': '📦 Fair' };
    return map[condition] || condition;
  };

  const formatCategory = (category) => {
    return category.replace('_', ' ').toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (!user) return null;

  return (
    <div className="marketplace-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />

      <div className="marketplace-container">
        <div className="marketplace-header">
          <h1>Marketplace</h1>
          <p>Buy and sell items with fellow students</p>
        </div>

        <div className="marketplace-actions">
          <button className="sell-item-button" onClick={() => setShowCreateModal(true)}>
            + Sell Item
          </button>

          <div className="filter-buttons">
            {[
              { key: 'all', label: 'All Items' },
              { key: 'textbooks', label: 'Textbooks' },
              { key: 'electronics', label: 'Electronics' },
              { key: 'furniture', label: 'Furniture' },
              { key: 'other', label: 'Other' }
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`filter-btn ${filter === key ? 'active' : ''}`}
                onClick={() => handleFilterChange(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar-wrapper" style={{ marginBottom: '24px' }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by title or description…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>
        </div>

        {/* Results summary */}
        {!loading && searchTerm.trim() && (
          <p className="search-results-summary">
            {items.length === 0
              ? `No results for "${searchTerm}"`
              : `${items.length} result${items.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </p>
        )}

        <div className="items-grid">
          {loading ? (
            <div className="loading">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="no-items">
              {searchTerm.trim() ? (
                <>
                  <h3>No items found</h3>
                  <p>Try a different keyword or clear the search.</p>
                </>
              ) : (
                <>
                  <h3>No items available</h3>
                  <p>Be the first to list an item!</p>
                </>
              )}
            </div>
          ) : (
            items.map(item => {
              const images = item.imageUrls?.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
              return (
                <div
                  key={item.id}
                  className="marketplace-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailItem(item)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailItem(item); } }}
                >
                  {images.length > 0 ? (
                    <ImageCarousel images={images} alt={item.title} className="marketplace-image" />
                  ) : (
                    <div className="marketplace-image-placeholder">
                      <span className="placeholder-icon">📦</span>
                    </div>
                  )}
                  {user.id === item.sellerId && (
                    <div className="item-owner-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="edit-item-button" onClick={() => handleEditItem(item)} title="Edit this listing">✏️</button>
                      <button className="delete-item-button" onClick={() => handleDeleteItem(item.id)} title="Delete this listing">🗑️</button>
                    </div>
                  )}
                  <div className="marketplace-content">
                    <div className="item-header">
                      <h3>{item.title}</h3>
                      <span className="price">${parseFloat(item.price).toFixed(2)}</span>
                    </div>
                    <p className="item-description">{item.description}</p>
                    <div className="item-meta">
                      <span className={`condition-badge ${item.condition.toLowerCase().replace('_', '-')}`}>
                        {formatCondition(item.condition)}
                      </span>
                      <span className="category-tag">{formatCategory(item.category)}</span>
                    </div>
                    <div className="item-footer">
                      <span className="seller-info">Sold by {item.sellerName || 'Anonymous'}</span>
                      {item.sellerId !== user.id && (
                        <button
                          type="button"
                          className="message-button"
                          onClick={(e) => { e.stopPropagation(); handleMessageSeller(item); }}
                        >
                          Message
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
              <h2>{editingItemId ? 'Edit Listing' : 'List an Item for Sale'}</h2>
              <button className="close-modal" onClick={handleCloseCreateModal}>×</button>
            </div>

            {profilePrivacy && profilePrivacy !== 'PUBLIC' && (
              <div className="privacy-warning-banner">
                ⚠️ Your profile is currently set to <strong>{profilePrivacy === 'FRIENDS_ONLY' ? 'Friends Only' : 'Private'}</strong>. 
                Buyers won't be able to view your profile. Consider switching to <strong>Public</strong> in your profile settings so people can contact you.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Item Title *</label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Chemistry Textbook 10th Edition"
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
                  <label htmlFor="price">Price ($) *</label>
                  <input
                    type="number"
                    id="price"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="TEXTBOOKS">Textbooks</option>
                    <option value="ELECTRONICS">Electronics</option>
                    <option value="FURNITURE">Furniture</option>
                    <option value="CLOTHING">Clothing</option>
                    <option value="SCHOOL_SUPPLIES">School Supplies</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Condition *</label>
                <div className="condition-selector">
                  {['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'].map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`condition-option ${formData.condition === c ? 'selected' : ''}`}
                      onClick={() => setFormData({ ...formData, condition: c })}
                    >
                      {formatCondition(c)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="image">Add Images (Optional, up to 5)</label>
                <p className="image-size-hint">Each image must be 5MB or smaller.</p>
                <input type="file" id="image" accept="image/*" multiple onChange={handleImageChange} className="file-input" />
                {formData.imageUrls?.length > 0 && (
                  <div className="image-previews-grid">
                    {formData.imageUrls.map((src, index) => (
                      <div key={index} className="image-preview-item">
                        <img src={src} alt={`Preview ${index + 1}`} className="image-preview" />
                        <button type="button" onClick={() => handleRemoveImage(index)} className="remove-image-button" aria-label="Remove image">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" onClick={handleCloseCreateModal} className="cancel-btn">Cancel</button>
                <button type="submit" className="submit-btn">{editingItemId ? 'Save Changes' : 'List Item'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailItem && (
        <div className="detail-modal-overlay" onClick={() => setDetailItem(null)}>
          <div className="detail-modal-content" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="detail-modal-close" onClick={() => setDetailItem(null)} aria-label="Close">×</button>
            <div className="detail-modal-carousel">
              {(detailItem.imageUrls?.length > 0 || detailItem.imageUrl) ? (
                <ImageCarousel
                  images={detailItem.imageUrls?.length > 0 ? detailItem.imageUrls : [detailItem.imageUrl]}
                  alt={detailItem.title}
                  className="detail-carousel"
                />
              ) : (
                <div className="detail-modal-image-placeholder">
                  <span className="placeholder-icon">📦</span>
                </div>
              )}
            </div>
            <div className="detail-modal-info">
              <h2 className="detail-modal-title">{detailItem.title}</h2>
              <p className="detail-modal-price">${parseFloat(detailItem.price).toFixed(2)}</p>
              <p className="detail-modal-description">{detailItem.description}</p>
              <div className="detail-modal-meta">
                <span className={`condition-badge ${(detailItem.condition || '').toLowerCase().replace('_', '-')}`}>
                  {formatCondition(detailItem.condition)}
                </span>
                <span className="category-tag">{formatCategory(detailItem.category)}</span>
              </div>
              <div className="detail-modal-seller">
                <span className="detail-seller-label">Sold by {detailItem.sellerName || 'Anonymous'}</span>
                {detailItem.sellerId && (
                  <button
                    type="button"
                    className="detail-view-profile-btn"
                    onClick={() => { setDetailItem(null); navigate(`/profile-view/${detailItem.sellerId}`); }}
                  >
                    View seller profile
                  </button>
                )}
                {detailItem.sellerId && detailItem.sellerId !== user.id && (
                  <button
                    type="button"
                    className="message-button"
                    onClick={() => { setDetailItem(null); handleMessageSeller(detailItem); }}
                  >
                    Message seller
                  </button>
                )}
                {detailItem.sellerId && detailItem.sellerId !== user.id && (
                  <button
                    type="button"
                    className="detail-report-listing-btn"
                    onClick={() => setReportListingId(detailItem.id)}
                  >
                    Report listing
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={!!reportListingId}
        onClose={() => setReportListingId(null)}
        reporterId={user?.id}
        targetType="MARKETPLACE_ITEM"
        targetId={reportListingId}
        subjectLabel="this listing"
      />

      <Footer />
    </div>
  );
}