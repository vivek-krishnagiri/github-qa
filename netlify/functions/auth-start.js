// netlify/functions/auth-start.js
import { redirect, mustEnv } from "./_shared.js";

export const handler = async (event) => {
  const clientId = mustEnv("GITHUB_CLIENT_ID");
  // Prefer SITE_URL, otherwise use Netlify's URL or current host
  const base =
    process.env.SITE_URL ||
    process.env.URL ||
    `${event.headers["x-forwarded-proto"] || "https"}://${event.headers.host}`;
  const scope = "repo read:user";

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${base}/oauth/callback`);
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("allow_signup", "true");

  return redirect(authorize.toString());
};
