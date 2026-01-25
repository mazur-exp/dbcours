const axios = require("axios");
const chalk = require("chalk");
const { GojekStats } = require("../database/db");
const { refreshGojekToken } = require("../modules/tokenUtils");

// Get transactions
async function getTransactions(restaurant, from, to) {
  const url = "https://app.gobiz.com/analytics-backend/api/datasources/proxy/2/_msearch?max_concurrent_shard_requests=5";
  const dateOffset = Math.floor((to - from) / 86400000);

  const headers = {
    "Content-Type": "application/x-ndjson",
    "authentication-type": "go-id",
    Authorization: `Bearer ${restaurant.gojek_access_token}`,
    "x-comp-range-offset": dateOffset + "d",
    "x-custom-interval": "1d",
    "x-dashboard-id": "14",
    "x-grafana-org-id": "1",
    "x-panel-id": "24",
    "x-ref-ids": "A",
    "x-setting-interval": "2m",
  };

  const createRequestBody = (from, to) => {
    return [
      '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-08"]}',
      `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND status.goresto:completed AND NOT order_number:FP* AND ordered_at:>=${from} AND ordered_at:<=${to}"}}]}},"aggs":{"2":{"terms":{"field":"analytic_temp.merchant_name.keyword","size":1000,"order":{"3":"desc"},"min_doc_count":1},"aggs":{"3":{"sum":{"field":"gross_amount"}},"4":{"avg":{"field":"gross_amount"}}}}}}`,
    ].join("\n");
  };

  const dayInMillis = 24 * 60 * 60 * 1000;
  let currentDay = to;

  let dataSaved = false; // Flag to track whether data was saved
  let missingDataCount = 0; // Missing data counter

  let errorCount = 0;

  while (currentDay >= from) {
    const previousDay = currentDay - dayInMillis;
    const data = createRequestBody(previousDay, currentDay);
    
    try {
      const response = await axios.post(url, data, {
        headers: {
          ...headers,
          "x-comp-range-from": previousDay,
          "x-comp-range-to": currentDay,
          "x-range-from": previousDay,
          "x-range-to": currentDay,
        },
      });

      console.log(chalk.green(`Запрос выполнен успешно для даты: ${new Date(currentDay).toLocaleDateString()}`));

      const result = response.data.responses[0].aggregations["2"].buckets[0];

      if (result) {
        const ordersCount = response.data.responses[0].hits.total.value;
        const grossSales = result["3"].value;
        const averageSales = result["4"].value;
        const restaurantName = result.key;
        
        // Format date to YYYY-MM-DD format
        const statDate = new Date(currentDay).toISOString().split("T")[0];

        // Checking if a record exists in a database
        const existingRecord = await GojekStats.findOne({
          where: {
            stat_date: statDate,
            restaurant_id: restaurant.id,
          },
        });

        if (existingRecord) {
          // Updating an existing entry
          existingRecord.sales = grossSales;
          existingRecord.orders = ordersCount;
          await existingRecord.save();
          console.log(chalk.yellow(`Запись обновлена для даты: ${statDate}`));
        } else {
          // Create a new entry
          await GojekStats.create({
            stat_date: statDate,
            sales: grossSales,
            orders: ordersCount,
            restaurant_id: restaurant.id,
          });
          console.log(
            chalk.green(`Создана новая запись для даты: ${statDate}`)
          );
        }

        dataSaved = true; // The data has been saved.
        missingDataCount = 0; // Reset the counter because the data has been saved.

        // Output the result to the console immediately after receiving
        console.log(chalk.blue(`Дата: ${statDate}`));
        console.log(chalk.blue(`Название ресторана: ${restaurantName}`));
        console.log(chalk.green(`Количество заказов: ${ordersCount}`));
        console.log(chalk.yellow(`Общая выручка (Gross Sales): ${grossSales}`));
        console.log(
          chalk.magenta(`Средняя выручка (Average Sales): ${averageSales}`)
        );
        console.log(chalk.gray("--------------------------------------"));
      }

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
          console.error(
            chalk.red(
              "Превышено количество ошибок. Прекращение выполнения скрипта."
            )
          );
          break; // We stop execution when 5 errors in a row are exceeded
        }
        continue; // Let's try again with the same day
      } else if (
        error instanceof TypeError &&
        error.message.includes("Cannot read properties of undefined")
      ) {
        console.error(
          chalk.red(
            `Ошибка: Похоже, данные за ${new Date(
              currentDay
            ).toLocaleDateString()} отсутствуют.`
          )
        );
        missingDataCount++; // Увеличиваем счетчик отсутствующих данных

        if (missingDataCount >= 10) {
          console.error(
            chalk.red(
              `Данные отсутствуют 10 дней подряд. Прекращение дальнейших попыток.`
            )
          );
          break; // We stop execution and exit the loop
        }
        continue;
      } else {
        errorCount++; // Increase the error counter
        if (errorCount > 5) {
          console.error(
            chalk.red(
              "Превышено количество ошибок. Прекращение выполнения скрипта."
            )
          );
          break; // We stop execution when 5 errors in a row are exceeded
        }
        console.error(chalk.red("Ошибка:", error));
        continue;
      }
    }

    currentDay = previousDay;
  }

  if (!dataSaved) {
    console.log(chalk.red("Данные не были получены или сохранены."));
  }
}

module.exports = { getTransactions };
