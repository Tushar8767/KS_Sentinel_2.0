const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = require('./app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[KS Sentinel Gateway] Server running on http://localhost:${PORT}`);
  console.log(`[KS Sentinel Gateway] Module 0: Architecture Foundation Active`);
});

module.exports = server;

