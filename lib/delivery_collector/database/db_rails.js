const chalk = require('chalk');
const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Connect to Rails SQLite database
const railsEnv = process.env.RAILS_ENV || 'development';
const dbPath = path.join(__dirname, '../../../storage', `dbcourse_${railsEnv}.sqlite3`);

console.log(chalk.blue(`[DB] Connecting to Rails database: ${dbPath}`));

// Sequelize connection to Rails SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false,
});

// Model for restaurant_stats table (ALREADY EXISTS in Rails!)
const RestaurantStat = sequelize.define('RestaurantStat', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  restaurant_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  stat_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  // Grab metrics
  grab_sales: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  grab_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  grab_ads_spend: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  grab_ads_sales: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  grab_new_customers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  grab_repeated_customers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  grab_fake_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // GoJek metrics
  gojek_sales: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  gojek_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  gojek_ads_spend: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  gojek_ads_sales: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  gojek_new_customers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  gojek_returned_customers: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  gojek_fake_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // Aggregated totals
  total_sales: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  total_orders: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  synced_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'restaurant_stats',  // EXISTING table in Rails!
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true
});

// Model for restaurants table (ALREADY EXISTS in Rails!)
const Restaurant = sequelize.define('Restaurant', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING
  },
  // Grab credentials
  grab_token: {
    type: DataTypes.TEXT
  },
  grab_user_id: {
    type: DataTypes.STRING
  },
  grab_store_id: {
    type: DataTypes.STRING
  },
  grab_merchant_id: {
    type: DataTypes.STRING
  },
  grab_advertiser_id: {
    type: DataTypes.STRING
  },
  grab_food_entity_id: {
    type: DataTypes.STRING
  },
  // GoJek credentials
  gojek_merchant_id: {
    type: DataTypes.STRING
  },
  gojek_client_id: {
    type: DataTypes.STRING
  },
  gojek_refresh_token: {
    type: DataTypes.TEXT
  },
  gojek_access_token: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'restaurants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true
});

// Associations
Restaurant.hasMany(RestaurantStat, { foreignKey: 'restaurant_id' });
RestaurantStat.belongsTo(Restaurant, { foreignKey: 'restaurant_id' });

async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log(chalk.green('[DB] ✓ Connected to Rails SQLite database'));

    // DON'T sync() - tables already created by Rails migrations!
    // await sequelize.sync();

    const restaurantsCount = await Restaurant.count();
    console.log(chalk.blue(`[DB] Found ${restaurantsCount} restaurants in Rails database`));

    return true;
  } catch (error) {
    console.error(chalk.red('[DB] ✗ Connection failed:'), error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  Restaurant,
  RestaurantStat,
  initializeDatabase
};
