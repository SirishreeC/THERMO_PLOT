import React, { useState, useEffect } from 'react';
import './Profile.css';

const Profile = () => {
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    avatar: ''
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading profile...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <img 
            src={profile.avatar || 'https://via.placeholder.com/150'} 
            alt="Avatar" 
            className="avatar"
          />
        </div>
        <div className="profile-body">
          <h2 className="name">{profile.name}</h2>
          <p className="email">{profile.email}</p>
          <p className="bio">{profile.bio}</p>
        </div>
        <div className="profile-footer">
          <button onClick={fetchProfile} className="refresh-btn">
            Refresh Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
