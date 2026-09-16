const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

// Increase hook timeout for MongoMemoryServer download/startup if needed
jest.setTimeout(30000);

beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key';

    if (process.env.USE_MOCK_DB === 'true') {
        return;
    }

    if (!process.env.MONGODB_URI) {
        // Allow MongoMemoryServer errors to propagate so suites that require
        // a real Mongoose connection fail loudly instead of silently degrading.
        mongod = await MongoMemoryServer.create();
        process.env.MONGODB_URI = mongod.getUri();
    }

    await mongoose.connect(process.env.MONGODB_URI);
}, 30000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongod) {
        await mongod.stop();
    }
});
