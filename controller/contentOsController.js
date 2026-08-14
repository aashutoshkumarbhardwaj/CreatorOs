const ContentOsModel = require("../model/contentOs");
const ContentFolderModel = require("../model/contentFolder");
const ScheduledContentModel = require("../model/scheduledContent");
const User = require("../model/user");
const services = require("../services.config");

function buildAccountViewModel(userDoc, fallbackUser) {
    const name = userDoc?.name || fallbackUser?.name || "Creator";
    const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "CR";

    return {
        id: fallbackUser?.id || userDoc?._id,
        name,
        email: userDoc?.email || fallbackUser?.email || "",
        initials,
    };
}

/**
 * Calculate word count and estimated read/speech time (150 WPM average speech speed).
 */
function computeScriptMetrics(scriptDetails = {}) {
    const combinedText = [
        scriptDetails.hook || "",
        scriptDetails.body || "",
        scriptDetails.cta || "",
    ].join(" ").trim();

    if (!combinedText) {
        return { wordCount: 0, estimatedReadTime: 0 };
    }

    const words = combinedText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    // Estimated read/speech time in seconds (150 WPM => 2.5 words/sec)
    const estimatedReadTime = Math.ceil((wordCount / 150) * 60);
    return { wordCount, estimatedReadTime };
}

/**
 * Render Content OS main view page.
 */
async function renderPage(req, res) {
    try {
        const userId = req.user.id;
        const userDoc = await User.findById(userId).select("name email alias").lean();

        // Seed mock items for demonstration if using mock DB
        if (process.env.USE_MOCK_DB === "true") {
            ContentOsModel.seedForUser(userId);
        }

        const [items, folders] = await Promise.all([
            ContentOsModel.find({ userId }).sort({ updatedAt: -1 }),
            ContentFolderModel.find({ userId }),
        ]);

        const stats = {
            totalIdeas: items.filter((i) => i.status === "idea").length,
            activeScripts: items.filter((i) => i.status === "scripting").length,
            readyToPublish: items.filter((i) => i.status === "ready").length,
            scheduledPosts: items.filter((i) => i.status === "scheduled").length,
            publishedPosts: items.filter((i) => i.status === "published").length,
        };

        const currentService = services.find((s) => s.key === "content-os") || {
            key: "content-os",
            name: "🧠 Content OS",
            description: "Organize ideas, scripts, and content planning workflows.",
            status: "available",
        };

        return res.render("content-os", {
            service: currentService,
            services,
            user: buildAccountViewModel(userDoc, req.user),
            items,
            folders,
            stats,
            activeNav: "content-os",
            error: null,
            success: req.query.success || null,
        });
    } catch (err) {
        console.error("Error rendering Content OS page:", err);
        return res.status(500).render("error", {
            message: "Failed to load Content OS.",
            error: err,
        });
    }
}

/**
 * List content items via JSON API.
 */
async function listItems(req, res) {
    try {
        const userId = req.user.id;
        const { status, platform, folderId, type, search } = req.query;

        const query = { userId };
        if (status) query.status = status;
        if (platform) query.platform = platform;
        if (folderId) query.folderId = folderId;
        if (type) query.type = type;

        let items = await ContentOsModel.find(query).sort({ updatedAt: -1 });

        if (search) {
            const term = search.toLowerCase();
            items = items.filter(
                (item) =>
                    item.title.toLowerCase().includes(term) ||
                    item.description.toLowerCase().includes(term) ||
                    (item.tags && item.tags.some((t) => t.toLowerCase().includes(term)))
            );
        }

        return res.json({ success: true, count: items.length, items });
    } catch (err) {
        console.error("Error listing Content OS items:", err);
        return res.status(500).json({ success: false, message: "Server error listing items." });
    }
}

/**
 * Get single content item by ID.
 */
async function getItemById(req, res) {
    try {
        const { id } = req.params;
        const item = await ContentOsModel.findById(id);

        if (!item || item.userId?.toString() !== req.user.id.toString()) {
            return res.status(404).json({ success: false, message: "Content item not found." });
        }

        return res.json({ success: true, item });
    } catch (err) {
        console.error("Error fetching Content OS item:", err);
        return res.status(500).json({ success: false, message: "Server error fetching item." });
    }
}

/**
 * Create a new Content OS item.
 */
