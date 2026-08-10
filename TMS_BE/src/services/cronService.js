import { runSlaSweep } from "../lib/cron.js";

export const runSlaCheck = async (force, authHeader, secretParam) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = authHeader || "";
    if (auth !== `Bearer ${secret}` && secretParam !== secret) {
      return { unauthorized: true };
    }
  }

  const result = await runSlaSweep(force);
  return { ok: true, ...result };
};

export default { runSlaCheck };
