// Simplified start script for Rails integration
// This version doesn't use local SQLite - saves directly to Rails via HTTP API

const chalk = require('chalk');
const { fetchAllPreviousData } = require('./modules/fetchAllPreviousData');

async function main() {
  console.log(chalk.bgCyan.black.bold('\n🚀 Starting delivery data collection for Rails\n'));

  try {
    // The fetchAllPreviousData will:
    // 1. Get restaurants from ENV.RESTAURANTS_DATA
    // 2. Collect data from Grab/GoJek APIs
    // 3. Save to local SQLite (for backward compat with old code)
    // 4. Send to Rails API via HTTP
    await fetchAllPreviousData();

    console.log(chalk.bgGreen.black.bold('\n✅ Collection completed successfully!\n'));
    process.exit(0);

  } catch (error) {
    console.error(chalk.bgRed.white.bold('\n❌ Collection failed!\n'));
    console.error(chalk.red('Error:'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Check if restaurants data provided
if (!process.env.RESTAURANTS_DATA || process.env.RESTAURANTS_DATA === '[]') {
  console.error(chalk.red('❌ No restaurants data provided!'));
  console.error(chalk.yellow('Set RESTAURANTS_DATA environment variable with restaurant credentials'));
  process.exit(1);
}

console.log(chalk.blue(`[Info] Rails environment: ${process.env.RAILS_ENV || 'development'}`));
console.log(chalk.blue(`[Info] Restaurants count: ${JSON.parse(process.env.RESTAURANTS_DATA).length}`));

main();
