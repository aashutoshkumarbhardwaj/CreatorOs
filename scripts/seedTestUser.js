const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../connect');
const User = require('../model/user');
const bcrypt = require('bcryptjs');

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env. Populate .env and try again.');
    process.exit(1);
  }

  await connectDB();

  const email = process.env.SEED_EMAIL || 'test@local';
  const password = process.env.SEED_PASSWORD || 'Password123!';

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Test user already exists:', email);
      process.exit(0);
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = new User({ name: 'Test User', email, password: hashed });
    await user.save();

    console.log('Seeded test user:');
    console.log('  email:', email);
    console.log('  password:', password);
    console.log('\nReminder: this user is for local development only. Do not enable on production.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed test user:', err);
    process.exit(1);
  }
}

seed();
