export type AdminIdentity = {
  id: string;
  loginName: string;
  displayName: string;
  role: "developer" | "manager" | "clerk";
  roleLabel: string;
  staffMemberId: string | null;
};

export type AdminAuthState = {
  loading: boolean;
  user: AdminIdentity | null;
  error: Error | null;
};

export type AdminAuthValue = AdminAuthState & {
  login: (credentials: { loginName: string; password: string }) => Promise<AdminIdentity>;
  logout: () => Promise<void>;
  refresh: (signal?: AbortSignal) => Promise<AdminIdentity | null>;
};
