import { ROUTES } from "./routes.js";
import { getSessionContext } from "./guards.js";

export async function resolveEntryPoint() {
  const ctx = await getSessionContext();

  if (!ctx.authenticated) {
    return ROUTES.public;
  }

  if (ctx.role === "admin") {
    return ROUTES.admin;
  }

  return ROUTES.user;
}
