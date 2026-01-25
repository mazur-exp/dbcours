const axios = require("axios");
const chalk = require("chalk");
const moment = require("moment");
const { GojekStats, Restaurant } = require("../database/db");

const { refreshGojekToken } = require("../modules/tokenUtils");

async function getClients(restaurant, from, to) {
  const url = "https://app.gobiz.com/analytics-backend/api/ds/query";

  const dayInMillis = 24 * 60 * 60 * 1000;
  to += dayInMillis; // Subtract one day from the start date
  const fromISO = moment(from).toISOString();  
  const toISO = moment(to).toISOString();
  const dateOffset = Math.floor((to-from) / 86400000);

  const headers = {
    "Content-Type": "application/json",
    "authentication-type": "go-id",
    Authorization: `Bearer ${restaurant.gojek_access_token}`,
    "x-comp-range-from": from,
    "x-comp-range-to": to,
    "x-comp-range-offset": dateOffset + "d",
    "x-dashboard-id": "85",
    "x-custom-interval": "1d",
    "x-grafana-org-id": "1",
    "x-panel-id": "4",
    "x-range-from": from,
    "x-range-to": to,
    "x-ref-ids": "A",
    "x-setting-interval": "1d",
  };

  const data = {
    queries: [
      {
        refId: "A",
        datasource: {
          uid: "53vCEARVk",
          type: "postgres",
        },
        rawSql:
          "WITH\n  timetable AS (\n    SELECT $__timeBucket(time, '1d', 'Asia/Jakarta') AS time\n    FROM generate_series(\n    \t$__timeFrom()::timestamptz, \n    \t$__timeTo()::timestamptz, \n    \tINTERVAL '1 day') AS time\n    GROUP BY 1\n  ),\n  user_list AS (\n    SELECT $__timeBucket(date, '1d', 'Asia/Jakarta') AS time,\n      ad_promo_both_new_user_list || promo_only_new_user_list as new_user,\n      ad_promo_both_existing_user_list || promo_only_existing_user_list as active_user,\n      ad_promo_both_dormant_user_list || promo_only_dormant_user_list as returning_user\n    FROM daily_outlet_metrics\n    WHERE merchant_id in () AND $__timeFilter(date)\n  ),\n  new_user_list AS (\n    SELECT DISTINCT \n      time,\n      unnest(new_user) AS user\n    FROM user_list\n  ),\n  returning_user_list AS (\n    SELECT DISTINCT \n      time,\n      unnest(returning_user) AS user\n    FROM user_list\n    EXCEPT\n    SELECT * FROM new_user_list\n  ),\n  active_user_list AS (\n    SELECT DISTINCT \n      time,\n      unnest(active_user) AS user\n    FROM user_list\n    EXCEPT (\n      SELECT * FROM new_user_list\n      UNION ALL\n      SELECT * FROM returning_user_list\n    )\n  ),\n  new_users AS (\n    SELECT time, COUNT(*) AS new_user\n    FROM new_user_list\n    GROUP BY time\n  ),\n  active_users AS (\n    SELECT time, COUNT(*) AS active_user\n    FROM active_user_list\n    GROUP BY time\n  ),\n  returning_users AS (\n    SELECT time, COUNT(*) AS returning_user\n    FROM returning_user_list\n    GROUP BY time\n  )\nSELECT time, \n  COALESCE(new_user, 0) AS new_user,\n  COALESCE(active_user, 0) AS active_user,\n  COALESCE(returning_user, 0) AS returning_user\nFROM timetable\nLEFT OUTER JOIN new_users USING (time)\nLEFT OUTER JOIN active_users USING (time)\nLEFT OUTER JOIN returning_users USING (time)\nORDER BY time",
        format: "time_series",
        datasourceId: 6,
        intervalMs: 86400000,
        maxDataPoints: 1208,
      },
    ],
    range: {
      from: fromISO,
      to: toISO,
      raw: {
        from: fromISO,
        to: toISO,
      },
    },
    from: from.toString(),
    to: to.toString(),
  };

  try {
    let dataSaved = false;

    const response = await axios.post(url, data, { headers });

    const values = response.data.results.A.frames[0].data.values;

    // Create an object to store summarized data by dates
    const aggregatedData = {};

    // We go through all the date entries in values
    values[0].forEach((value, i) => {
      if (i == 0) return false; // Skip the first entry

      const date = moment(value).format("YYYY-MM-DD");

      if (!aggregatedData[date]) {
        // Initialize an object for each date
        aggregatedData[date] = {
          newClient: 0,
          activeClient: 0,
          returnedClient: 0,
        };
      }

      // We sum up the values ​​for each date
      aggregatedData[date].newClient += values[1][i];
      aggregatedData[date].activeClient += values[2][i];
      aggregatedData[date].returnedClient += values[3][i];
    });

    const sortedDates = Object.keys(aggregatedData).sort((a, b) => new Date(b) - new Date(a));

    const tasks = sortedDates.map(async (date) => {
      console.log(chalk.bgYellow.black.bold(`\n📅 Дата: ${new Date(date).toLocaleDateString("ru-RU", {day: "2-digit", month: "2-digit", year: "numeric",})}`));
      console.log(chalk.white.bold("-----------------------------------"));
      console.log(`${chalk.bold("Новые клиенты:")} ${chalk.greenBright(aggregatedData[date].newClient)}`);
      console.log(`${chalk.bold("Активные клиенты:")} ${chalk.blueBright(aggregatedData[date].activeClient)}`);
      console.log(`${chalk.bold("Постоянные клиенты:")} ${chalk.yellowBright(aggregatedData[date].returnedClient)}`);
      console.log(chalk.white.bold("-----------------------------------"));

      const existingStat = await GojekStats.findOne({
        where: {
          stat_date: date,
          restaurant_id: restaurant.id,
        },
      });

      if (existingStat) {
        existingStat.new_client = aggregatedData[date].newClient;
        existingStat.active_client = aggregatedData[date].activeClient;
        existingStat.returned_client = aggregatedData[date].returnedClient;
        await existingStat.save();
      } else {
        await GojekStats.create({
          new_client: aggregatedData[date].newClient,
          active_client: aggregatedData[date].activeClient,
          returned_client: aggregatedData[date].returnedClient,
          restaurant_id: restaurant.id,
          stat_date: date,
        });
      }

      dataSaved = true;
    });

    await Promise.all(tasks);

    // At the end of the function, after all tasks have been completed:
    if (dataSaved) {
      return true; // The data has been saved.
    } else {
      console.log(chalk.yellow("Нет данных для сохранения в базе данных."));
      return false; // There was no data to save.
    }
  } catch (error) {
    // Always display detailed information about the error
    console.error(chalk.red("Ошибка:", error.message));
    if (error.response) {
      console.error(chalk.red("Статус:", error.response.status));
      console.error(chalk.red("Ответ от сервера:"));
      console.error(error.response.data);
    }

    if (error.response && error.response.status === 401) {
      console.error(chalk.red("Ошибка 401: Необходимо обновить токен."));
      await refreshGojekToken(restaurant); // The refreshToken function is supposed to update the gojek_access_token in the restaurant object
      console.log(chalk.yellow("Повторная попытка загрузки данных..."));
      return await getClients(restaurant, from, to); // Retry after token refresh
    } else if (error.response && error.response.status === 502) {
      console.error(chalk.red("Ошибка 502: Пробуем выполнить запрос еще раз"));
      return await getClients(restaurant, from, to); // Retry after token refresh
    } else {
      return false;
    }
  }
}

module.exports = { getClients };
