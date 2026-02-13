import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./loginPage.css";
import { isSessionValid, setSession, clearSession } from "./sessionUtils";

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [isUnverified, setIsUnverified] = useState(false);

  useEffect(() => {
    // Check if user has a valid session (not expired)
    if (isSessionValid()) {
      navigate("/main"); // already logged in with valid session → skip login page
    } else {
      // Clear expired session
      clearSession();
    }
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError("");
    setIsLocked(false);
    setAttemptsRemaining(null);
    setIsUnverified(false);
  };

  // Check if user has a profile
  const checkUserProfile = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`);
      
      if (response.ok) {
        // Profile exists
        return true;
      } else if (response.status === 404) {
        // Profile doesn't exist
        return false;
      }
      // For other errors, assume profile exists to avoid redirect loop
      return true;
    } catch (error) {
      console.error('Error checking profile:', error);
      // On error, assume profile exists
      return true;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setIsLocked(false);
    setAttemptsRemaining(null);
    setIsUnverified(false);

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Store user data with session timestamp (2 hour expiration)
        setSession(data.user);
        
        // Check if user has a profile
        const hasProfile = await checkUserProfile(data.user.id);
        
        if (hasProfile) {
          // User has profile, go to main page
          navigate('/main', { state: { user: data.user } });
        } else {
          // User doesn't have profile, go to profile edit
          navigate('/profile-edit', { state: { isFirstTime: true } });
        }
      } else {
        // Handle different error cases
        if (data.message && data.message.includes('verify your email')) {
          // Unverified email
          setIsUnverified(true);
          setError(data.message);
        } else if (response.status === 423 || data.locked) {
          // Account is locked
          setIsLocked(true);
          setError(data.message);
        } else if (data.attemptsRemaining !== undefined) {
          // Show attempts remaining
          setAttemptsRemaining(data.attemptsRemaining);
          setError(data.message);
        } else {
          // General error
          setError(data.message || 'Login failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for verification recovery
  const handleVerifyEmail = () => {
    navigate('/verify-recovery', { 
      state: { email: formData.email.trim().toLowerCase() } 
    });
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Log In</h1>

        <form onSubmit={handleLogin}>
          <label>Email:</label>
          <input 
            type="email" 
            name="email"
            placeholder="Enter your buffs email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading || isLocked}
            required 
          />

          <label>Password:</label>
          <input 
            type="password" 
            name="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            disabled={loading || isLocked}
            required 
          />

          {error && (
            <div className={`error-box ${isLocked ? 'locked' : attemptsRemaining !== null ? 'warning' : isUnverified ? 'unverified' : ''}`}>
              {isLocked && (
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 20 20" 
                  fill="currentColor"
                  style={{ marginRight: '8px', display: 'inline-block', verticalAlign: 'middle' }}
                >
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              )}
              {error}
            </div>
          )}

          {/* Show verify button for unverified users */}
          {isUnverified && (
            <button 
              type="button" 
              className="verify-email-btn"
              onClick={handleVerifyEmail}
            >
              Verify Email Now
            </button>
          )}

          <button type="submit" disabled={loading || isLocked}>
            {loading ? 'Logging in...' : isLocked ? 'Account Locked' : 'Log In'}
          </button>
        </form>

        <div className="login-links">
          <p>
            Don't have an account?{" "}
            <a href="/signup">Sign up</a>
          </p>
          <a href="/reset">Forgot password?</a>
        </div>
      </div>
    </div>
  );
}