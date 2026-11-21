import { describe, expect, it } from "vitest";
import type { Host, HostActionDef } from "@termix-ssh/plugin-sdk/ui";
import {
  hostTools,
  lastHostTab,
  forgetHostTabs,
  openCountByHost,
  rememberHostTab,
  tabsOnHost,
} from "../../../src/frontend/host/host-tools";

const Icon = () => null;
const action = (
  id: string,
  extra: Partial<HostActionDef> = {},
): HostActionDef => ({
  id,
  titleKey: id,
  icon: Icon,
  kind: "open",
  when: () => true,
  ...extra,
});
const host = { id: "1", name: "box", ip: "10.0.0.1" } as Host;

describe("hostTools", () => {
  it("puts sessions first by priority, then tools by order", () => {
    const tools = hostTools(
      [
        action("files", { tabType: "file-manager", order: 20 }),
        action("ssh", { kind: "connect", tabType: "terminal", priority: 10 }),
        action("rdp", { kind: "connect", tabType: "rdp", priority: 5 }),
        action("docker", { tabType: "docker", order: 10 }),
        action("off", { tabType: "nope", when: () => false }),
      ],
      host,
    );
    expect(tools.tabs.map((a) => a.id)).toEqual([
      "ssh",
      "rdp",
      "docker",
      "files",
    ]);
    expect(tools.launchers).toEqual([]);
  });

  it("keeps actions that don't open a tab apart and skips the overview", () => {
    const tools = hostTools(
      [
        action("wake", { run: () => {} }),
        action("pick", { tabType: "x", items: () => [] }),
        action("page", { tabType: "host-overview" }),
        action("dupe1", { tabType: "metrics" }),
        action("dupe2", { tabType: "metrics" }),
      ],
      host,
    );
    expect(tools.tabs.map((a) => a.id)).toEqual(["dupe1"]);
    expect(tools.launchers.map((a) => a.id)).toEqual(["wake", "pick"]);
  });
});

describe("open tabs per host", () => {
  const tabs = [
    { id: "a", type: "terminal", host: { id: "1" } },
    { id: "b", type: "terminal", host: { id: 1 } },
    { id: "c", type: "host-overview", host: { id: "1" } },
    { id: "d", type: "terminal", host: { id: "1" }, parentSplitTabId: "s" },
    { id: "e", type: "settings" },
    { id: "f", type: "docker", host: { id: "2" } },
  ];

  it("finds a host's tabs outside splits", () => {
    expect(tabsOnHost(tabs, "1").map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("counts open tools per host without the overview", () => {
    expect([...openCountByHost(tabs)]).toEqual([
      ["1", 2],
      ["2", 1],
    ]);
  });

  it("remembers the last tab per host", () => {
    rememberHostTab(1, "b");
    expect(lastHostTab("1")).toBe("b");
    forgetHostTabs();
    expect(lastHostTab("1")).toBeUndefined();
  });
});
