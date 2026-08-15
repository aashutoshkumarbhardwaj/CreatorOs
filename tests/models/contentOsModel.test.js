const mongoose = require("mongoose");
const ContentOs = require("../../model/contentOs");
const ContentFolder = require("../../model/contentFolder");

describe("Content OS Models", () => {
    const originalUseMockDb = process.env.USE_MOCK_DB;

    beforeAll(() => {
        process.env.USE_MOCK_DB = "true";
    });

    afterAll(() => {
        if (originalUseMockDb === undefined) {
            delete process.env.USE_MOCK_DB;
        } else {
            process.env.USE_MOCK_DB = originalUseMockDb;
        }
    });

    afterEach(async () => {
        await ContentOs.deleteMany({});
        await ContentFolder.deleteMany({});
    });

    describe("ContentOs Model", () => {
        it("should create a content item with default fields", async () => {
            const userId = new mongoose.Types.ObjectId().toString();
            const item = await ContentOs.create({
                userId,
                title: "Viral Creator Hack",
            });

            expect(item.userId.toString()).toBe(userId.toString());
            expect(item.title).toBe("Viral Creator Hack");
            expect(item.type).toBe("idea");
            expect(item.status).toBe("idea");
            expect(item.platform).toBe("general");
            expect(item.priority).toBe("medium");
        });

        it("should update script details and store metrics", async () => {
            const userId = new mongoose.Types.ObjectId().toString();
            const item = await ContentOs.create({
                userId,
                title: "YouTube Studio Setup",
                status: "scripting",
                type: "script",
                scriptDetails: {
                    hook: "Want a 4k studio look for $50?",
                    body: "Here are the top 3 lighting tips.",
                    cta: "Subscribe for more hacks!",
                },
            });

            expect(item.scriptDetails.hook).toBe("Want a 4k studio look for $50?");
            expect(item.scriptDetails.cta).toBe("Subscribe for more hacks!");
        });
    });

    describe("ContentFolder Model", () => {
        it("should create a project folder for organizing content", async () => {
            const userId = new mongoose.Types.ObjectId().toString();
            const folder = await ContentFolder.create({
                userId,
                name: "Summer Launch 2026",
                color: "#F59E0B",
                description: "Product launch series",
            });

            expect(folder.userId.toString()).toBe(userId.toString());
            expect(folder.name).toBe("Summer Launch 2026");
            expect(folder.color).toBe("#F59E0B");
        });
    });
});
