import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Header.css';
import { clearSession } from './sessionUtils';

export default function Header({ onBackClick, profilePictureUrl, currentUserId }) {

  const navigate = useNavigate();

  // ⭐ PHASE 3 STATE
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Go to profile
  const handleProfileClick = () => {
    navigate('/profile');
  };

  const handleLogout = () => {
    const confirmLogout = window.confirm('Are you sure you want to logout?');
    if (confirmLogout) {
      clearSession();
      sessionStorage.clear();
      navigate('/login');
    }
  };

  // ⭐ PHASE 3: SEARCH USERS
  const handleSearch = async (e) => {
    const value = e.target.value;
    setSearchText(value);

    if (value.trim() === "") {
      setResults([]);
      setShowResults(false);
      return;
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/search-users?query=${encodeURIComponent(value)}`
      );
      const data = await response.json();

      const users = Array.isArray(data) ? data : data.users || [];

      if (!response.ok) {
        setResults([]);
        setShowResults(false);
        return;
      }

      setResults(users);
      setShowResults(true);

    } catch (error) {
      console.error("Search error:", error);
    }
  };

  // ⭐ When clicking a search result
  const handleSelectUser = (userId) => {
    setShowResults(false);
    setSearchText("");

    if (currentUserId && userId === currentUserId) {
      navigate('/profile');
      return;
    }

    navigate(`/profile-view/${userId}`);
  };

  return (
    <header className="header">
      <div className="header-content" ref={resultsRef}>

        {/* LEFT SIDE */}
        <div className="header-left">
          <button className="header-button" onClick={onBackClick}>
            ← Back
          </button>
          <div className="logo-text">BuffBuzz</div>
        </div>

        {/* CENTER: SEARCH */}
        <div className="header-center">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search for students"
              className="search-input"
              value={searchText}
              onChange={handleSearch}
              onFocus={() => searchText && setShowResults(true)}
            />

            {/* ⭐ DROPDOWN RESULTS */}
            {showResults && (
              <div className={`search-results-box ${results.length === 0 ? 'empty' : ''}`}>
                {results.length === 0 ? (
                  <div>No users found.</div>
                ) : (
                  results.map((user) => (
                    <div
                      key={user.id}
                      className="search-result-item"
                      onClick={() => handleSelectUser(user.id)}
                    >
                      {user.profilePictureUrl ? (
                        <img
                          src={user.profilePictureUrl}
                          alt=""
                          className="search-avatar"
                        />
                      ) : (
                        <div className="search-avatar fallback">👤</div>
                      )}
                      <div className="search-result-text">
                        <span className="search-result-name">{user.fullName || user.email}</span>
                        <span className="search-result-email">{user.email}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="header-right">
          <button className="header-button">🏠 Home</button>
          <button className="header-button">⚙️ Settings</button>

          <div
            className="profile-circle"
            onClick={handleProfileClick}
            style={{
              backgroundImage: profilePictureUrl ? `url(${profilePictureUrl})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: 'pointer'
            }}
          >
            {!profilePictureUrl && '👤'}
          </div>

          <button className="header-button logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
