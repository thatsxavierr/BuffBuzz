import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul>
            <li><a href="#">Link 1</a></li>
          </ul>
        </div>
        
        <div className="footer-section">
          <h3>Contact</h3>
          <p>buffbuzz2025@gmail.com</p>
        </div>
        
        <div className="footer-section">
          <h3>About</h3>
          <p>Connecting students across campus</p>
        </div>
      </div>
    </footer>
  );
}