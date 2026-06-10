import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const API_BASE = "http://localhost:2567";

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStored(): AuthState {
  try {
    const token = localStorage.getItem("jwt");
    const user = localStorage.getItem("user");
    return { token, user: user ? JSON.parse(user) : null };
  } catch {
    return { token: null, user: null };
  }
}

function store(token: string, user: User) {
  localStorage.setItem("jwt", token);
  localStorage.setItem("user", JSON.stringify(user));
}

function clear() {
  localStorage.removeItem("jwt");
  localStorage.removeItem("user");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(getStored);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "login failed");
    }
    const data = await res.json();
    store(data.token, data.user);
    setState({ token: data.token, user: data.user });
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "registration failed");
    }
    const data = await res.json();
    store(data.token, data.user);
    setState({ token: data.token, user: data.user });
  }, []);

  const logout = useCallback(() => {
    clear();
    setState({ token: null, user: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
