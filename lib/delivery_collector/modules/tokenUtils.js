const fs = require("fs");
const path = require("path");
const axios = require("axios");
const chalk = require("chalk");
const { Restaurant } = require("../database/db");

// Path to the file with restaurants
const restaurantsFilePath = path.join(__dirname, "../restaurants.js");

async function getGojekTokens(url, data, restaurant) {

  try {
    const response = await axios.post(url, data, {
      headers: {
        "x-user-type": "merchant",
        "x-appid": "go-biz-web-dashboard",
        "x-appversion": "platform-v3.69.0-55f7978d",
        "x-deviceos": "Web",
        "x-phonemake": "OS X 10.15.7 64-bit",
        "x-phonemodel": "Chrome 131.0.0.0 on OS X 10.15.7 64-bit",
        "x-platform": "Web",
        "x-uniqueid": "8c1b9ca3-6304-4949-8e33-11e147e0c610",
        "x-user-locale": "en-GB",
      }
    });

    // Updating tokens in the database
    restaurant.gojek_access_token = response.data.access_token;
    restaurant.gojek_refresh_token = response.data.refresh_token;
    await restaurant.save(); // Save changes to the database

    console.log(
      chalk.green(
        `Токены для ресторана "${restaurant.name}" успешно обновлены в базе данных.`
      )
    );

    // Update tokens in the restaurants.js file
    updateRestaurantTokensInFile(restaurant);
    return true;
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
    return false;
  }
}

// Authorization token refresh function
async function refreshGojekToken(restaurant) {
  return await getGojekTokens(
    "https://api.gobiz.co.id/gobiz/goid/token",
    {
      client_id: restaurant.gojek_client_id,
      grant_type: "refresh_token",
      data: {
        refresh_token: restaurant.gojek_refresh_token,
      },
    },
    restaurant
  );
}

// Token refresh function in restaurants.js file
function updateRestaurantTokensInFile(updatedRestaurant) {
  // Loading current data from file
  const restaurants = require(restaurantsFilePath);

  // Looking for a restaurant to update
  const restaurantIndex = restaurants.findIndex(
    (r) => r.name === updatedRestaurant.name
  );

  if (restaurantIndex !== -1) {
    // Updating tokens
    restaurants[restaurantIndex].gojek_refresh_token =
      updatedRestaurant.gojek_refresh_token;

    // Convert the data to a string
    const restaurantsData = `const restaurants = ${JSON.stringify(
      restaurants,
      null,
      4
    )};\n\nmodule.exports = restaurants;\n`;

    // Save updated data to a file
    fs.writeFileSync(restaurantsFilePath, restaurantsData, "utf8");

    console.log(
      chalk.green(
        `Токены для ресторана "${updatedRestaurant.name}" успешно обновлены в файле restaurants.js.`
      )
    );
  } else {
    console.error(
      chalk.red(
        "Ресторан с указанным merchant_id не найден в файле restaurants.js."
      )
    );
  }
}

async function loginGojekToken(restaurant) {
  try {
    const restaurants = require(restaurantsFilePath);
    const resturantData = restaurants.find((r) => r.name === restaurant.name);

  return await getGojekTokens(
    "https://api.gobiz.co.id/goid/token",
    {
      client_id: "go-biz-web-new",
      grant_type: "password",
      data: {
        email: resturantData.gojek.username,
        password: resturantData.gojek.password,
      }
    },
    restaurant
  );
  } catch (error) {
    console.error(chalk.red("Error: could not login to Gojek account"));
    return false;
  }
}

async function loginGrabToken(restaurant) {

  try {

    const restaurants = require(restaurantsFilePath);
    const resturantData = restaurants.find((r) => r.name === restaurant.name);

    const url = "https://merchant.grab.com/mex-core-api/user-profile/v1/login";
    const data = {
      username: resturantData.grab.username,
      password: resturantData.grab.password,
      without_force_logout: false,
      login_source: "TROY_PORTAL_MAIN_USERNAME_PASSWORD",
      session_data: {
        web_session_data: {
          user_agent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          human_readable_user_agent: "Chrome",
        },
      },
    };


    const response = await axios.post(url, data);

    if (!response.data.data.success) {
      throw new Error(response);
    }

    const newGrabToken = response.data.data.data.jwt;

    await Restaurant.update(
      { grab_token: newGrabToken },
      {
        where: { id: restaurant.id },
      }
    );

    console.log(
      chalk.green(
        `Токены для ресторана "${restaurant.name}" успешно обновлены в базе данных.`
      )
    );

    return newGrabToken;
  } catch (error) {
    console.error(chalk.red("Error: could not login to Grab account"));
    return false;
  }
}

module.exports = { refreshGojekToken, loginGojekToken, loginGrabToken };
