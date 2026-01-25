const axios = require("axios");
const chalk = require("chalk");
const { Restaurant } = require("../../database/db");
const { loginGrabToken } = require("../tokenUtils");

async function fetchGrabStatements(restaurant) {
  restaurant.grab_token = await loginGrabToken(restaurant);

  if (!restaurant.grab_token) {
    console.log(chalk.red("No grab token found"));
    return false;
  }

  try {
    const response = await axios.get(
      "https://merchant.grab.com/permission/v1/statements?currency=IDR",
      {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json, text/plain, */*",
          "accept-encoding": "gzip, deflate, br, zstd",
          "accept-language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          authorization: restaurant.grab_token, // Token for authorization
          "x-mts-ssid": restaurant.grab_token, // We also substitute this into this title
          "x-grabkit-grab-requestid": "123c8643-ed05-461e-bd85-7c33e514ca31",
          "x-api-source": "mex-auth",
          "x-app-platform": "web",
          "x-app-version": "1.2(v67)",
          "x-client-id": "GrabMerchant-Portal",
          "x-currency": "IDR",
          "x-date": new Date().toISOString(),
          "x-device-id": "ios",
          "x-language": "gb",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
      }
    );

    // Extract the userID from the response and write it to the restaurant object
    const userID = response.data.data.statements[0].userID;

    // We check if there is a record with such a reply date and write it to the restaurant object
    const existingRecord = await Restaurant.findOne({
      where: {
        id: restaurant.id,
      },
    });

    if (existingRecord) {
      // If the record exists, update it
      await Restaurant.update(
        { grab_user_id: userID },
        {
          where: { id: restaurant.id },
        }
      );
    }

    restaurant.grab_user_id = userID;

    console.log(`userID записан в restaurant: ${restaurant.grab_user_id}`);

    const response2 = await axios.get(
      "https://merchant.grab.com/employee-management/v1/get-user?grab_id=" +
        restaurant.grab_user_id +
        "&currency=IDR",
      {
        headers: {
          authorization: restaurant.grab_token,
          "x-grabkit-grab-requestid": "1bd41357-a13f-481e-92c3-9000f693d3e1",
          "x-api-source": "mex-core-api",
          "x-client-id": "GrabMerchant-Portal",
          "x-currency": "IDR",
          "x-date": new Date().toISOString(),
          "x-device-id": "ios",
          "x-mex-resource": "zeus_store:6-C4LWL3TGRYWKNA",
          "x-mex-version": "v2",
          "x-mts-jb": "false",
          "Grab-id": restaurant.grab_user_id,
          "x-mts-ssid": restaurant.grab_token,
          "x-request-id": "df1bdc26a3c4eee23689f98a822988d2",
          "x-agent": "mexapp",
          "x-app-platform": "web",
          "x-app-version": "1.2(v67)",
          "x-grabkit-clientid": "GrabMerchant-Portal",
          "x-language": "gb",
          "x-user-type": "user-profile",
        },
      }
    );

    let storeID = response2.data.store_id,
      grabFoodEntityID = response2.data.grab_food_entity_id;

    if (!storeID) {
      storeID = response2.data.parent_entity_id;
    }

    restaurant.grab_food_entity_id = grabFoodEntityID;

    // If the record exists, update it
    await Restaurant.update(
      { grab_store_id: storeID, grab_food_entity_id: grabFoodEntityID },
      {
        where: { id: restaurant.id },
      }
    );

    const advertiserID = await searchAdvertisers(restaurant);

    restaurant.grab_advertiser_id = advertiserID;

    await Restaurant.update(
      { grab_advertiser_id: advertiserID },
      {
        where: { id: restaurant.id },
      }
    );

    const merchantID = await searchMerchants(restaurant);
    restaurant.grab_merchant_id = merchantID;

    await Restaurant.update(
      { grab_merchant_id: merchantID },
      {
        where: { id: restaurant.id },
      }
    );

    return true;
  } catch (error) {
    console.error(
      "Error fetching Grab statements:",
      error.response ? error.response.data : error.message
    );
    return false;
  }
}

async function searchAdvertisers(restaurant) {
  const headers = {
    authorization: restaurant.grab_token,
    cookie:
      "OptanonAlertBoxClosed=2024-09-04T18:03:06.640Z; OptanonConsent=isGpcEnabled=0&datestamp=Thu+Sep+05+2024+02:03:06+GMT%2B0800; _ga=GA1.2.180030981.1725473142",
  };

  try {
    const response = await axios.post(
      "https://api.grab.com/admanageruiserver/v3/advertisers/search",
      {
        filters: [],
        pageNumber: 1,
        pageSize: 10,
        sorting: null,
      },
      { headers }
    );
    const advertisers = response.data.entries;
    if (advertisers && advertisers.length > 0) {
      const advertiserID = advertisers[0].advertiserID;
      console.log("advertiserID:", advertiserID);
      return advertiserID;
    } else {
      console.log("No advertisers found");
      return null;
    }
  } catch (error) {
    console.error(
      "Error fetching advertisers:",
      error.response ? error.response.data : error.message
    );
  }
}

async function searchMerchants(restaurant) {
  const headers = {
    "x-agent": "mexapp",
    "x-app-platform": "web",
    "x-app-version": "1.0.0",
    "x-client-id": "GrabMerchant-Portal",
    "x-currency": "IDR",
    "x-device-id": "ios",
    "x-grabkit-clientid": "GrabMerchant-Portal",
    "x-mts-ssid": restaurant.grab_token,
    "x-request-id": "584e9747e670593f326781c2ce21",
    "x-user-type": "user-profile",
  };

  try {
    const response = await axios.get(
      "https://merchant.grab.com/troy/user-profile/v1/merchant-selector",
      { headers }
    );

    const merchants = response.data.merchants.map(merchant => merchant.id);
    if (merchants && merchants.length > 0) {
      const merchantID = merchants[0].id;
      console.log("merchantID:", merchantID);
      return merchantID;
    } else {
      console.log("No advertisers found");
      return null;
    }
  } catch (error) {
    console.error(
      "Error fetching advertisers:",
      error.response ? error.response.data : error.message
    );
  }
}

module.exports = { fetchGrabStatements };
