const edgeColors: Record<string, string> = {
  depends_on: "#bf5f2f",
  defines: "#1f6d67",
  implements: "#17445f",
  extends: "#5b6f2e",
  example_of: "#8b4b77",
  uses: "#6f4a2a",
  alternative_to: "#375b82",
  related_to: "#6a5f4a"
};

const refs = {
  workspacePath: document.getElementById("workspace-path") as HTMLDivElement,
  statusLog: document.getElementById("status-log") as HTMLPreElement,
  statNodes: document.getElementById("stat-nodes") as HTMLElement,
  statEdges: document.getElementById("stat-edges") as HTMLElement,
  statChanged: document.getElementById("stat-changed") as HTMLElement,
  orbit: document.getElementById("orbit-canvas") as unknown as SVGSVGElement,
  zoomLevel: document.getElementById("zoom-level") as HTMLSelectElement,
  commandOutput: document.getElementById("command-output") as HTMLPreElement,
  commandTarget: document.getElementById("command-target") as HTMLInputElement,
  commandInstruction: document.getElementById("command-instruction") as HTMLInputElement,
  commandScope: document.getElementById("command-scope") as HTMLSelectElement,
  workspaceManual: document.getElementById("workspace-manual") as HTMLInputElement,
  themeMode: document.getElementById("theme-mode") as HTMLSelectElement
};

let graphState: { nodes: GraphNode[]; edges: GraphEdge[] } = { nodes: [], edges: [] };
let detachWorkspaceListener: (() => void) | null = null;
let detachThemeListener: (() => void) | null = null;

function setStatus(message: string): void {
  refs.statusLog.textContent = message;
}

function setWorkspaceLabel(workspacePath: string): void {
  refs.workspacePath.textContent = workspacePath;
  refs.workspaceManual.value = workspacePath;
}

function applyTheme(state: ThemeState): void {
  document.documentElement.dataset.theme = state.effective;
  refs.themeMode.value = state.source;
  renderOrbit(refs.zoomLevel.value as ZoomLevel);
}

function updateStats(report?: RebuildReport): void {
  refs.statNodes.textContent = String(graphState.nodes.length);
  refs.statEdges.textContent = String(graphState.edges.length);
  refs.statChanged.textContent = String(report?.changed_files.length ?? 0);
}

function truncate(value: string, size: number): string {
  if (value.length <= size) {
    return value;
  }
  return `${value.slice(0, size - 1)}…`;
}

function abstractionLabel(node: GraphNode, zoom: ZoomLevel): string {
  if (zoom === "z0") {
    return node.id.slice(0, 8);
  }
  if (zoom === "z1") {
    return node.title || node.type;
  }
  if (zoom === "z2") {
    return `• ${truncate(node.title || node.type, 28)}`;
  }
  if (zoom === "z3") {
    return `${truncate(node.title || node.type, 30)} · ${node.type}`;
  }
  return `${truncate(node.title || node.type, 34)} · ${node.type} · ${truncate(node.file, 18)}`;
}

function clearOrbit(): void {
  while (refs.orbit.firstChild) {
    refs.orbit.removeChild(refs.orbit.firstChild);
  }
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

function renderOrbit(zoom: ZoomLevel): void {
  clearOrbit();
  const { nodes, edges } = graphState;
  if (nodes.length === 0) {
    return;
  }

  const width = 960;
  const height = 640;
  const cx = width / 2;
  const cy = height / 2;
  const focus = nodes.find((node) => node.type === "section") ?? nodes[0];
  const linkedEdges = edges.filter((edge) => edge.source === focus.id || edge.target === focus.id).slice(0, 24);
  const neighborIds = new Set<string>();
  for (const edge of linkedEdges) {
    if (edge.source !== focus.id) {
      neighborIds.add(edge.source);
    }
    if (edge.target !== focus.id) {
      neighborIds.add(edge.target);
    }
  }
  const neighbors = nodes.filter((node) => neighborIds.has(node.id));

  const ring = svgElement("circle");
  ring.setAttribute("cx", String(cx));
  ring.setAttribute("cy", String(cy));
  ring.setAttribute("r", "220");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "var(--orbit-ring)");
  ring.setAttribute("stroke-width", "1.5");
  refs.orbit.appendChild(ring);

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(focus.id, { x: cx, y: cy });
  neighbors.forEach((node, index) => {
    const theta = (Math.PI * 2 * index) / Math.max(neighbors.length, 1);
    const jitter = (node.id.charCodeAt(0) % 7) * 0.02;
    const radius = 220 + (node.id.charCodeAt(1) % 4) * 8;
    positions.set(node.id, {
      x: cx + Math.cos(theta + jitter) * radius,
      y: cy + Math.sin(theta + jitter) * radius
    });
  });

  for (const edge of linkedEdges) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) {
      continue;
    }
    const line = svgElement("line");
    line.setAttribute("x1", String(source.x));
    line.setAttribute("y1", String(source.y));
    line.setAttribute("x2", String(target.x));
    line.setAttribute("y2", String(target.y));
    line.setAttribute("stroke", edgeColors[edge.type] ?? "var(--edge-line-default)");
    line.setAttribute("stroke-width", String(Math.max(1.3, edge.weight * 2.4)));
    line.setAttribute("opacity", String(Math.max(0.22, Math.min(1, edge.weight))));
    refs.orbit.appendChild(line);
  }

  function drawNode(node: GraphNode, isCenter: boolean): void {
    const pos = positions.get(node.id);
    if (!pos) {
      return;
    }
    const group = svgElement("g");
    group.setAttribute("transform", `translate(${pos.x}, ${pos.y})`);

    const circle = svgElement("circle");
    circle.setAttribute("r", isCenter ? "36" : "22");
    circle.setAttribute("fill", isCenter ? "var(--node-focus)" : "var(--node-default)");
    circle.setAttribute("opacity", isCenter ? "0.94" : "0.86");
    circle.setAttribute("stroke", "var(--node-stroke)");
    circle.setAttribute("stroke-width", "2");
    group.appendChild(circle);

    const text = svgElement("text");
    text.setAttribute("x", "0");
    text.setAttribute("y", isCenter ? "58" : "42");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "var(--ink-strong)");
    text.setAttribute("font-size", isCenter ? "14" : "12");
    text.setAttribute("font-family", "'Avenir Next', 'Futura', sans-serif");
    text.textContent = abstractionLabel(node, zoom);
    group.appendChild(text);

    refs.orbit.appendChild(group);
  }

  drawNode(focus, true);
  neighbors.forEach((node) => drawNode(node, false));
}

