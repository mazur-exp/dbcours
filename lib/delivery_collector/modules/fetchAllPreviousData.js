const chalk = require("chalk");

const { getAcceptedOrders } = require("./getAcceptedOrders");
const { getCancelledOrders } = require("./getCancelledOrders");
const { getCancelReason } = require("./getCancelReason");
const { getClients } = require("./getClientsStatus");
const { getCloseTime } = require("./getCloseTime");
const { getDriverWait } = require("./getDriverWait");
const { getIncomingOrders } = require("./getIncomingOrders");
const { getMarkedReady } = require("./getMarkedReady");
const { getOrderMetrics } = require("./getOrderMetrics");
const { getOrderStatusDetails } = require("./getOrderStatusDetails");
const { getPotentialLoss } = require("./getPotentialLoss");
const { getRating } = require("./getRating");
const { getTransactions } = require("./getTransactions");
const {
  fetchAdSummaryMetricsByDay,
  fetchConversionFunnelMetricsByDay,
  fetchCustomerLifecycleMetricsByDay,
} = require("./grab/getOverviewAd");
const { fetchCancelReasonByDay } = require("./grab/getCancelReason");
const { fetchPayoutsByDay } = require("./grab/getPayouts");
const { getPayouts } = require("./getPayouts");
const { fetchRestaurantMetricsByDay } = require("./grab/getSales");
const { getAdCostAndSalesStatistics } = require("./getAdCostAndSalesStatistics");
const { fetchGrabStatements } = require('./grab/getUserData');
const { Restaurant, GrabStats, GojekStats } = require("../database/db");
const { getGojekAllData } = require("./getMe");

// Import Rails DB sync module (HTTP version - works without sqlite3 bindings on macOS)
const { saveRestaurantStats } = require("./saveToRailsDB_http");

async function fetchForRestaurant(restaurant, customFrom = null, customTo = null) {
  let from, to;

  if (customFrom && customTo) {
    // Используем кастомные даты для Grab (ISO формат)
    from = customFrom.grab;
    to = customTo.grab;
  } else {
    // Последние 3 дня (старое поведение)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 3);
    twoDaysAgo.setUTCHours(0,0,0,0);
    from = twoDaysAgo.toISOString();

    let yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(23,59,59,999);
    to = yesterday.toISOString();
  }

  console.log(chalk.green.bold("Starting Grab fetching"));
  const grabStatements = await fetchGrabStatements(restaurant);

  if (!grabStatements) {
    console.log(chalk.red("Failed to fetch Grab statements"));
  } else {
    console.log(chalk.green("Grab statements fetched successfully"));

    console.log(chalk.green("1. Grab продажи (Sales Performance)"));
    await fetchRestaurantMetricsByDay(
      restaurant,
      ["sales-performance"],
      from,
      to
    );

    console.log(
      chalk.green("2. Grab обзор клиентов (Customer Breakdown Overview)")
    );
    await fetchRestaurantMetricsByDay(
      restaurant,
      ["customer-breakdown-overview"],
      from,
      to
    );

    console.log(
      chalk.green("3. Время ожидания водителей (Operation Waiting Time)")
    );
    await fetchRestaurantMetricsByDay(
      restaurant,
      ["operation-waiting-time-list"],
      from,
      to
    );

    console.log(chalk.green("4. Процент отмен заказов (Cancellation Rate)"));
    await fetchRestaurantMetricsByDay(
      restaurant,
      ["operation-cancellation-rate-per-store"],
      from,
      to
    );

    console.log(chalk.green("5. Время оффлайна магазина (Store Offline Hours)"));
    await fetchRestaurantMetricsByDay(
      restaurant,
      ["operation-store-offline-hours-metric"],
      from,
      to
    );

    console.log(chalk.green("6. Получить отчет по Customer Lifecycle"));
    await fetchCustomerLifecycleMetricsByDay(restaurant, from, to);

    console.log(chalk.green("7. Получить сводный отчет (Ad Summary)"));
    await fetchAdSummaryMetricsByDay(restaurant, from, to);

    console.log(chalk.green("8. Получить воронку конверсий (Conversion Funnel)"));
    await fetchConversionFunnelMetricsByDay(restaurant, from, to);

    console.log(chalk.green("9. Получайте выплаты (Payouts)"));
    await fetchPayoutsByDay(restaurant, from, to);

    console.log(chalk.green('10. Причины отмены (Cancel Reasons)'));
    await fetchCancelReasonByDay(restaurant, from, to);
  }

  // Для Gojek используем локальное время
  let gojekFrom, gojekTo;

  if (customFrom && customTo) {
    // Используем кастомные даты для Gojek (timestamp)
    gojekFrom = customFrom.gojek;
    gojekTo = customTo.gojek;
  } else {
    // Два дня назад 00:00:00 по локальному времени
    const localTwoDaysAgo = new Date();
    localTwoDaysAgo.setDate(localTwoDaysAgo.getDate() - 3);
    localTwoDaysAgo.setHours(0, 0, 0, 0);

    // Вчера 23:59:00 по локальному времени
    const localYesterday = new Date();
    localYesterday.setDate(localYesterday.getDate() - 1);
    localYesterday.setHours(23, 59, 0, 0);

    gojekFrom = localTwoDaysAgo.getTime();
    gojekTo = localYesterday.getTime();
  }

  console.log(chalk.green.bold("Starting Gojek fetching"));
  const gojekData = await getGojekAllData(restaurant);
  
  if (!gojekData) {
    console.log(chalk.red("Failed to fetch Gojek data"));
  } else {
    console.log(chalk.green("Gojek data fetched successfully"));

    console.log(chalk.green("1. Список транзакций"));
    await getTransactions(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("2. Рейтинг"));
    await getRating(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("3. Время доставки"));
    await getOrderMetrics(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("4. Недоставленные заказы"));
    await getOrderStatusDetails(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("5. Реклама (Cost and Sales)"));
    await getAdCostAndSalesStatistics(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("6. Входящие заказы"));
    await getIncomingOrders(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("7. Принятые заказы"));
    await getAcceptedOrders(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("8. Отмечено как готовое"));
    await getMarkedReady(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("9. Отмененные заказы"));
    await getCancelledOrders(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("10. Причины отмены"));
    await getCancelReason(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("11. Время закрытия"));
    await getCloseTime(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("12. Клиенты"));
    await getClients(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("13. Возможные потери"));
    await getPotentialLoss(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("14. Водитель Подождите"));
    await getDriverWait(restaurant, gojekFrom, gojekTo);

    console.log(chalk.green("15. Выплаты"));
    await getPayouts(restaurant, gojekFrom, gojekTo);
  }
}

