import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Marketplace.css';
import Header from './Header.js';
import Footer from './Footer.js';

export default function Marketplace() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: 'textbooks',
    condition: 'new',
    imageUrl: ''
  });

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    
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

  const fetchItems = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/marketplace');
      
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

  const handleBackClick = () => {
    navigate('/main');
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:5000/api/marketplace/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          sellerId: user.id
        })
      });

      if (response.ok) {
        alert('Item listed successfully!');
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          price: '',
          category: 'textbooks',
          condition: 'new',
          imageUrl: ''
        });
        fetchItems();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to list item');
      }
    } catch (error) {
      console.error('Error listing item:', error);
      alert('An error occurred while listing the item');
    }
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    return item.category === filter;
  });

  if (!user) {
    return null;
  }

  return (
    <div className="marketplace-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />
      
      <div className="marketplace-container">
        <div className="marketplace-header">
          <h1>Marketplace</h1>
          <p>Buy and sell items with fellow students</p>
        </div>

        <div className="marketplace-actions">
          <button 
            className="sell-item-button"
            onClick={() => setShowCreateModal(true)}
          >
            + Sell Item
          </button>

          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Items
            </button>
            <button 
              className={`filter-btn ${filter === 'textbooks' ? 'active' : ''}`}
              onClick={() => setFilter('textbooks')}
            >
              Textbooks
            </button>
            <button 
              className={`filter-btn ${filter === 'electronics' ? 'active' : ''}`}
              onClick={() => setFilter('electronics')}
            >
              Electronics
            </button>
            <button 
              className={`filter-btn ${filter === 'furniture' ? 'active' : ''}`}
              onClick={() => setFilter('furniture')}
            >
              Furniture
            </button>
            <button 
              className={`filter-btn ${filter === 'other' ? 'active' : ''}`}
              onClick={() => setFilter('other')}
            >
              Other
            </button>
          </div>
        </div>

        <div className="items-grid">
          {loading ? (
            <div className="loading">Loading items...</div>
          ) : filteredItems.length === 0 ? (
            <div className="no-items">
              <h3>No items available</h3>
              <p>Be the first to list an item!</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div key={item.id} className="marketplace-card">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="marketplace-image" />
                ) : (
                  <div className="marketplace-image-placeholder">
                    <span className="placeholder-icon">📦</span>
                  </div>
                )}
                
                <div className="marketplace-content">
                  <div className="item-header">
                    <h3>{item.title}</h3>
                    <span className="price">${item.price}</span>
                  </div>
                  
                  <p className="item-description">{item.description}</p>
                  
                  <div className="item-meta">
                    <span className={`condition-badge ${item.condition}`}>
                      {item.condition === 'new' ? '✨ New' : 
                       item.condition === 'like-new' ? '⭐ Like New' :
                       item.condition === 'good' ? '👍 Good' : '📦 Fair'}
                    </span>
                    <span className="category-tag">{item.category}</span>
                  </div>

                  <div className="item-footer">
                    <span className="seller-info">Sold by {item.sellerName || 'Anonymous'}</span>
                    <button className="message-button">Message</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Listing Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>List an Item for Sale</h2>
              <button 
                className="close-modal"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

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
                    <option value="textbooks">Textbooks</option>
                    <option value="electronics">Electronics</option>
                    <option value="furniture">Furniture</option>
                    <option value="clothing">Clothing</option>
                    <option value="school-supplies">School Supplies</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Condition *</label>
                <div className="condition-selector">
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'new' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'new' })}
                  >
                    ✨ New
                  </button>
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'like-new' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'like-new' })}
                  >
                    ⭐ Like New
                  </button>
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'good' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'good' })}
                  >
                    👍 Good
                  </button>
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'fair' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'fair' })}
                  >
                    📦 Fair
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="image">Add Image *</label>
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
                  required
                />
                {formData.imageUrl && (
                  <div className="image-preview-small">
                    <img src={formData.imageUrl} alt="Preview" />
                  </div>
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
                  List Item
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