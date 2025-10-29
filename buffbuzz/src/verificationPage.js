import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './verificationPage.css';

function VerificationPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate('/signup');
    }
  }, [email, navigate]);

  const handleChange = (index, value) => {
    if (value.length > 1) return;
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`code-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      document.getElementById(`code-${index - 1}`).focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const newCode = pastedData.split('');
    
    while (newCode.length < 6) {
      newCode.push('');
    }
    
    setCode(newCode);
    
    // Focus on the last filled input or the first empty one
    const lastFilledIndex = pastedData.length - 1;
    if (lastFilledIndex < 5) {
      document.getElementById(`code-${lastFilledIndex + 1}`).focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const verificationCode = code.join('');

    if (verificationCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          verificationCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setTimeout(() => {
          navigate('/main', { state: { user: data.user } }); // Changed to /main and pass user data
        }, 2000);
      } else {
        setError(data.message || 'Verification failed');
        if (data.message.includes('Too many failed attempts')) {
          setTimeout(() => {
            navigate('/signup');
          }, 3000);
        }
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('http://localhost:5000/api/resend-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Verification code resent! Check your email.');
        setCode(['', '', '', '', '', '']);
        document.getElementById('code-0').focus();
      } else {
        setError(data.message || 'Failed to resend code');
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="verification-container">
      <div className="verification-card">
        <h1>Verify Your Email</h1>
        <p className="verification-subtitle">
          We've sent a 6-digit code to <strong>{email}</strong>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="verification-label">Enter Verification Code</div>
          
          <div className="code-inputs" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                id={`code-${index}`}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="code-input"
                disabled={loading || resending}
              />
            ))}
          </div>
          
          <p className="code-hint">Enter the 6-digit code sent to your email</p>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <button 
            type="submit" 
            className="verify-button"
            disabled={loading || resending}
          >
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>

          <div className="resend-section">
            <p>Didn't receive the code?</p>
            <button
              type="button"
              onClick={handleResend}
              className="resend-button"
              disabled={loading || resending}
            >
              {resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="back-button"
          >
            Back to Sign Up
          </button>
        </form>
      </div>
    </div>
  );
}

export default VerificationPage;