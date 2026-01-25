const chalk = require('chalk');
const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// We define the path to the SQLite database file
const dbFilePath = path.join(__dirname, '/database.sqlite');

// We check if the database file exists
if (!fs.existsSync(dbFilePath)) {
    console.log(chalk.red('Файл базы данных не найден.'));
    return false;
}

// Create an instance of Sequelize using SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbFilePath,
    logging: false,
});

// We define a model for the restaurants table
const Restaurant = sequelize.define('Restaurant', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    gojek_merchant_id: {
        type: DataTypes.STRING,
    },
    gojek_client_id: {
        type: DataTypes.STRING,
        defaultValue: 'YEZympJ5WqYRh7Hs', // We set the default value of
    },
    gojek_refresh_token: {
        type: DataTypes.TEXT,
    },
    gojek_access_token: {
        type: DataTypes.TEXT,
    },
    grab_user_id: { 
        type: DataTypes.TEXT,
    },
    grab_store_id: { 
        type: DataTypes.TEXT,
    },
    grab_food_entity_id: {
        type: DataTypes.TEXT,
    },
    grab_advertiser_id: {
        type: DataTypes.TEXT,
    },
    grab_merchant_id: {
        type: DataTypes.TEXT,
    },
    grab_token: { 
        type: DataTypes.TEXT,
    },
}, {
    tableName: 'restaurants',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    freezeTableName: true,
});

// We define a model for the gojek_stats table
const GojekStats = sequelize.define('GojekStats', {
    stat_date: {
        type: DataTypes.DATEONLY,
    },
    rating: {
        type: DataTypes.DECIMAL(3, 2),
    },
    sales: {
        type: DataTypes.DECIMAL(10, 2),
    },
    orders: {
        type: DataTypes.INTEGER,
    },
    ads_sales: {
        type: DataTypes.DECIMAL(10, 2),
    },
    ads_orders: {
        type: DataTypes.INTEGER,
    },
    ads_spend: {
        type: DataTypes.DECIMAL(10, 2),
    },
    accepting_time: {
        type: DataTypes.TIME,
    },
    preparation_time: {
        type: DataTypes.TIME,
    },
    delivery_time: {
        type: DataTypes.TIME,
    },
    lost_orders: {
        type: DataTypes.INTEGER,
    },
    realized_orders_percentage: {
        type: DataTypes.DECIMAL(5, 2),
    },
    one_star_ratings: {
        type: DataTypes.INTEGER,
    },
    two_star_ratings: {
        type: DataTypes.INTEGER,
    },
    three_star_ratings: {
        type: DataTypes.INTEGER,
    },
    four_star_ratings: {
        type: DataTypes.INTEGER,
    },
    five_star_ratings: {
        type: DataTypes.INTEGER,
    },
    accepted_orders: {
        type: DataTypes.INTEGER,
    },
    incoming_orders: {
        type: DataTypes.INTEGER,
    },
    marked_ready: {
        type: DataTypes.INTEGER,
    },
    cancelled_orders: {
        type: DataTypes.INTEGER,
    },
    acceptance_timeout: {
        type: DataTypes.INTEGER,
    },
    out_of_stock: {
        type: DataTypes.INTEGER,
    },
    store_is_busy: {
        type: DataTypes.INTEGER,
    },
    store_is_closed: {
        type: DataTypes.INTEGER,
    },
    close_time: {
        type: DataTypes.STRING,
    },
    new_client: {
        type: DataTypes.INTEGER,
    },
    active_client: {
        type: DataTypes.INTEGER,
    },
    returned_client: {
        type: DataTypes.INTEGER,
    },
    potential_lost: {
        type: DataTypes.INTEGER,
    },
    driver_waiting: {
        type: DataTypes.FLOAT,
    },
    payouts: {
        type: DataTypes.INTEGER,
    },
}, {
    tableName: 'gojek_stats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    freezeTableName: true,
});

