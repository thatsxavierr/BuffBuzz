import React, { useState } from "react";
import { useEffect } from "react";
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
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Store user data with session timestamp (2 hour expiration)
        setSession(data.user);
        
        navigate('/main', { state: { user: data.user } });
      } else {
        setError(data.message || 'Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
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
            disabled={loading}
            required 
          />

          <label>Password:</label>
          <input 
            type="password" 
            name="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            disabled={loading}
            required 
          />

          {error && <p className="error-text">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
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
