import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import type { TermixApp } from "@termix-ssh/plugin-sdk/frontend";
import type { Host, HostFolder } from "@termix-ssh/plugin-sdk/ui";

const fakeShell = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
    language: "en",
  }),
}));
vi.mock("@termix-ssh/plugin-sdk/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useShellController: () => fakeShell.current,
}));

import { HostTree } from "../../../src/frontend/host/HostTree";

const host = (id: string, name: string, extra: Partial<Host> = {}): Host =>
  ({
    id,
    name,
    ip: `10.0.0.${id}`,
    port: 22,
    username: "root",
    ...extra,
  }) as Host;

const docker = host("1", "docker-box");
const tree: HostFolder = {
  name: "root",
  children: [
    { name: "Lab", path: "Lab", children: [docker] },
    host("2", "laptop"),
  ],
};

let app: RenderedPluginApp | null = null;

beforeEach(() => {
  localStorage.clear();
  fakeShell.current = {
    hosts: {
      tree,
      list: [docker],
      loaded: true,
      loading: false,
      edit: vi.fn(),
    },
    tabs: {
      list: [
        { id: "t1", type: "terminal", host: { id: "1" } },
        { id: "t2", type: "docker", host: { id: "1" } },
      ],
    },
    callbacks: {},
  };
});

afterEach(async () => {
  cleanup();
  await app?.deactivate();
  app = null;
});

function renderTree(props: Partial<Parameters<typeof HostTree>[0]> = {}) {
  const onSelectHost = vi.fn();
  const onOpenChild = vi.fn();
  render(
    <HostTree
      selectedHostId={null}
      onSelectHost={onSelectHost}
      onOpenChild={onOpenChild}
      {...props}
    />,
  );
  return { onSelectHost, onOpenChild };
}

describe("HostTree", () => {
  it("opens a folder and selects a host", () => {
    const { onSelectHost } = renderTree();
    expect(screen.queryByText("docker-box")).toBeNull();
    fireEvent.click(screen.getByText("Lab"));
    fireEvent.click(screen.getByText("docker-box"));
    expect(onSelectHost).toHaveBeenCalledWith(docker);
    // Two tools are open on it.
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("keeps folders open across visits", () => {
    renderTree();
    fireEvent.click(screen.getByText("Lab"));
    cleanup();
    renderTree();
    expect(screen.getByText("docker-box")).toBeTruthy();
  });

  it("searches hosts", () => {
    renderTree();
    fireEvent.change(screen.getByLabelText("hostLayout.tree.search"), {
      target: { value: "lap" },
    });
    expect(screen.getByText("laptop")).toBeTruthy();
    expect(screen.queryByText("Lab")).toBeNull();
    fireEvent.change(screen.getByLabelText("hostLayout.tree.search"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("hostLayout.tree.noMatch")).toBeTruthy();
  });

  it("opens the tree to a host chosen elsewhere", () => {
    renderTree({ selectedHostId: "1", reveal: ["folder:Lab"] });
    expect(screen.getByText("docker-box")).toBeTruthy();
    expect(
      screen
        .getByText("docker-box")
        .closest("[role=treeitem]")
        ?.getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("lists what a plugin says runs inside a host and opens it", async () => {
    app = await renderWithApp({
      activate(plugin: TermixApp) {
        plugin.registerHostTreeChildren({
          id: "containers",
          when: (h) => String(h.id) === "1",
          useChildren: () => ({
            items: [
              {
                id: "c1",
                label: "nginx",
                kind: "container",
                state: "running",
                tabType: "docker",
                data: { focus: { container: "c1" } },
              },
            ],
          }),
        });
      },
    });
    const { onOpenChild } = renderTree({ reveal: ["folder:Lab"] });
    expect(screen.queryByText("nginx")).toBeNull();
    fireEvent.click(screen.getAllByLabelText("hostLayout.tree.expand")[0]);
    await waitFor(() => expect(screen.getByText("nginx")).toBeTruthy());
    fireEvent.click(screen.getByText("nginx"));
    expect(onOpenChild).toHaveBeenCalledWith(
      docker,
      expect.objectContaining({ id: "c1", tabType: "docker" }),
    );
  });

  it("moves with the arrow keys", () => {
    const { onSelectHost } = renderTree();
    const lab = screen.getByText("Lab").closest("[role=treeitem]")!;
    fireEvent.keyDown(lab, { key: "ArrowRight" });
    expect(screen.getByText("docker-box")).toBeTruthy();
    const row = screen.getByText("docker-box").closest("[role=treeitem]")!;
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onSelectHost).toHaveBeenCalledWith(docker);
    fireEvent.keyDown(lab, { key: "ArrowLeft" });
    expect(screen.queryByText("docker-box")).toBeNull();
  });
});
