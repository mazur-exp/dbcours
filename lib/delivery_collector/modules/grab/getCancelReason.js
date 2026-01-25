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

async function executeRequest(restaurant, from, to) {
  const headers = {
    Authorization: restaurant.grab_token,
    "x-agent": "mexapp",
    "x-app-platform": "web",
    "x-app-version": "1.2(v67)",
    "x-client-id": "GrabMerchant-Portal",
    "x-currency": "IDR",
    "x-date": from,
    "x-device-id": "ios",
    "x-grabkit-clientid": "GrabMerchant-Portal",
    "x-language": "gb",
    "x-merchant-id": restaurant.grab_merchant_id,
    "x-mex-version": "v2",
    "x-mts-jb": "false",
    "x-mex-resource": "zeus_store:" + restaurant.grab_food_entity_id,
    "x-mts-ssid": restaurant.grab_token,
    "x-request-id": "371b03289bd67b81fd1f654ba9ac5709",
    "x-user-type": "user-profile",
  };

  const requestData = {
    merchant_group_id: restaurant.grab_merchant_id,
    parentEntityIds: [],
    storeGrabIDs: [restaurant.grab_store_id],
    businessLines: [],
    offset: 0,
    limit: 50,
    pageNumber: 0,
    startDate: from,
    endDate: to,
    queryNames: ["operation-cancellation-rate-per-store"],
  };

  from = from.split("T")[0];
  to = to.split("T")[0];

  try {
    const response = await axios({
      method: "post",
      url: `https://merchant.grab.com/troy/insights/v1/list?merchant_group_id=${restaurant.grab_merchant_id}&currency=IDR`,
      headers: headers,
      data: requestData,
    });

    return response.data.data || null;
  } catch (error) {
    console.error("Error making request:", error.status, error.message);
    return null;
  }
}

async function fetchCancellations(restaurant, from, to) {
  const report = await executeRequest(restaurant, from, to);
  if (report) {
    await saveMetrics(report, restaurant, from);
  } else {
    console.log("Нет данных для сохранения.");
  }
}

async function saveMetrics(cancellations, restaurant, date) {

  if (!cancellations) return;

  const stat_date = date.split("T")[0];
  cancellations = cancellations[0].columns || [];

  const data = {
    store_is_closed: parseInt(cancellations["mex-insightsv2-018-002-list"]) || 0,
    store_is_busy: parseInt(cancellations["mex-insightsv2-018-003-list"]) || 0,
    store_is_closing_soon: parseInt(cancellations["mex-insightsv2-018-004-list"]) || 0,
    out_of_stock: parseInt(cancellations["mex-insightsv2-018-005-list"]) || 0
  };

  data.cancelled_orders = Object.keys(data).reduce((acc, curr) => acc + data[curr], 0);

  await upsertGrabStats(restaurant.id, stat_date, data);
}

// Example of use with metrics Geo
async function fetchCancelReasonByDay(restaurant, from, to) {
  await fetchMetricsByDay(restaurant, from, to, fetchCancellations);
}

module.exports = {
  fetchCancelReasonByDay,
};
