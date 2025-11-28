import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Jobs.css';
import Header from './Header.js';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';

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
    jobType: 'FULL_TIME',
    category: 'INTERNSHIP',
    description: '',
    requirements: '',
    salary: '',
    applicationLink: ''
  });

  useEffect(() => {
    const userData = getValidUser();
    
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

  const fetchJobs = async (category = null) => {
    try {
      const url = category && category !== 'all' 
        ? `http://localhost:5000/api/jobs?category=${category.toUpperCase()}`
        : 'http://localhost:5000/api/jobs';
      
      const response = await fetch(url);
      
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

      const data = await response.json();

      if (response.ok) {
        alert('Job posted successfully!');
        setShowCreateModal(false);
        setFormData({
          title: '',
          company: '',
          location: '',
          jobType: 'FULL_TIME',
          category: 'INTERNSHIP',
          description: '',
          requirements: '',
          salary: '',
          applicationLink: ''
        });
        fetchJobs();
      } else {
        alert(data.message || 'Failed to post job');
      }
    } catch (error) {
      console.error('Error posting job:', error);
      alert('An error occurred while posting the job');
    }
  };

  const handleApply = (job) => {
    if (job.applicationLink) {
      window.open(job.applicationLink, '_blank');
    } else {
      alert('Application link not available');
    }
  };

  const handleDeleteJob = async (jobId) => {
  if (!window.confirm('Are you sure you want to delete this job posting?')) {
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id
      })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Job deleted successfully!');
      fetchJobs(filter === 'all' ? null : filter);
    } else {
      alert(data.message || 'Failed to delete job');
    }
  } catch (error) {
    console.error('Error deleting job:', error);
    alert('An error occurred while deleting the job');
  }
};

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setLoading(true);
    fetchJobs(newFilter);
  };

  const getTypeIcon = (type) => {
    const icons = {
      'FULL_TIME': '💼',
      'PART_TIME': '⏰',
      'INTERNSHIP': '🎓',
      'CONTRACT': '📝'
    };
    return icons[type] || '💼';
  };

  const formatJobType = (type) => {
    return type.replace('_', '-').toLowerCase().split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('-');
  };

  const formatCategory = (category) => {
    return category.replace('_', '-').toLowerCase().split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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
              onClick={() => handleFilterChange('all')}
            >
              All Jobs
            </button>
            <button 
              className={`filter-btn ${filter === 'internship' ? 'active' : ''}`}
              onClick={() => handleFilterChange('internship')}
            >
              Internships
            </button>
            <button 
              className={`filter-btn ${filter === 'on_campus' ? 'active' : ''}`}
              onClick={() => handleFilterChange('on_campus')}
            >
              On-Campus
            </button>
            <button 
              className={`filter-btn ${filter === 'remote' ? 'active' : ''}`}
              onClick={() => handleFilterChange('remote')}
            >
              Remote
            </button>
            <button 
              className={`filter-btn ${filter === 'local' ? 'active' : ''}`}
              onClick={() => handleFilterChange('local')}
            >
              Local
            </button>
          </div>
        </div>

        <div className="jobs-list">
          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="no-jobs">
              <h3>No jobs available</h3>
              <p>Check back later for new opportunities!</p>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.id} className="job-card">
                <div className="job-header">
                  <div className="job-title-section">
                    <h3>{job.title}</h3>
                    <p className="company-name">{job.company}</p>
                  </div>
                  <div className="job-header-right">
                    <span className={`job-type-badge ${job.jobType.toLowerCase()}`}>
                      {getTypeIcon(job.jobType)} {formatJobType(job.jobType)}
                    </span>
                    {user.id === job.posterId && (
                      <button 
                        className="delete-job-button"
                        onClick={() => handleDeleteJob(job.id)}
                        title="Delete this job"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                <div className="job-meta">
                  <span className="job-location">📍 {job.location}</span>
                  {job.salary && (
                    <span className="job-salary">💰 {job.salary}</span>
                  )}
                  <span className="job-category">🏷️ {formatCategory(job.category)}</span>
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
                  <label htmlFor="jobType">Job Type *</label>
                  <select
                    id="jobType"
                    value={formData.jobType}
                    onChange={(e) => setFormData({ ...formData, jobType: e.target.value })}
                    required
                  >
                    <option value="FULL_TIME">Full-Time</option>
                    <option value="PART_TIME">Part-Time</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="CONTRACT">Contract</option>
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
                    <option value="INTERNSHIP">Internship</option>
                    <option value="ON_CAMPUS">On-Campus</option>
                    <option value="REMOTE">Remote</option>
                    <option value="LOCAL">Local</option>
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
                  <label htmlFor="applicationLink">Application Link *</label>
                  <input
                    type="url"
                    id="applicationLink"
                    value={formData.applicationLink}
                    onChange={(e) => setFormData({ ...formData, applicationLink: e.target.value })}
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