type ZoomLevel = "z4" | "z3" | "z2" | "z1" | "z0";
type ThemeSource = "system" | "light" | "dark";
type EffectiveTheme = "light" | "dark";

interface ThemeState {
  source: ThemeSource;
  effective: EffectiveTheme;
}

interface GraphNode {
  id: string;
  type: string;
  file: string;
  title: string;
  content_hash: string;
  structure_hash: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  confidence: number;
  origin: string;
}

interface RebuildReport {
  processed_files: number;
  changed_files: string[];
  deleted_files: string[];
  nodes_written: number;
  edges_written: number;
  warnings: string[];
}

interface CommandPayload {
  command: "rewrite";
  target: string;
  instruction: string;
  scope: "block" | "section";
}

interface CommandResult {
  command: string;
  target: string;
  file: string;
  applied: boolean;
  diff: string;
  warnings: string[];
}

interface AxonizeBridge {
  getWorkspace(): Promise<{ workspacePath: string }>;
  getTheme(): Promise<ThemeState>;
  setTheme(source: ThemeSource): Promise<ThemeState>;
  onThemeChanged(callback: (payload: ThemeState) => void): () => void;
  chooseWorkspace(): Promise<{ workspacePath: string }>;
  setWorkspace(workspacePath: string): Promise<{ workspacePath: string }>;
  onWorkspaceChanged(callback: (payload: { workspacePath: string }) => void): () => void;
  rebuild(full?: boolean): Promise<RebuildReport>;
  check(): Promise<{ errors: string[] }>;
  loadGraph(): Promise<{ state: Record<string, unknown> | null; nodes: GraphNode[]; edges: GraphEdge[] }>;
  runCommand(command: CommandPayload, apply?: boolean): Promise<CommandResult>;
}

interface Window {
  axonize: AxonizeBridge;
}
