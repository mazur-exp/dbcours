const axios = require('axios');
const chalk = require('chalk');
const moment = require('moment');
const { GojekStats, Restaurant } = require('../database/db');

const { refreshGojekToken } = require('../modules/tokenUtils');

/* Get advertising statistics */

async function getAdStatistics(restaurant, from, to) {
    const url = 'https://app.gobiz.com/analytics-backend/api/ds/query';

    const fromISO = moment(from).toISOString();
    const toISO = moment(to).toISOString();

    const dateOffset = Math.floor((to-from) / 86400000);

    const headers = {
        'Content-Type': 'application/x-ndjson',
        'authentication-type': 'go-id',
        'Authorization': `Bearer ${restaurant.gojek_access_token}`,
        'x-comp-range-from': from,
        'x-comp-range-to': to,
        'x-comp-range-offset': dateOffset + 'd',
        'x-dashboard-id': '75',
        'x-custom-ad-slot': 'GOFOOD_CPC_FUNGIBLE_AD;GOFOOD_HOME_BANNER_TOP;GOFOOD_HOME_MAST_HEAD_TOP;GOFOOD_TEXT_SEARCH_TILE',
        'x-grafana-org-id': '1',
        'x-panel-id': '14',
        'x-range-from': from,
        'x-range-to': to,
        'x-ref-ids': 'A',
        'x-setting-interval': '1h',
    };

    const data = {
        "queries": [{
            "refId": "A",
            "datasource": {
                "uid": "53vCEARVk",
                "type": "postgres"
            },
            "rawSql": `with daily_metrics as (
                Select date, ad_id, sum(num_clicks) as num_clicks,
                jsonb_merge_object(coalesce(orders_info, '{}'::jsonb)) as orders_info,
                merchant_id, sum(num_banner_impressions) as num_banner_impressions
                from daily_go_ads_campaign_metrics
                where merchant_id in ()
                and $__timeFilter(date)
                group by ad_id, merchant_id, date
            ),
            hourly_metrics as (
                Select date, ad_id, sum(num_clicks) as num_clicks,
                jsonb_merge_object(coalesce(orders_info, '{}'::jsonb)) as orders_info,
                merchant_id, sum(num_impressions) as num_impressions
                from hourly_ads_campaign_metrics
                where merchant_id in ()
                and $__timeFilter(date)
                group by ad_id, merchant_id, date
            ),
            metrics as (
                select
                    coalesce(d.ad_id, h.ad_id) as ad_id,
                    coalesce(d.merchant_id, h.merchant_id) as merchant_id,
                    coalesce(d.date, h.date) as date,
                    coalesce(sum(d.num_clicks), sum(h.num_clicks)) as num_clicks,
                    coalesce(sum(d.num_banner_impressions), sum(h.num_impressions)) as num_banner_impressions,
                    jsonb_merge_object(coalesce(d.orders_info, h.orders_info, '{}'::jsonb)) as orders_info
                from daily_metrics d full outer join hourly_metrics h
                on d.date = h.date and d.ad_id = h.ad_id and d.merchant_id = h.merchant_id
                group by 1, 2, 3
            ),
            ad_metrics as (
                select date, ad_id, merchant_id,
                    coalesce(count(key), 0) as order_count,
                    coalesce(sum(cast(objects.value -> 'gmv_top_line' as bigint)), 0) as gmv_top_line,
                    coalesce(sum(cast(objects.value -> 'gmv_bottom_line' as bigint)), 0) as gmv_bottom_line,
                    num_clicks,
                    num_banner_impressions
                from metrics m left join lateral jsonb_each(orders_info) objects on true
                group by m.ad_id, merchant_id, num_clicks, num_banner_impressions, date
            ),
            active_campaigns as (
                select id, ad_slot, price_per_unit, pricing_model_type,
                    case when (start_date < cast(to_timestamp($__unixEpochFrom()) as date)) then cast(to_timestamp($__unixEpochFrom()) as date)
                    else start_date
                    end as start_date,
                    case when (end_date > cast(to_timestamp($__unixEpochTo()) as date)) then cast(to_timestamp($__unixEpochTo()) as date)
                    else end_date
                    end as end_date, m.*
                from go_ads_campaign_details a join ad_metrics m on a.id = m.ad_id
                where $__timeFilter(date)
                and LOWER(membership_type) = 'paid'
            ),
            outlet_interval as (
                select merchant_id, min(start_date) as start_date, max(end_date) as end_date
                from active_campaigns
                group by merchant_id
            ),
            daily_outlet_metrics as (
                select o.date, o.merchant_id, sum(num_completed_orders) as num_completed_orders
                from daily_outlet_metrics o join outlet_interval i on o.merchant_id = i.merchant_id
                where o.merchant_id in ()
                and o.date between i.start_date and i.end_date
                group by 1, 2
                order by o.merchant_id, o.date
            ),
            hourly_outlet_metrics as (
                select o.date, o.merchant_id, sum(num_completed_orders) as num_completed_orders
                from hourly_outlet_metrics o join outlet_interval i on o.merchant_id = i.merchant_id
                where o.merchant_id in ()
                and o.date between i.start_date and i.end_date
                group by 1, 2
                order by o.merchant_id, o.date
            ),
            outlet_metrics as (
                select 
                    coalesce(d.date, h.date) as date,
                    coalesce(d.merchant_id, h.merchant_id) as merchant_id,
                    coalesce(d.num_completed_orders, h.num_completed_orders) as num_completed_orders
                from daily_outlet_metrics d full outer join hourly_outlet_metrics h
                on d.date = h.date and d.merchant_id = h.merchant_id
            ),
            ad_campaign_details as (
                select ad.date, ad.merchant_id, ad.ad_slot,
                    coalesce(sum(ad.order_count), 0) as order_count,
                    coalesce(sum(ad.num_clicks), 0) as num_clicks,
                    case when LOWER(ad.pricing_model_type) = 'cpc' then coalesce(sum(ad.num_clicks * ad.price_per_unit), 0)
                    else coalesce(sum(ad.num_banner_impressions * ad.price_per_unit), 0)
                    end as ad_spent,
                    coalesce(sum(ad.gmv_top_line), 0) as ad_gmv_top_line,
                    coalesce(sum(ad.num_banner_impressions), 0) as num_banner_impressions
                from active_campaigns ad 
                where ad_slot in ('GOFOOD_CPC_FUNGIBLE_AD','GOFOOD_HOME_BANNER_TOP','GOFOOD_HOME_MAST_HEAD_TOP','GOFOOD_TEXT_SEARCH_TILE')
                group by ad.date, ad.merchant_id, ad.ad_slot, ad.pricing_model_type
            )
            select a.date,
                    a.ad_slot,
                    count(distinct a.merchant_id) as num_participating_outlets, 
                    sum(o.num_completed_orders) num_outlet_completed_orders,
                    sum(a.order_count) as num_ad_completed_orders,
                    sum(a.ad_spent) as ad_spent, 
                    sum(a.ad_gmv_top_line) as gmv_top_line,
                    coalesce(sum(a.ad_gmv_top_line) / NULLIF(sum(a.ad_spent), 0), 0) as roas,
                    coalesce(sum(a.order_count) / NULLIF(count(distinct a.merchant_id), 0), 0) as avg_daily_transaction
            from ad_campaign_details a join outlet_metrics o on a.merchant_id = o.merchant_id and a.date = o.date
            group by a.date, a.ad_slot`,
            "format": "table",
            "datasourceId": 6,
            "intervalMs": 3600000,
            "maxDataPoints": 1182
        }],
        "range": {
            "from": fromISO,
            "to": toISO,
            "raw": {
                "from": "now-1d/d",
                "to": "now-1d/d"
            }
        },
        "from": from.toString(),
        "to": to.toString()
    };

    try {

        let dataSaved = false;

        const response = await axios.post(url, data, { headers });

        const values = response.data.results.A.frames[0].data.values;

        // Create an object to store summarized data by dates
        const aggregatedData = {};

        // We go through all the entries in values
        values[0].forEach((value, i) => {
            const date = moment(values[0][i]).format('YYYY-MM-DD');

            if (!aggregatedData[date]) {
                // Initialize an object for each date
                aggregatedData[date] = {
                    ads_sales: 0,
                    ads_orders: 0,
                    ads_spend: 0
                };
            }

            // We sum up the values ​​for each date
            aggregatedData[date].ads_sales += values[6][i];
            aggregatedData[date].ads_orders += values[4][i];
            aggregatedData[date].ads_spend += values[5][i];

            dataSaved = true;  // The data is available and will be saved.
        });

        // Now we write the summarized data into the database
        const sortedDates = Object.keys(aggregatedData).sort((a, b) => new Date(b) - new Date(a));

        const tasks = sortedDates.map(async date => {
            console.log(chalk.bgYellow.black.bold(`\n📅 Дата: ${new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}`));
            console.log(chalk.white.bold('-----------------------------------'));
            console.log(`${chalk.bold('📊 Завершенных заказов по рекламе:')} ${chalk.greenBright(aggregatedData[date].ads_orders)}`);
            console.log(`${chalk.bold('💰 Стоимость рекламы:')} ${chalk.blueBright(aggregatedData[date].ads_spend)} IDR`);
            console.log(`${chalk.bold('💵 Валовая выручка:')} ${chalk.yellowBright(aggregatedData[date].ads_sales)} IDR`);
            console.log(chalk.white.bold('-----------------------------------'));

            const existingStat = await GojekStats.findOne({
                where: {
                    stat_date: date,
                    restaurant_id: restaurant.id
                }
            });

            if (existingStat) {
                existingStat.ads_sales = aggregatedData[date].ads_sales;
                existingStat.ads_orders = aggregatedData[date].ads_orders;
                existingStat.ads_spend = aggregatedData[date].ads_spend;
                await existingStat.save();
            } else {
                await GojekStats.create({
                    ads_sales: aggregatedData[date].ads_sales,
                    ads_orders: aggregatedData[date].ads_orders,
                    ads_spend: aggregatedData[date].ads_spend,
                    restaurant_id: restaurant.id,
                    stat_date: date
                });
            }
        });

        // Waiting for all asynchronous operations to complete
        await Promise.all(tasks);

        // At the end of the function, after all tasks have been completed:
        if (dataSaved) {
            return true;  // The data has been saved.
        } else {
            console.log(chalk.yellow('Нет данных для сохранения в базе данных.'));
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
            return await getAdStatistics(restaurant, from, to); // Retry after token refresh
        } else if (error.response && error.response.status === 502) {
            console.error(chalk.red('Ошибка 502: Пробуем выполнить запрос еще раз'));
            return await getAdStatistics(restaurant, from, to); // Retry after token refresh
        } else {
            return false;
        }
    }
}

module.exports = { getAdStatistics };