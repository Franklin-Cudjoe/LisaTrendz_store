import { spawn } from "node:child_process";

const commands = [
  ["npm", ["--prefix", "server", "run", "start"]],
  ["npm", ["exec", "--", "vite"]],
];

function startCommand(command, args) {
  if (process.platform === "win32") {
    return spawn("cmd.exe", ["/d", "/s", "/c", [command, ...args].join(" ")], {
      stdio: "inherit",
    });
  }

  return spawn(command, args, {
    stdio: "inherit",
  });
}

const children = commands.map(([command, args]) => startCommand(command, args));

let isShuttingDown = false;
let pendingExitCode = 0;
let runningChildren = children.length;

function stopChild(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
    return;
  }

  child.kill("SIGTERM");
}

function requestShutdown(exitCode = 0) {
  if (exitCode && !pendingExitCode) {
    pendingExitCode = exitCode;
  }

  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  children.forEach(stopChild);
}

children.forEach((child) => {
  child.on("error", () => {
    requestShutdown(1);
  });

  child.on("exit", (code, signal) => {
    runningChildren -= 1;

    if (!isShuttingDown) {
      requestShutdown(signal ? 1 : (code ?? 0));
    }

    if (runningChildren === 0) {
      process.exit(pendingExitCode);
    }
  });
});

process.on("SIGINT", () => {
  requestShutdown(0);
});

process.on("SIGTERM", () => {
  requestShutdown(0);
});
