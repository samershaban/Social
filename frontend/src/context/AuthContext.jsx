import { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken, setToken, clearToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api.getMyProfile()
      .then((profile) => setUser(profile))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { user, token } = await api.login({ email, password });
    setToken(token);
    setUser(user);
    return user;
  }

  async function register(username, email, password) {
    const { user, token } = await api.register({ username, email, password });
    setToken(token);
    setUser(user);
    return user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
