const mongoose = require('mongoose');

/**
 * @schema inviteSchema
 * @description Mongoose schema definition for invite.
 */
const inviteSchema = new mongoose.Schema(
  {
    inviter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    projectName: {
      type: String,
      trim: true,
      default: 'CreatorOS Collaboration',
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'expired'],
      default: 'pending',
    },
    message: {
      type: String,
      trim: true,
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const MongooseInviteModel = mongoose.models.Invite || mongoose.model('Invite', inviteSchema);

const emptyInviteQuery = {
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  lean() {
    return Promise.resolve([]);
  },
  then(resolve, reject) {
    return Promise.resolve([]).then(resolve, reject);
  },
};

const MockInviteModel = {
  countDocuments: async () => 0,
  findOne: async () => null,
  findByIdAndDelete: async () => null,
  find: () => emptyInviteQuery,
};

function getActiveInviteModel() {
  return process.env.USE_MOCK_DB === "true"
    ? MockInviteModel
    : MongooseInviteModel;
}

const InviteModel = {
  countDocuments: (...args) => getActiveInviteModel().countDocuments(...args),
  findOne: (...args) => getActiveInviteModel().findOne(...args),
  findByIdAndDelete: (...args) => getActiveInviteModel().findByIdAndDelete(...args),
  find: (...args) => getActiveInviteModel().find(...args),
  create: (...args) => getActiveInviteModel().create(...args),
};

module.exports = InviteModel;
