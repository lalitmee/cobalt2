#!/usr/bin/env node
import { run } from "../src/cli.js";

run().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
