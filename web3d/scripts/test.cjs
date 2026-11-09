const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  ts = require("typescript");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ortaq-domain-"));
try {
  for (const name of [
    "palette",
    "strings",
    "types",
    "domain",
    "apartmentPlan",
    "drawingPlan",
    "drawingPlan.test",
    "cinematic",
    "framing",
    "buildingModel",
    "planMedia",
    "mapStyle",
    "tileBuildings",
    "domain.test",
    "planMedia.test",
  ]) {
    const source = fs.readFileSync(
      path.join(__dirname, "../src", name + ".ts"),
      "utf8",
    );
    const output = ts
      .transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        },
      })
      .outputText.replace(/require\("\.\/(\w+)\.ts"\)/g, 'require("./$1.js")');
    fs.writeFileSync(path.join(dir, name + ".js"), output);
  }
  require(path.join(dir, "domain.test.js"));
  require(path.join(dir, "planMedia.test.js"));
  require(path.join(dir, "drawingPlan.test.js"));
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
