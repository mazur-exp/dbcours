const axios = require('axios');
const Sequelize = require('sequelize');
const chalk = require('chalk');
const { GojekStats } = require('../database/db');; // Importing the GojekStats model

const { refreshGojekToken } = require('../modules/tokenUtils');

/*
* For shorter periods of time, sometimes Gojek doesnt return data average rating data for a specific day.
* In that case, we will just fetch the nearest one for the date
*/
async function getLastRating(restaurant, date, responseData) {
    if (responseData.length > 0) {
        const lastRatingBucket = responseData.pop();
        const lastAverageRating = lastRatingBucket['1']?.value;
        if (lastAverageRating) return lastAverageRating
    }

    // Select nearest non-null rating
    const gojekStats = await GojekStats.findOne({
        where: {
            restaurant_id: restaurant.id,
            rating: {
                [Sequelize.Op.gt]: 0
            },
            stat_date: {
                [Sequelize.Op.lt]: new Date(date).toISOString().split('T')[0]
            }
        },
        order: [[ 'stat_date', 'DESC' ]],
    });
    
    return (gojekStats && gojekStats.rating > 0) ? gojekStats.rating: 0
}

/* Get ratings */
async function getRating(restaurant, from, to) {
    const url = 'https://app.gobiz.com/analytics-backend/api/datasources/proxy/26/_msearch?max_concurrent_shard_requests=5';

    const headers = {
        'Content-Type': 'application/x-ndjson',
        'authentication-type': 'go-id',
        'Authorization': `Bearer ${restaurant.gojek_access_token}`,
        'x-comp-range-from': null,
        'x-comp-range-to': null,
        'x-custom-interval': '1h',
        'x-dashboard-id': '28',
        'x-panel-id': '6',
        'x-range-from': null,
        'x-range-to': null,
        'x-ref-ids': 'A;B;C',
        'x-setting-interval': '2h',
        'x-grafana-org-id': '1',
    };

    const dayInMillis = 24 * 60 * 60 * 1000;
    let currentDay = to;

    let dataSaved = false;  // Flag to track whether data was saved
    let missingDataCount = 0;  // Missing data counter
    let errorCount = 0;

    while (currentDay >= from) {
        const previousDay = currentDay - dayInMillis;

        headers['x-comp-range-from'] = previousDay;
        headers['x-comp-range-to'] = currentDay;
        headers['x-range-from'] = previousDay;
        headers['x-range-to'] = currentDay;

        const data = [
            '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["analytic_merchant_rating_v1_2024-05","analytic_merchant_rating_v1_2024-06","analytic_merchant_rating_v1_2024-07","analytic_merchant_rating_v1_2024-08"]}',
            `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"label.merchant_id: AND time:>=${previousDay} AND time:<=${currentDay}"}}]}},"aggs":{"2":{"date_histogram":{"field":"time","min_doc_count":1,"extended_bounds":{"min":${previousDay},"max":${currentDay}},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1h"},"aggs":{"1":{"avg":{"field":"data.restaurant_rating"}}}}}}`,
            '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["analytic_merchant_rating_v1_2024-05","analytic_merchant_rating_v1_2024-06","analytic_merchant_rating_v1_2024-07","analytic_merchant_rating_v1_2024-08"]}',
            `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"label.merchant_id: AND time:>=${previousDay} AND time:<=${currentDay}"}}]}},"aggs":{"2":{"date_histogram":{"field":"time","min_doc_count":1,"extended_bounds":{"min":${previousDay},"max":${currentDay}},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1w"},"aggs":{"1":{"avg":{"field":"data.restaurant_rating"}}}}}}`,
            '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["analytic_merchant_rating_v1_2024-05","analytic_merchant_rating_v1_2024-06","analytic_merchant_rating_v1_2024-07","analytic_merchant_rating_v1_2024-08"]}',
            `{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"label.merchant_id: AND time:>=${previousDay} AND time:<=${currentDay}"}}]}},"aggs":{"2":{"terms":{"field":"data.merchant_id","size":10,"order":{"_key":"desc"},"min_doc_count":1},"aggs":{"1":{"sum":{"field":"data.cumulative_5_star_rating_received_count"}},"3":{"sum":{"field":"data.cumulative_4_star_rating_received_count"}},"4":{"sum":{"field":"data.cumulative_3_star_rating_received_count"}},"5":{"sum":{"field":"data.cumulative_2_star_rating_received_count"}},"6":{"sum":{"field":"data.cumulative_1_star_rating_received_count"}}}}}}`
        ].join('\n');

        try {
            const response = await axios.post(url, data, { headers: headers });

            console.log(chalk.green(`Запрос выполнен успешно для даты: ${new Date(currentDay).toLocaleDateString()}`));

            const firstRequestAggregations = response.data.responses[0].aggregations['2'].buckets;
            const lastRatingValue = await getLastRating(restaurant, previousDay, firstRequestAggregations);

            const secondRequestAggregations = response.data.responses[2].aggregations['2'].buckets[0] ?? {};
            const ratings = {
                one_star_ratings: secondRequestAggregations['6']?.value || 0,
                two_star_ratings: secondRequestAggregations['5']?.value || 0,
                three_star_ratings: secondRequestAggregations['4']?.value || 0,
                four_star_ratings: secondRequestAggregations['3']?.value || 0,
                five_star_ratings: secondRequestAggregations['1']?.value || 0,
            };

            console.log('Количество отзывов по оценкам:');
            console.table({
                '5 звезд': ratings.five_star_ratings,
                '4 звезды': ratings.four_star_ratings,
                '3 звезды': ratings.three_star_ratings,
                '2 звезды': ratings.two_star_ratings,
                '1 звезда': ratings.one_star_ratings,
            });
            console.log('');
            console.log(chalk.yellow(`Последнее значение оценки заведения за ${new Date(currentDay).toLocaleDateString()}: ${lastRatingValue}`));
            console.log('');
            console.log('');

            const existingStat = await GojekStats.findOne({
                where: {
                    stat_date: new Date(currentDay).toISOString().split('T')[0],
                    restaurant_id: restaurant.id
                }
            });

            if (existingStat) {
                existingStat.rating = lastRatingValue;
                existingStat.one_star_ratings = ratings.one_star_ratings;
                existingStat.two_star_ratings = ratings.two_star_ratings;
                existingStat.three_star_ratings = ratings.three_star_ratings;
                existingStat.four_star_ratings = ratings.four_star_ratings;
                existingStat.five_star_ratings = ratings.five_star_ratings;
                await existingStat.save();
                dataSaved = true;  // The data has been saved.
                missingDataCount = 0;  // Reset the counter because the data has been saved.
            } else {
                await GojekStats.create({
                    stat_date: new Date(currentDay).toISOString().split('T')[0],
                    rating: lastRatingValue,
                    one_star_ratings: ratings.one_star_ratings,
                    two_star_ratings: ratings.two_star_ratings,
                    three_star_ratings: ratings.three_star_ratings,
                    four_star_ratings: ratings.four_star_ratings,
                    five_star_ratings: ratings.five_star_ratings,
                    restaurant_id: restaurant.id
                });
                dataSaved = true;  // The data has been saved.
                missingDataCount = 0;  // Reset the counter because the data has been saved.
            }

            errorCount = 0;
        } catch (error) {

            // Always display detailed information about the error
            console.error(chalk.red('Ошибка:', error.message));
            if (error.response) {
                console.error(chalk.red('Статус:', error.response.status));
                console.error(chalk.red('Ответ от сервера:', error.response.data));
            }

            // Error handling logic
            if (error.response && error.response.status === 401) {
                console.error(chalk.red('Ошибка 401: Необходимо обновить токен.'));
                await refreshGojekToken(restaurant);
                console.log(chalk.yellow('Повторная попытка загрузки данных...'));
                errorCount++; // Increase the error counter
                if (errorCount > 5) {
                    console.error(chalk.red('Превышено количество ошибок. Прекращение выполнения скрипта.'));
                    break; // We stop execution when 5 errors in a row are exceeded
                }
                continue;  // Let's try again with the same day

            } else if (error instanceof TypeError && error.message.includes("Cannot read properties of undefined")) {
                console.error(chalk.red(`Ошибка: Похоже, данные за ${new Date(currentDay).toLocaleDateString()} отсутствуют.`));
                missingDataCount++;  // Increase the missing data counter

                if (missingDataCount >= 10) {
                    console.error(chalk.red(`Данные отсутствуют 10 дней подряд. Прекращение дальнейших попыток.`));
                    break;  // We stop execution and exit the loop
                }
                if (errorCount > 5) {
                    console.error(chalk.red('Превышено количество ошибок. Прекращение выполнения скрипта.'));
                    break; // We stop execution when 5 errors in a row are exceeded
                }

            } else {
                errorCount++; // Increase the error counter
                if (errorCount > 5) {
                    console.error(chalk.red('Превышено количество ошибок. Прекращение выполнения скрипта.'));
                    break; // We stop execution when 5 errors in a row are exceeded
                }
                console.error(chalk.red('Ошибка:', error));
                continue;  
            }
        }

        currentDay = previousDay;
    }

    return dataSaved;  // Return true if the data was saved at least once, otherwise false
}

module.exports = { getRating };