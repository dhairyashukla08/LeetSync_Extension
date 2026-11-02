import React, { useState, useEffect, useCallback } from "react";
import { send } from "../api.js";

const card = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 10,
  padding: "12px 14px",
  marginBottom: 12,
};
const title = {
  fontSize: "0.68rem",
  fontWeight: 700,
  color: "rgba(240,246,255,0.5)",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  marginBottom: 8,
};
const input = {
  width: "100%",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 7,
  padding: "8px 10px",
  color: "#f0f6ff",
  fontSize: "0.78rem",
  fontFamily: "JetBrains Mono, monospace",
};
const btn = (primary) => ({
  width: "100%",
  padding: "9px 0",
  borderRadius: 8,
  fontWeight: 700,
  fontSize: "0.8rem",
  cursor: "pointer",
  border: primary ? "none" : "1px solid rgba(255,255,255,0.15)",
  background: primary
    ? "linear-gradient(135deg,#00ff88,#4f8cff)"
    : "transparent",
  color: primary ? "#050b14" : "rgba(240,246,255,0.7)",
});
const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: "0.78rem",
  color: "rgba(240,246,255,0.8)",
};
const small = {
  fontSize: "0.68rem",
  color: "rgba(240,246,255,0.4)",
  marginTop: 6,
};

const PRESETS = [
  { label: "Default", value: "LeetCode/{id}-{slug}/" },
  { label: "By difficulty", value: "LeetCode/{difficulty}/{id}-{slug}/" },
  { label: "By topic", value: "LeetCode/{topic}/{id}-{slug}/" },
  { label: "By language", value: "LeetCode/{lang}/{id}-{slug}/" },
  { label: "Keep every language", value: "LeetCode/{id}-{slug}/{lang}/" },
];

