import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/manrope';
import App from './App.jsx';
import { applyAccent } from './components/AccentSwitcher.jsx';
import { applyTheme } from './components/ThemeSwitcher.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import './styles.css';

// Restore the user's saved preferences before first paint (no flash).
const savedFontSize = localStorage.getItem('zorfly_font_size') || 'medium';
document.documentElement.dataset.fontSize = savedFontSize;
applyTheme(localStorage.getItem('zorfly_theme') || 'system');
applyAccent(localStorage.getItem('zorfly_accent') || 'navy');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
