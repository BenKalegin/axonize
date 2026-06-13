/**
 * Instruction injected into LLM system prompts so the model knows it can author
 * HTML islands — fenced ```html``` blocks that axonize renders inline as
 * sandboxed iframes.
 *
 * The read-mode sandbox is STATIC: HTML and CSS render, but scripts never run
 * and external network access is blocked. The prompt steers the model away from
 * JS-dependent output so it doesn't emit islands that silently do nothing.
 */

const HTML_ISLAND_FEW_SHOT_EXAMPLE = `\`\`\`html
<div style="border: 1px solid #555; border-radius: 8px; padding: 12px;">
  <h3 style="margin-top: 0;">Plan comparison</h3>
  <table style="border-collapse: collapse; width: 100%;">
    <tr><th style="text-align: left; padding: 6px;">Feature</th><th>Basic</th><th>Pro</th></tr>
    <tr><td style="padding: 6px;">Seats</td><td style="text-align: center;">5</td><td style="text-align: center;">Unlimited</td></tr>
    <tr><td style="padding: 6px;">SSO</td><td style="text-align: center; color: #fb4934;">—</td><td style="text-align: center; color: #8ec07c;">✓</td></tr>
  </table>
</div>
\`\`\``;

export const HTML_ISLAND_INSTRUCTION = [
    "## HTML islands",
    "",
    "axonize renders a fenced ```html``` block inline as a sandboxed island. Use it when a layout exceeds what markdown can express — styled comparison tables, color-coded grids, cards, badges, callouts, side-by-side panels, or inline SVG figures.",
    "",
    "Read-mode rules (the sandbox enforces these — output that violates them silently does nothing):",
    "- STATIC only: HTML and CSS render, but JavaScript never executes. Do NOT use <script>, inline handlers (onclick=…), or javascript: URLs — they are inert. Interactive widgets belong in a later feature, not here.",
    "- No external network access: inline <style>/style attributes only, and images must be data: or blob: URIs. Do not reference external stylesheets, fonts, scripts, or remote <img> src.",
    "- Keep each island self-contained and prefer plain markdown for ordinary prose and simple tables — reach for an HTML island only when the visual structure earns it.",
    "",
    "Few-shot HTML island example:",
    "",
    HTML_ISLAND_FEW_SHOT_EXAMPLE,
].join("\n");
