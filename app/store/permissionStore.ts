import { create } from "zustand";

export interface Permission {
  id: string;
  name: string;
  groupName: string;
  status: string;
}

export interface Role {
  id: string;
  name: string;
}

interface AuthStore {
  role: Role | null;
  permissions: Permission[];
  isAuthReady: boolean;
  setRole: (role: Role) => void;
  setPermissions: (permissions: Permission[]) => void;
  setAuthReady: () => void;
  hasPermission: (group: string, action: string) => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  role: null,
  permissions: [],
  isAuthReady: false,

  setRole: (role) => set({ role }),
  setPermissions: (permissions) => set({ permissions }),
  setAuthReady: () => set({ isAuthReady: true }),

  hasPermission: (group, action) => {
    const { permissions } = get();
    return permissions.some(
      (perm) =>
        perm.groupName === group &&
        perm.name === action &&
        perm.status === "active"
    );
  },
}));
