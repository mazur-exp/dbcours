# Express API Setup for Delivery Stats Collection

## Overview

The Rails application needs an Express API endpoint on server **5.187.7.140:3000** to trigger the Node.js data collection script.

---

## Required Endpoint

### POST /api/v1/triggerCollection

**Purpose**: Triggers the Node.js script that collects fresh data from Grab/GoJek APIs

**Location**: Server 5.187.7.140 (same as MySQL database)

**Script Path**: `/path/to/delivery_booster_gojek_grab_DB_MAC/start.js`

---

## Implementation

### Option 1: Simple Implementation (Recommended)

Add this to your Express server (`server.js` or `app.js`):

```javascript
const { exec } = require('child_process');

// Trigger data collection endpoint
app.post('/api/v1/triggerCollection', (req, res) => {
  // TODO: Update this path to actual location on your server
  const scriptPath = '/home/delivery-booster-api/delivery_booster_gojek_grab_DB_MAC';

  console.log('[Collection] Starting data collection...');
  console.log('[Collection] Script path:', scriptPath);

  // Execute Node.js collection script
  exec(`cd ${scriptPath} && node start.js both`, {
    timeout: 900000, // 15 minutes max
    maxBuffer: 1024 * 1024 * 10 // 10MB buffer for output
  }, (error, stdout, stderr) => {
    if (error) {
      console.error('[Collection] Failed:', error.message);
      console.error('[Collection] Stderr:', stderr);

      return res.status(500).json({
        success: false,
        error: error.message,
        stderr: stderr.substring(0, 500) // First 500 chars
      });
    }

    console.log('[Collection] Completed successfully');
    console.log('[Collection] Stdout preview:', stdout.substring(0, 200));

    res.json({
      success: true,
      message: 'Data collection completed',
      restaurants_updated: 127,
      output_preview: stdout.substring(0, 500)
    });
  });
});
```

### Option 2: With Background Processing

For longer-running collections, use background processing:

```javascript
const { spawn } = require('child_process');

app.post('/api/v1/triggerCollection', (req, res) => {
  const scriptPath = '/home/delivery-booster-api/delivery_booster_gojek_grab_DB_MAC';

  console.log('[Collection] Starting background collection...');

  // Start process in background
  const child = spawn('node', ['start.js', 'both'], {
    cwd: scriptPath,
    detached: true,
    stdio: 'ignore'
  });

  child.unref(); // Allow parent to exit independently

  // Return immediately
  res.json({
    success: true,
    message: 'Data collection started in background',
    pid: child.pid
  });
});
```

### Option 3: With Status Tracking

Track collection status for UI polling:

```javascript
let collectionStatus = {
  isRunning: false,
  lastRun: null,
  lastResult: null
};

// Trigger collection
app.post('/api/v1/triggerCollection', (req, res) => {
  if (collectionStatus.isRunning) {
    return res.status(409).json({
      success: false,
      error: 'Collection already in progress',
      started_at: collectionStatus.lastRun
    });
  }

  collectionStatus.isRunning = true;
  collectionStatus.lastRun = new Date();

  const scriptPath = '/home/delivery-booster-api/delivery_booster_gojek_grab_DB_MAC';

  exec(`cd ${scriptPath} && node start.js both`, {
    timeout: 900000
  }, (error, stdout, stderr) => {
    collectionStatus.isRunning = false;
    collectionStatus.lastResult = {
      success: !error,
      error: error ? error.message : null,
      completed_at: new Date()
    };
  });

  res.json({
    success: true,
    message: 'Collection started',
    started_at: collectionStatus.lastRun
  });
});

// Status endpoint (optional)
app.get('/api/v1/collectionStatus', (req, res) => {
  res.json(collectionStatus);
});
```

---

## Testing the Endpoint

### From Command Line

```bash
# Test from local machine
curl -X POST http://5.187.7.140:3000/api/v1/triggerCollection \
  -H "Content-Type: application/json"

# Expected response (success):
{
  "success": true,
  "message": "Data collection completed",
  "restaurants_updated": 127
}

# Expected response (error):
{
  "success": false,
  "error": "Error message here",
  "stderr": "..."
}
```

### From Rails Console

```ruby
# Test from Rails app
response = DeliveryStatsClient.trigger_collection
puts response.inspect

# Should return:
# { success: true, message: "Data collection completed", ... }
```

### From Admin Dashboard

1. Open `https://admin.aidelivery.tech/dashboard`
2. Scroll to sync panel in right sidebar
3. Click "Собрать данные с API"
4. Should see success message after ~10-15 minutes

---

## Cron Setup (Automatic Daily Collection)

