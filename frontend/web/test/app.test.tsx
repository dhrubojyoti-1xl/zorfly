import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '../src/App.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { ToastProvider } from '../src/context/ToastContext.jsx';

describe('Zorfly web foundation', () => {
  it('redirects unauthenticated users to the OneXL login experience', async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Log In' })).toBeInTheDocument();
  });
});
