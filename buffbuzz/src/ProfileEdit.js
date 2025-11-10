import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ProfileEdit.css';
import Header from './Header';


export default function ProfileEdit() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    pronouns: '',
    bio: '',
    major: '',
    department: '',
    graduationYear: '',
    classification: '',
    clubs: '',
    instagramHandle: '',
    linkedinUrl: '',
    facebookHandle: '',
    profilePicture: null
  });
  const [previewImage, setPreviewImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch existing profile data on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setFormData({
            name: data.name || '',
            bio: data.bio || '',
            major: data.major || '',
            department: data.department || '',
            graduationYear: data.graduationYear || '',
            classification: data.classification || '',
            clubs: data.clubs || '',
            pronouns: data.pronouns || '',
            instagramHandle: data.instagramHandle || '',
            linkedinUrl: data.linkedinUrl || '',
            facebookHandle: data.facebookHandle || '',
            profilePicture: null
          });
          if (data.profilePictureUrl) {
            setPreviewImage(data.profilePictureUrl);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      setFormData(prev => ({
        ...prev,
        profilePicture: file
      }));
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('bio', formData.bio);
      formDataToSend.append('major', formData.major);
      formDataToSend.append('department', formData.department);
      formDataToSend.append('graduationYear', formData.graduationYear);
      formDataToSend.append('classification', formData.classification);
      formDataToSend.append('clubs', formData.clubs);
      formDataToSend.append('pronouns', formData.pronouns);
      formDataToSend.append('instagramHandle', formData.instagramHandle);
      formDataToSend.append('linkedinUrl', formData.linkedinUrl);
      formDataToSend.append('facebookHandle', formData.facebookHandle);
      
      if (formData.profilePicture) {
        formDataToSend.append('profilePicture', formData.profilePicture);
      }

      const response = await fetch('/api/profile/update', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataToSend
      });

      if (response.ok) {
        // Navigate back to main page after successful update
        navigate('/main');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/main');
  };

  // Generate graduation year options (current year to 10 years in future)
  const currentYear = new Date().getFullYear();
  const graduationYears = Array.from({ length: 11 }, (_, i) => currentYear + i);

  return (
    <div>
    <Header onBackClick={() => navigate('/main')} profilePictureUrl={previewImage} />
    <div className="profile-edit-container">
      <div className="profile-edit-card">
        <h1>Edit Profile</h1>
        
        <form onSubmit={handleSubmit}>
          {/* Profile Picture Section */}
          <div className="profile-picture-section">
            <div className="profile-picture-preview">
              {previewImage ? (
                <img src={previewImage} alt="Profile preview" />
              ) : (
                <div className="profile-placeholder">📷</div>
              )}
            </div>
            <label htmlFor="profile-picture-input" className="upload-button">
              Change Picture
            </label>
            <input
              id="profile-picture-input"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Basic Information Section */}
          <div className="section-header">Basic Information</div>

          {/* Name Field */}
          <div className="form-group">
            <label htmlFor="name">Name *</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </div>

          {/* Pronouns Field */}
          <div className="form-group">
            <label htmlFor="pronouns">Pronouns</label>
            <select
              id="pronouns"
              name="pronouns"
              value={formData.pronouns}
              onChange={handleChange}
            >
              <option value="">Select pronouns</option>
              <option value="he/him">He/Him</option>
              <option value="she/her">She/Her</option>
              <option value="they/them">They/Them</option>
              <option value="he/they">He/They</option>
              <option value="she/they">She/They</option>
              <option value="other">Other/Prefer not to say</option>
            </select>
          </div>

          {/* Bio Field */}
          <div className="form-group">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              placeholder="Tell us about yourself..."
              rows="4"
              maxLength="500"
            />
            <span className="character-count">{formData.bio.length}/500</span>
          </div>

          {/* Academic Information Section */}
          <div className="section-header">Academic Information</div>

          {/* Major Field */}
          <div className="form-group">
            <label htmlFor="major">Major</label>
            <input
              id="major"
              type="text"
              name="major"
              value={formData.major}
              onChange={handleChange}
              placeholder="e.g., Computer Science"
            />
          </div>

          {/* Department Field */}
          <div className="form-group">
            <label htmlFor="department">Department</label>
            <input
              id="department"
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              placeholder="e.g., College of Engineering"
            />
          </div>

          {/* Classification Field */}
          <div className="form-group">
            <label htmlFor="classification">Year in School</label>
            <select
              id="classification"
              name="classification"
              value={formData.classification}
              onChange={handleChange}
            >
              <option value="">Select classification</option>
              <option value="freshman">Freshman</option>
              <option value="sophomore">Sophomore</option>
              <option value="junior">Junior</option>
              <option value="senior">Senior</option>
              <option value="graduate">Graduate Student</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Graduation Year Field */}
          <div className="form-group">
            <label htmlFor="graduationYear">Graduation Year</label>
            <select
              id="graduationYear"
              name="graduationYear"
              value={formData.graduationYear}
              onChange={handleChange}
            >
              <option value="">Select year</option>
              {graduationYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Campus Life Section */}
          <div className="section-header">Campus Life</div>

          {/* Clubs/Organizations Field */}
          <div className="form-group">
            <label htmlFor="clubs">Clubs & Organizations</label>
            <textarea
              id="clubs"
              name="clubs"
              value={formData.clubs}
              onChange={handleChange}
              placeholder="e.g., ColorStack, Student Government, Robotics Club"
              rows="3"
              maxLength="300"
            />
            <span className="character-count">{formData.clubs.length}/300</span>
          </div>

          {/* Social Media Section */}
          <div className="section-header">Social Media</div>

          {/* Instagram Handle */}
          <div className="form-group">
            <label htmlFor="instagramHandle">Instagram</label>
            <div className="input-with-prefix">
              <span className="input-prefix">@</span>
              <input
                id="instagramHandle"
                type="text"
                name="instagramHandle"
                value={formData.instagramHandle}
                onChange={handleChange}
                placeholder="username"
              />
            </div>
          </div>

          {/* LinkedIn URL */}
          <div className="form-group">
            <label htmlFor="linkedinUrl">LinkedIn</label>
            <input
              id="linkedinUrl"
              type="url"
              name="linkedinUrl"
              value={formData.linkedinUrl}
              onChange={handleChange}
              placeholder="https://linkedin.com/in/yourprofile"
            />
          </div>

          {/* Facebook Handle */}
          <div className="form-group">
            <label htmlFor="facebookHandle">Facebook</label>
            <div className="input-with-prefix">
              <span className="input-prefix">@</span>
              <input
                id="facebookHandle"
                type="text"
                name="facebookHandle"
                value={formData.facebookHandle}
                onChange={handleChange}
                placeholder="username"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="form-actions">
            <button 
              type="button" 
              className="cancel-button" 
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="save-button"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
      </div>
  </div>
  );
}