const { spawn } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const workspaceArg = (process.argv[2] || "").trim();

if (!workspaceArg) {
  console.error("Usage: npm run open:workspace -- /absolute/path/to/workspace-or-docs");
  process.exit(1);
}

const workspace = path.resolve(workspaceArg);
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const electronBin = path.join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "electron.cmd" : "electron");

function runBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(npmCmd, ["run", "build"], { cwd: repoRoot, stdio: "inherit", shell: false });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`build_failed:${code ?? "unknown"}`));
      }
    });
    child.on("error", reject);
  });
}

function runElectron() {
  const child = spawn(electronBin, [".", "--workspace", workspace], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, AXONIZE_WORKSPACE: workspace }
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });
}

runBuild()
  .then(() => {
    runElectron();
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
