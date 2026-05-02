import { spawn } from "node:child_process";

const defaultTestDatabaseUrl =
  "postgresql://deallock:deallock@localhost:5432/deallock_test?schema=public";
const hardhatRpcUrl = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";
const releaseEnv = {
  ...process.env,
  DATABASE_URL_TEST: process.env.DATABASE_URL_TEST || defaultTestDatabaseUrl,
  HARDHAT_RPC_URL: hardhatRpcUrl,
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const spawnOptions = {
      stdio: "inherit",
      cwd: options.cwd || process.cwd(),
      shell: false,
    };
    if (options.env) spawnOptions.env = options.env;
    const child = spawn(command, args, spawnOptions);

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function isHardhatReady() {
  try {
    const response = await fetch(hardhatRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      signal: AbortSignal.timeout(1000),
    });
    const body = await response.json();
    return body.result !== undefined;
  } catch {
    return false;
  }
}

async function waitForHardhat() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isHardhatReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Hardhat node did not become available at ${hardhatRpcUrl}`);
}

async function withHardhatNode(callback) {
  if (await isHardhatReady()) {
    console.log(`Using existing Hardhat node at ${hardhatRpcUrl}`);
    await callback();
    return;
  }

  console.log(`Starting local Hardhat node at ${hardhatRpcUrl}`);
  const node = spawn("npx", ["hardhat", "node"], {
    stdio: ["ignore", "inherit", "inherit"],
    env: releaseEnv,
    shell: false,
  });

  try {
    await waitForHardhat();
    await callback();
  } finally {
    node.kill("SIGTERM");
  }
}

async function main() {
  await run("npx", ["hardhat", "compile"]);
  await run("npm", ["run", "check:bytecode"]);
  await run("npx", ["hardhat", "test"]);
  await run("npm", ["run", "lint:contracts"]);

  await run("npm", ["run", "db:generate"], { cwd: "backend", env: releaseEnv });
  await run("npm", ["run", "build"], { cwd: "backend", env: releaseEnv });
  await run("npm", ["test"], { cwd: "backend", env: releaseEnv });

  await withHardhatNode(async () => {
    await run("npm", ["run", "test:indexer"], { cwd: "backend", env: releaseEnv });
  });

  await run("npm", ["run", "build"], { cwd: "frontend", env: releaseEnv });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
