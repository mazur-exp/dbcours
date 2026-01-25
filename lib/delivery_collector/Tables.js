const config = require("./config");

function fetchAndInsertAllStatsForAllRestaurants() {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const lastRow = sheet.getLastRow();

    for (let i = 2; i <= lastRow; i++) {
        const restaurantNameCell = String(sheet.getRange(i, 1).getValue()).trim();

        // Check if the cell contains the restaurant name in quotes
        if (restaurantNameCell.startsWith('"') && restaurantNameCell.endsWith('"')) {
            const restaurantName = restaurantNameCell.replace(/"/g, ''); // Убираем кавычки

            // URL for API request including all data types with dynamic restaurant name
            const apiUrl = `${config.APIURL}/restaurant-stats?name=${encodeURIComponent(restaurantName)}&start_date=2024-09-01&end_date=2024-09-16`;

            Logger.log(`Fetching stats for restaurant: ${restaurantName}, API URL: ${apiUrl}`);

            try {
                // Sending a request to the API
                const response = UrlFetchApp.fetch(apiUrl);
                const responseData = JSON.parse(response.getContentText());

                // Logging the server response for a specific restaurant
                Logger.log(`Response received for restaurant: ${restaurantName}: ${JSON.stringify(responseData)}`);

                if (!responseData || typeof responseData !== 'object') {
                    Logger.log(`Invalid response data for ${restaurantName}`);
                    continue;
                }

                const services = ['gojek', 'grab'];
                services.forEach(service => {
                    if (Array.isArray(responseData[service]) && responseData[service].length === 0) {
                        Logger.log(`No data found for service: ${service} for restaurant: ${restaurantName}`);
                        return; // If there is no data on the service (empty array), skip
                    }

                    if (responseData[service] && typeof responseData[service] === 'object') {
                        Logger.log(`Processing service: ${service} for restaurant: ${restaurantName}`);
                        const data = responseData[service];
                        const dates = Object.keys(data).sort((a, b) => new Date(b) - new Date(a));

                        dates.forEach(date => {
                            Logger.log(`Processing date: ${date} for service: ${service}`);
                            const isoDate = new Date(date).toISOString().slice(0, 10);
                            let column = findOrInsertColumnForDate(isoDate, sheet);

                            // Logging a column for the current date
                            Logger.log(`Inserting data into column: ${column} for date: ${isoDate}`);

                            // Depending on the service, we insert the data
                            if (service === 'gojek') {
                                Logger.log(`Inserting Gojek stats for date: ${isoDate}`);
                                updateStatsInColumnGojek(data[date]?.[0], column, sheet, i); // Checking that the data exists
                            } else if (service === 'grab') {
                                Logger.log(`Inserting Grab stats for date: ${isoDate}`);
                                updateStatsInColumnGrab(data[date]?.[0], column, sheet, i); // Checking that the data exists
                            }

                            // We sign the dates in the restaurant line if the cells are empty, starting from the current one and up to the first one
                            fillEmptyDateCells(i - 1, column, sheet);
                        });
                    } else {
                        Logger.log(`No data found for service: ${service} for restaurant: ${restaurantName}`);
                    }
                });

            } catch (error) {
                Logger.log(`Error for restaurant: ${restaurantName}. Error message: ${error}`);
            }
        }
    }
}

function findOrInsertColumnForDate(newDate, sheet) {
    const dateRow = 1; // First line with dates
    const lastColumn = sheet.getLastColumn();

    for (let col = 2; col <= lastColumn; col++) { // Начинаем с колонки B
        const existingDate = sheet.getRange(dateRow, col).getValue();
        if (!existingDate) {
            // If the date is empty, insert a new date here
            sheet.getRange(dateRow, col).setValue(new Date(newDate));
            Logger.log(`Inserted new date: ${newDate} into column: ${col}`);
            return col;
        }

        const existingIsoDate = new Date(existingDate).toISOString().slice(0, 10);
        if (existingIsoDate === newDate) {
            Logger.log(`Found existing date: ${newDate} in column: ${col}`);
            return col;
        }

        if (new Date(newDate) > new Date(existingIsoDate)) {
            // If the new date is greater, insert a new column before the current one.
            sheet.insertColumnBefore(col);
            sheet.getRange(dateRow, col).setValue(new Date(newDate));
            Logger.log(`Inserted new column for date: ${newDate} before column: ${col}`);
            return col;
        }
    }

    // If you can't find a suitable place, add a new column to the end
    const newColumn = lastColumn + 1;
    sheet.insertColumnAfter(lastColumn);
    sheet.getRange(dateRow, newColumn).setValue(new Date(newDate));
    Logger.log(`Inserted new date: ${newDate} into new column: ${newColumn}`);
    return newColumn;
}

function fillEmptyDateCells(row, upToColumn, sheet) {
    const dateRow = 1; // First line with dates
    for (let col = 2; col <= upToColumn; col++) {
        const dateCell = sheet.getRange(dateRow, col).getValue();
        const restaurantDateCell = sheet.getRange(row, col);

        if (!restaurantDateCell.getValue() && dateCell) {
            // Fill the cell with the date from the first row if it is empty
            restaurantDateCell.setValue(new Date(dateCell));
            Logger.log(`Filled empty cell in row: ${row}, column: ${col} with date: ${dateCell}`);
        }
    }
}

function updateStatsInColumnGojek(stats, column, sheet, startRow) {
    const rowsMappingGojek = {
        'rating': 2,
        'sales': 3,
        'orders': 4,
        'ads_sales': 6,
        'ads_orders': 7,
        'ads_spend': 9,
        'accepting_time': 11,
        'preparation_time': 12,
        'delivery_time': 13,
        'lost_orders': 15,
        'realized_orders_percentage': 16,
        'five_star_ratings': 17,
        'four_star_ratings': 18,
        'three_star_ratings': 19,
        'two_star_ratings': 20,
        'one_star_ratings': 21,
    };

    if (!stats || typeof stats !== 'object') {
        Logger.log('Invalid Gojek stats data');
        return;
    }

    for (const [statName, rowOffset] of Object.entries(rowsMappingGojek)) {
        if (stats[statName] !== undefined) {
            sheet.getRange(startRow + rowOffset, column).setValue(stats[statName]);
            Logger.log(`Inserted Gojek stat: ${statName} with value: ${stats[statName]} in row: ${startRow + rowOffset}, column: ${column}`);
        } else {
            Logger.log(`Missing Gojek stat: ${statName} for this date`);
        }
    }
}

function updateStatsInColumnGrab(stats, column, sheet, startRow) {
    const rowsMappingGrab = {
        'rating': 26, // Move down one line
        'sales': 27,
        'orders': 28,
        'ads_sales': 30,
        'ads_orders': 31,
        'ads_spend': 33,
        'offline_rate': 35,
        'cancelation_rate': 36,
        'ads_ctr': 38,
        'impressions': 39,
        'unique_impressions_reach': 42,
        'unique_menu_visits': 43,
        'unique_add_to_carts': 44,
        'unique_conversion_reach': 45,
        'new_customers': 46,
        'earned_new_customers': 47,
        'repeated_customers': 48,
        'earned_repeated_customers': 49,
        'reactivated_customers': 50,
        'earned_reactivated_customers': 51,
        'total_customers': 52,
        'new_customers': 53,
        'repeated_customers': 54,
        'reactivated_customers': 55,
    };

    if (!stats || typeof stats !== 'object') {
        Logger.log('Invalid Grab stats data');
        return;
    }

    for (const [statName, rowOffset] of Object.entries(rowsMappingGrab)) {
        // Check that the value exists and is not null
        if (stats[statName] !== undefined && stats[statName] !== null) {
            sheet.getRange(startRow + rowOffset, column).setValue(stats[statName]);
            Logger.log(`Inserted Grab stat: ${statName} with value: ${stats[statName]} in row: ${startRow + rowOffset}, column: ${column}`);
        } else {
            Logger.log(`Missing or null Grab stat: ${statName} for this date`);
        }
    }

    // We process driver_waiting_time by calculating the average value
    if (stats['driver_waiting_time'] && stats['driver_waiting_time'] !== 'null') {
        const driverWaitingTimes = JSON.parse(stats['driver_waiting_time']);
        let totalTime = 0;
        let count = 0;

        // We sum up all the waiting times and count the number
        for (const [time, value] of Object.entries(driverWaitingTimes)) {
            totalTime += parseFloat(value); // Преобразуем значения к числу
            count++;
        }

        // Calculate the average value if there is data
        if (count > 0) {
            const averageTime = totalTime / count;
            sheet.getRange(startRow + 37, column).setValue(averageTime.toFixed(2)); // Вставляем среднее значение в строку 40
            Logger.log(`Inserted average driver waiting time: ${averageTime.toFixed(2)} in row: ${startRow + 40}, column: ${column}`);
        } else {
            Logger.log('No valid driver waiting time entries to calculate average');
        }
    } else {
        Logger.log('No valid driver waiting time found for Grab');
    }
}