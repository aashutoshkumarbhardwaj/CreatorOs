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
        try {
            mongod = await MongoMemoryServer.create();
            process.env.MONGODB_URI = mongod.getUri();
        } catch (err) {
            console.warn('MongoMemoryServer startup skipped:', err.message);
            process.env.USE_MOCK_DB = 'true';
            return;
        }
    }
    
    if (process.env.MONGODB_URI) {
        await mongoose.connect(process.env.MONGODB_URI);
    }
}, 30000);

afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongod) {
        await mongod.stop();
    }
});
