// Friendly text for specific codes. Any other code uses its error class's default message.
const MESSAGES: Record<string, string> = {
  SLOT_TAKEN:
    "Sorry, this table was just booked for that time. Please choose another time or table.",
  TABLE_BLOCKED: "This table can’t be booked at that time. Please choose another time or table.",
  RESERVATION_NOT_FOUND: "We couldn’t find this booking.",
  ALREADY_CANCELLED: "This booking is already cancelled.",
  CANCEL_TOO_LATE: "This booking has already started, so it can’t be cancelled.",
  NOT_CONFIRMED: "Confirm this booking first.",
  ALREADY_CONFIRMED: "This booking is already confirmed.",
  ALREADY_ARRIVED: "This guest is already marked as arrived.",
  ALREADY_NO_SHOW: "This booking is already marked as a no-show.",
  CONFIRM_TOO_LATE: "This booking has already started, so it can’t be confirmed.",
  ARRIVAL_TOO_LATE: "This booking is already over, so the guest can’t be marked as arrived.",
  NO_SHOW_TOO_EARLY: "A guest can be marked as a no-show only after their booking starts.",
  DATABASE_UNAVAILABLE: "The database is unavailable right now. Please try again.",
  EMAIL_TAKEN: "There’s already an account with this email.",
  INVALID_CREDENTIALS: "Incorrect email or password. Please try again.",
  SESSION_EXPIRED: "Your session has ended. Please sign in again.",
  GOOGLE_TOKEN_INVALID: "We couldn’t sign you in with Google. Please try again.",
  GOOGLE_EMAIL_UNVERIFIED:
    "Google hasn’t verified this email address yet. Please verify it with Google first.",
  GOOGLE_EMAIL_TAKEN:
    "There’s already an account with this email. Sign in with your password instead.",
  GOOGLE_UNAVAILABLE: "Google sign-in isn’t available right now. Please try again.",
  RESTAURANT_NOT_FOUND: "We couldn’t find this restaurant.",
  PHOTO_NOT_FOUND: "We couldn’t find this photo.",
  TABLE_NOT_FOUND: "We couldn’t find this table.",
  BLOCK_NOT_FOUND: "We couldn’t find this block.",
  UPLOAD_NOT_VERIFIED: "We couldn’t confirm this upload. Please upload the photo again.",
  PHOTO_ALREADY_SAVED: "This photo is already saved.",
};

/** An error we expected and can explain to the client. Anything else is treated as a bug. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(code = "VALIDATION_ERROR", message?: string, details?: unknown) {
    super(400, code, message ?? MESSAGES[code] ?? "The request is invalid.", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = "UNAUTHORIZED", message?: string, details?: unknown) {
    super(401, code, message ?? MESSAGES[code] ?? "Please sign in to continue.", details);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = "FORBIDDEN", message?: string, details?: unknown) {
    super(403, code, message ?? MESSAGES[code] ?? "You don't have permission to do this.", details);
  }
}

export class NotFoundError extends AppError {
  constructor(code = "NOT_FOUND", message?: string, details?: unknown) {
    super(
      404,
      code,
      message ?? MESSAGES[code] ?? "We couldn't find what you're looking for.",
      details,
    );
  }
}

export class ConflictError extends AppError {
  constructor(code = "CONFLICT", message?: string, details?: unknown) {
    super(
      409,
      code,
      message ?? MESSAGES[code] ?? "This conflicts with the current state.",
      details,
    );
  }
}

export class TooManyRequestsError extends AppError {
  constructor(code = "TOO_MANY_REQUESTS", message?: string, details?: unknown) {
    super(
      429,
      code,
      message ?? MESSAGES[code] ?? "Too many attempts. Please wait a minute and try again.",
      details,
    );
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(code = "SERVICE_UNAVAILABLE", message?: string, details?: unknown) {
    super(
      503,
      code,
      message ?? MESSAGES[code] ?? "This service is unavailable right now.",
      details,
    );
  }
}
