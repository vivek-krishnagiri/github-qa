// netlify/functions/ask.js
import { json, getCookie, ghFetch, mustEnv } from "./_shared.js";

const SYS_PROMPT = `
You are an intent parser for GitHub questions. Output STRICT JSON with fields:
- action: one of ["repo_count","file_count","line_count","list_repos"]
- repo: string | null
- path: string | null (file path inside the repo, e.g. "src/index.js")

Pick the minimal action that answers the question. Examples:
Q: "How many repositories do I have?" -> {"action":"repo_count","repo":null,"path":null}
Q: "How many files are in my repo called notes?" -> {"action":"file_count","repo":"notes","path":null}
Q: "How many lines in app.js in repo travel-app?" -> {"action":"line_count","repo":"travel-app","path":"app.js"}
Q: "List my repositories" -> {"action":"list_repos","repo":null,"path":null}

Return only the JSON.`;

async function interpret(question, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content: question }
      ],
      temperature: 0
    })
  });

  if (!res.ok) {
    const t = await res.text().catch(()=> "");
    throw new Error(`OpenAI error: ${t || res.statusText}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "{}";
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Interpreter did not return valid JSON.");
  }
}

async function getDefaultBranch(owner, repo, token) {
  const r = await (await ghFetch(`/repos/${owner}/${repo}`, token)).json();
  return r.default_branch || "main";
}

async function countFiles(owner, repo, token) {
  const branch = await getDefaultBranch(owner, repo, token);
  const tree = await (await ghFetch(`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, token)).json();
  // Count only blobs (files)
  return (tree.tree || []).filter(n => n.type === "blob").length;
}

async function countLines(owner, repo, path, token) {
  // Get blob SHA via contents endpoint, then fetch blob
  const contents = await (await ghFetch(`/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, token)).json();
  const isFile = contents && contents.type === "file";
  if (!isFile) throw new Error("That path is not a file.");
  const content = Buffer.from(contents.content || "", "base64").toString("utf8");
  if (content.length === 0) return 0;
  // Count newline-delimited lines (last line may not end with \n)
  const lines = content.split(/\r\n|\r|\n/).length;
  return lines;
}

export const handler = async (event) => {
  try {
    const token = getCookie(event, "gh_token");
    if (!token) return json({ error: "Not authenticated." }, 401);

    const { question } = JSON.parse(event.body || "{}");
    if (!question) return json({ error: "Missing 'question'." }, 400);

    const OPENAI_API_KEY = mustEnv("OPENAI_API_KEY");

    // 1) Turn NL into a command
    const intent = await interpret(question, OPENAI_API_KEY);

    // 2) Figure out owner (the signed-in user)
    const me = await (await ghFetch("/user", token)).json();
    const owner = me.login;

    // 3) Execute intent
    let answer = "";
    let details = {};

    if (intent.action === "repo_count") {
      // paginate up to 100 per page
      let page = 1, total = 0, hasMore = true;
      while (hasMore) {
        const res = await (await ghFetch(`/user/repos?per_page=100&page=${page}&type=owner`, token)).json();
        total += res.length;
        hasMore = res.length === 100;
        page += 1;
      }
      answer = `You have ${total} repositories.`;
    } else if (intent.action === "list_repos") {
      const res = await (await ghFetch(`/user/repos?per_page=100&type=owner&sort=updated`, token)).json();
      const names = res.map(r => r.name);
      answer = names.length
        ? `Your repositories (first ${names.length}): ${names.join(", ")}.`
        : "You have no repositories.";
    } else if (intent.action === "file_count") {
      if (!intent.repo) throw new Error("Which repository?");
      const total = await countFiles(owner, intent.repo, token);
      answer = `Repository "${intent.repo}" has ${total} files (default branch).`;
    } else if (intent.action === "line_count") {
      if (!intent.repo || !intent.path) throw new Error("Need repo and file path.");
      const lines = await countLines(owner, intent.repo, intent.path, token);
      answer = `File "${intent.path}" in "${intent.repo}" has ${lines} lines.`;
    } else {
      answer = "I can help with: repo_count, file_count(repo), line_count(repo, path), list_repos. Try one of those.";
    }

    // 4) Optional: let OpenAI polish the wording (kept simple / low tokens)
    const polishedRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Rewrite the answer to be short, friendly, and precise. No extra commentary." },
          { role: "user", content: answer }
        ],
        temperature: 0.2
      })
    });
    if (polishedRes.ok) {
      const pj = await polishedRes.json();
      answer = pj.choices?.[0]?.message?.content?.trim() || answer;
    }

    return json({ ok: true, answer, intent });
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
};
