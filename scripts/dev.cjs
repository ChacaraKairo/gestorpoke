const { spawn } = require("node:child_process");

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const isWindows = process.platform === "win32";
const binSuffix = isWindows ? ".cmd" : "";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, shell: false, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} foi encerrado por ${signal}.`));
        return;
      }
      if (code) {
        reject(new Error(`${command} saiu com código ${code}.`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  await run(`electron-rebuild${binSuffix}`, ["-f", "-w", "better-sqlite3"]);
  await run(`electron-vite${binSuffix}`, ["dev"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
