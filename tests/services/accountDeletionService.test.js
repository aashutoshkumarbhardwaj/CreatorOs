const mongoose = require("mongoose");
const fs = require("fs/promises");
const { deleteFiles: hfDeleteFiles } = require("@huggingface/hub");
const User = require("../../model/user");
const Url = require("../../model/url");
const Invite = require("../../model/invite");
const Creator = require("../../model/creator");
const AnalyticsSnapshot = require("../../model/analyticsSnapshot");
const EngagementHistory = require("../../model/engagementHistory");
const Post = require("../../model/post");
const Task = require("../../model/task");
const DmTrigger = require("../../model/dmTrigger");
const Sponsor = require("../../model/sponsor");
const CrmBrand = require("../../model/crmBrand");
const CrmDeal = require("../../model/crmDeal");
const CrmInvoice = require("../../model/crmInvoice");
const CrmMediaKit = require("../../model/crmMediaKit");
const EventType = require("../../model/eventType");
const MeetingBooking = require("../../model/meetingBooking");
const Notification = require("../../model/notification");
const NotificationPreference = require("../../model/notificationPreference");
const AiInsight = require("../../model/aiInsight");
const AssistantChat = require("../../model/assistantChat");
const ContentOs = require("../../model/contentOs");
const ContentFolder = require("../../model/contentFolder");
const QrCode = require("../../model/qrCode");
const ScheduledContent = require("../../model/scheduledContent");
const PasswordResetToken = require("../../model/passwordResetToken");
const Upload = require("../../model/upload");
const VaultFile = require("../../model/vaultFile");
const ContributorSession = require("../../model/contributorSession");
const { deleteAccount } = require("../../services/accountDeletionService");

jest.mock("@huggingface/hub", () => ({
  deleteFiles: jest.fn().mockResolvedValue(undefined),
}));

describe("accountDeletionService", () => {
  const originalMockDb = process.env.USE_MOCK_DB;
  const originalHfToken = process.env.HF_TOKEN;
  const originalHfRepo = process.env.HF_DATASET_REPO;
  const originalVaultPath = process.env.VAULT_STORAGE_PATH;
  const allModels = [
    Url,
    Invite,
    Task,
    DmTrigger,
    Sponsor,
    CrmBrand,
    CrmDeal,
    CrmInvoice,
    CrmMediaKit,
    EventType,
    MeetingBooking,
    Notification,
    NotificationPreference,
    AiInsight,
    AssistantChat,
    ContentOs,
    ContentFolder,
    QrCode,
    ScheduledContent,
    PasswordResetToken,
    Upload,
    VaultFile,
    AnalyticsSnapshot,
    EngagementHistory,
    Post,
  ];

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMockDb === undefined) delete process.env.USE_MOCK_DB;
    else process.env.USE_MOCK_DB = originalMockDb;
    if (originalHfToken === undefined) delete process.env.HF_TOKEN;
    else process.env.HF_TOKEN = originalHfToken;
    if (originalHfRepo === undefined) delete process.env.HF_DATASET_REPO;
    else process.env.HF_DATASET_REPO = originalHfRepo;
    if (originalVaultPath === undefined) delete process.env.VAULT_STORAGE_PATH;
    else process.env.VAULT_STORAGE_PATH = originalVaultPath;
  });

  it("deletes all current user-owned records and creator-linked records in a MongoDB transaction", async () => {
    process.env.USE_MOCK_DB = "false";
    process.env.HF_TOKEN = "hf-token";
    process.env.HF_DATASET_REPO = "creatoros-uploads";
    process.env.VAULT_STORAGE_PATH = "./test-vault";

    const userId = new mongoose.Types.ObjectId();
    const creatorId = new mongoose.Types.ObjectId();
    const user = { _id: userId };
    const deletionQuery = () => ({
      session: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    const creatorQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      session: jest.fn().mockResolvedValue([{ _id: creatorId }]),
    };
    const uploadQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ hfPath: `${userId}/image.png` }]),
    };
    const creatorDeleteOne = jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    const userUpdateMany = jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });
    const userDeleteOne = jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    });
    const session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      abortTransaction: jest.fn().mockResolvedValue(undefined),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    allModels.forEach((Model) => {
      if (Model === Upload) {
        jest.spyOn(Model, "find").mockReturnValue(uploadQuery);
      }
      jest.spyOn(Model, "deleteMany").mockImplementation(deletionQuery);
    });

    jest.spyOn(Creator, "find").mockReturnValue(creatorQuery);
    jest.spyOn(mongoose.models.Creator, "deleteOne").mockImplementation(creatorDeleteOne);
    jest.spyOn(ContributorSession, "deleteOne").mockImplementation(deletionQuery);
    jest.spyOn(mongoose.models.User, "updateMany").mockImplementation(userUpdateMany);
    jest.spyOn(mongoose.models.User, "deleteOne").mockImplementation(userDeleteOne);
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);
    jest.spyOn(fs, "rm").mockResolvedValue(undefined);

    await deleteAccount(user);

    expect(hfDeleteFiles).toHaveBeenCalledWith({
      repo: { type: "dataset", name: "creatoros-uploads" },
      accessToken: "hf-token",
      paths: [`${userId}/image.png`],
    });
    expect(fs.rm).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`[\\\\/]test-vault[\\\\/]${userId.toString()}$`)),
      { recursive: true, force: true },
    );

    expect(Task.deleteMany).toHaveBeenCalledWith({ creatorId: userId });
    expect(EventType.deleteMany).toHaveBeenCalledWith({ userId });
    expect(MeetingBooking.deleteMany).toHaveBeenCalledWith({ userId });
    expect(ContentOs.deleteMany).toHaveBeenCalledWith({ userId });
    expect(CrmDeal.deleteMany).toHaveBeenCalledWith({ creatorId: userId });
    expect(Upload.deleteMany).toHaveBeenCalledWith({ userId });
    expect(VaultFile.deleteMany).toHaveBeenCalledWith({ userId });

    expect(AnalyticsSnapshot.deleteMany).toHaveBeenCalledWith({
      creatorId: { $in: [creatorId] },
    });
    expect(EngagementHistory.deleteMany).toHaveBeenCalledWith({
      creatorId: { $in: [creatorId] },
    });
    expect(Post.deleteMany).toHaveBeenCalledWith({
      creatorId: { $in: [creatorId] },
    });
    expect(creatorDeleteOne).toHaveBeenCalledWith({ _id: creatorId });
    expect(userUpdateMany).toHaveBeenCalledWith(
      { collaborators: userId },
      { $pull: { collaborators: userId } },
    );
    expect(userDeleteOne).toHaveBeenCalledWith({ _id: userId });
    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(session.abortTransaction).not.toHaveBeenCalled();
  });

  it("does not start database deletion when external storage cleanup fails", async () => {
    process.env.USE_MOCK_DB = "false";
    process.env.HF_TOKEN = "hf-token";
    process.env.HF_DATASET_REPO = "creatoros-uploads";

    const userId = new mongoose.Types.ObjectId();
    const user = { _id: userId };
    const uploadQuery = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ hfPath: `${userId}/image.png` }]),
    };

    jest.spyOn(Upload, "find").mockReturnValue(uploadQuery);
    hfDeleteFiles.mockRejectedValueOnce(new Error("Hugging Face unavailable"));
    const startSession = jest.spyOn(mongoose, "startSession");

    await expect(deleteAccount(user)).rejects.toThrow("Hugging Face unavailable");
    expect(startSession).not.toHaveBeenCalled();
  });
});
