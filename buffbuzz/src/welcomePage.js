import React from 'react';
import './welcomePage.css';
//import mainlogo from './mainlogo.png';
import logo2 from './logo2.png';

export default function welcomePage() {
  const handleGoBuffsClick = () => {
  };

  return (
    <div className="welcome-container">
      <img 
        src={logo2} 
        alt="BuffBuzz Logo" 
        className="logo"
      />
      
      <h1>Welcome to BuffBuzz</h1>
      
      <button onClick={handleGoBuffsClick}>
        Go Buffs
      </button>
    </div>
  );
}