function Toggle({ label, value, onChange }) {
  return (
    <div style={{ ...row, marginTop: 10 }}>
      <span>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 38,
          height: 22,
          borderRadius: 11,
          padding: 2,
          border: "none",
          cursor: "pointer",
          background: value ? "#00ff88" : "rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            transform: value ? "translateX(16px)" : "translateX(0)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}

export default function Settings({ onStatus }) {
  const [lc, setLc] = useState({ loggedIn: false, username: "" });
  const [gh, setGh] = useState({ connected: false });
  const [repos, setRepos] = useState([]);
  const [form, setForm] = useState({
    folderTemplate: "LeetCode/{id}-{slug}/",
    bestSubmissionOnly: false,
    streakRemind: true,
    aiCommit: false,
    aiKey: "",
    aiModel: "",
    aiFallbackModel: "",
  });
  const [newRepo, setNewRepo] = useState("");
  const [msg, setMsg] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiTest, setAiTest] = useState(null);
  const [aiTesting, setAiTesting] = useState(false);
  const [folderPreview, setFolderPreview] = useState({ path: "", warnings: [] });

  const [repoInput, setRepoInput] = useState("");
  const submitRepoUrl = async () => {
    const r = await send("GH_SET_REPO", { input: repoInput });
    if (r.ok) {
      setRepos((l) =>
        l.some((x) => x.full_name === r.repo.full_name) ? l : [r.repo, ...l],
      );
      setRepoInput("");
    } else setMsg(r.error);
    refresh();
  };

  const testAi = async () => {
    setAiTesting(true);
    setAiTest(null);
    const r = await send("AI_TEST");
    setAiTest(r);
    setAiTesting(false);
  };

  const refresh = useCallback(async () => {
    const [l, g] = await Promise.all([send("LC_STATUS"), send("GH_STATUS")]);
    setLc(l);
    setGh(g);
    onStatus?.({ lc: l, gh: g });
    chrome.storage?.local.get("aiLastError", (d) =>
      setAiError(d.aiLastError || ""),
    );
  }, [onStatus]);

  // Poll while the tab is open (login happens in other tabs / background)
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    chrome.storage?.local.get(
      [
        "folderTemplate",
        "bestSubmissionOnly",
        "streakRemind",
        "aiCommit",
        "aiKey",
        "aiModel",
        "aiFallbackModel",
      ],
      (d) =>
        setForm((f) => ({
          folderTemplate: d.folderTemplate || f.folderTemplate,
          bestSubmissionOnly: !!d.bestSubmissionOnly,
          streakRemind: d.streakRemind !== false,
          aiCommit: !!d.aiCommit,
          aiKey: d.aiKey || "",
          aiModel: d.aiModel || "",
          aiFallbackModel: d.aiFallbackModel || "",
        })),
    );
  }, []);

  useEffect(() => {
    if (gh.connected && repos.length === 0)
      send("GH_REPOS").then((r) => setRepos(r.repos || []));
  }, [gh.connected]);

  // Live folder preview, computed by the same code that builds real paths
  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await send("FOLDER_PREVIEW", { template: form.folderTemplate });
      setFolderPreview({ path: r.path || "", warnings: r.warnings || [] });
    }, 250);
    return () => clearTimeout(t);
  }, [form.folderTemplate]);

  const updateForm = (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    chrome.storage.local.set(next);
  };

  const connectGitHub = async () => {
    setMsg("");
    const r = await send("GH_CONNECT");
    if (!r.ok) setMsg(r.error || "Could not start GitHub login");
    refresh();
  };

  const pickRepo = async (full) => {
    const r = repos.find((x) => x.full_name === full);
    await chrome.storage.local.set({
      ghRepo: full,
      ghBranch: r?.default_branch || "main",
    });
    refresh();
  };

  const createRepo = async () => {
    const name = newRepo.trim().replace(/\s+/g, "-");
    if (!name) return;
    setMsg("");
    const r = await send("GH_CREATE_REPO", { name });
    if (r.ok) {
      setRepos((list) => [r.repo, ...list]);
      setNewRepo("");
    } else setMsg(r.error || "Could not create repo");
    refresh();
  };

  const disconnect = async () => {
    await send("GH_DISCONNECT");
    setRepos([]);
    refresh();
  };

  const presetValue = PRESETS.some((p) => p.value === form.folderTemplate)
    ? form.folderTemplate
    : "custom";

  return (
    <div>
      {/* ── LeetCode ── */}
      <div style={card}>
        <div style={title}>1 · LeetCode</div>
        {lc.loggedIn ? (
          <div style={row}>
            <span>✅ Logged in{lc.username ? ` as ${lc.username}` : ""}</span>
          </div>
        ) : (
          <>
            <button
              style={btn(true)}
              onClick={() =>
                chrome.tabs.create({
                  url: "https://leetcode.com/accounts/login/",
                })
              }
            >
              Log in to LeetCode
            </button>
            <div style={small}>
              Log in on leetcode.com as usual. LeetSync never sees your
              password.
            </div>
          </>
        )}
        {lc.loggedIn && !lc.username && (
          <div style={small}>
            Open any leetcode.com page once to show your username here.
          </div>
        )}
      </div>

      {/* ── GitHub ── */}
      <div style={card}>
        <div style={title}>2 · GitHub</div>

        {!gh.connected && !gh.pending && (
          <>
            <button style={btn(true)} onClick={connectGitHub}>
              Connect GitHub
            </button>
            <div style={small}>
              You'll get a short code to enter on github.com/login/device.
            </div>
          </>
        )}

        {gh.pending && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: "0.72rem",
                color: "rgba(240,246,255,0.5)",
                marginBottom: 6,
              }}
            >
              Enter this code on GitHub:
            </div>
            <div
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: "1.4rem",
                fontWeight: 800,
                letterSpacing: "0.15em",
                color: "#00ff88",
              }}
            >
              {gh.pending.user_code}
            </div>
            <button
              style={{ ...btn(false), marginTop: 10 }}
              onClick={() =>
                chrome.tabs.create({ url: gh.pending.verification_uri })
              }
            >
              Open GitHub
            </button>
            <div style={small}>Waiting for approval…</div>
          </div>
        )}

        {gh.connected && (
          <>
            <div style={{ ...row, marginBottom: 12 }}>
              <span>
                ✅ Connected as <b>{gh.user}</b>
              </span>
              <button
                onClick={disconnect}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ff4444",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                }}
              >
                Disconnect
              </button>
            </div>

            <div style={{ ...title, marginBottom: 5 }}>Repository</div>
            <select
              value={gh.repo || ""}
              onChange={(e) => pickRepo(e.target.value)}
              style={input}
            >
              <option value="">Select a repo…</option>
              {repos.map((r) => (
                <option key={r.full_name} value={r.full_name}>
                  {r.full_name}
                  {r.private ? " 🔒" : ""}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                value={newRepo}
                onChange={(e) => setNewRepo(e.target.value)}
                placeholder="or create: leetcode-solutions"
                style={input}
              />
              <button onClick={createRepo} style={{ ...btn(false), width: 70 }}>
                Create
              </button>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                placeholder="or paste repo URL / owner/repo"
                style={input}
              />
              <button
                onClick={submitRepoUrl}
                style={{ ...btn(false), width: 70 }}
              >
                Use
              </button>
            </div>
            <div style={small}>New repos are private. Branch: {gh.branch}</div>
          </>
        )}

        {(gh.error || msg) && (
          <div style={{ ...small, color: "#ff4444" }}>{gh.error || msg}</div>
        )}
      </div>

      {/* ── Options ── */}
      {gh.connected && (
        <div style={card}>
          <div style={title}>3 · Options</div>

          {/* Folder structure */}
          <div style={{ ...title, marginBottom: 5 }}>Folder structure</div>
          <select
            value={presetValue}
            onChange={(e) => {
              if (e.target.value !== "custom")
                updateForm({ folderTemplate: e.target.value });
            }}
            style={input}
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
          <input
            value={form.folderTemplate}
            onChange={(e) => updateForm({ folderTemplate: e.target.value })}
            style={{ ...input, marginTop: 6 }}
          />
          <div style={small}>
            Variables: {"{id}"} {"{slug}"} {"{difficulty}"} {"{topic}"}{" "}
            {"{lang}"}
          </div>
          {folderPreview.path && (
            <div
              style={{
                ...small,
                color: "rgba(240,246,255,0.65)",
                fontFamily: "JetBrains Mono, monospace",
                wordBreak: "break-all",
              }}
            >
              Preview: {folderPreview.path}
            </div>
          )}
          {folderPreview.warnings.map((w) => (
            <div key={w} style={{ ...small, color: "#ffab00" }}>
              ⚠ {w}
            </div>
          ))}
          <div style={small}>
            Applies to new syncs only. Existing files stay where they are.
          </div>

          <Toggle
            label="Best submission only"
            value={form.bestSubmissionOnly}
            onChange={(v) => updateForm({ bestSubmissionOnly: v })}
          />

          {/* AI commit messages */}
          <Toggle
            label="AI commit messages"
            value={form.aiCommit}
            onChange={(v) => updateForm({ aiCommit: v })}
          />
          {form.aiCommit && (
            <>
              <input
                type="password"
                placeholder="Gemini API key"
                value={form.aiKey}
                onChange={(e) => updateForm({ aiKey: e.target.value })}
                style={{ ...input, marginTop: 8 }}
              />
              <input
                placeholder="model (default: gemini-3.5-flash)"
                value={form.aiModel}
                onChange={(e) => updateForm({ aiModel: e.target.value })}
                style={{ ...input, marginTop: 6 }}
              />
              <input
                placeholder="fallback model (optional)"
                value={form.aiFallbackModel}
                onChange={(e) =>
                  updateForm({ aiFallbackModel: e.target.value })
                }
                style={{ ...input, marginTop: 6 }}
              />
              <div style={small}>
                Your solution code is sent to Google to write the commit
                message. Get a key at aistudio.google.com. If the AI call fails,
                the default message is used.
              </div>
              <button
                style={{ ...btn(false), marginTop: 8 }}
                onClick={testAi}
                disabled={aiTesting}
              >
                {aiTesting ? "Testing… (keep this popup open)" : "Test AI"}
              </button>
              {aiTest && (
                <div
                  style={{
                    ...small,
                    color: aiTest.ok ? "#00ff88" : "#ff4444",
                  }}
                >
                  {aiTest.ok
                    ? `✓ "${aiTest.message}" (${aiTest.ms} ms)`
                    : `✗ ${aiTest.error} (${aiTest.ms ?? 0} ms)`}
                </div>
              )}
              {aiError && (
                <div style={{ ...small, color: "#ff4444" }}>
                  Last AI error: {aiError}
                </div>
              )}
            </>
          )}

          <Toggle
            label="Streak reminders"
            value={form.streakRemind}
            onChange={async (v) => {
              await chrome.storage.local.set({ streakRemind: v });
              setForm((f) => ({ ...f, streakRemind: v }));
              send("STREAK_CHECK");
            }}
          />
          <button
            style={{ ...btn(false), marginTop: 10 }}
            onClick={() => send("STREAK_CHECK", { test: true })}
          >
            Send test reminder
          </button>
        </div>
      )}
    </div>
  );
}