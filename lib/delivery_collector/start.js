const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
const axios = require('axios');

const { Restaurant, initializeDatabase } = require('./database/db'); // Added initializeDatabase
const { Op } = require('sequelize');

const { loginGrabToken } = require('./modules/tokenUtils');
const { getGojekAllData } = require('./modules/getMe');
const { getTransactions } = require('./modules/getTransactions');
const { getRating } = require('./modules/getRating');
const { getAdCostAndSalesStatistics } = require('./modules/getAdCostAndSalesStatistics');
const { getOrderMetrics } = require('./modules/getOrderMetrics');
const { getOrderStatusDetails } = require('./modules/getOrderStatusDetails');
const { syncRestaurantsToServer } = require('./modules/syncRestaurantsToServer');
const { fetchGrabStatements } = require('./modules/grab/getUserData');
const { fetchRestaurantMetricsByDay } = require('./modules/grab/getSales');
const { fetchCustomerLifecycleMetricsByDay, fetchAdSummaryMetricsByDay, fetchConversionFunnelMetricsByDay, fetchGeoMetricsByDay } = require('./modules/grab/getOverviewAd');

// Import restaurant data to add to the database
const restaurants = require('./restaurants');

// Import configuration
const config = require('./config');
const { getAcceptedOrders } = require('./modules/getAcceptedOrders');
const { getMarkedReady } = require('./modules/getMarkedReady');
const { getIncomingOrders } = require('./modules/getIncomingOrders');
const { getCancelledOrders } = require('./modules/getCancelledOrders');
const { getCancelReason } = require('./modules/getCancelReason');
const { getClients } = require('./modules/getClientsStatus');
const { getCloseTime } = require('./modules/getCloseTime');
const { getPotentialLoss } = require('./modules/getPotentialLoss');
const { getDriverWait } = require('./modules/getDriverWait');
const { fetchAllPreviousData } = require('./modules/fetchAllPreviousData');
const { fetchPayoutsByDay } = require('./modules/grab/getPayouts');
const { getPayouts } = require('./modules/getPayouts');
const { fetchCancelReasonByDay } = require('./modules/grab/getCancelReason');

async function main(deliveryService) {

    // Initializing the database
    await initializeDatabase();

    await addOrUpdateRestaurants();

    const restaurantName = config.restaurantName; // Restaurant name to search for

    // We get a restaurant by name
    const restaurants = await findRestaurantByName(restaurantName);

    if (restaurants && restaurants.length > 0) {
        const restaurant = restaurants[0]; // We assume that at least one restaurant has been found

        if (deliveryService == 'gojek') {
            await getGojekAllData(restaurant);
            chooseGojekScenario(restaurant);
        } else if(deliveryService == 'grab') {
            chooseGrabScenario(restaurant);
        } else if (deliveryService == 'both') {
            await fetchAllPreviousData();
            console.log(chalk.green.bold('\n✅ Auto-collection completed! Exiting...\n'));
            process.exit(0);  // Exit after auto-collection
        }
    } else {
        console.log('Ресторан не найден');
    }
}