// We define a model for the grab_stats table
const GrabStats = sequelize.define('GrabStats', {
    stat_date: {
        type: DataTypes.DATEONLY,
    },
    rating: {
        type: DataTypes.DECIMAL(3, 2),
    },
    sales: {
        type: DataTypes.DECIMAL(10, 2),
    },
    orders: {
        type: DataTypes.INTEGER,
    },
    ads_sales: {
        type: DataTypes.DECIMAL(10, 2),
    },
    ads_orders: {
        type: DataTypes.INTEGER,
    },
    ads_spend: {
        type: DataTypes.DECIMAL(10, 2),
    },
    offline_rate: {
        type: DataTypes.DECIMAL(5, 2),
    },
    cancelation_rate: {
        type: DataTypes.DECIMAL(5, 2),
    },
    cancelled_orders: {
        type: DataTypes.INTEGER,
    },
    store_is_closed: {
        type: DataTypes.INTEGER,
    },
    store_is_busy: {
        type: DataTypes.INTEGER,
    },
    store_is_closing_soon: {
        type: DataTypes.INTEGER,
    },
    out_of_stock: {
        type: DataTypes.INTEGER,
    },
    driver_waiting_time: {
        type: Sequelize.JSON, // We use INTEGER to store the wait time in seconds
        allowNull: true,
    },
    ads_ctr: {
        type: DataTypes.DECIMAL(5, 2),
    },
    impressions: {
        type: DataTypes.INTEGER,
    },
    unique_impressions_reach: {
        type: DataTypes.INTEGER,
    },
    unique_menu_visits: {
        type: DataTypes.INTEGER,
    },
    unique_add_to_carts: {
        type: DataTypes.INTEGER,
    },
    unique_conversion_reach: {
        type: DataTypes.INTEGER,
    },
    new_customers: {
        type: DataTypes.INTEGER,
    },
    earned_new_customers: {
        type: DataTypes.DECIMAL(10, 2),
    },
    repeated_customers: {
        type: DataTypes.INTEGER,
    },
    earned_repeated_customers: {
        type: DataTypes.DECIMAL(10, 2),
    },
    reactivated_customers: {
        type: DataTypes.INTEGER,
    },
    earned_reactivated_customers: {
        type: DataTypes.DECIMAL(10, 2),
    },
    total_customers: {
        type: DataTypes.INTEGER,
    },
    payouts: {
        type: DataTypes.INTEGER
    },
}, {
    tableName: 'grab_stats',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    freezeTableName: true,
});

// We establish a relationship between the tables
Restaurant.hasMany(GrabStats, { foreignKey: 'restaurant_id' });
GrabStats.belongsTo(Restaurant, { foreignKey: 'restaurant_id' });

// We establish a relationship between the tables
Restaurant.hasMany(GojekStats, { foreignKey: 'restaurant_id' });
GojekStats.belongsTo(Restaurant, { foreignKey: 'restaurant_id' });

// Function to initialize the database
async function initializeDatabase() {
    try {
        // 
        await sequelize.sync(); // Synchronizing Models with Database
        console.log(chalk.blue('Соединение с локальной БД установлено'));

        // We get all the restaurants from the database
        const restaurants = await Restaurant.findAll();

        if (restaurants.length > 0) {
            console.log(chalk.green.bold('\n====== СПИСОК ДОБАВЛЕННЫХ РЕСТОРАНОВ ======'));
            restaurants.forEach((restaurant, index) => {
                console.log(chalk.yellow.bold(`\n${index + 1}. ${restaurant.name}`));
                console.log(chalk.cyan(`Merchant ID: ${restaurant.gojek_merchant_id || 'Не указано'}`));
                console.log(chalk.cyan(`Client ID: ${restaurant.gojek_client_id || 'Не указано'}`));
                if (restaurant.gojek_refresh_token) {
                    console.log(chalk.cyan(`Refresh Token: Есть`));
                }
            });
            console.log(chalk.green.bold('=========================================\n'));
        } else {
            console.log(chalk.red.bold('\nВ базе данных нет добавленных ресторанов.\n'));
        }
    } catch (error) {
        console.error(chalk.red('Не получается подключиться к локальной БД:', error));
    }
}

// We export the models, the Sequelize instance, and the database initialization function
module.exports = { sequelize, Restaurant, GojekStats, GrabStats, initializeDatabase };