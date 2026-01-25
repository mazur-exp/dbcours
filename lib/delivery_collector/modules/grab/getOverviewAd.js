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
      // Форматируем строки дат в тот же вид, что и convertDateToISOWithOffset (с суффиксом "+08:00")
      startTime: startOfDay.toISOString().replace("Z", "+08:00"),
      endTime: endOfDay.toISOString().replace("Z", "+08:00"),
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

// Function to clear values ​​from characters except dot
const cleanValue = (value = "0") =>
  parseFloat(value.replace(/[^\d.-]/g, "")) || 0;

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
async function executeRequest(restaurant, typePost, requestData) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: restaurant.grab_token,
    "x-request-id": "72effc7261af770498349a2f8665b37e",
    "x-grabkit-clientid": "GrabMerchant-Portal",
    "x-client-id": "GrabMerchant-Portal",
    "x-mex-version": "v2",
    Origin: "https://merchant.grab.com",
    Referer: "https://merchant.grab.com/insights?tab=sales",
    "x-language": "gb",
    "x-currency": "IDR",
    "x-app-version": "1.2(v67)",
    "x-device-id": "ios",
    "x-mts-ssid": restaurant.grab_token,
  };

  try {
    const response = await axios({
      method: "post",
      url: `https://portal.grab.com/adsapi/v1/advertisers/${restaurant.grab_advertiser_id}/selfserve/report?caller=${typePost}`,
      headers: headers,
      data: requestData,
    });
    return response.data.report || null;
  } catch (error) {
    console.error("Error making request:", error.status, error.message);
    return null;
  }
}

// Универсальная функция для обработки метрик
async function handleMetrics(
  restaurant,
  type,
  requestData,
  saveFunction,
  from
) {
  const report = await executeRequest(restaurant, type, requestData);
  if (report) {
    await saveFunction(report, restaurant, from);
  } else {
    console.log("Нет данных для сохранения.");
  }
}

// Example function for processing CustomerLifecycle metrics
async function fetchCustomerLifecycleMetrics(restaurant, from, to) {
  const requestData = {
    timeZone: "Asia/Makassar",
    startTime: from,
    endTime: to,
    metrics: ["SSR_CONVERSION_VALUE"],
    dimensions: ["SSR_ADVERTISER_ID", "SSR_AUDIENCE_LIFE_CYCLE_MERCHANT"],
    dimensionFilters: [
      {
        dimension: "SSR_ADVERTISER_ID",
        values: [restaurant.grab_advertiser_id],
      },
    ],
    caller: "CustomerLifeCycle",
  };

  await handleMetrics(
    restaurant,
    "CustomerLifeCycle",
    requestData,
    saveCustomerLifecycleMetrics,
    from
  );
}

async function saveCustomerLifecycleMetrics(report, restaurant, date) {
  const stat_date = date.split("T")[0];
  const data = {
    earned_new_customers: 0,
    earned_repeated_customers: 0,
    earned_reactivated_customers: 0,
  };

  report.forEach(({ metrics, dimensions: { AudienceLifeCycleMerchant_ } }) => {
    const conversionValue = cleanValue(metrics.ConversionValue_);
    if (AudienceLifeCycleMerchant_ === "NEW")
      data.earned_new_customers = conversionValue;
    else if (AudienceLifeCycleMerchant_ === "EXISTING")
      data.earned_repeated_customers = conversionValue;
    else data.earned_reactivated_customers = conversionValue;
  });

  await upsertGrabStats(restaurant.id, stat_date, data);
}

// Example function for processing metrics by Summary
async function fetchAdSummaryMetrics(restaurant, from, to) {
  const requestData = {
    timezone: "Asia/Makassar",
    startTime: from,
    endTime: to,
    granularity: "SSR_DAY",
    metrics: [
      "SSR_BILLABLE_LOCAL_AD_SPEND",
      "SSR_CONVERSIONS",
      "SSR_IMPRESSIONS",
      "SSR_CTR",
      "SSR_ROAS",
    ],
    dimensionFilters: [
      {
        dimension: "SSR_ADVERTISER_ID",
        values: [restaurant.grab_advertiser_id],
      },
    ],
    caller: "Summary",
  };
  await handleMetrics(
    restaurant,
    "Summary",
    requestData,
    saveAdSummaryMetrics,
    from
  );
}

