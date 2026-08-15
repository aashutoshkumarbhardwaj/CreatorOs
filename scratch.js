const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

async function main() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = 'dev_jwt_secret_key_12345';
  process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN = 'dev_verify';
  process.env.INSTAGRAM_APP_SECRET = 'dev_app_secret';
  process.env.PORT = '3000';

  const connectDB = require('./connect');
  await connectDB();

  const User = require('./model/user');
  const password = await bcrypt.hash('Password123!', 12);
  await User.create({
    name: 'Demo Creator',
    email: 'test@local.com',
    password,
    isVerified: true,
  });

  console.log('✅ Memory MongoDB started & seeded test user: test@local.com / Password123!');

  const app = require('./index');
  app.listen(3000, () => {
    console.log('🚀 Local dev server running on http://localhost:3000');
  });
}

main().catch(err => {
  console.error('Error starting server:', err);
  process.exit(1);
});
