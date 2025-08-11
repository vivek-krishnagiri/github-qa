// netlify/functions/me.js
import { json, getCookie, ghFetch } from "./_shared.js";

export const handler = async (event) => {
  try {
    const token = getCookie(event, "gh_token");
    if (!token) return json({ authenticated: false });

    const me = await (await ghFetch("/user", token)).json();
    return json({ authenticated: true, user: me });
  } catch (e) {
    return json({ authenticated: false, error: e.message }, 401);
  }
};
