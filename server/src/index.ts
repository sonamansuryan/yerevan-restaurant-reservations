import { app } from "./app.ts";
import { env } from "./config/env.ts";

// Express 5 passes startup errors, such as a port already in use, to this callback. Ignoring the
// argument would print the success message even when the server failed to start.
app.listen(env.PORT, (error) => {
  if (error) throw error;
  console.log(`API listening on http://localhost:${env.PORT}`);
});
