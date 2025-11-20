import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Jobs.css';
import Header from './Header.js';
import Footer from './Footer';

export default function Jobs() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    type: 'full-time',
    category: 'internship',
    description: '',
    requirements: '',
    salary: '',
    applicationUrl: ''
  });

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!userData) {
      navigate('/login');
    } else {
      setUser(userData);
      fetchProfilePicture(userData.id);
      fetchJobs();
    }
  }, [navigate]);

  const fetchProfilePicture = async (userId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/profile/${userId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.profile?.profilePictureUrl) {
          setProfilePicture(data.profile.profilePictureUrl);
        }
      }
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const fetchJobs = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/jobs');
      
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackClick = () => {
    navigate('/main');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('http://localhost:5000/api/jobs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          posterId: user.id
        })
      });

      if (response.ok) {
        alert('Job posted successfully!');
        setShowCreateModal(false);
        setFormData({
          title: '',
          company: '',
          location: '',
          type: 'full-time',
          category: 'internship',
          description: '',
          requirements: '',
          salary: '',
          applicationUrl: ''
        });
        fetchJobs();
      } else {
        const data = await response.json();
        alert(data.message || 'Failed to post job');
      }
    } catch (error) {
      console.error('Error posting job:', error);
      alert('An error occurred while posting the job');
    }
  };

  const handleApply = (job) => {
    if (job.applicationUrl) {
      window.open(job.applicationUrl, '_blank');
    } else {
      alert('Application link not available');
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.category === filter;
  });

  const getTypeIcon = (type) => {
    const icons = {
      'full-time': '💼',
      'part-time': '⏰',
      'internship': '🎓',
      'contract': '📝'
    };
    return icons[type] || '💼';
  };

  if (!user) {
    return null;
  }

  return (
    <div className="jobs-page">
      <Header onBackClick={handleBackClick} profilePictureUrl={profilePicture} />
      
      <div className="jobs-container">
        <div className="jobs-header">
          <h1>Jobs & Internships</h1>
          <p>Find your next opportunity</p>
        </div>

        <div className="jobs-actions">
          <button 
            className="post-job-button"
            onClick={() => setShowCreateModal(true)}
          >
            + Post Job
          </button>

          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All Jobs
            </button>
            <button 
              className={`filter-btn ${filter === 'internship' ? 'active' : ''}`}
              onClick={() => setFilter('internship')}
            >
              Internships
            </button>
            <button 
              className={`filter-btn ${filter === 'on-campus' ? 'active' : ''}`}
              onClick={() => setFilter('on-campus')}
            >
              On-Campus
            </button>
            <button 
              className={`filter-btn ${filter === 'remote' ? 'active' : ''}`}
              onClick={() => setFilter('remote')}
            >
              Remote
            </button>
            <button 
              className={`filter-btn ${filter === 'local' ? 'active' : ''}`}
              onClick={() => setFilter('local')}
            >
              Local
            </button>
          </div>
        </div>

        <div className="jobs-list">
          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="no-jobs">
              <h3>No jobs available</h3>
              <p>Check back later for new opportunities!</p>
            </div>
          ) : (
            filteredJobs.map(job => (
              <div key={job.id} className="job-card">
                <div className="job-header">
                  <div className="job-title-section">
                    <h3>{job.title}</h3>
                    <p className="company-name">{job.company}</p>
                  </div>
                  <span className={`job-type-badge ${job.type}`}>
                    {getTypeIcon(job.type)} {job.type.replace('-', ' ')}
                  </span>
                </div>

                <div className="job-meta">
                  <span className="job-location">📍 {job.location}</span>
                  {job.salary && (
                    <span className="job-salary">💰 {job.salary}</span>
                  )}
                  <span className="job-category">🏷️ {job.category}</span>
                </div>

                <p className="job-description">{job.description}</p>

                {job.requirements && (
                  <div className="job-requirements">
                    <strong>Requirements:</strong>
                    <p>{job.requirements}</p>
                  </div>
                )}

                <div className="job-footer">
                  <span className="posted-date">
                    Posted {new Date(job.createdAt).toLocaleDateString()}
                  </span>
                  <button 
                    className="apply-button"
                    onClick={() => handleApply(job)}
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post a Job Opportunity</h2>
              <button 
                className="close-modal"
                onClick={() => setShowCreateModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title">Job Title *</label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Software Engineering Intern"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="company">Company *</label>
                  <input
                    type="text"
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="Company name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="location">Location *</label>
                  <input
                    type="text"
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Canyon, TX or Remote"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="type">Job Type *</label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="internship">Internship</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="category">Category *</label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  >
                    <option value="internship">Internship</option>
                    <option value="on-campus">On-Campus</option>
                    <option value="remote">Remote</option>
                    <option value="local">Local</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Job Description *</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the role, responsibilities, and what you're looking for..."
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="requirements">Requirements *</label>
                <textarea
                  id="requirements"
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  placeholder="List the qualifications and skills needed..."
                  rows="3"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="salary">Salary (Optional)</label>
                  <input
                    type="text"
                    id="salary"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="e.g., $20-25/hr or $60,000/year"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="applicationUrl">Application Link *</label>
                  <input
                    type="url"
                    id="applicationUrl"
                    value={formData.applicationUrl}
                    onChange={(e) => setFormData({ ...formData, applicationUrl: e.target.value })}
                    placeholder="https://..."
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  Post Job
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}