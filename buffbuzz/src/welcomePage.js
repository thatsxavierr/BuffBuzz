import React from "react";
import "./welcomePage.css";
import logo2 from "./logo2.png";
import { useNavigate } from "react-router-dom";

export default function WelcomePage() {
  const navigate = useNavigate();

  const handleGoBuffsClick = () => {
    navigate("/login");
  };

  return (
    <div className="welcome-container">
      <img src={logo2} alt="BuffBuzz Logo" className="logo" />
      <h1>Welcome to BuffBuzz</h1>
      <button onClick={handleGoBuffsClick}>Go Buffs</button>
    </div>
  );
}