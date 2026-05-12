/**
 * One-time Google OAuth flow — generates a refresh token for the sync function.
 *
 * Phase 1 (no args):  prints the authorization URL to open in your browser
 * Phase 2 (with code): exchanges the code for tokens and prints the refresh token
 *
 * Usage:
 *   node scripts/google-auth.mjs          ← get the URL
 *   node scripts/google-auth.mjs CODE     ← exchange the code
 */
import { readFileSync } from "fs";

// Load .env.local
const envFile = readFileSync(".env.local", "utf8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"; // out-of-band: Google shows the code on-screen

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

const code = process.argv[2];

if (!code) {
  // Phase 1 — print the URL
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  console.log("\n── Phase 1: Open this URL in your browser ──────────────────────\n");
  console.log(url);
  console.log("\n─────────────────────────────────────────────────────────────────");
  console.log("After you click Allow, Google will show a code on screen.");
  console.log('Run:  node scripts/google-auth.mjs PASTE_CODE_HERE\n');
} else {
  // Phase 2 — exchange the code for tokens
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("\n✗ Token exchange failed:", data.error, data.error_description);
    process.exit(1);
  }

  console.log("\n── Phase 2: Token exchange successful ───────────────────────────\n");
  console.log("REFRESH TOKEN (add this to .env.local as GOOGLE_REFRESH_TOKEN):\n");
  console.log(data.refresh_token);
  console.log("\n─────────────────────────────────────────────────────────────────\n");
}
