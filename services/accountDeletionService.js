const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const { deleteFiles: hfDeleteFiles } = require("@huggingface/hub");

const User = require("../model/user");
const Url = require("../model/url");
const Invite = require("../model/invite");
const Creator = require("../model/creator");
const AnalyticsSnapshot = require("../model/analyticsSnapshot");
const EngagementHistory = require("../model/engagementHistory");
const Post = require("../model/post");
const Task = require("../model/task");
const DmTrigger = require("../model/dmTrigger");
const Sponsor = require("../model/sponsor");
const CrmBrand = require("../model/crmBrand");
const CrmDeal = require("../model/crmDeal");
const CrmInvoice = require("../model/crmInvoice");
const CrmMediaKit = require("../model/crmMediaKit");
const EventType = require("../model/eventType");
const MeetingBooking = require("../model/meetingBooking");
const Notification = require("../model/notification");
const NotificationPreference = require("../model/notificationPreference");
const AiInsight = require("../model/aiInsight");
const AssistantChat = require("../model/assistantChat");
const ContentOs = require("../model/contentOs");
const ContentFolder = require("../model/contentFolder");
const QrCode = require("../model/qrCode");
const ScheduledContent = require("../model/scheduledContent");
const PasswordResetToken = require("../model/passwordResetToken");
const Upload = require("../model/upload");
const VaultFile = require("../model/vaultFile");
const ContributorSession = require("../model/contributorSession");

const isMockDb = () => process.env.USE_MOCK_DB === "true";

function applySession(query, session) {
    return session ? query.session(session) : query;
}

async function deleteDirectUserData(session, userId) {
    const userIdModels = [
        [Url, { userId }],
        [Invite, { inviter: userId }],
        [Task, { creatorId: userId }],
        [DmTrigger, { creatorId: userId }],
        [Sponsor, { creatorId: userId }],
        [CrmBrand, { creatorId: userId }],
        [CrmDeal, { creatorId: userId }],
        [CrmInvoice, { creatorId: userId }],
        [CrmMediaKit, { creatorId: userId }],
        [EventType, { userId }],
        [MeetingBooking, { userId }],
        [Notification, { userId }],
        [NotificationPreference, { userId }],
        [AiInsight, { userId }],
        [AssistantChat, { userId }],
        [ContentOs, { userId }],
        [ContentFolder, { userId }],
        [QrCode, { userId }],
        [ScheduledContent, { userId }],
        [PasswordResetToken, { userId }],
        [Upload, { userId }],
        [VaultFile, { userId }],
    ];

    for (const [Model, filter] of userIdModels) {
        await applySession(Model.deleteMany(filter), session);
    }

    await applySession(
        ContributorSession.deleteOne({ contributorId: userId.toString() }),
        session,
    );
}

async function deleteCreatorData(session, userId) {
    const creators = await applySession(
        Creator.find({ userId }).select("_id").lean(),
        session,
    );
    const creatorIds = creators.map((creator) => creator._id);

    if (!creatorIds.length) {
        return;
    }

    const creatorOwnedModels = [AnalyticsSnapshot, EngagementHistory, Post];

    for (const Model of creatorOwnedModels) {
        await applySession(Model.deleteMany({ creatorId: { $in: creatorIds } }), session);
    }

    for (const creatorId of creatorIds) {
        await applySession(Creator.deleteOne({ _id: creatorId }), session);
    }
}

async function removeCollaboratorReferences(session, userId) {
    await applySession(
        User.updateMany(
            { collaborators: userId },
            { $pull: { collaborators: userId } },
        ),
        session,
    );
}

async function getUploadsForDeletion(userId) {
    return Upload.find({ userId }).select("hfPath").lean();
}

async function deleteHuggingFaceUploads(uploads) {
    if (!uploads.length) {
        return;
    }

    const accessToken = process.env.HF_TOKEN;
    const repository = process.env.HF_DATASET_REPO;
    if (!accessToken || !repository) {
        const error = new Error(
            "Hugging Face storage is not configured, so uploaded account files cannot be removed.",
        );
        error.code = "ACCOUNT_STORAGE_NOT_CONFIGURED";
        error.status = 500;
        throw error;
    }

    const paths = uploads.map((upload) => upload.hfPath).filter(Boolean);
    if (!paths.length) {
        return;
    }

    const repo = { type: "dataset", name: repository };
    const batchSize = 100;

    for (let index = 0; index < paths.length; index += batchSize) {
        await hfDeleteFiles({
            repo,
            accessToken,
            paths: paths.slice(index, index + batchSize),
        });
    }
}

async function deleteLegacyVaultFiles(userId) {
    const storageRoot = path.resolve(
        process.env.VAULT_STORAGE_PATH || path.join(process.cwd(), "uploads", "vault"),
    );
    const userStoragePath = path.join(storageRoot, userId.toString());

    await fs.rm(userStoragePath, { recursive: true, force: true });
}

async function deleteMockAccountData(user) {
    const userId = user._id;

    await Url.deleteMany({ userId });
    await Invite.deleteMany({ inviter: userId });
    await ContentOs.deleteMany({ userId });
    await ContentFolder.deleteMany({ userId });
    await ContributorSession.deleteOne({ contributorId: userId.toString() });

    const creators = await Creator.find({ userId }).lean();
    for (const creator of creators) {
        await AnalyticsSnapshot.deleteMany({ creatorId: creator._id });
        await EngagementHistory.deleteMany({ creatorId: creator._id });
        await Post.deleteMany({ creatorId: creator._id });
        await Creator.deleteOne({ _id: creator._id });
    }

    if (typeof user.deleteOne === "function") {
        await user.deleteOne();
    }
}

async function deleteAccount(user) {
    if (!user || !user._id) {
        const error = new Error("User not found");
        error.status = 404;
        throw error;
    }

    if (isMockDb()) {
        await deleteMockAccountData(user);
        return;
    }

    const uploads = await getUploadsForDeletion(user._id);
    await deleteHuggingFaceUploads(uploads);
    await deleteLegacyVaultFiles(user._id);

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        await deleteDirectUserData(session, user._id);
        await deleteCreatorData(session, user._id);
        await removeCollaboratorReferences(session, user._id);
        await User.deleteOne({ _id: user._id }).session(session);

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
}

module.exports = {
    deleteAccount,
};
