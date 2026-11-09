import { QueryClient } from "@tanstack/react-query";

// One client for the whole app, so every component shares the same cache of server data.
export const queryClient = new QueryClient();
