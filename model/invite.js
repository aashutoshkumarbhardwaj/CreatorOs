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
    .catch(err => console.error(err))