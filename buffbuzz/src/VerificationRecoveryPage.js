import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./VerificationRecoveryPage.css";

export default function VerificationRecoveryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState("request"); // "request" or "verify"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);

  const handleResendCode = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/resend-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Verification code sent! Check your email.");
        setStep("verify");
        setAttemptsRemaining(3); // Reset to 3 attempts
      } else {
        setError(data.message || "Failed to send verification code");
      }
    } catch (error) {
      console.error("Resend code error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          verificationCode: verificationCode.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("Email verified successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(data.message || "Verification failed");
        // Update attempts remaining if provided
        if (data.message.includes("attempt")) {
          const match = data.message.match(/(\d+) attempt/);
          if (match) {
            setAttemptsRemaining(parseInt(match[1]));
          }
        }
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verification-recovery-container">
      <div className="verification-recovery-box">
        <h1 className="recovery-title">
          {step === "request" ? "Resend Verification Code" : "Verify Your Email"}
        </h1>

        <p className="recovery-description">
          {step === "request"
            ? "Enter your email to receive a new verification code."
            : "Enter the 6-digit code sent to your email."}
        </p>

        {step === "request" ? (
          <form onSubmit={handleResendCode}>
            <label>Email:</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />

            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}

            <button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Verification Code"}
            </button>

            <div className="recovery-links">
              <a onClick={() => navigate("/login")}>Back to Login</a>
              <span className="separator">|</span>
              <a onClick={() => navigate("/signup")}>Create New Account</a>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <div className="email-display-box">
              <strong>Email:</strong> {email}
              <button
                type="button"
                className="change-email-btn"
                onClick={() => setStep("request")}
              >
                Change
              </button>
            </div>

            <label>Verification Code:</label>
            <input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              disabled={loading}
              maxLength={6}
              required
            />

            {attemptsRemaining !== null && attemptsRemaining > 0 && (
              <div className="attempts-info">
                {attemptsRemaining} attempt{attemptsRemaining === 1 ? "" : "s"} remaining
              </div>
            )}

            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}

            <button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify Email"}
            </button>

            <div className="recovery-links">
              <a onClick={handleResendCode}>Resend Code</a>
              <span className="separator">|</span>
              <a onClick={() => navigate("/login")}>Back to Login</a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}