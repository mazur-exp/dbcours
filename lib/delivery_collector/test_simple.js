// Simple test without database - just check if modules load
const chalk = require('chalk');

console.log(chalk.green('✓ Chalk works'));
console.log(chalk.blue('[Test] Testing module loading...'));

try {
  const axios = require('axios');
  console.log(chalk.green('✓ Axios loaded'));

  const moment = require('moment');
  console.log(chalk.green('✓ Moment loaded'));

  console.log(chalk.bgGreen.black('\n✅ All core modules loaded successfully!\n'));
  console.log(chalk.yellow('Note: SQLite3 may not build on macOS but will work in Docker production'));

} catch (error) {
  console.error(chalk.red('❌ Error:'), error.message);
  process.exit(1);
}
