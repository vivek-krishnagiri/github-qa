// netlify/functions/auth-callback.js
import { json, getCookie, setCookie, mustEnv } from "./_shared.js";

export const handler = async (event) => {
  try {
    const code = new URL(event.rawUrl).searchParams.get("code");
    if (!code) return json({ error: "Missing code" }, 400);

    const clientId = mustEnv("GITHUB_CLIENT_ID");
    const clientSecret = mustEnv("GITHUB_CLIENT_SECRET");

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code
      })
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || tokenJson.error) {
      return json({ error: tokenJson.error_description || "OAuth exchange failed" }, 400);
    }

    const cookie = setCookie("gh_token", tokenJson.access_token);
    return {
      statusCode: 200,
      headers: { "Set-Cookie": cookie, "Content-Type": "text/html" },
      body: `
        <html>
          <head><meta charset="utf-8" /></head>
          <body>
            <script>window.location = "/";</script>
          </body>
        </html>
      `
    };
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};