async function fetchAllPreviousData(customFrom = null, customTo = null) {
  const restaurants = await Restaurant.findAll();

  if (customFrom && customTo) {
    console.log(chalk.bgCyan.black.bold(`\n📅 Автосбор за период: ${customFrom.display} - ${customTo.display}\n`));
  } else {
    console.log(chalk.bgCyan.black.bold(`\n📅 Автосбор за последние 3 дня\n`));
  }

  // Step 1: Collect data from Grab/GoJek APIs (saves to local SQLite)
  for (restaurant in restaurants) {
    console.log(chalk.blue.bold(`Fetching data for ${restaurants[restaurant].name}`));
    await fetchForRestaurant(restaurants[restaurant], customFrom, customTo);
  }

  // Step 2: Copy collected data to Rails database
  console.log(chalk.bgYellow.black.bold(`\n🔄 Copying data to Rails database...\n`));
  await syncToRailsDatabase(restaurants);

  console.log(chalk.bgGreen.black.bold(`\n✅ All data collected and synced to Rails!\n`));
}

/**
 * Sync collected data from local SQLite to Rails SQLite
 */
async function syncToRailsDatabase(restaurants) {
  for (const restaurant of restaurants) {
    console.log(chalk.cyan(`[Sync] Processing ${restaurant.name}...`));

    // Get Grab stats from local database
    const grabStats = await GrabStats.findAll({
      where: { restaurant_id: restaurant.id },
      order: [['stat_date', 'DESC']],
      limit: 90  // Last 90 days
    });

    // Get GoJek stats from local database
    const gojekStats = await GojekStats.findAll({
      where: { restaurant_id: restaurant.id },
      order: [['stat_date', 'DESC']],
      limit: 90  // Last 90 days
    });

    // Save to Rails database
    await saveRestaurantStats(restaurant.name, grabStats, gojekStats);
  }
}

module.exports = { fetchAllPreviousData };
