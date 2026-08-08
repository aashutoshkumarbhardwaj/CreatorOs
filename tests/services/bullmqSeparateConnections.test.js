const fs = require('fs');
const path = require('path');

describe('BullMQ Redis connection isolation', () => {
    test('dmQueueService creates distinct queue and worker connections', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../../services/dmQueueService.js'),
            'utf8'
        );

        expect(source).toContain('createRedisConnection');
        expect(source).toContain("createRedisConnection('dm-queue')");
        expect(source).toContain("createRedisConnection('dm-worker')");
        expect(source).toMatch(/new Queue\([\s\S]*connection:\s*queueConnection/);
        expect(source).toMatch(/new Worker\([\s\S]*connection:\s*workerConnection/);
    });

    test('analyticsRefreshWorker creates distinct queue and worker connections', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../../workers/analyticsRefreshWorker.js'),
            'utf8'
        );

        expect(source).toContain('const queueConnection = new IORedis');
        expect(source).toContain('const workerConnection = new IORedis');
        expect(source).toMatch(/new Queue\([\s\S]*connection:\s*queueConnection/);
        expect(source).toMatch(/new Worker\([\s\S]*connection:\s*workerConnection/);
        expect(source).not.toMatch(/new Queue\([\s\S]*connection:\s*redisConnection/);
    });
});
