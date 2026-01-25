const axios = require("axios");
const chalk = require("chalk");
const { GrabStats } = require("../../database/db");
const { getAverageRating } = require("./getAverageRating");

// Function for dividing a date range into days taking into account the time zone +08:00
function splitByDays(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = [];
  const timezoneOffset = 8 * 60 * 60 * 1000; // Time zone offset +08:00

  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    const startOfDay = new Date(d.getTime() + timezoneOffset);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime());
    endOfDay.setUTCHours(23, 59, 59, 999);

    days.push({
      startTime: startOfDay.toISOString(),
      endTime: endOfDay.toISOString(),
    });
  }
  return days;
}

async function fetchRestaurantMetricsByDay(restaurant, queryNames, from, to) {
  const days = splitByDays(from, to);

  for (const day of days) {
    console.log(`Fetching data from ${day.startTime} to ${day.endTime}`);
    await fetchRestaurantMetrics(restaurant, queryNames, day.startTime, day.endTime);
  }
}

async function fetchRestaurantMetrics(restaurant, queryNames, startDate, endDate) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": restaurant.grab_token,
    "x-grabkit-clientid": "GrabMerchant-Portal",
    "x-client-id": "GrabMerchant-Portal",
    "x-mex-version": "v2",
    "grab-id": restaurant.grab_store_id,
    "x-language": "gb",
    "x-currency": "IDR",
    "x-app-version": "1.2(v67)",
    "x-device-id": "ios",
    "x-mts-jb": "false",
    "x-agent": "mexapp",
    "x-api-source": "mex-insign",
    "merchantid": restaurant.grab_food_entity_id,
    "x-mex-resource": "zeus_store:" + restaurant.grab_food_entity_id,
    "x-mts-ssid": restaurant.grab_token,
  };  

  const requestData = {
    parentEntityIds: [],
    storeGrabIDs: [restaurant.grab_store_id],
    businessLines: [],
    startDate: startDate,
    endDate: endDate,
    queryNames: queryNames,
  };

  try {
    const response = await axios({
      method: "post",
      url: "https://merchant.grab.com/troy/insights/v1/list?currency=IDR",
      headers: headers,
      data: requestData,
    });

    // console.log(JSON.stringify(response.data, null, 2));

    // Extract data depending on the request
    let dataToSave = {};
    const stat_date = startDate.split("T")[0];

    switch (queryNames[0]) {
      case "sales-performance":
        const { net_sales, transactions_count } = response.data.data
          ? response.data.data[0].columns
          : { net_sales: 0, transactions_count: 0 };

        dataToSave = {
          rating: await getAverageRating(restaurant, startDate, endDate),
          sales: net_sales,
          orders: transactions_count,
        };
        break;
      case "customer-breakdown-overview":
        const { total_customer, new_user, repeated, infrequent } = response.data
          .data
          ? response.data.data[0].columns
          : { total_customer: 0, new_user: 0, repeated: 0, infrequent: 0 };
        dataToSave = {
          total_customers: total_customer,
          new_customers: new_user,
          repeated_customers: repeated,
          reactivated_customers: infrequent,
        };
        break;
      case "operation-waiting-time-list":

        const data = response.data.data;

        const waitingTime = data && data.length > 0
          ? Math.round(
            data.reduce((acc, item) => acc + parseFloat(item.columns.avg_time), 0) / data.length * 100
          ) / 100
          : 0;

        dataToSave = { driver_waiting_time: waitingTime || 0 };
        break;
      case "operation-store-offline-hours-metric":
        const { offline_hours_in_minutes } = response.data.data
          ? response.data.data[0].columns
          : 0;
        dataToSave = {
          offline_rate: offline_hours_in_minutes || 0,
        };
        break;
      case "operation-cancellation-rate-per-store":
        const { cancellation_rate } = response.data.data
          ? response.data.data[0]?.columns
          : 0;
        dataToSave = {
          cancelation_rate: cancellation_rate || 0,
        };
        break;
      default:
        console.log(chalk.red("Неизвестный запрос."));
        return;
    }

    // Check if there is a record with this date
    const existingRecord = await GrabStats.findOne({
      where: {
        stat_date: stat_date,
        restaurant_id: restaurant.id,
      },
    });

    if (existingRecord) {
      // If the record exists, update it
      await GrabStats.update(dataToSave, {
        where: { stat_date: stat_date, restaurant_id: restaurant.id },
      });
      console.log(chalk.yellow(`Запись на ${stat_date} обновлена.`));
    } else {
      // If the record does not exist, create a new one
      await GrabStats.create({
        ...dataToSave,
        stat_date: stat_date,
        restaurant_id: restaurant.id,
      });
      console.log(chalk.green(`Новая запись на ${stat_date} создана.`));
    }

    console.log(
      chalk.blue("Данные, которые были записаны/обновлены в таблицу:")
    );
    Object.entries(dataToSave).forEach(([key, value]) => {
      console.log(chalk.cyan(`${key}: ${value}`));
    });

    return true;
  } catch (error) {
    console.error(
      chalk.red("Ошибка при выполнении запроса или сохранении данных:"),
      error
    );
  }
}

module.exports = { fetchRestaurantMetricsByDay };
