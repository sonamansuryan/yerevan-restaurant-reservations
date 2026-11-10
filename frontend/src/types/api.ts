/** GET /api/health */
export interface HealthResponse {
  status: "ok";
}

/** A user, as the auth endpoints return them. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: "CUSTOMER" | "OWNER" | "ADMIN";
}

/** POST /api/auth/register, /login, /google and /refresh, and GET /api/me */
export interface AuthResponse {
  user: AuthUser;
}

/** The body of every error response. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
