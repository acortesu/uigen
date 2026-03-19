import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { getToolLabel, ToolCallBadge } from "../ToolCallBadge";

describe("getToolLabel", () => {
  describe("str_replace_editor", () => {
    it("returns 'Creating <path>' for create command", () => {
      expect(getToolLabel("str_replace_editor", { command: "create", path: "/App.jsx" })).toBe("Creating /App.jsx");
    });

    it("returns 'Editing <path>' for str_replace command", () => {
      expect(getToolLabel("str_replace_editor", { command: "str_replace", path: "/components/Card.jsx" })).toBe("Editing /components/Card.jsx");
    });

    it("returns 'Editing <path>' for insert command", () => {
      expect(getToolLabel("str_replace_editor", { command: "insert", path: "/App.jsx" })).toBe("Editing /App.jsx");
    });

    it("returns 'Reading <path>' for view command", () => {
      expect(getToolLabel("str_replace_editor", { command: "view", path: "/App.jsx" })).toBe("Reading /App.jsx");
    });

    it("returns tool name for unknown command", () => {
      expect(getToolLabel("str_replace_editor", { command: "unknown", path: "/App.jsx" })).toBe("str_replace_editor");
    });
  });

  describe("file_manager", () => {
    it("returns 'Renaming <path>' for rename command", () => {
      expect(getToolLabel("file_manager", { command: "rename", path: "/old.jsx" })).toBe("Renaming /old.jsx");
    });

    it("returns 'Deleting <path>' for delete command", () => {
      expect(getToolLabel("file_manager", { command: "delete", path: "/App.jsx" })).toBe("Deleting /App.jsx");
    });
  });

  it("returns tool name for unknown tools", () => {
    expect(getToolLabel("unknown_tool", { command: "foo" })).toBe("unknown_tool");
  });

  it("handles missing path gracefully", () => {
    expect(getToolLabel("str_replace_editor", { command: "create" })).toBe("Creating");
  });
});

describe("ToolCallBadge", () => {
  it("shows spinner and label while in progress", () => {
    render(<ToolCallBadge toolName="str_replace_editor" args={{ command: "create", path: "/App.jsx" }} state="call" />);
    expect(screen.getByText("Creating /App.jsx")).toBeDefined();
  });

  it("shows green dot and label when done", () => {
    render(<ToolCallBadge toolName="str_replace_editor" args={{ command: "str_replace", path: "/App.jsx" }} state="result" result="ok" />);
    expect(screen.getByText("Editing /App.jsx")).toBeDefined();
  });

  it("shows friendly label for file_manager delete", () => {
    render(<ToolCallBadge toolName="file_manager" args={{ command: "delete", path: "/old.jsx" }} state="result" result="ok" />);
    expect(screen.getByText("Deleting /old.jsx")).toBeDefined();
  });
});