async function refreshGraph(): Promise<void> {
  const graph = await window.axonize.loadGraph();
  graphState = { nodes: graph.nodes, edges: graph.edges };
  updateStats();
  renderOrbit(refs.zoomLevel.value as ZoomLevel);
}

async function runRebuild(full: boolean): Promise<void> {
  setStatus(`${full ? "Full" : "Incremental"} rebuild running...`);
  const report = await window.axonize.rebuild(full);
  const graph = await window.axonize.loadGraph();
  graphState = { nodes: graph.nodes, edges: graph.edges };
  updateStats(report);
  renderOrbit(refs.zoomLevel.value as ZoomLevel);
  setStatus(JSON.stringify(report, null, 2));
}

async function runCheck(): Promise<void> {
  const result = await window.axonize.check();
  setStatus(JSON.stringify(result, null, 2));
}

function currentCommandPayload(): CommandPayload {
  return {
    command: "rewrite",
    target: refs.commandTarget.value.trim(),
    instruction: refs.commandInstruction.value.trim(),
    scope: (refs.commandScope.value as "block" | "section") ?? "block"
  };
}

async function runCommand(apply: boolean): Promise<void> {
  const payload = currentCommandPayload();
  if (!payload.target || !payload.instruction) {
    refs.commandOutput.textContent = "target and instruction are required";
    return;
  }
  const result = await window.axonize.runCommand(payload, apply);
  refs.commandOutput.textContent = JSON.stringify(result, null, 2);
  if (apply) {
    await refreshGraph();
  }
}

async function initialize(): Promise<void> {
  if (!detachWorkspaceListener) {
    detachWorkspaceListener = window.axonize.onWorkspaceChanged((payload) => {
      setWorkspaceLabel(payload.workspacePath);
      void runRebuild(false);
    });
  }

  if (!detachThemeListener) {
    detachThemeListener = window.axonize.onThemeChanged((payload) => {
      applyTheme(payload);
    });
  }

  const theme = await window.axonize.getTheme();
  applyTheme(theme);

  const workspace = await window.axonize.getWorkspace();
  setWorkspaceLabel(workspace.workspacePath);

  try {
    await runRebuild(false);
  } catch (error) {
    setStatus(`Initialization error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

document.getElementById("choose-workspace")?.addEventListener("click", async () => {
  try {
    await window.axonize.chooseWorkspace();
  } catch (error) {
    setStatus(`Choose workspace failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

document.getElementById("set-workspace")?.addEventListener("click", async () => {
  const requested = refs.workspaceManual.value.trim();
  if (!requested) {
    setStatus("Workspace path is required.");
    return;
  }
  try {
    await window.axonize.setWorkspace(requested);
  } catch (error) {
    setStatus(`Set workspace failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

document.getElementById("rebuild")?.addEventListener("click", async () => {
  await runRebuild(false);
});

document.getElementById("rebuild-full")?.addEventListener("click", async () => {
  await runRebuild(true);
});

document.getElementById("check")?.addEventListener("click", async () => {
  await runCheck();
});

refs.zoomLevel.addEventListener("change", () => {
  renderOrbit(refs.zoomLevel.value as ZoomLevel);
});

refs.themeMode.addEventListener("change", async () => {
  const source = refs.themeMode.value as ThemeSource;
  try {
    const nextTheme = await window.axonize.setTheme(source);
    applyTheme(nextTheme);
  } catch (error) {
    setStatus(`Set theme failed: ${error instanceof Error ? error.message : String(error)}`);
  }
});

document.getElementById("command-preview")?.addEventListener("click", async () => {
  await runCommand(false);
});

document.getElementById("command-apply")?.addEventListener("click", async () => {
  await runCommand(true);
});

initialize().catch((error) => {
  setStatus(`Fatal initialization error: ${error instanceof Error ? error.message : String(error)}`);
});
