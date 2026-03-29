import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost, clearTokens, setTokens, getAccessToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiGet("/auth/me");
      setUser({
        user_id: String(me.user_id ?? ""),
        full_name: me.full_name,
        email: me.email,
        phone: me.phone ?? "",
        address: me.address ?? "",
        role_name: me.role_name
      });
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email, password) => {
    const data = await apiPost("/auth/login", { email, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser({
      user_id: String(data.user?.user_id ?? ""),
      full_name: data.user?.full_name,
      email: data.user?.email,
      phone: data.user?.phone ?? "",
      address: data.user?.address ?? "",
      role_name: data.user?.role_name
    });
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    return apiPost("/auth/register", payload);
  }, []);

  const updateProfile = useCallback(async (payload) => {
    const me = await apiPatch("/auth/me", payload);
    setUser({
      user_id: String(me.user_id ?? ""),
      full_name: me.full_name,
      email: me.email,
      phone: me.phone ?? "",
      address: me.address ?? "",
      role_name: me.role_name
    });
    return me;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("bd_refresh_token");
    try {
      if (refreshToken) {
        await apiPost("/auth/logout", { refreshToken });
      }
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      login,
      logout,
      register,
      refreshProfile,
      updateProfile
    }),
    [user, loading, login, logout, register, refreshProfile, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
