export function assertChecks(checks) {
  const failed = Object.entries(checks).filter(([, passed]) => passed !== true).map(([name]) => name);
  if (failed.length) throw new Error(`Checks failed: ${failed.join(", ")}`);
  console.log(`CHECKS_PASSED=${Object.keys(checks).length}`);
}
