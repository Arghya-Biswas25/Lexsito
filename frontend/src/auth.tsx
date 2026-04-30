import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, TOKEN_KEY, USER_KEY } from "./api";
import { router } from "expo-router";

export type User = {
  id: string;
  name: string;
  email: string;
  bar_council_no?: string | null;
  city?: string | null;
  chamber_address?: string | null;
  gstin?: string | null;
  hourly_rate?: number;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; bar_council_no?: string; city?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const stored = await AsyncStorage.getItem(USER_KEY);
      if (token && stored) {
        try {
          setUser(JSON.parse(stored));
          const res = await api.get("/auth/me");
          setUser(res.data);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data));
        } catch {
          await AsyncStorage.removeItem(TOKEN_KEY);
          await AsyncStorage.removeItem(USER_KEY);
          setUser(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password });
    await AsyncStorage.setItem(TOKEN_KEY, res.data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const register = async (data: any) => {
    const res = await api.post("/auth/register", data);
    await AsyncStorage.setItem(TOKEN_KEY, res.data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
    setUser(res.data.user);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    setUser(null);
    router.replace("/login");
  };

  const refreshUser = async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(res.data));
    } catch {}
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => useContext(Ctx);
