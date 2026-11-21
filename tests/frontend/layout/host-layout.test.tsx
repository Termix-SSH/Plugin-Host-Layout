import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  ServerStatusProvider,
  ShellControllerProvider,
  TabPortals,
  setPermissionsForTesting,
} from "@termix-ssh/plugin-sdk/testing-host";

vi.mock("@termix-ssh/plugin-sdk/frontend", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key, language: "en" }),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { HostLayout } from "../../../src/frontend/layout/HostLayout";

// The shell keeps polling after unmount; its late logs would reach a closed worker.
for (const level of ["log", "info", "warn", "error", "debug"] as const) {
  console[level] = () => {};
}

beforeEach(() => {
  localStorage.clear();
  setPermissionsForTesting([], true);
});
afterEach(cleanup);

function renderLayout() {
  return render(
    <ServerStatusProvider isAuthenticated>
      <ShellControllerProvider username="admin" onLogout={() => {}}>
        <HostLayout />
        <TabPortals />
      </ShellControllerProvider>
    </ServerStatusProvider>,
  );
}

describe("HostLayout", () => {
  it("draws the host tree, its footer and the stage", async () => {
    renderLayout();
    await waitFor(() =>
      expect(
        screen.getByRole("tree", { name: "hostLayout.tree.label" }),
      ).toBeTruthy(),
    );
    expect(screen.getByLabelText("hostLayout.tree.search")).toBeTruthy();
    expect(screen.getByLabelText("hostLayout.home")).toBeTruthy();
    expect(screen.getByLabelText("hostLayout.manage")).toBeTruthy();
    expect(screen.getByLabelText("hostLayout.toolsMenu")).toBeTruthy();
    expect(screen.getByLabelText("hostLayout.search")).toBeTruthy();
    expect(screen.getByLabelText("hostLayout.resize")).toBeTruthy();
  });

  it("resizes the tree and remembers the width", async () => {
    const { container } = renderLayout();
    const handle = await screen.findByLabelText("hostLayout.resize");
    fireEvent.mouseDown(handle, { clientX: 280 });
    fireEvent.mouseMove(window, { clientX: 380 });
    fireEvent.mouseUp(window, { clientX: 380 });
    const aside = container.querySelector("aside") as HTMLElement;
    expect(aside.style.width).toBe("380px");
    expect(localStorage.getItem("host-layout.treeWidth")).toBe("380");
    fireEvent.doubleClick(handle);
    expect(aside.style.width).toBe("280px");
  });

  it("keeps the shell row in its own stacking context", () => {
    const { container } = renderLayout();
    expect(
      container.querySelector("aside")?.closest(".isolate"),
    ).not.toBeNull();
  });
});
