// netlify/functions/logout.js
import { json, setCookie } from "./_shared.js";

export const handler = async () => {
  // Overwrite + expire the HttpOnly cookie on the server
  const expired = setCookie("gh_token", "", { maxAgeSec: 0 });
  return {
    statusCode: 200,
    headers: { "Set-Cookie": expired, "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true })
  };
};