async function chooseGojekScenario(restaurant) {
    /* Date settings */
    const from = convertToUTC(config.from);
    const to = convertToUTC(config.to);
    const toAllHistory = convertToUTC(config.to);

    // CLI for scenario selection
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const menuOptions = [
        '1. Список транзакций (По дням)',
        '2. Рейтинг (По дням)',
        '3. Время доставки (Без ограничений)',
        '4. Недоставленные заказы (По дням)',
        '5. Реклама - Затраты и продажи (По дням)',
        '6. Входящие заказы (по дням)',
        '7. Принятые заказы (по дням)',
        '8. Отмечено как готовое (по дням)',
        '9. Отмененные заказы (по дням)',
        '10. Причины отмены (по дням)',
        '11. время закрытия (по дням)',
        '12. Клиенты (Без ограничений)',
        '13. Возможные потери (по дням)',
        '14. Водитель Подождите (по дням)',
        '15. Выплаты (по дням)',
        chalk.yellow('16. Собрать всю историю до ' + config.toAllHistory),
    ];

    const header = `
        ${chalk.green.bold('========================================')}
        ${chalk.green.bold(`${restaurant.name.toUpperCase()} - ВЫБОР СЦЕНАРИЯ \n\nНачало: ${config.from} \nКонец: ${config.to}`)}
        ${chalk.green.bold('========================================')}
    `;

    console.log(header);

    rl.question(`${menuOptions.join('\n')}\nВведите номер: `, async (answer) => {
        const scenarios = {
            '1': () => getTransactions(restaurant, from, to),
            '2': () => getRating(restaurant, from, to),
            '3': () => getOrderMetrics(restaurant, from, to),
            '4': () => getOrderStatusDetails(restaurant, from, to),
            '5': () => getAdCostAndSalesStatistics(restaurant, from, to),
            '6': () => getIncomingOrders(restaurant, from, to),
            '7': () => getAcceptedOrders(restaurant, from, to),
            '8': () => getMarkedReady(restaurant, from, to),
            '9': () => getCancelledOrders(restaurant, from, to),
            '10': () => getCancelReason(restaurant, from, to),
            '11': () => getCloseTime(restaurant, from, to),
            '12': () => getClients(restaurant, from, to),
            '13': () => getPotentialLoss(restaurant, from, to),
            '14': () => getDriverWait(restaurant, from, to),
            '15': () => getPayouts(restaurant, from, to),
            '16': () => gatherFullHistory(restaurant, toAllHistory),
        };

        const selectedScenario = scenarios[answer];

        if (selectedScenario) {
            await selectedScenario();
        } else {
            console.log(chalk.red('Неверный выбор!'));
        }

        rl.close();
    });
}

async function chooseGrabScenario(restaurant) {

    await fetchGrabStatements(restaurant);

    /* Date settings */
    const from = convertDateToISOWithOffset(config.from); // Converts to 2023-01-05T17:00:00.000Z
    const to = convertDateToISOWithOffset(config.to); 

    // CLI for scenario selection
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const menuOptions = [
        chalk.green('1. Grab продажи (Sales Performance)'),
        chalk.green('2. Grab обзор клиентов (Customer Breakdown Overview)'),
        chalk.green('3. Время ожидания водителей (Operation Waiting Time)'),
        chalk.green('4. Процент отмен заказов (Cancellation Rate)'),
        chalk.green('5. Время оффлайна магазина (Store Offline Hours)'),
        chalk.green('6. Получить отчет по Customer Lifecycle'),
        chalk.green('7. Получить сводный отчет (Ad Summary)'),
        chalk.green('8. Получить воронку конверсий (Conversion Funnel)'),
        chalk.green('9. Получайте выплаты (Payouts)'),
        chalk.green('10. Причины отмены (Cancel Reasons)'),
    ];

    const header = `
        ${chalk.green.bold('========================================')}
        ${chalk.green.bold(`${restaurant.name.toUpperCase()} - ВЫБОР СЦЕНАРИЯ \n\nНачало: ${config.from} \nКонец: ${config.to}`)}
        ${chalk.green.bold('========================================')}
    `;

    console.log(header);

    rl.question(`${menuOptions.join('\n')}\nВведите номер: `, async (answer) => {
        const scenarios = {
            '1': () => fetchRestaurantMetricsByDay(restaurant, ['sales-performance'], from, to),
            '2': () => fetchRestaurantMetricsByDay(restaurant, ['customer-breakdown-overview'], from, to),
            '3': () => fetchRestaurantMetricsByDay(restaurant, ['operation-waiting-time-list'], from, to),
            '4': () => fetchRestaurantMetricsByDay(restaurant, ['operation-cancellation-rate-per-store'], from, to),
            '5': () => fetchRestaurantMetricsByDay(restaurant, ['operation-store-offline-hours-metric'], from, to),
            '6': () => fetchCustomerLifecycleMetricsByDay(restaurant, from, to), // Calling a function Customer Lifecycle
            '7': () => fetchAdSummaryMetricsByDay(restaurant, from, to),        // Calling a function Ad Summary
            '8': () => fetchConversionFunnelMetricsByDay(restaurant, from, to), // Calling a function Conversion Funnel
            '9': () => fetchPayoutsByDay(restaurant, from, to),
            '10': () => fetchCancelReasonByDay(restaurant, from, to),
        };

        const selectedScenario = scenarios[answer];

        if (selectedScenario) {
            await selectedScenario();
        } else {
            console.log(chalk.red('Неверный выбор!'));
        }

        rl.close();
    });
}

