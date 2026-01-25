const axios = require("axios");
const chalk = require("chalk");
const path = require("path");
const prettyjson = require("prettyjson");
const { GojekStats, Restaurant, GrabStats } = require("../database/db.js");
const config = require("../config.js");

const restaurantsFilePath = path.join(__dirname, "../restaurants.js");
const restaurantsCfg = require(restaurantsFilePath);

const cfgByName = Object.fromEntries(
  (restaurantsCfg || []).map(r => [r.name, r])
);

async function syncRestaurantsToServer() {
  try {
    const batchSize = 50; // Reduced package size for smoother loading
    let offset = 0;

    while (true) {
      // Loading restaurants page by page
      const restaurants = await Restaurant.findAll({
        limit: batchSize,
        offset,
      });

      if (restaurants.length === 0) break;

      // For each batch of restaurants we load the data page by page
      for (const restaurant of restaurants) {
        console.log(restaurant.name);

        let statsOffset = 0;
        let gojekStatsBatch, grabStatsBatch;

        do {
          // Loading Gojek statistics in parts
          gojekStatsBatch = await GojekStats.findAll({
            where: { restaurant_id: restaurant.id },
            limit: 100,
            offset: statsOffset,
          });

          // Loading Grab statistics in parts
          grabStatsBatch = await GrabStats.findAll({
            where: { restaurant_id: restaurant.id },
            limit: 100,
            offset: statsOffset,
          });

          // We generate data for sending to the server
          const dataToSend = {
            id: restaurant.id,
            name: restaurant.name,
            gojek_merchant_id: restaurant.gojek_merchant_id,
            gojek_client_id: restaurant.gojek_client_id,
            gojek_access_token: restaurant.gojek_access_token,
            gojek_refresh_token: restaurant.gojek_refresh_token,
            grab_token: restaurant.grab_token,
            grab_user_id: restaurant.grab_user_id,
            grab_store_id: restaurant.grab_store_id,
            grab_food_entity_id: restaurant.grab_food_entity_id,
            grab_advertiser_id: restaurant.grab_advertiser_id,
            grab_merchant_id: restaurant.grab_merchant_id,
            gojek_stats: gojekStatsBatch
              .filter((a) => a.stat_date != "Invalid date")
              .map((stat) => ({
                restaurant_id: stat.restaurant_id,
                stat_date: stat.stat_date,
                rating: stat.rating,
                sales: stat.sales,
                orders: stat.orders,
                ads_sales: stat.ads_sales,
                ads_orders: stat.ads_orders,
                ads_spend: stat.ads_spend,
                accepting_time: stat.accepting_time,
                preparation_time: stat.preparation_time,
                delivery_time: stat.delivery_time,
                lost_orders: stat.lost_orders,
                realized_orders_percentage: stat.realized_orders_percentage,
                one_star_ratings: stat.one_star_ratings,
                two_star_ratings: stat.two_star_ratings,
                three_star_ratings: stat.three_star_ratings,
                four_star_ratings: stat.four_star_ratings,
                five_star_ratings: stat.five_star_ratings,
                accepted_orders: stat.accepted_orders,
                incoming_orders: stat.incoming_orders,
                marked_ready: stat.marked_ready,
                cancelled_orders: stat.cancelled_orders,
                acceptance_timeout: stat.acceptance_timeout,
                out_of_stock: stat.out_of_stock,
                store_is_busy: stat.store_is_busy,
                store_is_closed: stat.store_is_closed,
                close_time: stat.close_time,
                new_client: stat.new_client,
                active_client: stat.active_client,
                returned_client: stat.returned_client,
                potential_lost: stat.potential_lost,
                driver_waiting: stat.driver_waiting,
                payouts: stat.payouts,
              })),
            grab_stats: grabStatsBatch
              .filter((a) => a.stat_date != "Invalid date")
              .map((stat) => ({
                restaurant_id: stat.restaurant_id,
                stat_date: stat.stat_date,
                rating: stat.rating,
                sales: stat.sales,
                orders: stat.orders,
                ads_sales: stat.ads_sales,
                ads_orders: stat.ads_orders,
                ads_spend: stat.ads_spend,
                offline_rate: stat.offline_rate,
                cancelation_rate: stat.cancelation_rate,
                cancelled_orders: stat.cancelled_orders,
                store_is_closed: stat.store_is_closed,
                store_is_busy: stat.store_is_busy,
                store_is_closing_soon: stat.store_is_closing_soon,
                out_of_stock: stat.out_of_stock,
                driver_waiting_time: Number(stat.driver_waiting_time),
                ads_ctr: stat.ads_ctr,
                impressions: stat.impressions,
                unique_impressions_reach: stat.unique_impressions_reach,
                unique_menu_visits: stat.unique_menu_visits,
                unique_add_to_carts: stat.unique_add_to_carts,
                unique_conversion_reach: stat.unique_conversion_reach,
                new_customers: stat.new_customers,
                earned_new_customers: stat.earned_new_customers,
                repeated_customers: stat.repeated_customers,
                earned_repeated_customers: stat.earned_repeated_customers,
                reactivated_customers: stat.reactivated_customers,
                earned_reactivated_customers: stat.earned_reactivated_customers,
                total_customers: stat.total_customers,
                payouts: stat.payouts,
                created_at: stat.created_at,
              })),
          };

          // только на первом батче для ресторана
          if (statsOffset === 0) {
            const cfg = cfgByName[restaurant.name];
            const commissions = pickCommissionFields(cfg);
            if (commissions) Object.assign(dataToSend, commissions);

            const overrides = pickTokenOverrides(cfg);
            if (overrides) Object.assign(dataToSend, overrides);
          }

          // Sending data to the server
          try {

            console.log("\nОтправка данных на сервер (POST)...");
            const postUrl = config.APIURL + "/sync-restaurants";
            console.log(postUrl);

            const response = await axios.post(
              postUrl,
              { restaurants: [dataToSend] }
            );

            console.log(
              `Batch synced. Offset: ${offset}, Stats Offset: ${statsOffset}, Message: ${response.data.message}`
            );

          } catch (sendError) {
            console.error(chalk.red("\n================ ОШИБКА ================"));
            console.error(chalk.red("Произошла ошибка во время запроса:"), sendError.message);

            // Пытаемся получить детальный ответ от сервера
            if (sendError.response) {
              console.error(chalk.yellow("Детали ответа от сервера (Laravel):"));
              console.error(`Статус: ${sendError.response.status} (${sendError.response.statusText})`);
              console.log(JSON.stringify(sendError.response.data, null, 2));
            }
            console.error(chalk.red("========================================="));
          }

          // Increase the offset for loading the next batch of statistics
          statsOffset += 100;
        } while (gojekStatsBatch.length > 0 || grabStatsBatch.length > 0);
      }

      // Increase the offset by the packet size
      offset += batchSize;
    }

    console.log("Все данные синхронизированы успешно.");
  } catch (error) {
    if (error.response) {
      console.error(chalk.red("Ошибка при синхронизации данных с сервером:"));
      console.error(prettyjson.render(error.response.data));
    } else if (error.request) {
      console.error(chalk.red("Ответ от сервера не получен."));
    } else {
      console.error(chalk.red("Ошибка при настройке запроса:"), error.message);
    }
  }
}




