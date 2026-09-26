const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');
const CrmBrand = require('../../model/crmBrand');

jest.mock('../../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { id: '64b7f1f1f1f1f1f1f1f1f1f1', name: 'Test Creator' };
    next();
  },
}));

const creatorCrmRoutes = require('../../routes/creatorCrmRoutes');
const app = express();
app.use(express.json());
app.use('/api/crm', creatorCrmRoutes);

describe('CRM Mass Assignment Security Tests', () => {
  let brandId;
  const testUserId = '64b7f1f1f1f1f1f1f1f1f1f1';
  const adminUserId = '64b7f2f2f2f2f2f2f2f2f2f2';

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/creator-os-test';
      await mongoose.connect(uri);
    }
  });

  afterAll(async () => {
    await CrmBrand.deleteMany({ creatorId: { $in: [testUserId, adminUserId] } });
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    const brand = await CrmBrand.create({
      creatorId: testUserId,
      companyName: 'Original Brand',
      status: 'lead'
    });
    brandId = brand._id;
  });

  afterEach(async () => {
    await CrmBrand.deleteMany({ creatorId: testUserId });
  });

  it('should prevent mass assignment of creatorId and contactHistory during brand update', async () => {
    const updatePayload = {
      companyName: 'Updated Brand',
      creatorId: adminUserId,
      contactHistory: [{ note: 'Fake injected note' }]
    };

    const res = await request(app)
      .put(`/api/crm/brands/${brandId}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    
    const dbBrand = await CrmBrand.findById(brandId);
    
    expect(dbBrand.creatorId.toString()).toBe(testUserId);
    expect(dbBrand.companyName).toBe('Updated Brand');
    expect(dbBrand.contactHistory.length).toBe(0);
  });
});
