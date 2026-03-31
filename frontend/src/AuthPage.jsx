import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './login.css';

const API_URL = 'http://127.0.0.1:8000';  // URL for Backend 

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  
  const navigate = useNavigate();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    setServerError('');

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const payload = isLogin 
        ? { username: data.username, password: data.password }
        : {
            username: data.username,
            email: data.email,
            password: data.password,
            full_name: data.fullName || '',
            organization: data.organization || ''
          };

      const res = await axios.post(`${API_URL}${endpoint}`, payload);
      
      if (isLogin) {
        // SUCCESSFUL LOGIN → STORE TOKEN → REDIRECT TO DASHBOARD
        localStorage.setItem('token', res.data.access_token);
        navigate('/dashboard');
      } else {
        alert('Registration successful! Please login.');
        setIsLogin(true);
        reset();
      }
    } catch (error) {
      console.error('FULL ERROR:', error.response);
      console.error('ERROR DATA:', error.response?.data);
      
      if (error.response?.status === 400) {
        setServerError(error.response.data.detail || 'Invalid credentials');
      } else if (error.response?.status === 401) {
        setServerError('Invalid username or password');
      } else if (error.response?.status === 404) {
        setServerError('Server not found - Check if backend is running on port 8000');
      } else {
        setServerError('This username/email id is not registered!');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleForm = (e) => {
    e.preventDefault();
    setIsLogin(!isLogin);
    setServerError('');
    reset();
  };

  return (
    <div className="login-container">
      <div className="header-brand">
        <img src="/logo.jpg" alt="ITR Logo" className="header-logo" />
        <div className="header-company">
          <h1>INTEGRATED THERMAL RESEARCH</h1>
        </div>
      </div>

      {/* Main form wrapper */}
      <div className={isLogin ? "login-wrapper" : "signup-wrapper"}>
        <h2 className={isLogin ? "product-title" : "signup-title"}>THERMOPLOT</h2>
        
        <div className="login-box">
          <h3 className="welcome">{isLogin ? 'WELCOME' : 'CREATE ACCOUNT'}</h3>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Registration-only fields */}
            {!isLogin && (
              <>
                <div>
                  <label>Full Name</label>
                  <input 
                    type="text"
                    {...register('fullName')} 
                    placeholder="Enter Full_Name" 
                  />
                </div>
                <div>
                  <label>Organization</label>
                  <input 
                    type="text"
                    {...register('organization')} 
                    placeholder="Company" 
                  />
                </div>
              </>
            )}

            {/* Username field */}
            <div>
              <label>Username</label>
              <input 
                type="text"
                {...register('username', { 
                  required: 'Username required', 
                  minLength: { value: 3, message: 'Min 3 characters' }
                })} 
                placeholder="Enter username" 
              />
              {errors.username && <small style={{color: '#ffeb3b'}}>{errors.username.message}</small>}
            </div>

            {/* Email field - registration only */}
            {!isLogin && (
              <div>
                <label>Email</label>
                <input 
                  {...register('email', { 
                    required: 'Email required',
                    pattern: { 
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 
                      message: 'Invalid email format' 
                    }
                  })} 
                  type="email" 
                  placeholder="user@example.com" 
                />
                {errors.email && <small style={{color: '#ffeb3b'}}>{errors.email.message}</small>}
              </div>
            )}

            {/* Password field */}
            <div>
              <label>Password</label>
              <input 
                {...register('password', { 
                  required: 'Password required', 
                  minLength: { value: 8, message: 'Minimum 8 characters' }
                })} 
                type="password" 
                placeholder="Enter password" 
              />
              {errors.password && <small style={{color: '#ffeb3b'}}>{errors.password.message}</small>}
            </div>

            {/* Confirm Password - registration only */}
            {!isLogin && (
              <div>
                <label>Confirm Password</label>
                <input 
                  {...register('confirmPassword', { 
                    required: 'Confirm password required',
                    validate: value => value === watch('password') || 'Passwords do not match'
                  })} 
                  type="password" 
                  placeholder="Confirm password" 
                />
                {errors.confirmPassword && <small style={{color: '#ffeb3b'}}>{errors.confirmPassword.message}</small>}
              </div>
            )}

            {/* Remember me checkbox */}
            <div className="options">
              <label>
                <input type="checkbox" {...register('rememberMe')} /> Remember me
              </label>
            </div>

            {/* Submit button */}
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Processing...' : (isLogin ? 'LOGIN →' : 'CREATE ACCOUNT →')}
            </button>
          </form>

          {/* Server error display */}
          {serverError && (
            <div className="error" style={{marginTop: '15px'}}>
              {serverError}
            </div>
          )}

          <a href="#" className="register" onClick={toggleForm} style={{marginTop: '20px'}}>
            {isLogin ? (
              <>Don't have an account? <strong><u>REGISTER</u></strong></>
            ) : (
              <>Already have an account? <strong><u>LOGIN</u></strong></>
            )}
          </a>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;