async function saveAdSummaryMetrics(report, restaurant, date) {
  const stat_date = date.split("T")[0];

  console.log(report);
  const metrics = report[0]?.metrics;

  const data = {
    ads_ctr: cleanValue(metrics?.CTR_),
    impressions: cleanValue(metrics?.Impressions_),
    ads_spend: cleanValue(metrics?.BillableLocalAdSpend_),
    ads_orders: cleanValue(metrics?.Conversions_),
    ads_sales:
      cleanValue(metrics?.ClickAttributedSale_) +
      cleanValue(metrics?.ViewAttributedSale_),
  };

  await upsertGrabStats(restaurant.id, stat_date, data);
}

// Пример функции для обработки ConversionFunnel метрик
async function fetchConversionFunnelMetrics(restaurant, from, to) {
  const requestData = {
    timeZone: "Asia/Makassar",
    startTime: from,
    endTime: to,
    metrics: [
      "SSR_UNIQUE_USER_IMPRESSION",
      "SSR_UNIQUE_MENU_VISIT",
      "SSR_UNIQUE_ADD_TO_CART",
      "SSR_UNIQUE_USER_CONVERSION",
    ],
    dimensions: ["SSR_ADVERTISER_ID"],
    dimensionFilters: [
      {
        dimension: "SSR_ADVERTISER_ID",
        values: [restaurant.grab_advertiser_id],
      },
    ],
    caller: "ConversionFunnel",
    pageToken: 0,
  };

  await handleMetrics(
    restaurant,
    "ConversionFunnel",
    requestData,
    saveConversionFunnelMetrics,
    from
  );
}

async function saveConversionFunnelMetrics(report, restaurant, date) {
  const stat_date = date.split("T")[0];
  const metrics = report[0]?.metrics;

  const data = {
    unique_impressions_reach: cleanValue(metrics?.UniqueUserImpression_),
    unique_menu_visits: cleanValue(metrics?.UniqueUserMenuVisit_),
    unique_add_to_carts: cleanValue(metrics?.UniqueUserAddToCart_),
    unique_conversion_reach: cleanValue(metrics?.UniqueUserConversion_),
  };

  await upsertGrabStats(restaurant.id, stat_date, data);
}

// Example of a function for processing Geo metrics
async function fetchGeoMetrics(restaurant, from, to) {
  const requestData = {
    timeZone: "Asia/Makassar",
    startTime: from,
    endTime: to,
    metrics: ["SSR_CONVERSION_VALUE"],
    dimensions: ["SSR_ADVERTISER_ID", "SSR_OUTLET"],
    dimensionFilters: [
      {
        dimension: "SSR_ADVERTISER_ID",
        values: [restaurant.grab_advertiser_id],
      },
    ],
    caller: "Geo",
    pageToken: 0,
  };

  await handleMetrics(restaurant, "Geo", requestData, saveGeoMetrics, from);
}

async function saveGeoMetrics(report, restaurant, date) {
  const stat_date = date.split("T")[0];
  const metrics = report[0].metrics;

  const data = {
    conversion_value: cleanValue(metrics.ConversionValue_),
  };

  await upsertGrabStats(restaurant.id, stat_date, data);
}



// Example of use with CustomerLifecycle metrics
async function fetchCustomerLifecycleMetricsByDay(restaurant, from, to) {
  await fetchMetricsByDay(restaurant, from, to, fetchCustomerLifecycleMetrics);
}

// Example of use with metrics AdSummary
async function fetchAdSummaryMetricsByDay(restaurant, from, to) {
  await fetchMetricsByDay(restaurant, from, to, fetchAdSummaryMetrics);
}

// Example of use with metrics ConversionFunnel
async function fetchConversionFunnelMetricsByDay(restaurant, from, to) {
  await fetchMetricsByDay(restaurant, from, to, fetchConversionFunnelMetrics);
}

// Example of use with metrics Geo
async function fetchGeoMetricsByDay(restaurant, from, to) {
  await fetchMetricsByDay(restaurant, from, to, fetchGeoMetrics);
}

// Экспортируем все функции как модуль
module.exports = {
  fetchCustomerLifecycleMetricsByDay,
  fetchAdSummaryMetricsByDay,
  fetchConversionFunnelMetricsByDay,
  fetchGeoMetricsByDay,
};
