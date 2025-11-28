import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './LostFound.css';
import Header from './Header.js';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

export default function LostFound() {
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
    category: 'LOST',
    location: '',
    date: '',
    contactInfo: '',
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
      const response = await fetch('http://localhost:5000/api/lostfound/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
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
          imageUrl: ''
        });
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
            items.map(item => (
              <div key={item.id} className="item-card">
                <div className={`item-badge ${item.category.toLowerCase()}`}>
                  {item.category === 'LOST' ? '🔍 Lost' : '✨ Found'}
                </div>
                
                {user.id === item.userId && (
                  <button 
                    className="delete-item-button"
                    onClick={() => handleDeleteItem(item.id)}
                    title="Delete this item"
                  >
                    🗑️
                  </button>
                )}
                
                {item.imageUrl && (
                  <img src={item.imageUrl} alt={item.title} className="item-image" />
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
                    <button className="contact-button">Contact</button>
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