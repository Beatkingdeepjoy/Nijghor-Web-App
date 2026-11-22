import { create } from 'zustand';
import { wsRelay } from '../services/websocket';
import { db } from '../db';
import { cryptoWorker } from '../crypto/worker-client';

interface UserProfile {
  userId: string;
  username: string;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isOnboarded: boolean;
  isLocked: boolean;
  lockPin: string | null;
  theme: 'warm-vault' | 'night-ghor';

  setUser: (user: UserProfile | null) => void;
  setTokens: (access: string, refresh: string) => void;
  setIsOnboarded: (val: boolean) => void;
  setIsLocked: (val: boolean) => void;
  toggleTheme: () => void;
  logout: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isOnboarded: false,
  isLocked: false,
  lockPin: null,
  theme: 'warm-vault',

  setUser: (user) => set({ user }),

  setTokens: (access, refresh) => {
    localStorage.setItem('nijghor_access_token', access);
    localStorage.setItem('nijghor_refresh_token', refresh);
    wsRelay.setToken(access);
    wsRelay.connect();
    set({ accessToken: access, refreshToken: refresh });
  },

  setIsOnboarded: (val) => {
    localStorage.setItem('nijghor_onboarded', val ? 'true' : 'false');
    set({ isOnboarded: val });
  },

  setIsLocked: (val) => set({ isLocked: val }),

  toggleTheme: () => {
    const next = get().theme === 'warm-vault' ? 'night-ghor' : 'warm-vault';
    localStorage.setItem('nijghor_theme', next);
    if (next === 'night-ghor') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme: next });
  },

  logout: async () => {
    localStorage.clear();
    wsRelay.disconnect();
    await cryptoWorker.lock();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isOnboarded: false,
      isLocked: false,
    });
  },

  initAuth: async () => {
    const savedTheme = (localStorage.getItem('nijghor_theme') as 'warm-vault' | 'night-ghor') || 'warm-vault';
    if (savedTheme === 'night-ghor') {
      document.documentElement.classList.add('dark');
    }

    const onboarded = localStorage.getItem('nijghor_onboarded') === 'true';
    const access = localStorage.getItem('nijghor_access_token');
    const refresh = localStorage.getItem('nijghor_refresh_token');
    const savedUser = localStorage.getItem('nijghor_user');

    let parsedUser = null;
    if (savedUser) {
      try {
        parsedUser = JSON.parse(savedUser);
      } catch {}
    }

    if (access && onboarded) {
      wsRelay.setToken(access);
      wsRelay.connect();
    }

    set({
      isOnboarded: onboarded,
      accessToken: access,
      refreshToken: refresh,
      user: parsedUser,
      theme: savedTheme,
    });
  },
}));
