const axios = require('axios');
const { GrabStats } = require('../../database/db');

async function getAverageRating(restaurant, from, to) {
    const URL = `https://api.grab.com/food/merchant/v1/feedback/overview?cityName=Bali&serviceType=DELIVERY&startDate=${from}&endDate=${to}&merchantIDs[]=${restaurant.grab_food_entity_id}&businessTypeFilter=0`
    
    const grabStats = await GrabStats.findOne({
        where: {
            restaurant_id: restaurant.id,
            stat_date: from,
        },
    });

    if (grabStats && grabStats.rating > 0) {
        return grabStats.rating;
    }

    const headers = {
        Authorization: restaurant.grab_token,
        merchantid: restaurant.grab_food_entity_id
    };

    try {
        const response = await axios.get(URL, { headers });
        return Math.round(response.data.feedbackOverview.aggregatedRatingScore * 100) / 100 || 0;
    } catch (error) {
        console.error('Error making request:', error.status, error.message);
        return 0;
    }
}

// Экспортируем все функции как модуль
module.exports = {
    getAverageRating
};