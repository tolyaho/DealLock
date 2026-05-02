#!/usr/bin/env bash
set -euo pipefail

DEFAULT_TEST_DATABASE_URL="postgresql://deallock:deallock@localhost:5432/deallock_test?schema=public"
TEST_DATABASE_URL="${DATABASE_URL_TEST:-$DEFAULT_TEST_DATABASE_URL}"
INDEXER_HARDHAT_RPC_URL="${HARDHAT_RPC_URL:-http://127.0.0.1:8545}"

hardhat_pid=""

cleanup() {
  if [[ -n "$hardhat_pid" ]]; then
    kill "$hardhat_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

hardhat_ready() {
  curl -fsS \
    -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
    "$INDEXER_HARDHAT_RPC_URL" >/dev/null 2>&1
}

wait_for_hardhat() {
  for _ in {1..30}; do
    if hardhat_ready; then
      return 0
    fi
    sleep 1
  done
  echo "Hardhat node did not become available at $INDEXER_HARDHAT_RPC_URL" >&2
  return 1
}

npx hardhat compile
npm run check:bytecode
npx hardhat test
npm run lint:contracts

(cd backend && npm run db:generate)
(cd backend && npm run build)
(cd backend && DATABASE_URL_TEST="$TEST_DATABASE_URL" npm test)

if hardhat_ready; then
  echo "Using existing Hardhat node at $INDEXER_HARDHAT_RPC_URL"
else
  echo "Starting local Hardhat node at $INDEXER_HARDHAT_RPC_URL"
  npx hardhat node &
  hardhat_pid="$!"
  wait_for_hardhat
fi

(cd backend && DATABASE_URL_TEST="$TEST_DATABASE_URL" HARDHAT_RPC_URL="$INDEXER_HARDHAT_RPC_URL" npm run test:indexer)
(cd frontend && npm run build)
