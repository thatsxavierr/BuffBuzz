import React from "react";
import "./loginPage.css";

export default function loginPage() {
  const handleLogin = (e) => {
    e.preventDefault();
    // Add authentication logic here later
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Log In</h1>

        <form onSubmit={handleLogin}>
          <label>Email:</label>
          <input type="email" placeholder="Enter your buffs email" required />

          <label>Password:</label>
          <input type="password" placeholder="Enter your password" required />

          <button type="submit">Log In</button>
        </form>

        <div className="login-links">
          <p>
            Don’t have an account?{" "}
            <a href="/signup">Sign up</a>
          </p>
          <a href="/reset">Forgot password?</a>
        </div>
      </div>
    </div>
  );
}
