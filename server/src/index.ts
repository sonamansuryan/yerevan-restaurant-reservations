import { app } from "./app.ts";

// Temporary: the env task moves this to src/config/env.ts, the only file that reads process.env.
const PORT = 4000;

// Express 5 passes startup errors, such as a port already in use, to this callback. Ignoring the
// argument would print the success message even when the server failed to start.
app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`API listening on http://localhost:${PORT}`);
});
