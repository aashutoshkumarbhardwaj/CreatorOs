const mockLean = jest.fn();
const mockSort = jest.fn(() => ({ lean: mockLean }));
const mockPopulate = jest.fn(() => ({ sort: mockSort }));
const mockFind = jest.fn(() => ({ populate: mockPopulate }));

jest.mock("../../model/task", () => ({ find: mockFind }));

const Task = require("../../model/task");
const { getTasks } = require("../../controller/taskController");

describe("Task search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLean.mockResolvedValue([]);
  });

  it("escapes regex metacharacters before querying MongoDB", async () => {
    const req = {
      user: { id: "64b7f1f1f1f1f1f1f1f1f1f1" },
      query: { search: "(draft+)+$" },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await getTasks(req, res, next);

    const escapedSearch = "\\(draft\\+\\)\\+\\$";
    expect(Task.find).toHaveBeenCalledWith({
      creatorId: req.user.id,
      isArchived: false,
      $or: [
        { title: { $regex: escapedSearch, $options: "i" } },
        { description: { $regex: escapedSearch, $options: "i" } },
        { tags: { $regex: escapedSearch, $options: "i" } },
      ],
    });
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, count: 0, tasks: [] });
  });
});
