import { run } from './check-repository-docs';

run(process.cwd())
  .then(exitCode => {
    process.exitCode = exitCode;
  })
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