module.exports = { chooseGrabScenario };

// Function to search for a restaurant by name (partial match)
async function findRestaurantByName(namePart) {
    try {
        const restaurants = await Restaurant.findAll({
            where: {
                name: {
                    [Op.like]: `%${namePart}%`
                }
            }
        });

        return restaurants;
    } catch (error) {
        console.error('Ошибка поиска ресторана:', error);
    }
}

function choiceDeliveryService() {
    console.log("ВЫБРАН РЕСТОРАН: " + config.restaurantName);
    console.log("Сервис:");
    console.log("1. Gojek");
    console.log("2. Grab");
    console.log("3. Сменить ресторан");
    console.log("4. Загрузить данные на сервер");
    console.log(chalk.cyan("5. Автосбор (последние 3 дня)"));
    console.log(chalk.cyan("6. Автосбор (свои даты из config.js)"));
    console.log("7. Пересчитать месяц для выбранного ресторана");
    console.log("8. Пересчитать месяц для всех ресторанов");
    console.log("9. Клиентский отчет по месяцу для выбранного ресторана");

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question("Введите номер: ", async (choice) => {
        readline.close();
        if (choice === '1') {
            main('gojek');
        } else if (choice === '2') {
            main('grab');
        } else if (choice === '3') {
            changeRestaurant();
        } else if (choice === '4') {
            syncRestaurantsToServer();
        } else if (choice === '5') {
            main('both');
        } else if (choice === '6') {
            await runAutoFetchWithConfigDates();
        } else if (choice === '7') {
            recalcMonthForSelectedRestaurant().then(() => choiceDeliveryService());
        } else if (choice === '8') {
            recalcMonthForAllRestaurants().then(() => choiceDeliveryService());
        } else if (choice === '9') {
            clientReportTextForSelectedRestaurant().then(() => choiceDeliveryService());
        } else {
            console.log("Неверный выбор. Пожалуйста, выберите корректный пункт меню.");
            choiceDeliveryService(); // Repeat the selection request
        }
    });
}

async function runAutoFetchWithConfigDates() {
    await initializeDatabase();
    await addOrUpdateRestaurants();

    console.log(chalk.bgYellow.black.bold(`\n📅 Автосбор за период из config.js:`));
    console.log(chalk.yellow(`   От: ${config.from}`));
    console.log(chalk.yellow(`   До: ${config.to}\n`));

    const gojekFrom = convertToUTC(config.from);
    const gojekTo = convertToUTC(config.to);
    const grabFrom = convertDateToISOWithOffset(config.from);
    const grabTo = convertDateToISOWithOffset(config.to);

    const customFrom = { gojek: gojekFrom, grab: grabFrom, display: config.from };
    const customTo = { gojek: gojekTo, grab: grabTo, display: config.to };

    await fetchAllPreviousData(customFrom, customTo);
    
    console.log(chalk.bgGreen.black.bold(`\n✅ Автосбор завершён!\n`));
    choiceDeliveryService();
}

function changeRestaurant() {
    console.log("Доступные рестораны:");
    restaurants.forEach((restaurant, index) => {
        console.log(`${index + 1}. ${restaurant.name}`);
    });

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question("Выберите ресторан: ", (restaurantChoice) => {
        const chosenIndex = parseInt(restaurantChoice) - 1;
        if (chosenIndex >= 0 && chosenIndex < restaurants.length) {
            // Update the restaurant name in the config
            config.restaurantName = restaurants[chosenIndex].name;

            // Write the new value to the config.js file
            fs.writeFile('./config.js', `module.exports = ${JSON.stringify(config, null, 2)};`, (err) => {
                if (err) {
                    console.error('Ошибка при записи конфигурации:', err);
                } else {
                    console.log("Ресторан успешно обновлен на: " + config.restaurantName);
                    // After changing the restaurant, we start the service selection again
                    choiceDeliveryService();
                }
            });
        } else {
            console.log("Неверный выбор. Пожалуйста, выберите корректный номер ресторана.");
            changeRestaurant(); // Repeating the restaurant selection request
        }
        readline.close();
    });
}

