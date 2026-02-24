import path from "node:path";
import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";

const repoRoot = path.resolve(__dirname, "../..");

test.describe("Axonize Electron App", () => {
  let app: ElectronApplication | undefined;
  let window: Page;

  test.beforeAll(async () => {
    app = await electron.launch({
      args: ["."],
      cwd: repoRoot,
      env: { ...process.env, AXONIZE_ALLOW_MULTI_INSTANCE: "1" }
    });
    window = await app.firstWindow();
  });

  test.afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test("indexes docs and supports command preview through UI controls", async () => {
    await expect(window.locator("#workspace-path")).not.toHaveText("");

    const docsPath = path.join(repoRoot, "docs");
    await window.fill("#workspace-manual", docsPath);
    await window.click("#set-workspace");
    await expect(window.locator("#workspace-path")).toContainText(repoRoot);

    await window.click("#rebuild");
    await expect(window.locator("#status-log")).toContainText('"processed_files"');

    await expect
      .poll(async () => Number.parseInt((await window.locator("#stat-nodes").innerText()).trim(), 10))
      .toBeGreaterThan(0);
    await expect
      .poll(async () => Number.parseInt((await window.locator("#stat-edges").innerText()).trim(), 10))
      .toBeGreaterThan(0);

    await window.click("#check");
    await expect(window.locator("#status-log")).toContainText('"errors"');

    const targetId = await window.evaluate(async () => {
      const graph = await window.axonize.loadGraph();
      const target = graph.nodes.find((node) => node.type === "paragraph") ?? graph.nodes[0];
      return target ? target.id : null;
    });

    expect(targetId).not.toBeNull();
    await window.fill("#command-target", String(targetId));
    await window.fill("#command-instruction", "make concise");
    await window.selectOption("#command-scope", "block");
    await window.click("#command-preview");

    await expect(window.locator("#command-output")).toContainText('"command": "rewrite"');
    await expect(window.locator("#command-output")).toContainText('"applied": false');
  });
});
