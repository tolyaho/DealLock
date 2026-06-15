import { runIndexerOnce, startIndexerLoop } from "./indexer/runner.js";
import { indexerConfig } from "./indexer/config.js";
import { validateEnv } from "./config/env.js";

validateEnv();
const config = indexerConfig();

if (process.env.INDEXER_ONCE === "true") {
  runIndexerOnce(config)
    .then((result) => {
      console.info(
        `Indexer run complete: ${result.agreementsSeen} agreements, ${result.eventsFound} new events`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
} else {
  startIndexerLoop({ ...config, enabled: true });
  console.info(`DealLock indexer polling every ${config.pollMs}ms`);
}
