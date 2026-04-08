import React from 'react';
import { useNavigate } from 'react-router-dom';
import './CommunityGuidelines.css';
import Header from './Header';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

export default function CommunityGuidelines() {
  const navigate = useNavigate();
  const user = getValidUser();

  return (
    <div className="guidelines-page">
      <Header
        onBackClick={() => (user ? navigate('/main') : navigate('/'))}
        profilePictureUrl={user?.profilePictureUrl}
        currentUserId={user?.id}
      />

      <main className="guidelines-container">
        <div className="guidelines-hero">
          <h1>Community Guidelines</h1>
          <p>
            BuffBuzz is a campus community. Please be respectful, honest, and safe so everyone can participate.
          </p>
        </div>

        <section className="guidelines-card">
          <h2>Be respectful</h2>
          <ul>
            <li>No harassment, bullying, hate, or threats.</li>
            <li>Don’t post private personal information about others.</li>
            <li>Keep debates civil—attack ideas, not people.</li>
          </ul>
        </section>

        <section className="guidelines-card">
          <h2>Keep content appropriate</h2>
          <ul>
            <li>No explicit sexual content, graphic violence, or illegal activity.</li>
            <li>No spam, repetitive posts, or misleading links.</li>
            <li>Use accurate titles and categories (Jobs, Marketplace, Lost &amp; Found, Groups).</li>
          </ul>
        </section>

        <section className="guidelines-card">
          <h2>Marketplace &amp; Lost &amp; Found safety</h2>
          <ul>
            <li>Don’t attempt scams or pressure users to pay outside agreed terms.</li>
            <li>Meet in public, well‑lit places and use good judgment.</li>
            <li>Mark Lost &amp; Found items resolved when appropriate.</li>
          </ul>
        </section>

        <section className="guidelines-card">
          <h2>Reporting &amp; enforcement</h2>
          <ul>
            <li>Use the “Report” option to flag content that violates these guidelines.</li>
            <li>Admins can review reports and take action, including removing content or restricting accounts.</li>
            <li>False or abusive reporting may also be moderated.</li>
          </ul>
        </section>

        <div className="guidelines-footer-note">
          <p>
            These guidelines may be updated to keep the community safe and helpful.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

