// login.js
// Run once per ~day:  node login.js
// Opens a visible browser, you log in by hand (username, password, OTP),
// then it captures the session cookies + __RequestVerificationToken and
// writes session.json. The n8n wrapper (server.js) reads that file — no
// browser, no OTP, in the n8n path.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const PORTAL_URL =
  process.env.CW_PORTAL_URL ||
  "https://integration.commonwellalliance.lkopera.com/";
const SESSION_FILE = path.join(__dirname, "session.json");

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

(async () => {
  // visible browser + your installed Chrome (no Playwright download needed)
  const browser = await chromium.launch({ headless: false, channel: "chrome" });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("\nOpening the CommonWell portal...");
  console.log("Log in normally in the browser window:");
  console.log("  1. enter username + password, Sign in");
  console.log("  2. click Send OTP");
  console.log("  3. enter the code from your CVS email, submit");
  console.log("  4. when you SEE the logged-in portal, come back here.\n");
  await page.goto(PORTAL_URL, { waitUntil: "domcontentloaded" });

  await ask("Press ENTER here once you are fully logged in... ");

  // navigate to the Transaction Logs page so the antiforgery token is present
  console.log("Navigating to Transaction Logs to grab the token...");
  await page.goto(new URL("TransactionLogs/index", PORTAL_URL).href, {
    waitUntil: "domcontentloaded",
  }).catch(() => {});

  // pull the __RequestVerificationToken hidden input
  let token = null;
  try {
    token = await page
      .locator('input[name="__RequestVerificationToken"]')
      .first()
      .getAttribute("value");
  } catch (e) {}

  // grab all cookies
  const cookies = await context.cookies();

  if (!token) {
    console.log("\n⚠  Could not find __RequestVerificationToken on the page.");
    console.log("   Make sure you were on the Transaction Logs page and logged in.");
  }

  const session = {
    savedAt: new Date().toISOString(),
    portalUrl: PORTAL_URL,
    token,
    cookies,
  };
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
  console.log(`\n✔ Session saved to ${SESSION_FILE}`);
  console.log(`  cookies: ${cookies.length}, token: ${token ? "yes" : "MISSING"}`);
  console.log("  This is good for roughly a day. Re-run when it expires.\n");

  await browser.close();
  process.exit(0);
})();
