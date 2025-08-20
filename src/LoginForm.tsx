import React, { useState } from 'react';
import './Login.css';

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
  mode: 'login' | 'register';
  setMode: (mode: 'login' | 'register') => void;
  loading: boolean;
  error: string | null;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onRegister, mode, setMode, loading, error }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await onLogin(username, password);
    } else {
      await onRegister(username, password);
    }
  };

  return (
    <div className="login">
      <div className="login__wrapper">
        <div className="login__card">
          <div
            className="login__side"
            style={{ backgroundImage: "url('https://i.pinimg.com/1200x/6f/20/a6/6f20a6dc97c43da3f7205dabc7e84057.jpg')" }}
            aria-hidden="true"
          />

          {/* ฟอร์ม login */}
          <form className="login__form" onSubmit={handleSubmit}>
            <h1 className="login__title">{mode === 'login' ? 'Login' : 'Register'}</h1>
            <div className="login__content">
              <div className="login__box">
                <i className="ri-user-3-line login__icon"></i>
                <div className="login__box-input">
                  <input
                    type="text"
                    required
                    className="login__input"
                    id="login-username"
                    placeholder=" "
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <label htmlFor="login-username" className="login__label">Username</label>
                </div>
              </div>
              <div className="login__box">
                <i className="ri-lock-2-line login__icon"></i>
                <div className="login__box-input">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className="login__input"
                    id="login-pass"
                    placeholder=" "
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <label htmlFor="login-pass" className="login__label">Password</label>
                  <i
                    className={showPassword ? 'ri-eye-line login__eye' : 'ri-eye-off-line login__eye'}
                    id="login-eye"
                    onClick={() => setShowPassword(v => !v)}
                    style={{ cursor: 'pointer' }}
                  ></i>
                </div>
              </div>
            </div>
            {error && <div style={{ color: 'salmon', marginBottom: 12 }}>{error}</div>}
            <button type="submit" className="login__button" disabled={loading}>
              {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Register'}
            </button>
            <p className="login__register">
              {mode === 'login' ? (
                <>Don't have an account? <a href="#" onClick={e => { e.preventDefault(); setMode('register'); }}>Register</a></>
              ) : (
                <>Already have an account? <a href="#" onClick={e => { e.preventDefault(); setMode('login'); }}>Login</a></>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginForm; 