const axios = require("axios");
const chalk = require("chalk");
const { GojekStats } = require("../database/db");
const { refreshGojekToken } = require("./tokenUtils");

async function getCloseTime(restaurant, from, to) {
  const url =
    "https://app.gobiz.com/analytics-backend/api/datasources/proxy/48/_msearch?max_concurrent_shard_requests=5";
  const dateOffset = Math.floor((to - from) / 86400000);

  const headers = {
    "Content-Type": "application/x-ndjson",
    "authentication-type": "go-id",
    Authorization: `Bearer ${restaurant.gojek_access_token}`,
    "x-comp-range-offset": dateOffset + "d",
    "x-custom-interval": "1d",
    "x-dashboard-id": "83",
    "x-grafana-org-id": "1",
    "x-panel-id": "61",
    "x-ref-ids": "A",
    "x-setting-interval": "5m",
  };

  const createRequestBody = (from, to) => {
    return [
      `{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["analytic_merchant_force_close_duration_v1_2024-10","analytic_merchant_force_close_duration_v1_2024-11"]}`,
      `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"time:>=${from} AND time:<${to} AND label.merchant_id:"}}]}},"aggs":{"3":{"terms":{"field":"data.merchant_id","size":10,"order":{"_key":"desc"},"min_doc_count":1},"aggs":{"6":{"terms":{"field":"data.restaurant_name","size":10,"order":{"_key":"desc"},"min_doc_count":1},"aggs":{"7":{"terms":{"field":"data.close_time","size":10,"order":{"_key":"desc"},"min_doc_count":1},"aggs":{"8":{"terms":{"field":"data.open_time","size":10,"order":{"_key":"desc"},"min_doc_count":1},"aggs":{"1":{"max":{"field":"data.force_close_duration"}}}}}}}}}}}}`,
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

      const result = response.data.responses[0].aggregations["3"].buckets[0];
      // Create an object to store summarized data by dates
      const aggregatedData = [];
      aggregatedData[new Date(currentDay).toISOString().split("T")[0]] = "0:0:0";

      if (result) {
        result["6"].buckets[0]["7"].buckets.forEach((item) => {
          const date = new Date(item.key).toISOString().split("T")[0],
            startDate = item.key;
          let hours = 0,
            minutes = 0,
            seconds = 0;

          item["8"].buckets.forEach((item) => {
            const endDate = item.key;
            let durationInt = (endDate - startDate) / 1000;

            hours += Math.floor(durationInt / 3600);
            durationInt = durationInt % 3600;
            minutes += Math.floor(durationInt / 60);
            seconds += Math.round((durationInt % 60));
          });

          minutes = Math.floor((minutes + Math.floor(seconds / 60)) % 60);
          hours = Math.round(hours + Math.floor(minutes / 60));
          seconds = Math.round((seconds % 60));

          aggregatedData[date] = hours + ":" + minutes + ":" + seconds;
        });
      }

      const sortedDates = Object.keys(aggregatedData).sort(
        (a, b) => new Date(b) - new Date(a)
      );

      const tasks = sortedDates.map(async (date) => {
        
        console.log(chalk.bgYellow.black.bold(`\n📅 Дата: ${new Date(date).toLocaleDateString("ru-RU", {day: "2-digit", month: "2-digit", year: "numeric",})}`));
        console.log(chalk.white.bold("-----------------------------------"));
        console.log(`${chalk.bold("⏰ продолжительность времени закрытия:")} ${chalk.yellowBright(aggregatedData[date])} (h:m:s)`);
        console.log(chalk.white.bold("-----------------------------------"));

        const existingStat = await GojekStats.findOne({
          where: {
            stat_date: date,
            restaurant_id: restaurant.id,
          },
        });

        dataSaved = true;

        if (existingStat) {
          existingStat.close_time = aggregatedData[date];
          await existingStat.save();
        } else {
          await GojekStats.create({
            close_time: aggregatedData[date],
            restaurant_id: restaurant.id,
            stat_date: date,
          });
        }
      });

      // Waiting for all asynchronous operations to complete
      await Promise.all(tasks);
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
        console.error(chalk.red(`Ошибка: Похоже, данные за ${new Date(
              currentDay
            ).toLocaleDateString()} отсутствуют.`
          )
        );
        missingDataCount++; // Increase the missing data counter

        if (missingDataCount >= 10) {
          console.error(chalk.red(`Данные отсутствуют 10 дней подряд. Прекращение дальнейших попыток.`));
          break; // We stop execution and exit the loop
        }
        continue;
      } else {
        errorCount++; // Increase the error counter
        if (errorCount > 5) {
          console.error(chalk.red("Превышено количество ошибок. Прекращение выполнения скрипта."));
          break; // We stop execution when 5 errors in a row are exceeded
        }
        console.error(chalk.red("Ошибка:", error));
        continue;
      }
    }

    currentDay = previousDay;
  }

  // At the end of the function, after all tasks have been completed:
  if (dataSaved) {
    return true;
  } else {
    console.log(chalk.red("Данные не были получены или сохранены."));
    return false;
  }

}

module.exports = { getCloseTime };
