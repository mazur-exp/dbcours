// Test connection to Rails SQLite database
process.env.RAILS_ENV = 'development';

const { initializeDatabase, Client } = require('./database/db_rails');
const chalk = require('chalk');

async function test() {
  console.log(chalk.bgBlue.white.bold('\n🧪 Testing Rails Database Connection\n'));

  // Test 1: Connect to database
  const connected = await initializeDatabase();
  if (!connected) {
    console.error(chalk.red('❌ Failed to connect to Rails database'));
    process.exit(1);
  }

  // Test 2: Read clients
  const clients = await Client.findAll({
    where: { status: 'active' },
    limit: 5
  });

  console.log(chalk.green(`\n✓ Found ${clients.length} active clients (showing first 5):\n`));

  clients.forEach((client, index) => {
    console.log(chalk.yellow(`${index + 1}. ${client.name}`));
    console.log(chalk.cyan(`   ID: ${client.id}`));
    console.log(chalk.cyan(`   Grab token: ${client.grab_token ? '✓ Present' : '✗ Missing'}`));
    console.log(chalk.cyan(`   GoJek token: ${client.gojek_refresh_token ? '✓ Present' : '✗ Missing'}`));
    console.log('');
  });

  // Test 3: Check credentials
  const clientsWithCreds = await Client.count({
    where: {
      status: 'active',
      grab_token: { [require('sequelize').Op.ne]: null }
    }
  });

  console.log(chalk.green(`\n📊 Statistics:`));
  console.log(`   Total active clients: ${clients.length}`);
  console.log(`   Clients with Grab credentials: ${clientsWithCreds}`);

  console.log(chalk.bgGreen.black.bold('\n✅ Rails database connection test passed!\n'));
}

test().catch(error => {
  console.error(chalk.red('\n❌ Test failed:'), error.message);
  console.error(error.stack);
  process.exit(1);
});
