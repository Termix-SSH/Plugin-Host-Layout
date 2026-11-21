import { afterEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import { usePluginComponent } from "@termix-ssh/plugin-sdk/frontend";
import { getRegisteredLayout } from "@termix-ssh/plugin-sdk/testing-host";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import * as plugin from "../../src/frontend/index";
import manifestJson from "../../manifest.json";
import locales from "../../locales/en.json";

const manifest = manifestJson as unknown as PluginManifest;

let rendered: RenderedPluginApp | null = null;

afterEach(async () => {
  await rendered?.deactivate();
  rendered = null;
});

describe(`${manifest.id} activate`, () => {
  it("registers the layout its manifest declares", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    const layout = getRegisteredLayout("host");
    expect(layout).toMatchObject({ id: "host", pluginId: manifest.id });
    expect(typeof layout?.component).toBe("function");
    expect(manifest.contributes?.layouts?.map((entry) => entry.id)).toEqual([
      "host",
    ]);
  });

  it("registers the Dashboard, Manage, Settings and host Overview tab types", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    expect(rendered.registered.tabs().sort()).toEqual([
      "dashboard",
      "host-manager",
      "host-overview",
      "settings",
    ]);
  });

  it("takes over the appearance step", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    expect(rendered.registered.onboardingSteps().sort()).toEqual([
      "appearance",
    ]);
  });

  it("offers the host list and the Dashboard to other plugins", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    for (const id of ["host-layout.hostTree", "host-layout.dashboard"]) {
      const { result } = renderHook(() => usePluginComponent(id));
      expect(result.current).toBeTruthy();
    }
  });

  it("takes everything back when it is turned off", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    await rendered.deactivate();
    rendered = null;
    expect(getRegisteredLayout("host")).toBeUndefined();
    const { result } = renderHook(() =>
      usePluginComponent("host-layout.hostTree"),
    );
    expect(result.current).toBeUndefined();
  });

  it("is a layout plugin that declares every tab it registers", () => {
    expect(manifest.capabilities).toContain("ui:layout");
    expect(manifest.contributes?.tabs?.map((tab) => tab.id).sort()).toEqual([
      "dashboard",
      "host-manager",
      "host-overview",
      "settings",
    ]);
  });
});
