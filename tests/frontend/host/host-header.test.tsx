import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  registerHostAction,
  resetHostContributions,
} from "@termix-ssh/plugin-sdk/testing-host";
import type { Host } from "@termix-ssh/plugin-sdk/ui";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import type {
  PluginManifest,
  TermixApp,
} from "@termix-ssh/plugin-sdk/frontend";

const fakeShell = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.name ? `${key}:${options.name}` : key,
    language: "en",
  }),
}));
vi.mock("@termix-ssh/plugin-sdk/ui", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useShellController: () => fakeShell.current,
}));

import { HostHeader } from "../../../src/frontend/host/HostHeader";

const Icon = () => null;
const host = {
  id: "1",
  name: "pve",
  ip: "10.0.0.1",
  port: 22,
  username: "root",
} as Host;

let tabs: {
  list: Array<Record<string, unknown>>;
  activeId: string;
  setActive: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  tabs = {
    list: [
      { id: "ov", type: "host-overview", label: "pve", host },
      { id: "t1", type: "terminal", label: "pve", host },
      { id: "t2", type: "terminal", label: "pve (2)", host },
    ],
    activeId: "t1",
    setActive: vi.fn(),
    open: vi.fn(),
    close: vi.fn(async () => {}),
  };
  fakeShell.current = {
    tabs,
    hosts: { edit: vi.fn() },
    callbacks: { openTab: vi.fn() },
  };
  registerHostAction({
    id: "ssh",
    titleKey: "Terminal",
    icon: Icon,
    kind: "connect",
    tabType: "terminal",
    priority: 10,
    when: () => true,
  });
  registerHostAction({
    id: "docker",
    titleKey: "Docker",
    icon: Icon,
    kind: "open",
    tabType: "docker",
    when: () => true,
  });
  registerHostAction({
    id: "wake",
    titleKey: "Wake",
    icon: Icon,
    kind: "open",
    run: vi.fn(),
    when: () => true,
  });
});

afterEach(() => {
  cleanup();
  resetHostContributions();
});

describe("HostHeader", () => {
  it("has a tab for the overview, each open session and each tool", () => {
    render(<HostHeader host={host} />);
    const labels = screen
      .getAllByRole("tab")
      .map((tab) => tab.textContent?.trim());
    expect(labels).toEqual([
      "hostLayout.overview",
      "Terminal",
      "Terminal 2",
      "Docker",
    ]);
    expect(
      screen
        .getByRole("tab", { name: "Terminal" })
        .getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("switches to an open tab and opens a tool that isn't open", () => {
    render(<HostHeader host={host} />);
    fireEvent.click(screen.getByRole("tab", { name: "Terminal 2" }));
    expect(tabs.setActive).toHaveBeenCalledWith("t2");
    fireEvent.click(screen.getByRole("tab", { name: "Docker" }));
    const shell = fakeShell.current as { callbacks: { openTab: unknown } };
    expect(shell.callbacks.openTab).toHaveBeenCalledWith(host, "docker");
  });

  it("closes a tab and opens another session", async () => {
    // A session tab type, like the SSH terminal's.
    const terminal: RenderedPluginApp = await renderWithApp(
      {
        activate(app: TermixApp) {
          app.registerTab("terminal", () => null, {
            titleKey: "Terminal",
            session: true,
          });
        },
      },
      {
        manifest: {
          id: "ssh",
          contributes: {
            tabs: [
              { id: "terminal", titleKey: "Terminal", openFrom: ["rail"] },
            ],
          },
        } as unknown as PluginManifest,
      },
    );
    render(<HostHeader host={host} />);
    fireEvent.click(screen.getByLabelText("hostLayout.closeTab:Terminal 2"));
    expect(tabs.close).toHaveBeenCalledWith("t2");
    fireEvent.click(screen.getByLabelText("hostLayout.newSession:Terminal 2"));
    expect(tabs.open).toHaveBeenCalledWith(host, "terminal", undefined, {
      forceNewTab: true,
    });
    await terminal.deactivate();
  });

  it("opens the overview when it was closed", () => {
    tabs.list = tabs.list.filter((tab) => tab.id !== "ov");
    render(<HostHeader host={host} />);
    fireEvent.click(screen.getByRole("tab", { name: "hostLayout.overview" }));
    expect(tabs.open).toHaveBeenCalledWith(host, "host-overview");
  });

  it("offers a back button on phones and edits the host", () => {
    const onBack = vi.fn();
    render(<HostHeader host={host} onBack={onBack} />);
    fireEvent.click(screen.getByLabelText("hostLayout.back"));
    expect(onBack).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("hostLayout.editHost"));
    const shell = fakeShell.current as { hosts: { edit: unknown } };
    expect(shell.hosts.edit).toHaveBeenCalledWith(host);
  });
});
