const chalk = require('chalk');
const axios = require('axios');

// Rails API endpoint (localhost in development, internal in production)
const RAILS_API_URL = process.env.RAILS_API_URL || 'http://localhost:3000';

/**
 * Saves restaurant data to Rails via HTTP API (works without sqlite3 bindings!)
 * @param {string} restaurantName - Name of the restaurant
 * @param {Array} grabStats - Array of Grab statistics
 * @param {Array} gojekStats - Array of GoJek statistics
 * @returns {Promise<boolean>} - Success status
 */
async function saveRestaurantStats(restaurantName, grabStats, gojekStats) {
  try {
    console.log(chalk.blue(`[Save] Sending data for ${restaurantName} to Rails API...`));

    const response = await axios.post(
      `${RAILS_API_URL}/api/collector/save_stats`,
      {
        restaurant_name: restaurantName,
        grab_stats: grabStats || [],
        gojek_stats: gojekStats || []
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000  // 30 seconds
      }
    );

    if (response.data.success) {
      console.log(chalk.green(`[Save] ✓ Saved ${response.data.saved_count} days for ${restaurantName}`));
      return true;
    } else {
      console.log(chalk.red(`[Save] ✗ Failed: ${response.data.error}`));
      return false;
    }

  } catch (error) {
    if (error.response) {
      console.error(chalk.red(`[Save] ✗ API error for ${restaurantName}:`), error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(chalk.red(`[Save] ✗ Cannot connect to Rails API at ${RAILS_API_URL}`));
      console.error(chalk.yellow(`      Make sure Rails server is running!`));
    } else {
      console.error(chalk.red(`[Save] ✗ Failed to save ${restaurantName}:`), error.message);
    }
    return false;
  }
}

module.exports = { saveRestaurantStats };
