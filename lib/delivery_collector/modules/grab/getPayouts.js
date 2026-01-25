const axios = require("axios");
const { GrabStats } = require("../../database/db");

// Function for dividing a date range into days taking into account the time zone +08:00
function splitByDays(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = [];
  const timezoneOffset = 8 * 60 * 60 * 1000; // Time zone offset +08:00

  // Let's go through each day
  for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
    const startOfDay = new Date(d.getTime() + timezoneOffset); // We take into account the displacement
    startOfDay.setUTCHours(0, 0, 0, 0); // Start of day taking into account the offset
    const endOfDay = new Date(startOfDay.getTime());
    endOfDay.setUTCHours(23, 59, 59, 999); // End of day with offset

    // Add a range for each day to the array
    days.push({
      startTime: startOfDay.toISOString(),
      endTime: endOfDay.toISOString(),
    });
  }
  return days;
}

// Universal function for performing queries by days
async function fetchMetricsByDay(restaurant, from, to, fetchFunction) {
  // We break the range into days
  const days = splitByDays(from, to);

  // We iteratively execute the query for each day
  for (const day of days) {
    console.log(`Fetching data from ${day.startTime} to ${day.endTime}`);
    await fetchFunction(restaurant, day.startTime, day.endTime);
  }
}

// Universal function for updating a record in a database
async function upsertGrabStats(restaurantId, statDate, data) {
  try {
    const existingRecord = await GrabStats.findOne({
      where: { restaurant_id: restaurantId, stat_date: statDate },
    });

    if (existingRecord) {
      await GrabStats.update(data, {
        where: { restaurant_id: restaurantId, stat_date: statDate },
      });

      console.log(data);
      console.log(`Запись для ресторана обновлена на ${statDate}.`);
    } else {
      await GrabStats.create({
        restaurant_id: restaurantId,
        stat_date: statDate,
        ...data,
      });
      console.log(`Создана новая запись для ресторана на ${statDate}.`);
    }
  } catch (error) {
    console.error("Ошибка при записи данных в базу:", error);
  }
}

// A generic function for executing a query
async function executeRequest(restaurant, from, to) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: restaurant.grab_token,
    "x-request-id": "72effc7261af770498349a2f8665b37e",
    "x-grabkit-clientid": "GrabMerchant-Portal",
    "x-client-id": "GrabMerchant-Portal",
    "x-mex-version": "v2",
    Origin: "https://merchant.grab.com",
    "x-language": "en",
    "x-currency": "IDR",
    "x-app-version": "1.2(v67)",
    "x-device-id": "ios",
    "x-mex-resource": "zeus_store:" + restaurant.grab_food_entity_id,
    "x-mts-ssid": restaurant.grab_token,
  };

  from = from.split("T")[0];
  to = to.split("T")[0];

  try {
    const response = await axios({
      method: "get",
      url: `https://merchant.grab.com/mex/finances/v1/stores/${restaurant.grab_store_id}/settlement-summary?from=${from}&to=${to}&currency=IDR`,
      headers: headers,
    });
    
    return response.data.data.net_earnings || null;
  } catch (error) {
    console.error("Error making request:", error.status, error.message);
    return null;
  }
}

async function fetchPayouts(restaurant, from, to) {
  const report = await executeRequest(restaurant, from, to);
  if (report) {
    await saveMetrics(report, restaurant, from);
  } else {
    console.log("Нет данных для сохранения.");
  }
}

async function saveMetrics(netPayouts, restaurant, date) {
  const stat_date = date.split("T")[0];

  const data = {
    payouts: netPayouts
  };

  await upsertGrabStats(restaurant.id, stat_date, data);
}

// Example of use with metrics Geo
async function fetchPayoutsByDay(restaurant, from, to) {
  await fetchMetricsByDay(restaurant, from, to, fetchPayouts);
}

module.exports = {
  fetchPayoutsByDay,
};