async function createItem(req, res) {
    try {
        const userId = req.user.id;
        const body = req.body;

        let tags = [];
        if (Array.isArray(body.tags)) {
            tags = body.tags;
        } else if (typeof body.tags === "string" && body.tags.trim()) {
            tags = body.tags.split(",").map((t) => t.trim()).filter(Boolean);
        }

        const scriptDetails = body.scriptDetails || {};
        const { wordCount, estimatedReadTime } = computeScriptMetrics(scriptDetails);
        scriptDetails.wordCount = wordCount;
        scriptDetails.estimatedReadTime = estimatedReadTime;

        let platforms = [];
        if (Array.isArray(body.platforms)) {
            platforms = body.platforms;
        } else if (typeof body.platforms === "string" && body.platforms.trim()) {
            platforms = body.platforms.split(",").map((p) => p.trim()).filter(Boolean);
        } else if (body.platform) {
            platforms = [body.platform];
        }

        const newItemData = {
            userId,
            title: body.title,
            description: body.description || "",
            type: body.type || (body.status === "scripting" ? "script" : "idea"),
            status: body.status || "idea",
            platform: body.platform || (platforms[0] || "general"),
            platforms: platforms.length > 0 ? platforms : ["general"],
            priority: body.priority || "medium",
            folderId: body.folderId || null,
            tags,
            scriptDetails,
            mediaAssets: body.mediaAssets || [],
            scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
            deadlineAt: body.deadlineAt ? new Date(body.deadlineAt) : null,
            performance: body.performance || {},
            comments: body.comments || [],
            aiGenerated: Boolean(body.aiGenerated),
        };

        const item = await ContentOsModel.create(newItemData);

        // If scheduledAt is provided and status is scheduled, sync with ScheduledContent queue
        if (item.scheduledAt && item.status === "scheduled") {
            try {
                await ScheduledContentModel.create({
                    userId,
                    caption: item.title + (item.description ? "\n\n" + item.description : ""),
                    platform: item.platform || "general",
                    timezone: "UTC",
                    scheduledAt: item.scheduledAt,
                    status: "scheduled",
                });
            } catch (scheduleErr) {
                console.warn("Notice: ScheduledContent sync skipped:", scheduleErr.message);
            }
        }

        return res.status(201).json({ success: true, item, message: "Content item created successfully." });
    } catch (err) {
        console.error("Error creating Content OS item:", err);
        return res.status(500).json({ success: false, message: "Server error creating item." });
    }
}

/**
 * Update an existing Content OS item.
 */
async function updateItem(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const body = req.body;

        const existing = await ContentOsModel.findById(id);
        if (!existing || existing.userId?.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        let tags = existing.tags;
        if (body.tags !== undefined) {
            if (Array.isArray(body.tags)) {
                tags = body.tags;
            } else if (typeof body.tags === "string") {
                tags = body.tags.split(",").map((t) => t.trim()).filter(Boolean);
            }
        }

        let platforms = existing.platforms || [existing.platform || "general"];
        if (body.platforms !== undefined) {
            if (Array.isArray(body.platforms)) {
                platforms = body.platforms;
            } else if (typeof body.platforms === "string") {
                platforms = body.platforms.split(",").map((p) => p.trim()).filter(Boolean);
            }
        } else if (body.platform) {
            platforms = [body.platform];
        }

        const scriptDetails = {
            ...existing.scriptDetails,
            ...(body.scriptDetails || {}),
        };
        const { wordCount, estimatedReadTime } = computeScriptMetrics(scriptDetails);
        scriptDetails.wordCount = wordCount;
        scriptDetails.estimatedReadTime = estimatedReadTime;

        const updateData = {
            title: body.title !== undefined ? body.title : existing.title,
            description: body.description !== undefined ? body.description : existing.description,
            type: body.type !== undefined ? body.type : existing.type,
            status: body.status !== undefined ? body.status : existing.status,
            platform: body.platform !== undefined ? body.platform : existing.platform,
            platforms: platforms.length > 0 ? platforms : ["general"],
            priority: body.priority !== undefined ? body.priority : existing.priority,
            folderId: body.folderId !== undefined ? body.folderId : existing.folderId,
            tags,
            scriptDetails,
            mediaAssets: body.mediaAssets !== undefined ? body.mediaAssets : existing.mediaAssets,
            scheduledAt: body.scheduledAt !== undefined ? (body.scheduledAt ? new Date(body.scheduledAt) : null) : existing.scheduledAt,
            deadlineAt: body.deadlineAt !== undefined ? (body.deadlineAt ? new Date(body.deadlineAt) : null) : existing.deadlineAt,
            publishedAt: body.status === "published" && !existing.publishedAt ? new Date() : existing.publishedAt,
            performance: body.performance !== undefined ? { ...existing.performance, ...body.performance } : existing.performance,
        };

        const updatedItem = await ContentOsModel.findByIdAndUpdate(id, updateData, { new: true });

        // If scheduledAt is modified and status is scheduled, sync with ScheduledContent
        if (updatedItem.scheduledAt && updatedItem.status === "scheduled") {
            try {
                await ScheduledContentModel.create({
                    userId,
                    caption: updatedItem.title + (updatedItem.description ? "\n\n" + updatedItem.description : ""),
                    platform: updatedItem.platform || "general",
                    timezone: "UTC",
                    scheduledAt: updatedItem.scheduledAt,
                    status: "scheduled",
                });
            } catch (scheduleErr) {
                console.warn("Notice: ScheduledContent sync skipped:", scheduleErr.message);
            }
        }

        return res.json({ success: true, item: updatedItem, message: "Item updated successfully." });
    } catch (err) {
        console.error("Error updating Content OS item:", err);
        return res.status(500).json({ success: false, message: "Server error updating item." });
    }
}

