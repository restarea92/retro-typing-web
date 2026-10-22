import nodeTest from 'node:test';
export const resourceTestsEnabled = process.env.RUN_PRIVATE_RESOURCE_TESTS === '1';
// Register every case, but never import omitted resources in the public default run.
export default function test(name, optionsOrCallback, callback) {
  const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
  const run = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
  return nodeTest(name, {...options, skip: options.skip || !resourceTestsEnabled}, run);
}
