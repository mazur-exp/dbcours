const axios = require("axios");
const chalk = require("chalk");
const { GojekStats } = require("../database/db");

const { refreshGojekToken } = require("../modules/tokenUtils");

/* Get statistics on % of order delivery */

async function getOrderStatusDetails(restaurant, from, to) {
  const url =
    "https://app.gobiz.com/analytics-backend/api/datasources/proxy/2/_msearch?max_concurrent_shard_requests=5";
  const dateOffset = Math.floor((to - from) / 86400000);

  const headers = {
    "Content-Type": "application/x-ndjson",
    "authentication-type": "go-id",
    Authorization: `Bearer ${restaurant.gojek_access_token}`,
    "x-comp-range-offset": dateOffset + "d",
    "x-custom-interval": "1d",
    "x-dashboard-id": "15",
    "x-grafana-org-id": "1",
    "x-panel-id": "36",
    "x-ref-ids": "A;B;C;D;E",
    "x-setting-interval": "20m",
  };

  const dayInMillis = 24 * 60 * 60 * 1000;
  let currentDay = to;

  let dataSaved = false;
  let missingDataCount = 0;

  let errorCount = 0; // Counter of consecutive errors

  while (currentDay >= from) {
    const previousDay = currentDay - dayInMillis;

    headers["x-comp-range-from"] = previousDay;
    headers["x-comp-range-to"] = currentDay;
    headers["x-range-from"] = previousDay;
    headers["x-range-to"] = currentDay;

    const data = [
      '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-07","orders_2024-08"]}',
      `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND NOT order_number:FP* AND _exists_:status.goresto AND ordered_at:>=${previousDay} AND ordered_at:<=${currentDay}"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":${previousDay},"max":${currentDay}},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1d"},"aggs":{}}}}`,
      '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-07","orders_2024-08"]}',
      `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND NOT order_number:FP* AND _exists_:status.goresto AND _exists_:analytic_temp.merchant_accepted_at AND ordered_at:>=${previousDay} AND ordered_at:<=${currentDay}"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":${previousDay},"max":${currentDay}},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1d"},"aggs":{}}}}`,
      '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-07","orders_2024-08"]}',
      `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND NOT order_number:FP* AND _exists_:status.goresto AND (_exists_:analytic_temp.food_prepared_at OR _exists_:analytic_temp.pickup_at.seconds) AND ordered_at:>=${previousDay} AND ordered_at:<=${currentDay}"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":${previousDay},"max":${currentDay}},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1d"},"aggs":{}}}}`,
      '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-07","orders_2024-08"]}',
      `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND NOT order_number:FP* AND _exists_:status.goresto AND _exists_:analytic_temp.pickup_at.seconds AND ordered_at:>=${previousDay} AND ordered_at:<=${currentDay}"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":${previousDay},"max":${currentDay}},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1d"},"aggs":{}}}}`,
      '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-07","orders_2024-08"]}',
      `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND NOT order_number:FP* AND _exists_:status.goresto AND status.goresto:completed AND ordered_at:>=${previousDay} AND ordered_at:<=${currentDay}"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":${previousDay},"max":${currentDay}},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1d"},"aggs":{}}}}`,
    ].join("\n");

    try {
      const response = await axios.post(url, data, { headers: headers });

      const responses = response.data.responses;

      const totalOrders = responses[0].hits.total.value;
      const deliveredOrders = responses[4].hits.total.value;

      if (totalOrders > 0) {
        const deliveryPercentage = (deliveredOrders / totalOrders) * 100;

        const existingStat = await GojekStats.findOne({
          where: {
            stat_date: new Date(currentDay).toISOString().split("T")[0],
            restaurant_id: restaurant.id,
          },
        });

        if (existingStat) {
          existingStat.lost_orders = totalOrders - deliveredOrders;
          existingStat.realized_orders_percentage = deliveryPercentage;
          await existingStat.save();
        } else {
          await GojekStats.create({
            stat_date: new Date(currentDay).toISOString().split("T")[0],
            lost_orders: totalOrders - deliveredOrders,
            realized_orders_percentage: deliveryPercentage,
            restaurant_id: restaurant.id,
          });
        }

        dataSaved = true;
        missingDataCount = 0;

        console.log(chalk.bgGreen.black.bold(`\nСТАТУС ВРЕМЕНИ ДОСТАВКИ ЗАКАЗОВ ЗА ${new Date(currentDay).toLocaleDateString("ru-RU", {day: "2-digit", month: "2-digit", year: "numeric",})}`));

        console.log(chalk.white.bold("-----------------------------------"));
        console.log(`${chalk.bold("📦 Общее количество заказов:")} ${chalk.blueBright(totalOrders)}`);
        console.log(`${chalk.bold("🚚 Количество доставленных заказов:")} ${chalk.greenBright(deliveredOrders)}`);
        console.log(`${chalk.bold("📊 Процент доставленных заказов:")} ${chalk.yellowBright(deliveryPercentage.toFixed(2))}%`);
        console.log(chalk.white.bold("-----------------------------------"));
      } else {
        missingDataCount++;
        console.error(chalk.red(`Данные отсутствуют за ${new Date(currentDay).toLocaleDateString()}.`));

        if (missingDataCount >= 5) {
          console.error(chalk.red(`Данные отсутствуют 5 дней подряд. Прекращение дальнейших попыток.`));
          break; // We stop execution and exit the loop
        }
      }

      // Reset the error counter on successful execution
      errorCount = 0;
    } catch (error) {
      // Always display detailed information about the error
      console.error(chalk.red("Ошибка:", error.message));
      if (error.response) {
        console.error(chalk.red("Статус:", error.response.status));
        console.error(chalk.red("Ответ от сервера:", error.response.data));
      }

      // Error handling logic
      if (error.response && error.response.status === 401) {
        console.error(chalk.red("Ошибка 401: Необходимо обновить токен."));
        await refreshGojekToken(restaurant);
        console.log(chalk.yellow("Повторная попытка загрузки данных..."));
        errorCount++; // Increase the error counter
        if (errorCount > 5) {
          console.error(chalk.red("Превышено количество ошибок. Прекращение выполнения скрипта."));
          break; // We stop execution when 5 errors in a row are exceeded
        }
        continue; // Let's try again with the same day
      } else {
        errorCount++; // Increase the error counter
        if (errorCount > 5) {
          console.error(chalk.red("Превышено количество ошибок. Прекращение выполнения скрипта."));
          break; // We stop execution when 5 errors in a row are exceeded
        }
        continue; // Terminate execution when an unexpected error occurs
      }
    }

    currentDay = previousDay;
  }

  if (!dataSaved) {
    console.log(chalk.red("Данные не были получены или сохранены."));
  }

  return dataSaved;
}

module.exports = { getOrderStatusDetails };
