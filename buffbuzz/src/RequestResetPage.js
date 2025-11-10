import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ResetPage.css";

export default function RequestResetPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/request-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("If an account exists with this email, you will receive a password reset link shortly.");
        setEmail("");
      } else {
        setError(data.message || 'Failed to process request. Please try again.');
      }
    } catch (error) {
      console.error('Reset request error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="reset-container">
      <div className="reset-box">
        <h1 className="reset-title">Reset Password</h1>
        <p className="reset-description">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        <form onSubmit={handleSubmit}>
          <label>Email:</label>
          <input 
            type="email" 
            name="email"
            placeholder="Enter your buffs email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required 
          />

          {error && <p className="error-text">{error}</p>}
          {message && <p className="success-text">{message}</p>}

          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="reset-links">
          <a href="/login">Back to Login</a>
        </div>
      </div>
    </div>
  );
}