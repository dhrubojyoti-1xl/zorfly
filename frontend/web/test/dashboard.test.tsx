import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from '../src/pages/Dashboard.jsx';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../src/api/client.js', () => ({
  api: { get: getMock }
}));

vi.mock('../src/context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { fullName: 'Aarav Mehta' },
    company: { id: 'tenant-1', name: 'Northstar Learning' },
    role: 'company_admin'
  })
}));

describe('executive dashboard', () => {
  beforeEach(() => {
    getMock.mockImplementation((path) => {
      if (path === '/dashboard/company') {
        return Promise.resolve({
          data: {
            data: {
              totalEmployees: 128,
              totalAttempts: 842,
              participationRate: 91,
              avgPercentage: 86,
              departmentAverages: [],
              topPerformers: [],
              needsAttention: []
            }
          }
        });
      }
      if (path === '/dashboard/me') {
        return Promise.resolve({
          data: {
            data: {
              testsAttempted: 14,
              avgPercentage: 88,
              avgAccuracy: 92,
              practiceTests: 6
            }
          }
        });
      }
      return Promise.resolve({ data: { data: { badges: [], totalPoints: 0 } } });
    });
  });

  it('renders tenant-scoped company and personal metrics without placeholder data', async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText('Company overview')).toBeInTheDocument();
    expect(screen.getByText('Northstar Learning')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
    expect(screen.getByText('842')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(getMock).toHaveBeenCalledWith('/dashboard/company');
    expect(getMock).toHaveBeenCalledWith('/dashboard/me');
  });
});