// Check command line arguments for automated mode
const deliveryServiceArg = process.argv[2];

if (deliveryServiceArg === 'both' || deliveryServiceArg === 'gojek' || deliveryServiceArg === 'grab') {
  // AUTOMATED MODE - no menu, just run and exit
  console.log(chalk.blue(`[Auto Mode] Starting ${deliveryServiceArg} data collection...`));

  main(deliveryServiceArg).then(() => {
    console.log(chalk.green('✓ Data collection completed successfully'));
    process.exit(0);
  }).catch(err => {
    console.error(chalk.red('✗ Data collection failed:'), err);
    process.exit(1);
  });
} else {
  // INTERACTIVE MODE - show menu
  choiceDeliveryService();
}

function convertDateToISOWithOffset(dateString) {
    // Split a string by spaces and periods
    const [day, month, year, hours, minutes] = dateString.split(/[\s.:]+/);

    // Create a date object taking into account the time zone +08:00
    const date = new Date(year, month - 1, day, hours, minutes, 59); // Устанавливаем время, включая часы, минуты и секунды

    // Set the time zone offset (+08:00 in minutes is 480 minutes)
    const timezoneOffset = 8 * 60 * 60 * 1000; // +08:00 в миллисекундах

    // Apply offset
    const offsetDate = new Date(date.getTime() + timezoneOffset);

    // Format to ISO, adding "+08:00"
    const isoString = offsetDate.toISOString().replace('Z', '+08:00');

    return isoString;
}

function convertToUTC(dateTimeStr) {
    const parseDateTime = (dateTimeStr) => {
        const [date, time] = dateTimeStr.split(' ');
        const [day, month, year] = date.split('.');

        // If the time is missing, set it to 00:00
        const [hours, minutes] = time ? time.split('.') : ['00', '00'];

        return new Date(year, month - 1, day, hours, minutes);
    };

    const date = parseDateTime(dateTimeStr);
    const timestampUTC = date.getTime();

    return timestampUTC;
}

function isDataDifferent(existingData, newData) {
    return Object.keys(newData).some(key => existingData[key] !== newData[key]);
}

async function addOrUpdateRestaurants() {
    for (const data of restaurants) {        
        if (!data.name && data.name.trim() !== '') {
            continue;
        }

        const existingRestaurant = await Restaurant.findOne({ where: { name: data.name } });
        if (existingRestaurant) {
            if (isDataDifferent(existingRestaurant.dataValues, data)) {
                await existingRestaurant.update(data);
                console.log(chalk.green(`"${data.name}" - Обновили данные в БД согласно новым данным из файла.`));
            } else {
                console.log(chalk.blue(`"${data.name}" - Все данные в БД актуальны`));
            }
        } else {
            const newRestaurant = await Restaurant.create(data);
            console.log(chalk.green(`"${newRestaurant.name}" - Добавлен в БД с ID ${newRestaurant.id}.`));
        }
    }
}