const normalizePlatform = (p) => {
  const v = String(p || '').toLowerCase().trim();
  if (v === 'gojek+grab' || v === 'gojek and grab' || v === 'both') return 'both';
  if (v === 'gojek' || v === 'grab') return v;
  return v; // оставим как есть, если вдруг другое значение
};
const toNum = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const pushIf = (obj, key, val, pred = (x) => x !== null && x !== undefined) => { if (pred(val)) obj[key] = val; };

function pickCommissionFields(cfg) {
  if (!cfg || typeof cfg !== 'object') return null;

  const out = {};

  // commission_settings (per-rule настройки)
  if (Array.isArray(cfg.commission_settings)) {
    out.commission_settings = cfg.commission_settings.map((s) => {
      const item = {};
      // platform
      item.platform = normalizePlatform(s.platform);

      // схема начисления
      pushIf(item, 'commission_type', s.commission_type);

      // параметры схемы
      pushIf(item, 'percent', toNum(s.percent), Number.isFinite);
      pushIf(item, 'base_sales', toNum(s.base_sales), Number.isFinite);
      pushIf(item, 'fixed_amount', toNum(s.fixed_amount), Number.isFinite);

      // налоговые флаги/проценты (новое)
      if (typeof s.pay_to_company === 'boolean') item.pay_to_company = s.pay_to_company;
      pushIf(item, 'tax_percent', toNum(s.tax_percent), Number.isFinite);

      return item;
    });
  }

  // ресторанный флаг (бэкап, если в настройке не указан)
  if (typeof cfg.pay_to_company === 'boolean') {
    out.pay_to_company = cfg.pay_to_company;
  }

  return Object.keys(out).length ? out : null;
}

function pickTokenOverrides(cfg) {
  if (!cfg) return null;
  // берём только то, что реально есть в cfg (чтобы не перетирать БД null-ами)
  const fields = [
    "gojek_refresh_token",
    "gojek_access_token",
    "gojek_client_id",
    "grab_token",
    "grab_user_id",
    "grab_store_id",
    "grab_merchant_id",
    "grab_advertiser_id",
    "grab_food_entity_id"
  ];
  const out = {};
  for (const f of fields) if (cfg[f]) out[f] = cfg[f];
  return Object.keys(out).length ? out : null;
}

module.exports = { syncRestaurantsToServer };
