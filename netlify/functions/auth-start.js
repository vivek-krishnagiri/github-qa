// netlify/functions/auth-start.js
import { redirect, mustEnv } from "./_shared.js";

export const handler = async () => {
  const clientId = mustEnv("GITHUB_CLIENT_ID");
  const siteUrl = mustEnv("SITE_URL"); // e.g. https://your-site.netlify.app
  const scope = "repo read:user"; // read access is enough for listing/counting

  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", `${siteUrl}/oauth/callback`);
  authorize.searchParams.set("scope", scope);
  authorize.searchParams.set("allow_signup", "true");

  return redirect(authorize.toString());
};
