import { execFile } from "node:child_process";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err, stdout, stderr) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      if (err) reject(err);
      else resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isWindowsEperm(err) {
  const msg = `${err?.message || ""}\n${err?.stdout || ""}\n${err?.stderr || ""}`;
  return /EPERM: operation not permitted, rename/i.test(msg);
}

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 450;

function getPnpmExec() {
  // 在 pnpm 生命周期脚本中，直接 spawn "pnpm" 可能在 Windows 上找不到 PATH。
  // npm_execpath 通常指向 pnpm 的 .cjs 入口，使用 node 去执行更稳。
  const execPath = process.env.npm_execpath;
  if (execPath && execPath.endsWith(".cjs")) {
    return { cmd: process.execPath, argsPrefix: [execPath] };
  }
  return { cmd: "pnpm", argsPrefix: [] };
}

const pnpm = getPnpmExec();

function allowEpermNonFatal() {
  if (process.env.PRISMA_GENERATE_ALLOW_EPERM === "0") return false;
  // Windows 本地开发常见被杀软/索引器占用：允许在 postinstall 不中断安装
  if (process.platform !== "win32") return false;
  const env = (process.env.NODE_ENV || "").toLowerCase();
  return env !== "production";
}

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    await run(pnpm.cmd, [...pnpm.argsPrefix, "exec", "prisma", "generate"]);
    process.exit(0);
  } catch (err) {
    const eperm = isWindowsEperm(err);
    if (!eperm || attempt === MAX_RETRIES) {
      console.error(
        `[prisma-generate] failed after ${attempt}/${MAX_RETRIES} attempts.\n` +
          (err instanceof Error ? err.stack || err.message : String(err))
      );
      if (eperm && allowEpermNonFatal()) {
        console.warn(
          "[prisma-generate] continuing despite Windows EPERM lock (dev-friendly). " +
            "Production/CI should set PRISMA_GENERATE_ALLOW_EPERM=0."
        );
        process.exit(0);
      }
      process.exit(1);
    }
    const delay = BASE_DELAY_MS * attempt;
    console.warn(
      `[prisma-generate] Windows EPERM rename lock, retrying in ${delay}ms (${attempt}/${MAX_RETRIES})...`
    );
    await sleep(delay);
  }
}

