const axios = require('axios');
const chalk = require('chalk');
const moment = require('moment');
const { GojekStats, Restaurant } = require('../database/db');

const { refreshGojekToken } = require('../modules/tokenUtils');

/* Get advertising statistics */

async function getAdCostAndSalesStatistics(restaurant, from, to) {
    console.log(chalk.yellow(`Получение данных о затратах на рекламу и продажах для ${restaurant.name}...`));

    // Преобразуем timestamp в объекты Date
    const fromDate = new Date(from);
    const toDate = new Date(to);

    console.log(chalk.cyan(`Период: ${moment(fromDate).format('DD.MM.YYYY')} - ${moment(toDate).format('DD.MM.YYYY')}`));

    // Флаг для определения успешного получения данных хотя бы за один день
    let anyDataRetrieved = false;

    // Разбиваем диапазон на отдельные дни
    const currentDate = new Date(fromDate);

    // Обрабатываем каждый день в диапазоне
    while (currentDate <= toDate) {
        // Получаем начало и конец текущего дня
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Форматированная дата для логирования
        const formattedDate = moment(currentDate).format('DD.MM.YYYY');
        console.log(chalk.cyan(`Получение данных за ${formattedDate}...`));

        // Получаем данные за один день
        const dayResult = await getDataForSingleDay(restaurant, dayStart.getTime(), dayEnd.getTime(), formattedDate);

        // Если получили данные за день, отмечаем успех
        if (dayResult) {
            anyDataRetrieved = true;
        }

        // Переходим к следующему дню
        currentDate.setDate(currentDate.getDate() + 1);
    }

    return anyDataRetrieved;
}

/**
 * Получение данных о затратах на рекламу и продажах за один день
 */
