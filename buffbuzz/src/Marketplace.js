import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Marketplace.css';
import Header from './Header.js';
import Footer from './Footer.js';
import { getValidUser } from './sessionUtils';

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
    category: 'TEXTBOOKS',
    condition: 'NEW',
    imageUrl: ''
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
        ? `http://localhost:5000/api/marketplace?category=${category.toUpperCase()}`
        : 'http://localhost:5000/api/marketplace';
      
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

      const data = await response.json();

      if (response.ok) {
        alert('Item listed successfully!');
        setShowCreateModal(false);
        setFormData({
          title: '',
          description: '',
          price: '',
          category: 'TEXTBOOKS',
          condition: 'NEW',
          imageUrl: ''
        });
        fetchItems();
      } else {
        alert(data.message || 'Failed to list item');
      }
    } catch (error) {
      console.error('Error listing item:', error);
      alert('An error occurred while listing the item');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this listing?')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/marketplace/${itemId}`, {
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

  const formatCondition = (condition) => {
    const conditionMap = {
      'NEW': '✨ New',
      'LIKE_NEW': '⭐ Like New',
      'GOOD': '👍 Good',
      'FAIR': '📦 Fair'
    };
    return conditionMap[condition] || condition;
  };

  const formatCategory = (category) => {
    return category.replace('_', ' ').toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

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
              onClick={() => handleFilterChange('all')}
            >
              All Items
            </button>
            <button 
              className={`filter-btn ${filter === 'textbooks' ? 'active' : ''}`}
              onClick={() => handleFilterChange('textbooks')}
            >
              Textbooks
            </button>
            <button 
              className={`filter-btn ${filter === 'electronics' ? 'active' : ''}`}
              onClick={() => handleFilterChange('electronics')}
            >
              Electronics
            </button>
            <button 
              className={`filter-btn ${filter === 'furniture' ? 'active' : ''}`}
              onClick={() => handleFilterChange('furniture')}
            >
              Furniture
            </button>
            <button 
              className={`filter-btn ${filter === 'other' ? 'active' : ''}`}
              onClick={() => handleFilterChange('other')}
            >
              Other
            </button>
          </div>
        </div>

        <div className="items-grid">
          {loading ? (
            <div className="loading">Loading items...</div>
          ) : items.length === 0 ? (
            <div className="no-items">
              <h3>No items available</h3>
              <p>Be the first to list an item!</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="marketplace-card">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="marketplace-image" />
                ) : (
                  <div className="marketplace-image-placeholder">
                    <span className="placeholder-icon">📦</span>
                  </div>
                )}
                
                {user.id === item.sellerId && (
                  <button 
                    className="delete-item-button"
                    onClick={() => handleDeleteItem(item.id)}
                    title="Delete this listing"
                  >
                    🗑️
                  </button>
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
                    <button className="message-button">Message</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'NEW' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'NEW' })}
                  >
                    ✨ New
                  </button>
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'LIKE_NEW' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'LIKE_NEW' })}
                  >
                    ⭐ Like New
                  </button>
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'GOOD' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'GOOD' })}
                  >
                    👍 Good
                  </button>
                  <button
                    type="button"
                    className={`condition-option ${formData.condition === 'FAIR' ? 'selected' : ''}`}
                    onClick={() => setFormData({ ...formData, condition: 'FAIR' })}
                  >
                    📦 Fair
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="image">Add Image (Optional)</label>
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="file-input"
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