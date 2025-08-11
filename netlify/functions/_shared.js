// netlify/functions/_shared.js
export function json(body, status = 200, headers = {}) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  };
}

export function redirect(location, status = 302, headers = {}) {
  return {
    statusCode: status,
    headers: { Location: location, ...headers },
    body: ""
  };
}

export function getCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map(s => s.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.split("=").slice(1).join("="));
  }
  return null;
}

export function setCookie(name, value, { maxAgeSec = 60 * 60 * 24 * 7 } = {}) {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAgeSec}`
  ];
  return attrs.join("; ");
}

export async function ghFetch(path, token, init = {}) {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

export function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}
