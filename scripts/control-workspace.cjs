const path = require("node:path");
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const workspaceInput = (args.find((arg) => !arg.startsWith("--")) || "").trim();
const full = args.includes("--full");
const portArg = args.find((arg) => arg.startsWith("--port="));
const port = portArg ? portArg.split("=", 2)[1] : "9222";

if (!workspaceInput) {
  console.error("Usage: npm run control:workspace -- /absolute/path/to/workspace-or-docs [--full] [--port=9222]");
  process.exit(1);
}

const workspace = path.resolve(workspaceInput);

async function findAxonizePage(browser) {
  const contexts = browser.contexts();
  for (const context of contexts) {
    for (const page of context.pages()) {
      try {
        await page.waitForSelector("#workspace-path", { timeout: 1500 });
        return page;
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function run() {
  const endpoint = `http://127.0.0.1:${port}`;
  const browser = await chromium.connectOverCDP(endpoint);

  const page = await findAxonizePage(browser);
  if (!page) {
    throw new Error(`axonize_window_not_found_at_${endpoint}`);
  }

  await page.fill("#workspace-manual", workspace);
  await page.click("#set-workspace");
  await page.click(full ? "#rebuild-full" : "#rebuild");

  await page.waitForFunction(
    () => {
      const text = (document.querySelector("#status-log")?.textContent || "").trim();
      return text.includes('"processed_files"');
    },
    { timeout: 120_000 }
  );

  const result = {
    workspace: (await page.locator("#workspace-path").innerText()).trim(),
    nodes: (await page.locator("#stat-nodes").innerText()).trim(),
    edges: (await page.locator("#stat-edges").innerText()).trim(),
    status: (await page.locator("#status-log").innerText()).trim()
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
