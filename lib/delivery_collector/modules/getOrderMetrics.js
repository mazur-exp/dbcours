const axios = require('axios');
const chalk = require('chalk');
const moment = require('moment');
const { GojekStats } = require('../database/db');
const { refreshGojekToken } = require('../modules/tokenUtils');

/* Получить статистику по времени отдачи заказов */
async function getOrderMetrics(restaurant, from, to) {
    const url = 'https://app.gobiz.com/analytics-backend/api/datasources/proxy/2/_msearch?max_concurrent_shard_requests=5';
    const dateOffset = Math.floor((to-from) / 86400000);

    const headers = {
        'Content-Type': 'application/x-ndjson',
        'authentication-type': 'go-id',
        'Authorization': `Bearer ${restaurant.gojek_access_token}`,
        'x-comp-range-from': from,
        'x-comp-range-to': to,
        'x-comp-range-offset': dateOffset + 'd',
        'x-custom-interval': '1d',
        'x-dashboard-id': '15',
        'x-grafana-org-id': '1',
        'x-grafana-org-id': '1',
        'x-panel-id': '22',
        'x-range-from': from,
        'x-range-to': to,
        'x-ref-ids': 'A;B;C',
        'x-setting-interval': '5m',
    };

    const data = [
        '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-08"]}',
        '{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND ordered_at:>=1723046400000 AND ordered_at:<=1723132799999"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":1723046400000,"max":1723132799999},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1h"},"aggs":{"1":{"avg":{"field":"analytic_temp.acceptance_time"}}}}}}',
        '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-08"]}',
        '{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND ordered_at:>=1723046400000 AND ordered_at:<=1723132799999"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":1723046400000,"max":1723132799999},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1h"},"aggs":{"3":{"avg":{"field":"analytic_temp.food_prepare_time"}}}}}}',
        '{"search_type":"query_then_fetch","ignore_unavailable":true,"index":["orders_2024-08"]}',
        '{"size":0,"query":{"bool":{"filter":[{"query_string":{"analyze_wildcard":true,"query":"merchant_id:(\"\") AND ordered_at:>=1723046400000 AND ordered_at:<=1723132799999"}}]}},"aggs":{"2":{"date_histogram":{"field":"ordered_at","min_doc_count":0,"extended_bounds":{"min":1723046400000,"max":1723132799999},"format":"epoch_millis","time_zone":"Asia/Jakarta","interval":"1h"},"aggs":{"3":{"avg":{"field":"analytic_temp.delivery_time"}}}}}}'
    ].join('\n');

    try {
        const response = await axios.post(url, data, { headers: headers });

        const responses = response.data.responses;
        let dataSaved = false;  // Variable for tracking data saving

        const calculateAverageInSeconds = (times) => {
            const totalSeconds = times.reduce((acc, time) => acc + time, 0);
            return totalSeconds / times.length;
        };

        const groupAndCalculateAverage = (buckets, valueKey) => {
            const groupedData = {};

            buckets.forEach(bucket => {
                const date = moment(parseInt(bucket.key_as_string)).format('YYYY-MM-DD');
                const value = bucket[valueKey] && bucket[valueKey].value;
                if (value !== null) {
                    if (!groupedData[date]) {
                        groupedData[date] = [];
                    }
                    groupedData[date].push(value);
                }
            });

            const averages = {};
            for (const date in groupedData) {
                averages[date] = calculateAverageInSeconds(groupedData[date]);
            }

            return averages;
        };

        const acceptingTimes = groupAndCalculateAverage(responses[0].aggregations['2'].buckets, '1');
        const preparationTimes = groupAndCalculateAverage(responses[1].aggregations['2'].buckets, '3');
        const deliveryTimes = groupAndCalculateAverage(responses[2].aggregations['2'].buckets, '3');



        function secondsToTimeFormat(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const remainingSeconds = Math.floor(seconds % 60);

            // Format to string TIME (HH:MM:SS)
            const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

            return formattedTime;
        }

        // We get an array of all dates and sort it in descending order
        const dates = Object.keys(acceptingTimes).sort((a, b) => new Date(b) - new Date(a));

        for (const date of dates) {
            const acceptingTime = acceptingTimes[date];
            const preparationTime = preparationTimes[date];
            const deliveryTime = deliveryTimes[date];

            if (!isNaN(acceptingTime) || !isNaN(preparationTime) || !isNaN(deliveryTime)) {
                dataSaved = true;  // The data is available and will be saved.

                const existingStat = await GojekStats.findOne({
                    where: {
                        stat_date: date,
                        restaurant_id: restaurant.id
                    }
                });


                if (existingStat) {
                    if (!isNaN(acceptingTime)) {
                        existingStat.accepting_time = secondsToTimeFormat(acceptingTime);
                    }
                    if (!isNaN(preparationTime)) {
                        existingStat.preparation_time = secondsToTimeFormat(preparationTime);
                    }
                    if (!isNaN(deliveryTime)) {
                        existingStat.delivery_time = secondsToTimeFormat(deliveryTime);
                    }
                    await existingStat.save();
                } else {
                    await GojekStats.create({
                        stat_date: date,
                        accepting_time: !isNaN(acceptingTime) ? secondsToTimeFormat(acceptingTime) : null,
                        preparation_time: !isNaN(preparationTime) ? secondsToTimeFormat(preparationTime) : null,
                        delivery_time: !isNaN(deliveryTime) ? secondsToTimeFormat(deliveryTime) : null,
                        restaurant_id: restaurant.id
                    });
                }

                // We format the date for easier perception
                const formattedDate = new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

                // Output data as plain text
                console.log(chalk.bgWhite.black.bold(`\n=== Статистика на ${formattedDate} ===`));
                console.log(`${chalk.bold('Дата:')} ${chalk.bold(formattedDate)}`);
                console.log(`${chalk.bold('Время принятия заказа:')} ${acceptingTime ? chalk.green(secondsToTimeFormat(acceptingTime)) : chalk.gray('N/A')}`);
                console.log(`${chalk.bold('Время подготовки заказа:')} ${preparationTime ? chalk.yellow(secondsToTimeFormat(preparationTime)) : chalk.gray('N/A')}`);
                console.log(`${chalk.bold('Время доставки заказа:')} ${deliveryTime ? chalk.blue(secondsToTimeFormat(deliveryTime)) : chalk.gray('N/A')}`);
                console.log(chalk.white.bold('-----------------------------------'));
            }
        }

        if (dataSaved) {
            console.log(chalk.green('Среднее время успешно сохранено в базу данных.'));
            return true;  // The data has been saved.
        } else {
            return false;  // There was no data to save.
        }


    } catch (error) {
        // Always display detailed information about the error
        console.error(chalk.red('Ошибка:', error.message));
        if (error.response) {
            console.error(chalk.red('Статус:', error.response.status));
            console.error(chalk.red('Ответ от сервера:', error.response.data));
        }

        if (error.response && error.response.status === 401) {
            console.error(chalk.red('Ошибка 401: Необходимо обновить токен.'));
            await refreshGojekToken(restaurant); // The refreshToken function is supposed to update the gojek_access_token in the restaurant object
            console.log(chalk.yellow('Повторная попытка загрузки данных...'));
            return await getOrderMetrics(restaurant, from, to); // Retry after token refresh
        } else {
            return false;  // In case of an error, return false
        }
    }
}

module.exports = { getOrderMetrics };