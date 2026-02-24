const fs = require("node:fs");
const path = require("node:path");

const sourceDir = path.resolve(__dirname, "..", "desktop", "renderer");
const targetDir = path.resolve(__dirname, "..", "dist", "renderer");

fs.mkdirSync(targetDir, { recursive: true });

for (const fileName of ["index.html", "styles.css"]) {
  fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
}