async function gatherFullHistory(restaurant, toTimestamp) {
    let continueGathering = true;

    // Convert to Timestamp to date and calculate the start date (from) one month before toTimestamp
    let currentToDate = new Date(toTimestamp);
    let currentFromDate = new Date(currentToDate);
    currentFromDate.setMonth(currentFromDate.getMonth() - 1);

    while (continueGathering) {
        const from = currentFromDate;
        const to = currentToDate;

        let transactionsResult = false;
        let ratingResult = false;
        let orderMetricsResult = false;
        let orderStatusDetailsResult = false;
        let adCostAndSalesResult = false;


        // We get the results of the functions
        transactionsResult = await getTransactions(restaurant, from.getTime(), to.getTime());
        ratingResult = await getRating(restaurant, from.getTime(), to.getTime());
        orderMetricsResult = await getOrderMetrics(restaurant, from.getTime(), to.getTime());
        orderStatusDetailsResult = await getOrderStatusDetails(restaurant, from.getTime(), to.getTime());
        adCostAndSalesResult = await getAdCostAndSalesStatistics(restaurant, from.getTime(), to.getTime());

        // Check if at least one function returns true
        continueGathering = transactionsResult || orderMetricsResult || orderStatusDetailsResult || ratingResult || adCostAndSalesResult;

        const formatDate = (date) => {
            return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        console.log('')
        console.log('')
        console.log('')

        if (continueGathering) {
            console.log(chalk.bgGreen.black.bold(`✅  Статистика за период с ${formatDate(from)} по ${formatDate(to)} собрана.`));
        } else {
            console.log(chalk.bgRed.white.bold(`⚠️  Нет данных за период с ${formatDate(from)} по ${formatDate(to)}. Завершение сбора статистики.`));
        }

        console.log('')
        console.log('')
        console.log('')
        // Go to the previous month
        currentToDate = new Date(currentFromDate);
        currentFromDate.setMonth(currentFromDate.getMonth() - 1);
    }
}

// ==== Helpers for API calls (server endpoints) ====

async function askInput(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(question, (answer) => {
            rl.close();
            resolve((answer || '').trim());
        });
    });
}

function isMonthInputValid(value) {
    return /^\d{4}-(0[1-9]|1[0-2])(\-\d{2})?$/.test(String(value || ''));
}

async function promptMonthOrThrow() {
    const month = await askInput('Введите месяц (YYYY-MM): ');
    if (!isMonthInputValid(month)) {
        throw new Error('Неверный формат месяца. Используйте YYYY-MM');
    }
    return month;
}

async function recalcMonthForSelectedRestaurant() {
    try {
        const month = await promptMonthOrThrow();
        const url = config.APIURL + '/recalculate-month';
        console.log(chalk.green('Запрос: POST ' + url));
        const payload = { name: config.restaurantName, month };
        const resp = await axios.post(url, payload);
        console.log(chalk.green('Готово:'), resp.data);
    } catch (err) {
        printAxiosError(err);
    }
}

async function recalcMonthForAllRestaurants() {
    try {
        const month = await promptMonthOrThrow();
        await initializeDatabase();
        const list = await Restaurant.findAll({ attributes: ['name'] });
        const url = config.APIURL + '/recalculate-month';
        console.log(chalk.green('Запрос для всех ресторанов: POST ' + url));
        for (const r of list) {
            const name = r.name;
            try {
                const resp = await axios.post(url, { name, month });
                console.log(chalk.green(`OK ${name}`), resp.data);
            } catch (e) {
                console.log(chalk.red(`Ошибка для ${name}`));
                printAxiosError(e);
            }
        }
        console.log(chalk.green('Пересчет завершен для всех.'));
    } catch (err) {
        printAxiosError(err);
    }
}

async function clientReportTextForSelectedRestaurant() {
    try {
        const month = await promptMonthOrThrow();
        let lang = await askInput('Язык (ru/en), по умолчанию ru: ');
        lang = (lang || 'ru').toLowerCase();
        const url = config.APIURL + '/commission/client-report-text';
        console.log(chalk.green('Запрос: POST ' + url));
        const resp = await axios.post(url, { name: config.restaurantName, month, lang }, { responseType: 'text' });
        console.log('\n' + String(resp.data || ''));
    } catch (err) {
        printAxiosError(err);
    }
}

function printAxiosError(err) {
    if (err && err.response) {
        console.error(chalk.red(`HTTP ${err.response.status}`));
        try {
            console.error(JSON.stringify(err.response.data, null, 2));
        } catch (_) {
            console.error(String(err.response.data));
        }
    } else {
        console.error(chalk.red(err && err.message ? err.message : String(err)));
    }
}
