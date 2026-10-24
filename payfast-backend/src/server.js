import { env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { createApp } from './app.js';

async function start() {
  await connectDatabase();
  createApp().listen(env.PORT, () => console.log(`Server running on port ${env.PORT}`));
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
