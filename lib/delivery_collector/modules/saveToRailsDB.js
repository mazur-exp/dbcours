const chalk = require('chalk');
const { Restaurant, RestaurantStat } = require('../database/db_rails');

/**
 * Saves restaurant data directly to Rails restaurant_stats table
 * @param {string} restaurantName - Name of the restaurant
 * @param {Array} grabStats - Array of Grab statistics from local SQLite
 * @param {Array} gojekStats - Array of GoJek statistics from local SQLite
 * @returns {Promise<boolean>} - Success status
 */
async function saveRestaurantStats(restaurantName, grabStats, gojekStats) {
  try {
    // Find restaurant_id by restaurant name in Rails database
    const restaurant = await Restaurant.findOne({
      where: { name: restaurantName }
    });

    if (!restaurant) {
      console.log(chalk.red(`[Save] ✗ Restaurant "${restaurantName}" not found in Rails DB (skip)`));
      return false;
    }

    console.log(chalk.blue(`[Save] Processing ${restaurantName} (ID: ${restaurant.id})...`));

    // Group statistics by date (merge Grab + GoJek for same date)
    const statsByDate = {};

    // Process Grab statistics
    if (grabStats && Array.isArray(grabStats)) {
      grabStats.forEach(stat => {
        const date = stat.stat_date;
        if (!date || date === 'Invalid date') return;

        if (!statsByDate[date]) {
          statsByDate[date] = initializeStatRecord(restaurant.id, date);
        }

        // Map Grab fields from local SQLite to Rails schema
        statsByDate[date].grab_sales = parseFloat(stat.sales) || 0;
        statsByDate[date].grab_orders = parseInt(stat.orders) || 0;
        statsByDate[date].grab_ads_spend = parseFloat(stat.ads_spend) || 0;
        statsByDate[date].grab_ads_sales = parseFloat(stat.ads_sales) || 0;
        statsByDate[date].grab_new_customers = parseInt(stat.new_customers) || 0;
        statsByDate[date].grab_repeated_customers = parseInt(stat.repeated_customers) || 0;
        // grab_fake_orders can be calculated separately if needed
      });
    }

    // Process GoJek statistics
    if (gojekStats && Array.isArray(gojekStats)) {
      gojekStats.forEach(stat => {
        const date = stat.stat_date;
        if (!date || date === 'Invalid date') return;

        if (!statsByDate[date]) {
          statsByDate[date] = initializeStatRecord(restaurant.id, date);
        }

        // Map GoJek fields from local SQLite to Rails schema
        statsByDate[date].gojek_sales = parseFloat(stat.sales) || 0;
        statsByDate[date].gojek_orders = parseInt(stat.orders) || 0;
        statsByDate[date].gojek_ads_spend = parseFloat(stat.ads_spend) || 0;
        statsByDate[date].gojek_ads_sales = parseFloat(stat.ads_sales) || 0;
        statsByDate[date].gojek_new_customers = parseInt(stat.new_client) || 0;
        statsByDate[date].gojek_returned_customers = parseInt(stat.returned_client) || 0;
        // gojek_fake_orders can be calculated separately if needed
      });
    }

    // Save all dates to Rails database
    let savedCount = 0;
    let errorCount = 0;

    for (const [date, data] of Object.entries(statsByDate)) {
      try {
        // Calculate aggregated totals
        data.total_sales = (parseFloat(data.grab_sales) || 0) + (parseFloat(data.gojek_sales) || 0);
        data.total_orders = (parseInt(data.grab_orders) || 0) + (parseInt(data.gojek_orders) || 0);

        // Upsert to Rails database (equivalent to Rails RestaurantStat.upsert)
        await RestaurantStat.upsert(data, {
          conflictFields: ['restaurant_id', 'stat_date']  // Unique constraint
        });

        savedCount++;
      } catch (error) {
        errorCount++;
        console.error(chalk.red(`[Save] Error saving ${date}:`), error.message);
      }
    }

    if (savedCount > 0) {
      console.log(chalk.green(`[Save] ✓ Saved ${savedCount} days for ${restaurantName}` +
        (errorCount > 0 ? chalk.yellow(` (${errorCount} errors)`) : '')));
    }

    return errorCount === 0;

  } catch (error) {
    console.error(chalk.red(`[Save] ✗ Failed to save ${restaurantName}:`), error.message);
    return false;
  }
}

/**
 * Initialize empty stat record for a date
 */
function initializeStatRecord(restaurantId, date) {
  return {
    restaurant_id: restaurantId,
    stat_date: date,
    grab_sales: 0,
    grab_orders: 0,
    grab_ads_spend: 0,
    grab_ads_sales: 0,
    grab_new_customers: 0,
    grab_repeated_customers: 0,
    grab_fake_orders: 0,
    gojek_sales: 0,
    gojek_orders: 0,
    gojek_ads_spend: 0,
    gojek_ads_sales: 0,
    gojek_new_customers: 0,
    gojek_returned_customers: 0,
    gojek_fake_orders: 0,
    total_sales: 0,
    total_orders: 0,
    synced_at: new Date()
  };
}

module.exports = { saveRestaurantStats };