/**
 * Delete a Content OS item.
 */
async function deleteItem(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const existing = await ContentOsModel.findById(id);
        if (!existing || existing.userId?.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        await ContentOsModel.findByIdAndDelete(id);
        return res.json({ success: true, message: "Item deleted successfully." });
    } catch (err) {
        console.error("Error deleting Content OS item:", err);
        return res.status(500).json({ success: false, message: "Server error deleting item." });
    }
}

/**
 * Convert Content OS item stage (e.g., Idea -> Script -> Ready -> Scheduled).
 */
async function convertItem(req, res) {
    try {
        const { id } = req.params;
        const { targetStatus, targetType } = req.body;

        const item = await ContentOsModel.findById(id);
        if (!item || item.userId?.toString() !== req.user.id.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        const newStatus = targetStatus || (item.status === "idea" ? "scripting" : item.status === "scripting" ? "ready" : "scheduled");
        const newType = targetType || (newStatus === "scripting" ? "script" : newStatus === "ready" || newStatus === "scheduled" ? "post" : item.type);

        const updated = await ContentOsModel.findByIdAndUpdate(
            id,
            { status: newStatus, type: newType },
            { new: true }
        );

        return res.json({ success: true, item: updated, message: `Converted item to ${newStatus}.` });
    } catch (err) {
        console.error("Error converting Content OS item:", err);
        return res.status(500).json({ success: false, message: "Server error converting item." });
    }
}

/**
 * Generate AI suggestions (Ideas, Hooks, Script Outlines, Captions).
 */
async function generateAiSuggestions(req, res) {
    try {
        const { prompt, mode = "idea", niche = "general", platform = "general" } = req.body;

        let result = {};

        if (mode === "idea") {
            result = {
                title: `Viral Strategy: ${prompt}`,
                description: `High-conversion content piece focused on ${prompt} for ${platform} (${niche}).`,
                tags: [niche, platform, "Viral", "Strategy"],
                ideas: [
                    `Top 5 Mistakes Creators Make When ${prompt}`,
                    `How I Saved 10 Hours a Week Using ${prompt}`,
                    `The Secret Hack Nobody Tells You About ${prompt}`,
                    `Why 90% of Creators Fail at ${prompt} (And How to Win)`,
                ],
            };
        } else if (mode === "hook") {
            result = {
                hooks: [
                    `Stop doing ${prompt} the wrong way! Here is what actually works in 2026.`,
                    `Want to master ${prompt}? Do these 3 simple things today.`,
                    `If you're struggling with ${prompt}, you need to watch this right now.`,
                    `The exact step-by-step formula for ${prompt} revealed.`,
                ],
            };
        } else if (mode === "script") {
            result = {
                scriptDetails: {
                    hook: `Attention creators! Are you trying to scale your content with ${prompt}?`,
                    body: `Here is the 3-step breakdown:\n\nStep 1: Set up your core workflow around ${prompt}.\nStep 2: Automate repetitive tasks using CreatorOS.\nStep 3: Analyze performance data weekly and double down.`,
                    cta: `Save this post and drop a 🔥 in the comments for the full checklist!`,
                    teleprompterNotes: `Keep high energy, smile at the camera, point to text overlays.`,
                },
            };
        } else {
            result = {
                caption: `Ready to level up your ${prompt}? 🚀 Here is everything you need to know to get started today! #CreatorOS #${platform} #${niche}`,
                hashtags: [`#${niche}`, `#${platform}`, "#creator economy", "#content strategy", "#productivity"],
            };
        }

        return res.json({ success: true, mode, result, message: "AI suggestions generated successfully." });
    } catch (err) {
        console.error("Error generating AI suggestions:", err);
        return res.status(500).json({ success: false, message: "Server error generating AI suggestions." });
    }
}

/**
 * List project folders.
 */
async function listFolders(req, res) {
    try {
        const userId = req.user.id;
        const folders = await ContentFolderModel.find({ userId });
        return res.json({ success: true, count: folders.length, folders });
    } catch (err) {
        console.error("Error listing folders:", err);
        return res.status(500).json({ success: false, message: "Server error listing folders." });
    }
}

/**
 * Create project folder.
 */
async function createFolder(req, res) {
    try {
        const userId = req.user.id;
        const { name, color, description } = req.body;

        const folder = await ContentFolderModel.create({
            userId,
            name,
            color: color || "#4338CA",
            description: description || "",
        });

        return res.status(201).json({ success: true, folder, message: "Folder created successfully." });
    } catch (err) {
        console.error("Error creating folder:", err);
        return res.status(500).json({ success: false, message: "Server error creating folder." });
    }
}

/**
 * Delete project folder.
 */
async function deleteFolder(req, res) {
    try {
        const { id } = req.params;
        const folder = await ContentFolderModel.findById(id);
        if (!folder || folder.userId?.toString() !== req.user.id.toString()) {
            return res.status(404).json({ success: false, message: "Folder not found." });
        }

        await ContentFolderModel.findByIdAndDelete(id);
        return res.json({ success: true, message: "Folder deleted successfully." });
    } catch (err) {
        console.error("Error deleting folder:", err);
        return res.status(500).json({ success: false, message: "Server error deleting folder." });
    }
}

/**
 * Export payload for external integrations (Notion, Google Docs, Canva, ChatGPT).
 */
async function exportToIntegration(req, res) {
    try {
        const { itemId, integration } = req.body;
        const item = await ContentOsModel.findById(itemId);

        if (!item || item.userId?.toString() !== req.user.id.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        let exportPayload = {};
        if (integration === "notion") {
            exportPayload = {
                title: item.title,
                properties: {
                    Status: item.status,
                    Platform: item.platform,
                    Tags: item.tags,
                },
                contentBlocks: [
                    { type: "heading_2", text: "Hook" },
                    { type: "paragraph", text: item.scriptDetails?.hook || "" },
                    { type: "heading_2", text: "Script Body" },
                    { type: "paragraph", text: item.scriptDetails?.body || "" },
                    { type: "heading_2", text: "Call to Action" },
                    { type: "paragraph", text: item.scriptDetails?.cta || "" },
                ],
            };
        } else if (integration === "gdocs") {
            exportPayload = {
                documentTitle: `[Content OS] ${item.title}`,
                bodyText: `${item.title}\n\nHOOK:\n${item.scriptDetails?.hook || ""}\n\nBODY:\n${item.scriptDetails?.body || ""}\n\nCTA:\n${item.scriptDetails?.cta || ""}`,
            };
        } else if (integration === "canva") {
            exportPayload = {
                designName: item.title,
                dimensions: item.platform === "youtube" ? "1920x1080" : "1080x1920",
                textOverlays: [item.scriptDetails?.hook || item.title],
            };
        } else {
            exportPayload = {
                prompt: `Generate 5 viral video variations based on this hook:\n"${item.scriptDetails?.hook || item.title}"\nTarget Platform: ${item.platform}`,
            };
        }

        return res.json({
            success: true,
            integration,
            exportPayload,
            message: `Integration payload generated for ${integration}.`,
        });
    } catch (err) {
        console.error("Error exporting to integration:", err);
        return res.status(500).json({ success: false, message: "Server error exporting integration." });
    }
}

/**
 * Reschedule a Content OS item date & time.
 */
async function rescheduleItem(req, res) {
    try {
        const { id } = req.params;
        const { scheduledAt, status } = req.body;
        const userId = req.user.id;

        if (!scheduledAt) {
            return res.status(400).json({ success: false, message: "scheduledAt date is required for rescheduling." });
        }

        const existing = await ContentOsModel.findById(id);
        if (!existing || existing.userId?.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        const updatedDate = new Date(scheduledAt);
        if (Number.isNaN(updatedDate.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid scheduledAt date format." });
        }

        const newStatus = status || (existing.status === "idea" ? "scheduled" : existing.status);

        const updatedItem = await ContentOsModel.findByIdAndUpdate(
            id,
            { scheduledAt: updatedDate, status: newStatus },
            { new: true }
        );

        // Sync with ScheduledContent queue if status is scheduled
        if (newStatus === "scheduled") {
            try {
                await ScheduledContentModel.create({
                    userId,
                    caption: updatedItem.title + (updatedItem.description ? "\n\n" + updatedItem.description : ""),
                    platform: updatedItem.platform || "general",
                    timezone: "UTC",
                    scheduledAt: updatedDate,
                    status: "scheduled",
                });
            } catch (scheduleErr) {
                console.warn("Notice: ScheduledContent sync skipped:", scheduleErr.message);
            }
        }

        return res.json({ success: true, item: updatedItem, message: "Content item rescheduled successfully." });
    } catch (err) {
        console.error("Error rescheduling item:", err);
        return res.status(500).json({ success: false, message: "Server error rescheduling item." });
    }
}

/**
 * Update performance metrics for a Content OS item.
 */
async function updatePerformance(req, res) {
    try {
        const { id } = req.params;
        const { impressions, views, engagementRate, clicks, likes, shares } = req.body;
        const userId = req.user.id;

        const existing = await ContentOsModel.findById(id);
        if (!existing || existing.userId?.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        const newPerformance = {
            impressions: impressions !== undefined ? Number(impressions) : existing.performance?.impressions || 0,
            views: views !== undefined ? Number(views) : existing.performance?.views || 0,
            engagementRate: engagementRate !== undefined ? Number(engagementRate) : existing.performance?.engagementRate || 0,
            clicks: clicks !== undefined ? Number(clicks) : existing.performance?.clicks || 0,
            likes: likes !== undefined ? Number(likes) : existing.performance?.likes || 0,
            shares: shares !== undefined ? Number(shares) : existing.performance?.shares || 0,
        };

        const updatedItem = await ContentOsModel.findByIdAndUpdate(
            id,
            { performance: newPerformance },
            { new: true }
        );

        return res.json({ success: true, item: updatedItem, message: "Performance metrics updated." });
    } catch (err) {
        console.error("Error updating performance metrics:", err);
        return res.status(500).json({ success: false, message: "Server error updating performance metrics." });
    }
}

/**
 * Add a collaboration comment to a Content OS item.
 */
async function addComment(req, res) {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        if (!text || typeof text !== "string" || !text.trim()) {
            return res.status(400).json({ success: false, message: "Comment text is required." });
        }

        const existing = await ContentOsModel.findById(id);
        if (!existing || existing.userId?.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        const userDoc = await User.findById(userId).select("name email").lean();
        const userName = userDoc?.name || req.user?.email || "Creator";

        const newComment = {
            _id: new (require("mongoose").Types.ObjectId)(),
            userId,
            userName,
            text: text.trim(),
            createdAt: new Date(),
        };

        const comments = [...(existing.comments || []), newComment];
        const updatedItem = await ContentOsModel.findByIdAndUpdate(id, { comments }, { new: true });

        return res.status(201).json({ success: true, comment: newComment, item: updatedItem, message: "Comment added successfully." });
    } catch (err) {
        console.error("Error adding comment:", err);
        return res.status(500).json({ success: false, message: "Server error adding comment." });
    }
}

/**
 * Delete a collaboration comment from a Content OS item.
 */
async function deleteComment(req, res) {
    try {
        const { id, commentId } = req.params;
        const userId = req.user.id;

        const existing = await ContentOsModel.findById(id);
        if (!existing || existing.userId?.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Item not found." });
        }

        const updatedComments = (existing.comments || []).filter(
            (c) => c._id?.toString() !== commentId.toString()
        );

        const updatedItem = await ContentOsModel.findByIdAndUpdate(id, { comments: updatedComments }, { new: true });

        return res.json({ success: true, item: updatedItem, message: "Comment deleted successfully." });
    } catch (err) {
        console.error("Error deleting comment:", err);
        return res.status(500).json({ success: false, message: "Server error deleting comment." });
    }
}

/**
 * Render Content Calendar standalone page (renders Content OS with defaultTab: 'calendar').
 */
async function renderCalendarPage(req, res) {
    req.query.tab = "calendar";
    return renderPage(req, res);
}

module.exports = {
    renderPage,
    renderCalendarPage,
    listItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem,
    convertItem,
    rescheduleItem,
    updatePerformance,
    addComment,
    deleteComment,
    generateAiSuggestions,
    listFolders,
    createFolder,
    deleteFolder,
    exportToIntegration,
};
