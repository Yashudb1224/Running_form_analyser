const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = fs.mkdtempSync(path.join(os.tmpdir(), "running-form-analysis-tests-"));
const tsc = path.resolve(path.dirname(require.resolve("typescript")), "..", "bin", "tsc");

try {
  execFileSync(process.execPath, [
    tsc,
    "--target", "ES2020",
    "--module", "commonjs",
    "--moduleResolution", "node",
    "--lib", "ES2020,DOM",
    "--outDir", output,
    "--rootDir", root,
    "--strict",
    "--esModuleInterop",
    "--skipLibCheck",
    "--types", "node",
    "tests/analysis.test.ts",
    "src/types/telemetry.ts",
    "src/lib/biomechanics.ts",
    "src/lib/gaitCycle.ts",
    "src/lib/signalProcessor.ts",
    "src/lib/symmetryAnalyzer.ts",
    "src/lib/formScorer.ts",
    "src/lib/researchReferences.ts",
    "src/lib/metricComparison.ts",
    "src/lib/analysisQuality.ts",
    "src/lib/evidenceFrames.ts",
    "src/lib/overlayDrawing.ts",
    "src/lib/legTracking.ts",
    "src/lib/pdfReport.ts",
    "src/lib/poseEstimator.ts",
  ], { cwd: root, stdio: "inherit" });

  execFileSync(process.execPath, ["--test", path.join(output, "tests", "analysis.test.js")], {
    cwd: root,
    env: { ...process.env, NODE_PATH: path.join(root, "node_modules") },
    stdio: "inherit",
  });
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
