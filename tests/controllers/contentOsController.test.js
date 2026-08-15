const mongoose = require("mongoose");
const {
    renderPage,
    listItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem,
    convertItem,
    generateAiSuggestions,
    listFolders,
    createFolder,
    deleteFolder,
    exportToIntegration,
} = require("../../controller/contentOsController");
const ContentOs = require("../../model/contentOs");
const ContentFolder = require("../../model/contentFolder");
const User = require("../../model/user");

describe("contentOsController", () => {
    let mockReq, mockRes;
    const testUserId = new mongoose.Types.ObjectId().toString();

    beforeAll(() => {
        process.env.USE_MOCK_DB = "true";
    });

    beforeEach(async () => {
        await ContentOs.deleteMany({});
        await ContentFolder.deleteMany({});

        mockReq = {
            user: { id: testUserId, email: "creator@example.com" },
            params: {},
            query: {},
            body: {},
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            render: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        User.findById = jest.fn().mockImplementation(() => ({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    _id: testUserId,
                    name: "Test Creator",
                    email: "creator@example.com",
                }),
            }),
        }));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("renderPage", () => {
        it("should render content-os template with user stats and items", async () => {
            await renderPage(mockReq, mockRes);
            expect(mockRes.render).toHaveBeenCalledWith(
                "content-os",
                expect.objectContaining({
                    activeNav: "content-os",
                    stats: expect.any(Object),
                })
            );
        });
    });

    describe("CRUD Item operations", () => {
        it("should create a new content item", async () => {
            mockReq.body = {
                title: "10 AI Tools",
                description: "Productivity video",
                type: "idea",
                status: "idea",
                platform: "youtube",
                tags: "AI, Tools",
            };

            await createItem(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    item: expect.objectContaining({
                        title: "10 AI Tools",
                        platform: "youtube",
                    }),
                })
            );
        });

        it("should list items for the authenticated user", async () => {
            await ContentOs.create({ userId: testUserId, title: "Item 1", status: "idea" });
            await ContentOs.create({ userId: testUserId, title: "Item 2", status: "scripting" });

            await listItems(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    count: 2,
                })
            );
        });

        it("should update a content item with calculated script metrics", async () => {
            const item = await ContentOs.create({ userId: testUserId, title: "Initial Title", status: "scripting" });
            mockReq.params.id = item._id;
            mockReq.body = {
                title: "Updated Title",
                scriptDetails: {
                    hook: "Attention creators!",
                    body: "Here is step 1 and step 2.",
                    cta: "Subscribe now!",
                },
            };

            await updateItem(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    item: expect.objectContaining({
                        title: "Updated Title",
                    }),
                })
            );
        });

        it("should delete a content item", async () => {
            const item = await ContentOs.create({ userId: testUserId, title: "To Delete" });
            mockReq.params.id = item._id;

            await deleteItem(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: "Item deleted successfully.",
                })
            );
        });

        it("should convert an item stage", async () => {
            const item = await ContentOs.create({ userId: testUserId, title: "Idea to Script", status: "idea" });
            mockReq.params.id = item._id;
            mockReq.body = { targetStatus: "scripting", targetType: "script" };

            await convertItem(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    item: expect.objectContaining({
                        status: "scripting",
                        type: "script",
                    }),
                })
            );
        });
    });

    describe("AI Suggestions & Integrations", () => {
        it("should generate AI content ideas", async () => {
            mockReq.body = { prompt: "Link in bio optimization", mode: "idea", platform: "instagram" };
            await generateAiSuggestions(mockReq, mockRes);

            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    mode: "idea",
                    result: expect.objectContaining({
                        title: expect.stringContaining("Link in bio"),
                    }),
                })
            );
        });

        it("should export payload for Notion integration", async () => {
            const item = await ContentOs.create({ userId: testUserId, title: "Notion Export Item" });
            mockReq.body = { itemId: item._id, integration: "notion" };

            await exportToIntegration(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    integration: "notion",
                    exportPayload: expect.objectContaining({
                        title: "Notion Export Item",
                    }),
                })
            );
        });
    });

    describe("Folder operations", () => {
        it("should create and list project folders", async () => {
            mockReq.body = { name: "Launch Folder", color: "#10B981" };
            await createFolder(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(201);

            await listFolders(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    count: 1,
                })
            );
        });
    });
});
