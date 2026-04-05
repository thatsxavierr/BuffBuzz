import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Jobs.css';
import Header from './Header.js';
import Footer from './Footer';
import { getValidUser } from './sessionUtils';
import ReportModal from './ReportModal';

export default function Jobs() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState(''); // NEW
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [reportJobId, setReportJobId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    jobType: 'FULL_TIME',
    category: 'INTERNSHIP',
    description: '',
    requirements: '',
    salary: '',
    applicationLink: '',
    applicationDeadline: ''
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

  // NEW — debounced search: re-runs whenever searchTerm or filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      fetchJobs(filter === 'all' ? null : filter, searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filter]);

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

  // UPDATED — now accepts search param
  const fetchJobs = async (category = null, search = '') => {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.set('category', category.toUpperCase());
      if (search && search.trim()) params.set('search', search.trim());
      const query = params.toString();
      const url = `http://localhost:5000/api/jobs${query ? `?${query}` : ''}`;
      
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

  const hasUnsavedChanges = () => {
    return !!(
      formData.title?.trim() ||
      formData.company?.trim() ||
      formData.location?.trim() ||
      formData.description?.trim() ||
      formData.requirements?.trim() ||
      formData.salary?.trim() ||
      formData.applicationLink?.trim() ||
      formData.applicationDeadline?.trim() ||
      formData.jobType !== 'FULL_TIME' ||
      formData.category !== 'INTERNSHIP'
    );
  };

  const isJobExpired = (job) => {
    if (job.isExpired !== undefined) return job.isExpired;
    return job.applicationDeadline && new Date(job.applicationDeadline) < new Date();
  };

  const handleCloseCreateModal = () => {
    if (hasUnsavedChanges() && !window.confirm('Discard unsaved changes? Your job posting will not be saved.')) {
      return;
    }
    setShowCreateModal(false);
    setEditingJobId(null);
    setFormData({
      title: '',
      company: '',
      location: '',
      jobType: 'FULL_TIME',
      category: 'INTERNSHIP',
      description: '',
      requirements: '',
      salary: '',
      applicationLink: '',
      applicationDeadline: ''
    });
  };

  const handleEditJob = (job) => {
    setFormData({
      title: job.title || '',
      company: job.company || '',
      location: job.location || '',
      jobType: job.jobType || 'FULL_TIME',
      category: job.category || 'INTERNSHIP',
      description: job.description || '',
      requirements: job.requirements || '',
      salary: job.salary || '',
      applicationLink: job.applicationLink || '',
      applicationDeadline: job.applicationDeadline ? job.applicationDeadline.slice(0, 10) : ''
    });
    setEditingJobId(job.id);
    setShowCreateModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingJobId) {
        const response = await fetch(`http://localhost:5000/api/jobs/${editingJobId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            applicationDeadline: formData.applicationDeadline?.trim() || null,
            userId: user.id
          })
        });

        let data = {};
        try {
          data = await response.json();
        } catch (_) {}

        if (response.ok) {
          alert('Job updated successfully!');
          setShowCreateModal(false);
          setEditingJobId(null);
          setFormData({
            title: '',
            company: '',
            location: '',
            jobType: 'FULL_TIME',
            category: 'INTERNSHIP',
            description: '',
            requirements: '',
            salary: '',
            applicationLink: '',
            applicationDeadline: ''
          });
          fetchJobs(filter === 'all' ? null : filter, searchTerm);
        } else {
          alert(data.message || `Failed to update job (${response.status})`);
        }
      } else {
        const response = await fetch('http://localhost:5000/api/jobs/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            applicationDeadline: formData.applicationDeadline?.trim() || null,
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
            applicationLink: '',
            applicationDeadline: ''
          });
          fetchJobs(filter === 'all' ? null : filter, searchTerm);
        } else {
          alert(data.message || 'Failed to post job');
        }
      }
    } catch (error) {
      console.error('Error saving job:', error);
      const msg = error.message || '';
      alert(msg.includes('fetch') || msg.includes('Network') ? 'Could not reach the server. Is the backend running on port 5000?' : 'An error occurred while saving the job');
    }
  };

  const handleApply = (job) => {
    if (isJobExpired(job)) {
      alert('This job posting has expired. Applications are no longer accepted.');
      return;
    }
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
        fetchJobs(filter === 'all' ? null : filter, searchTerm);
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
    fetchJobs(newFilter === 'all' ? null : newFilter, searchTerm);
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

        {/* NEW — Search Bar */}
        <div className="search-bar-wrapper" style={{ marginBottom: '24px' }}>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search by job title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>
        </div>

        {/* NEW — Results summary */}
        {!loading && searchTerm.trim() && (
          <p className="search-results-summary">
            {jobs.length === 0
              ? `No results for "${searchTerm}"`
              : `${jobs.length} result${jobs.length !== 1 ? 's' : ''} for "${searchTerm}"`}
          </p>
        )}

        <div className="jobs-list">
          {loading ? (
            <div className="loading">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="no-jobs">
              {searchTerm.trim() ? (
                <>
                  <h3>No jobs found</h3>
                  <p>Try a different keyword or clear the search.</p>
                </>
              ) : (
                <>
                  <h3>No jobs available</h3>
                  <p>Check back later for new opportunities!</p>
                </>
              )}
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
                    {isJobExpired(job) && (
                      <span className="job-expired-badge">Expired</span>
                    )}
                    <span className={`job-type-badge ${job.jobType.toLowerCase()}`}>
                      {getTypeIcon(job.jobType)} {formatJobType(job.jobType)}
                    </span>
                    {user.id === job.posterId && (
                      <div className="job-owner-actions">
                        <button 
                          className="edit-job-button"
                          onClick={() => handleEditJob(job)}
                          title="Edit this job"
                        >
                          ✏️
                        </button>
                        <button 
                          className="delete-job-button"
                          onClick={() => handleDeleteJob(job.id)}
                          title="Delete this job"
                        >
                          🗑️
                        </button>
                      </div>
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
                    {job.applicationDeadline && (
                      <> · Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}</>
                    )}
                  </span>
                  <div className="job-footer-actions">
                    {job.posterId !== user.id && (
                      <button
                        type="button"
                        className="job-report-btn"
                        onClick={() => setReportJobId(job.id)}
                      >
                        Report
                      </button>
                    )}
                    <button 
                      className={`apply-button ${isJobExpired(job) ? 'apply-button-disabled' : ''}`}
                      onClick={() => handleApply(job)}
                      disabled={isJobExpired(job)}
                      title={isJobExpired(job) ? 'Applications closed' : 'Apply for this job'}
                    >
                      {isJobExpired(job) ? 'Applications closed' : 'Apply Now'}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Job Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingJobId ? 'Edit Job Posting' : 'Post a Job Opportunity'}</h2>
              <button 
                className="close-modal"
                onClick={handleCloseCreateModal}
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

              <div className="form-group">
                <label htmlFor="applicationDeadline">Application deadline (optional)</label>
                <input
                  type="date"
                  id="applicationDeadline"
                  value={formData.applicationDeadline}
                  onChange={(e) => setFormData({ ...formData, applicationDeadline: e.target.value })}
                />
                <span className="form-hint">After this date, the job will show as expired and users cannot apply.</span>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  onClick={handleCloseCreateModal}
                  className="cancel-btn"
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
                  {editingJobId ? 'Save Changes' : 'Post Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={!!reportJobId}
        onClose={() => setReportJobId(null)}
        reporterId={user?.id}
        targetType="JOB"
        targetId={reportJobId}
        subjectLabel="this job posting"
      />

      <Footer />
    </div>
  );
}