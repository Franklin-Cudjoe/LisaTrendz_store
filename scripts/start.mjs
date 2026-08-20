import { spawn } from "node:child_process";
import { createServer } from "node:net";

const DEFAULT_API_PORT = 4000;
const DEFAULT_WEB_PORT = 5173;
const HOST = "127.0.0.1";
const PORT_SEARCH_LIMIT = 50;

function readPort(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function findOpenPort(startPort) {
  for (let port = startPort; port < startPort + PORT_SEARCH_LIMIT; port += 1) {
    if (await canUsePort(port)) {
      return port;
    }
  }

  throw new Error(
    `Could not find an available port between ${startPort} and ${
      startPort + PORT_SEARCH_LIMIT - 1
    }.`,
  );
}

function quoteCommandPart(value) {
  const text = String(value);

  if (/^[\w@%+=:,./\\-]+$/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

function startCommand(label, args, env = {}) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const commandArgs =
    process.platform === "win32"
      ? ["/d", "/s", "/c", ["npm", ...args].map(quoteCommandPart).join(" ")]
      : args;

  const child = spawn(command, commandArgs, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env,
    },
  });

  child.label = label;
  return child;
}

const apiPort = await findOpenPort(readPort("PORT", DEFAULT_API_PORT));
const webPort = await findOpenPort(readPort("VITE_PORT", DEFAULT_WEB_PORT));
const apiOrigin = `http://localhost:${apiPort}`;
const webOrigin = `http://${HOST}:${webPort}`;

console.log(`Starting API on ${apiOrigin}`);
console.log(`Starting storefront on ${webOrigin}`);

const children = [
  startCommand("api", ["--prefix", "server", "run", "start"], {
    PORT: String(apiPort),
  }),
  startCommand(
    "storefront",
    [
      "exec",
      "--",
      "vite",
      "--host",
      HOST,
      "--port",
      String(webPort),
      "--strictPort",
      "--open",
    ],
    {
      VITE_API_TARGET: apiOrigin,
      VITE_API_BASE_URL: "",
    },
  ),
];

let isShuttingDown = false;
let pendingExitCode = 0;
let runningChildren = children.length;

function stopChild(child) {
  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
    });
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
  child.on("error", (error) => {
    console.error(`${child.label} could not start: ${error.message}`);
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