async function getDataForSingleDay(restaurant, from, to, formattedDate) {
    const url = 'https://portal.gofoodmerchant.co.id/analytics-backend/api/datasources/proxy/63/_msearch?max_concurrent_shard_requests=5';

    const fromTs = from.toString();
    const toTs = to.toString();

    // Общие заголовки
    const baseHeaders = {
        'accept': '*/*',
        'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'authentication-type': 'go-id',
        'authorization': `Bearer ${restaurant.gojek_access_token}`,
        'cache-control': 'no-cache',
        'content-type': 'application/json, application/x-ndjson',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'sec-ch-ua': '"Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-comp-range-from': fromTs,
        'x-comp-range-offset': '',
        'x-comp-range-to': toTs,
        'x-custom-ad-slot': '',
        'x-custom-interval': '1d',
        'x-custom-merchant-id': '',
        'x-dashboard-id': '104',
        'x-grafana-org-id': '1',
        'x-setting-interval': '1d'
    };

    // Заголовки для запроса Sales (GMV)
    const salesHeaders = {
        ...baseHeaders,
        'x-panel-id': '16',
        'x-range-from': fromTs,
        'x-range-to': toTs,
        'x-ref-ids': 'total_gmv_topline_amount;prev_total_gmv_topline_amount;total_ad_promo_gmv_topline_amount;total_organic_gmv_topline_amount'
    };

    // Заголовки для запроса Cost (Burn Amount)
    const costHeaders = {
        ...baseHeaders,
        'x-panel-id': '20',
        'x-range-from': fromTs,
        'x-range-to': toTs,
        'x-ref-ids': 'total_ad_promo_burn_amount;total_ad_burn_amount;total_promo_burn_amount'
    };

    const data = null;

    try {
        // Выполняем оба запроса параллельно
        const [salesResponse, costResponse] = await Promise.all([
            axios.post(url, data, { headers: salesHeaders }),
            axios.post(url, data, { headers: costHeaders })
        ]);

        let adsSales = 0;
        let adsSpend = 0;

        // Обработка ответа Sales
        if (salesResponse.data && salesResponse.data.responses && salesResponse.data.responses.length > 2) {
            // total_ad_promo_gmv_topline_amount - индекс 2
            const adPromoResponse = salesResponse.data.responses[2];
            if (adPromoResponse && adPromoResponse.aggregations && adPromoResponse.aggregations['2'] && adPromoResponse.aggregations['2'].buckets) {
                const buckets = adPromoResponse.aggregations['2'].buckets;
                for (const bucket of buckets) {
                    if (bucket.key >= from && bucket.key <= to) {
                        if (bucket['1'] && typeof bucket['1'].value !== 'undefined') {
                            adsSales = bucket['1'].value;
                            break;
                        }
                    }
                }
            }
        }

        // Обработка ответа Cost
        if (costResponse.data && costResponse.data.responses && costResponse.data.responses.length > 0) {
            // total_ad_promo_burn_amount - индекс 0 (согласно x-ref-ids: total_ad_promo_burn_amount;total_ad_burn_amount;total_promo_burn_amount)
            // 0: total_ad_promo_burn_amount (Ads + Discounts) = 43,800 - ЭТО НАМ НУЖНО
            // 1: total_ad_burn_amount (For Ads) = 14,400
            // 2: total_promo_burn_amount (For Discounts) = 29,400

            // Нам нужен total_ad_promo_burn_amount (Ads & Discounts Expenditure), который под индексом 0
            const adPromoBurnResponse = costResponse.data.responses[0];

            if (adPromoBurnResponse && adPromoBurnResponse.aggregations && adPromoBurnResponse.aggregations['2'] && adPromoBurnResponse.aggregations['2'].buckets) {
                const buckets = adPromoBurnResponse.aggregations['2'].buckets;
                for (const bucket of buckets) {
                    if (bucket.key >= from && bucket.key <= to) {
                        if (bucket['1'] && typeof bucket['1'].value !== 'undefined') {
                            adsSpend = bucket['1'].value;
                            break;
                        }
                    }
                }
            }
        }

        const adsData = {
            ads_spend: adsSpend,
            ads_sales: adsSales
        };

        // Выводим информацию о полученных данных
        console.log(chalk.bgYellow.black.bold(`\n📊 Статистика рекламы за ${formattedDate}`));
        console.log(chalk.white.bold('-----------------------------------'));
        console.log(`${chalk.bold('💰 Стоимость рекламы:')} ${chalk.blueBright(adsData.ads_spend)} IDR`);
        console.log(`${chalk.bold('💵 Валовая выручка:')} ${chalk.yellowBright(adsData.ads_sales)} IDR`);
        console.log(chalk.white.bold('-----------------------------------'));

        // Сохраняем данные в БД с конкретной датой текущего дня
        const statDate = moment(from).format('YYYY-MM-DD');

        const existingStat = await GojekStats.findOne({
            where: {
                stat_date: statDate,
                restaurant_id: restaurant.id
            }
        });

        if (existingStat) {
            existingStat.ads_sales = adsData.ads_sales;
            existingStat.ads_spend = adsData.ads_spend;
            await existingStat.save();
            console.log(chalk.green(`Данные за ${formattedDate} успешно обновлены в базе данных.`));
        } else {
            await GojekStats.create({
                ads_sales: adsData.ads_sales,
                ads_spend: adsData.ads_spend,
                restaurant_id: restaurant.id,
                stat_date: statDate
            });
            console.log(chalk.green(`Данные за ${formattedDate} успешно сохранены в базе данных.`));
        }

        return true;

    } catch (error) {
        // Выводим детальную информацию об ошибке
        console.error(chalk.red(`Ошибка при получении данных за ${formattedDate}:`, error.message));
        if (error.response) {
            console.error(chalk.red('Статус:', error.response.status));
            // Логируем ответ, но аккуратно, чтобы не засорять консоль
            const errorData = JSON.stringify(error.response.data);
            console.error(chalk.red('Ответ от сервера:', errorData.length > 500 ? errorData.substring(0, 500) + '...' : errorData));
        }

        if (error.response && error.response.status === 401) {
            console.error(chalk.red('Ошибка 401: Необходимо обновить токен.'));
            await refreshGojekToken(restaurant);
            console.log(chalk.yellow('Повторная попытка загрузки данных...'));
            return await getDataForSingleDay(restaurant, from, to, formattedDate);
        } else if (error.response && error.response.status === 502) {
            console.error(chalk.red('Ошибка 502: Пробуем выполнить запрос еще раз'));
            return await getDataForSingleDay(restaurant, from, to, formattedDate);
        } else {
            return false;
        }
    }
}

module.exports = { getAdCostAndSalesStatistics };