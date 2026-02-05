import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./signUpPage.css";

export default function SignupPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    userType: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [errors, setErrors] = useState({
    userType: false,
    firstName: false,
    lastName: false,
    email: false,
    password: false,
    confirmPassword: false
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const getEmailDomain = () => {
    if (formData.userType === "student") {
      return "@buffs.wtamu.edu";
    } else if (formData.userType === "professor") {
      return "@wtamu.edu";
    }
    return "";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: false
      }));
    }
    setErrorMessage("");
  };

  const validateForm = () => {
    const newErrors = {
      userType: formData.userType === "",
      firstName: formData.firstName.trim() === "",
      lastName: formData.lastName.trim() === "",
      email: formData.email.trim() === "" || !/^[a-zA-Z0-9._-]+$/.test(formData.email),
      password: formData.password.length < 8,
      confirmPassword: formData.confirmPassword !== formData.password
    };

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const fullEmail = (formData.email.trim() + getEmailDomain()).toLowerCase();

    const userData = {
      userType: formData.userType,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: fullEmail,
      password: formData.password
    };

    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok) {
        // Navigate to verification page with email
        navigate('/verification', { state: { email: fullEmail } });
      } else {
        setErrorMessage(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrorMessage('An error occurred during registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className="signup-page">
      <div className="signup-container">
        <div className="logo-section">
          <h1>BuffBuzz</h1>
          <p>Join the community</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="userType">I am a:</label>
            <select
              id="userType"
              name="userType"
              value={formData.userType}
              onChange={handleInputChange}
              className={errors.userType ? "invalid" : ""}
              required
              disabled={loading}
            >
              <option value="">Select...</option>
              <option value="student">Student</option>
              <option value="professor">Professor</option>
            </select>
            {errors.userType && <span className="error">Please select a user type</span>}
          </div>

          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className={errors.firstName ? "invalid" : ""}
              required
              disabled={loading}
            />
            {errors.firstName && <span className="error">Please enter your first name</span>}
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className={errors.lastName ? "invalid" : ""}
              required
              disabled={loading}
            />
            {errors.lastName && <span className="error">Please enter your last name</span>}
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="email-display">
              <input
                type="text"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={errors.email ? "invalid" : ""}
                required
                disabled={loading}
              />
              <span className="email-domain">{getEmailDomain()}</span>
            </div>
            {errors.email && <span className="error">Please enter a valid email</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={errors.password ? "invalid" : ""}
              required
              disabled={loading}
            />
            {errors.password && <span className="error">Password must be at least 8 characters</span>}
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={errors.confirmPassword ? "invalid" : ""}
              required
              disabled={loading}
            />
            {errors.confirmPassword && <span className="error">Passwords do not match</span>}
          </div>

          {errorMessage && (
            <div className="error-message-box">
              {errorMessage}
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="login-link">
          Already have an account? <a onClick={handleLoginClick}>Log in</a>
        </div>
      </div>
    </div>
  );
}
