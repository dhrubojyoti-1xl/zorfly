import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getAccessToken, setAccessToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [role, setRole] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    setCompany(data.company);
    setRole(data.role);
  }, []);

  const loadMe = useCallback(async () => {
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const response = await api.get('/auth/me');
      const data = response.data.data;
      setUser(data.user);
      setCompany(data.company);
      setRole(data.role);
      setCompanies(data.companies || []);
      setPermissions(data.permissions || []);
    } catch {
      setAccessToken('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const logIn = useCallback(
    async ({ email, password }) => {
      const response = await api.post('/auth/login', { email, password });
      const data = response.data.data;
      if (data.requiresCompanySelection) {
        return {
          requiresCompanySelection: true,
          preAuthToken: data.preAuthToken,
          companies: data.companies
        };
      }
      applySession(data);
      await loadMe();
      return { requiresCompanySelection: false };
    },
    [applySession, loadMe]
  );

  const registerCompany = useCallback(
    async (payload) => {
      const response = await api.post('/auth/register', payload);
      applySession(response.data.data);
      await loadMe();
    },
    [applySession, loadMe]
  );

  const selectCompany = useCallback(
    async ({ preAuthToken, companyId }) => {
      const response = await api.post('/auth/select-company', { preAuthToken, companyId });
      applySession(response.data.data);
      await loadMe();
    },
    [applySession, loadMe]
  );

  // Sidebar Company Switcher — swaps the active company without re-login.
  const switchCompany = useCallback(
    async (companyId) => {
      const response = await api.post('/auth/switch-company', { companyId });
      applySession(response.data.data);
      await loadMe();
    },
    [applySession, loadMe]
  );

  const logOut = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Clearing the local session matters more than the server call succeeding.
    }
    setAccessToken('');
    setUser(null);
    setCompany(null);
    setRole(null);
    setCompanies([]);
    setPermissions([]);
  }, []);

  // Company Admin implicitly holds every permission; everyone else is checked
  // against the resolved set from the server.
  const can = useCallback(
    (permission) => role === 'company_admin' || permissions.includes(permission),
    [role, permissions]
  );

  const value = useMemo(
    () => ({
      user,
      company,
      role,
      companies,
      permissions,
      can,
      loading,
      isAuthenticated: Boolean(user),
      logIn,
      registerCompany,
      selectCompany,
      switchCompany,
      logOut,
      loadSession: loadMe
    }),
    [
      user,
      company,
      role,
      companies,
      permissions,
      can,
      loading,
      logIn,
      registerCompany,
      selectCompany,
      switchCompany,
      logOut,
      loadMe
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
