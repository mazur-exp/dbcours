// Credentials will be passed from Rails via ENV variable
// This file is used by the collection script
module.exports = JSON.parse(process.env.RESTAURANTS_DATA || '[]');
