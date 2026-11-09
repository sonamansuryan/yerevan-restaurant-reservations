// Values that must never appear in a reply or a log. They're distinctive, so a search finds any leak.
export const SECRET_PASSWORD = "my-very-secret-password";
// JSON.parse quotes short text in full, and only the start of longer text.
export const SECRET_SHORT_PASSWORD = "hunter2-secret";
export const SECRET_HASH_TEXT = "not-a-real-hash";
export const SECRET_HASH = `$argon2id$v=19$m=65536,t=3,p=4$${SECRET_HASH_TEXT}`;

export const secretAccount = { name: "Ani", email: "ani@example.com", password: SECRET_PASSWORD };
export const secretCredentials = { email: "ani@example.com", password: SECRET_PASSWORD };
