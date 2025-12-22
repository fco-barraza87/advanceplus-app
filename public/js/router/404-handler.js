import { resolveEntryPoint } from "./router.js";

(async () => {
  const target = await resolveEntryPoint();
  window.location.replace(target);
})();
