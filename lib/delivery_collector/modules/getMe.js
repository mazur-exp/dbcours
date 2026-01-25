const axios = require('axios');
const chalk = require('chalk');
const { refreshGojekToken, loginGojekToken } = require('./tokenUtils');

async function getGojekAllData(restaurant) {
    const isRefreshed = await refreshGojekToken(restaurant);

    
    if (!isRefreshed) {
        console.log(chalk.yellow('Trying to login with username & password:'));
        const loggedIn = await loginGojekToken(restaurant);
        if (!loggedIn) {
            console.error(chalk.red('Failed to login with username & password. Please check the credentials.'));
            return false;
        }
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${restaurant.gojek_access_token}`,
        'gojek-country-code': 'ID',
    };

    if (!restaurant.gojek_merchant_id) {
        try {
            const response = await axios.get('https://api.gobiz.co.id/v1/users/me', {
                headers: headers
            });

            if (response.data.user.merchant_id) {
                // Updating tokens in the database
                restaurant.gojek_merchant_id = response.data.user.merchant_id;
                await restaurant.save(); // Save changes to the database

                console.log(chalk.yellow('Добавили merchant_id к ' + restaurant.name));

                return true;
            } else {
                console.log(chalk.red('merchant_id не найден'));
                return false;
            }

        } catch (error) {

            if (error.response && error.response.status === 401) {
                console.error(chalk.red('Ошибка 401: Необходимо обновить токен.'));
                await refreshGojekToken(restaurant); // The refreshToken function is supposed to update the gojek_access_token in the restaurant object
                console.log(chalk.yellow('Повторная попытка загрузки данных...'));
                return await getGojekAllData(restaurant); // Retry after token refresh
            }

            console.error('Error making request:', error.response ? error.response.data : error.message);
        }
    } else {
        console.log(chalk.green('Gojek merchant_id found in the database: ' + restaurant.gojek_merchant_id));
        return true;
    }

}

module.exports = { getGojekAllData };