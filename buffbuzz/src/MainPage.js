import React from 'react';
import { useNavigate } from 'react-router-dom';
import './MainPage.css';
import Header from './Header.js';
import LeftSidebar from './LeftSidebar';
import RightSidebar from './RightSidebar';
import Footer from './Footer';

export default function MainPage({ onBackToWelcome }) {
const navigate = useNavigate();

  return (
    <div className="main-page">
      <Header onBackClick={onBackToWelcome} />
      
      <div className="main-body">
        <LeftSidebar />
        
        <div className="main-content">
          <button 
            onClick={() => navigate('/create-post')} 
            className="create-post-button"
          >
            + Create New Post
          </button>
          <h1>Main content area - coming soon!</h1>
        </div>
        
        <RightSidebar />
      </div>
      <Footer />
    </div>
  );
}
