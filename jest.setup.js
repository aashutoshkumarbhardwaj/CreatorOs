jest.mock('node-cron', () => {
  return {
    schedule: jest.fn(),
  };
});
