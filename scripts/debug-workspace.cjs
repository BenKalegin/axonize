const path = require("node:path");
const { _electron: electron } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

const workspaceInput = (args.find((arg) => !arg.startsWith("--")) || "").trim();
if (!workspaceInput) {
  console.error("Usage: npm run debug:workspace -- /absolute/path/to/workspace-or-docs [--full] [--keep-open]");
  process.exit(1);
}

const workspace = path.resolve(workspaceInput);
const keepOpen = args.includes("--keep-open");
const full = args.includes("--full") || !args.includes("--incremental");

async function run() {
  const app = await electron.launch({
    args: [".", "--workspace", workspace],
    cwd: repoRoot,
    env: { ...process.env, AXONIZE_WORKSPACE: workspace, AXONIZE_ALLOW_MULTI_INSTANCE: "1" }
  });

  const win = await app.firstWindow();
  await win.waitForSelector("#workspace-path", { timeout: 30_000 });
  await win.click(full ? "#rebuild-full" : "#rebuild");

  await win.waitForFunction(
    () => {
      const text = (document.querySelector("#status-log")?.textContent || "").trim();
      return text.includes('"processed_files"');
    },
    { timeout: 120_000 }
  );

  const result = {
    workspace: (await win.locator("#workspace-path").innerText()).trim(),
    nodes: (await win.locator("#stat-nodes").innerText()).trim(),
    edges: (await win.locator("#stat-edges").innerText()).trim(),
    status: (await win.locator("#status-log").innerText()).trim()
  };
  console.log(JSON.stringify(result, null, 2));

  if (keepOpen) {
    await new Promise(() => {});
  } else {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
