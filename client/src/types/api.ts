/** GET /api/health */
export interface HealthResponse {
  status: "ok";
}

/** The body of every error response. */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