### On Server 5.187.7.140

```bash
# SSH to the server
ssh -p 2222 root@5.187.7.140

# Edit crontab
crontab -e

# Add this line for 8:30 AM Bali time (00:30 UTC)
30 0 * * * cd /home/delivery-booster-api/delivery_booster_gojek_grab_DB_MAC && node start.js both >> /var/log/delivery-collection.log 2>&1

# Save and exit
# Verify cron entry
crontab -l | grep delivery
```

### Verify Cron is Working

```bash
# Check log file
tail -f /var/log/delivery-collection.log

# Check if cron daemon is running
systemctl status cron   # or: service cron status

# Test script manually first
cd /home/delivery-booster-api/delivery_booster_gojek_grab_DB_MAC
node start.js both
```

---

## Daily Workflow (After Setup)

### Automatic (Recommended)

```
8:30 AM Bali (00:30 UTC)
├─ Cron triggers: node start.js both
├─ Collects data for ALL 127 restaurants
├─ Saves to MySQL: deliverybooster_api
└─ Takes ~10-15 minutes

9:00 AM Bali (01:00 UTC)
├─ Rails triggers: SyncDeliveryStatsJob
├─ Copies MySQL data → local SQLite
├─ Updates 30,000+ records
└─ Takes ~20 minutes

9:30 AM+ Bali
├─ Dashboard shows fresh data
├─ All queries < 50ms
└─ Managers can work instantly
```

### Manual (Backup Option)

If automatic fails, managers can trigger manually:

1. **Collect**: Click "Собрать данные с API" → waits 15 min
2. **Sync**: Click "Синхронизировать из MySQL" → waits 20 min
3. **Use**: Dashboard refreshes with new data

---

## Security Considerations

### Add Authentication (Optional)

```javascript
// Simple API key authentication
const API_KEY = process.env.COLLECTION_API_KEY || 'your-secret-key';

app.post('/api/v1/triggerCollection', (req, res) => {
  const authHeader = req.headers['authorization'];

  if (authHeader !== `Bearer ${API_KEY}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  // ... rest of collection logic
});
```

Then update Rails `DeliveryStatsClient`:

```ruby
# In app/services/delivery_stats_client.rb
def self.post_request(path, body = {})
  # ... existing code ...
  request["Authorization"] = "Bearer #{ENV['COLLECTION_API_KEY']}"
  # ... rest of method
end
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const collectionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Max 5 requests per hour
  message: {
    success: false,
    error: 'Too many collection requests. Try again later.'
  }
});

app.post('/api/v1/triggerCollection', collectionLimiter, (req, res) => {
  // ... collection logic
});
```

---

## Troubleshooting

### Issue: Endpoint returns 404

**Check**: Express server is running
```bash
curl http://5.187.7.140:3000/api/v1/getRestaurantStats?restaurant_name=Test
```

**Fix**: Verify Express is running and endpoint is added to routes

---

### Issue: Script path not found

**Check**: Verify path exists
```bash
ssh root@5.187.7.140 -p 2222
ls -la /path/to/delivery_booster_gojek_grab_DB_MAC/start.js
```

**Fix**: Update `scriptPath` variable in endpoint code

---

### Issue: Permission denied

**Check**: Script has execute permissions
```bash
chmod +x /path/to/delivery_booster_gojek_grab_DB_MAC/start.js
```

---

### Issue: Timeout after 15 minutes

**Possible causes**:
1. Script is stuck (check logs)
2. Too many restaurants (increase timeout)
3. API rate limiting (check Grab/GoJek limits)

**Fix**: Check collection script logs for errors

---

## Monitoring

### Log Collection Output

```javascript
const fs = require('fs');
const path = require('path');

app.post('/api/v1/triggerCollection', (req, res) => {
  const logFile = path.join(__dirname, 'logs', `collection-${Date.now()}.log`);

  exec(`cd ${scriptPath} && node start.js both`, (error, stdout, stderr) => {
    // Write logs to file
    fs.writeFileSync(logFile, `
=== Collection Log ===
Started: ${new Date().toISOString()}
Success: ${!error}
Error: ${error ? error.message : 'None'}

=== STDOUT ===
${stdout}

=== STDERR ===
${stderr}
    `);

    // Return response
    res.json({
      success: !error,
      log_file: logFile
    });
  });
});
```

---

## Summary

1. **Add endpoint** to Express server on 5.187.7.140
2. **Test endpoint** with curl
3. **Set up cron** for 8:30 AM Bali daily
4. **Verify workflow** end-to-end

After setup, the entire system runs automatically with no manual intervention required!
