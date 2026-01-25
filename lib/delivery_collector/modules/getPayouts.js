const axios = require("axios");
const chalk = require("chalk");
const { GojekStats } = require("../database/db");
const { refreshGojekToken } = require("./tokenUtils");

function getDateDiffInDays(a, b) {
  const _MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round(Math.abs(a - b) / _MS_PER_DAY);
}

async function fetchPayouts(page, num, token) {
  const url = `https://api.gobiz.co.id/v1/merchants/payouts?page=${page}&per=${num}`;

  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      "authentication-type": "go-id",
      Authorization: `Bearer ${token}`
    }
  });

  return response.data.payouts;
}

async function getPayouts(restaurant, from, to) {
  let page = 1;
  let payouts = await fetchPayouts(page, 15, restaurant.gojek_access_token);

  const dayInMillis = 24 * 60 * 60 * 1000;
  let currentDay = to;

  let dataSaved = false; // Flag to track whether data was saved

  let errorCount = 0;

  while (currentDay >= from) {
    const previousDay = currentDay - dayInMillis;

    try {
      console.log(
        chalk.green(
          `Запрос выполнен успешно для даты: ${new Date(
            currentDay
          ).toLocaleDateString()}`
        )
      );

      const currentDateString = new Date(currentDay).toISOString().split('T')[0];

      const result = payouts.filter((payout) => {
        return payout.status === "paid" && payout.paid_at.split('T')[0] == currentDateString;
      });

      // Check if we need to fetch more payouts
      if (result.length === 0) {
        
        // check if last date in payouts is less than current date
        const lastPayoutDate = new Date(payouts[payouts.length - 1].paid_at).getTime();

        if (lastPayoutDate > currentDay) {
          console.log("Reached: " + new Date(lastPayoutDate));
          
          payouts = await fetchPayouts(++page, 15, restaurant.gojek_access_token);
          continue;
        }
      }

      const payout = result ? Math.round(result.reduce((acc, a) => acc + parseFloat(a.net_amount), 0) / 100) : 0;

      console.log(
        chalk.bgYellow.black.bold(
          `\n📅 Дата: ${new Date(currentDay).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}`
        )
      );
      console.log(chalk.white.bold("-----------------------------------"));
      console.log(
        `${chalk.bold(
          "💵 выплаты:"
        )} ${payout} (IDR)`
      );
      console.log(chalk.white.bold("-----------------------------------"));

      const existingStat = await GojekStats.findOne({
        where: {
          stat_date: currentDay,
          restaurant_id: restaurant.id,
        },
      });

      dataSaved = true;

      if (existingStat) {
        existingStat.payouts = payout;
        await existingStat.save();
      } else {
        await GojekStats.create({
          payouts: payout,
          restaurant_id: restaurant.id,
          stat_date: currentDay,
        });
      }
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

        currentDay = previousDay;
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

        currentDay = previousDay;

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

  // At the end of the function, after all tasks have been completed:
  if (dataSaved) {
    return true;
  } else {
    console.log(chalk.red("Данные не были получены или сохранены."));
    return false;
  }
}

module.exports = { getPayouts };
