// node tests/e2e/wait.mjs <seconds>  (blocks until the API port is free again or the time elapses)
const secs = Number(process.argv[2] ?? 60);
await new Promise((r) => setTimeout(r, secs * 1000));
console.log(`waited ${secs}s`);
