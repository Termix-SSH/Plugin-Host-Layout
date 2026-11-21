import { describe, expect, it } from "vitest";
import type { Host, HostFolder } from "@termix-ssh/plugin-sdk/ui";
import {
  ancestorKeys,
  countHosts,
  findFolder,
  folderKey,
  hostKey,
  hostsIn,
  visibleRows,
} from "../../../src/frontend/host/tree-model";

const host = (id: string, name: string, extra: Partial<Host> = {}): Host =>
  ({
    id,
    name,
    ip: `10.0.0.${id}`,
    port: 22,
    username: "root",
    ...extra,
  }) as Host;

const pve = host("1", "pve", {
  childHosts: [host("2", "nas"), host("3", "web", { tags: ["prod"] })],
});
const tree: HostFolder = {
  name: "root",
  children: [
    host("9", "laptop"),
    {
      name: "Lab",
      path: "Lab",
      children: [
        pve,
        { name: "Pi", path: "Lab / Pi", children: [host("4", "pihole")] },
      ],
    },
  ],
};

describe("visibleRows", () => {
  it("shows folders first and keeps closed folders shut", () => {
    const rows = visibleRows(tree, new Set());
    expect(rows.map((row) => row.key)).toEqual([
      folderKey("Lab"),
      hostKey("9"),
    ]);
    expect(rows[0]).toMatchObject({ kind: "folder", count: 4 });
  });

  it("opens folders and sub hosts that are expanded", () => {
    const rows = visibleRows(tree, new Set([folderKey("Lab"), hostKey("1")]));
    expect(rows.map((row) => [row.key, row.depth])).toEqual([
      [folderKey("Lab"), 0],
      [folderKey("Lab / Pi"), 1],
      [hostKey("1"), 1],
      [hostKey("2"), 2],
      [hostKey("3"), 2],
      [hostKey("9"), 0],
    ]);
    expect(rows[2]).toMatchObject({ hasSubHosts: true, expanded: true });
  });

  it("opens the way to a search match and hides the rest", () => {
    const rows = visibleRows(tree, new Set(), "prod");
    expect(rows.map((row) => row.key)).toEqual([
      folderKey("Lab"),
      hostKey("1"),
      hostKey("3"),
    ]);
  });

  it("finds hosts by address too", () => {
    expect(visibleRows(tree, new Set(), "10.0.0.4").map((r) => r.key)).toEqual([
      folderKey("Lab"),
      folderKey("Lab / Pi"),
      hostKey("4"),
    ]);
  });

  it("is empty with no tree", () => {
    expect(visibleRows(null, new Set())).toEqual([]);
  });
});

describe("tree helpers", () => {
  it("lists what is above a host", () => {
    expect(ancestorKeys(tree, "3")).toEqual([folderKey("Lab"), hostKey("1")]);
    expect(ancestorKeys(tree, "9")).toEqual([]);
    expect(ancestorKeys(tree, "nope")).toEqual([]);
  });

  it("counts and flattens hosts", () => {
    expect(countHosts(tree)).toBe(5);
    expect(hostsIn(findFolder(tree, "Lab")).map((h) => h.name)).toEqual([
      "pve",
      "nas",
      "web",
      "pihole",
    ]);
    expect(findFolder(tree, "Nope")).toBeNull();
  });
});
