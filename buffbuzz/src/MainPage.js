import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MainPage.css';
import Header from './Header.js';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import Footer from './Footer';

export default function MainPage() {
  const navigate = useNavigate();

  const handleBackClick = () => {
    navigate('/');
  };

  return (
    <div className="main-page">
      <Header onBackClick={handleBackClick} />
      
      <div className="main-layout">
        <LeftSidebar />
        <div className="main-content">
          <button 
            onClick={() => navigate('/create-post')} 
            className="create-post-button"
          >
            + Create New Post
          </button>
          <h1>Main content area</h1>
        </div>
        <RightSidebar />
      </div>
      
      <Footer />
    </div>
  );
}