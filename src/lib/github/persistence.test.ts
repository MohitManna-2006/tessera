import { describe, expect, it } from "vitest";

import {
  clearGitHubEnvelope,
  createGitHubEnvelope,
  GITHUB_STORAGE_KEY,
  readGitHubEnvelope,
  toggleRepoSelection,
  writeGitHubEnvelope,
} from "./persistence";

function createStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    _store: store,
  };
}

describe("GitHub persistence", () => {
  it("creates and reads envelope", () => {
    const storage = createStorage();
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [],
      selectedRepoIds: [],
      readmes: {},
      now: 1000,
    });
    expect(writeGitHubEnvelope(storage, envelope)).toBe(true);
    expect(readGitHubEnvelope(storage, 1000 + 1000)).toEqual(envelope);
  });

  it("expires after TTL", () => {
    const storage = createStorage();
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [],
      selectedRepoIds: [],
      readmes: {},
      now: 1000,
    });
    writeGitHubEnvelope(storage, envelope);
    expect(readGitHubEnvelope(storage, 1000 + 30 * 60 * 1000 + 1)).toBeNull();
    expect(storage._store.has(GITHUB_STORAGE_KEY)).toBe(false);
  });

  it("clears on invalid JSON", () => {
    const storage = createStorage();
    storage.setItem(GITHUB_STORAGE_KEY, "not json");
    expect(readGitHubEnvelope(storage)).toBeNull();
  });

  it("toggles selection within limit", () => {
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [],
      selectedRepoIds: ["1"],
      readmes: {},
    });
    const added = toggleRepoSelection(envelope, "2", 5);
    expect(added?.selectedRepoIds).toEqual(["1", "2"]);
    const removed = toggleRepoSelection(added!, "1", 5);
    expect(removed?.selectedRepoIds).toEqual(["2"]);
  });

  it("rejects over limit", () => {
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [],
      selectedRepoIds: ["1", "2", "3", "4", "5"],
      readmes: {},
    });
    expect(toggleRepoSelection(envelope, "6", 5)).toBeNull();
  });

  it("write fails on over-limit envelope", () => {
    const storage = createStorage();
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [],
      selectedRepoIds: ["1"],
      readmes: {},
    });
    // manually craft over-limit (>10)
    const over = {
      ...envelope,
      selectedRepoIds: Array.from({ length: 11 }, (_, i) => String(i + 1)),
    };
    expect(writeGitHubEnvelope(storage, over as never)).toBe(false);
  });

  it("clear removes", () => {
    const storage = createStorage();
    const envelope = createGitHubEnvelope({
      username: "octocat",
      profile: null,
      repos: [],
      selectedRepoIds: [],
      readmes: {},
    });
    writeGitHubEnvelope(storage, envelope);
    clearGitHubEnvelope(storage);
    expect(readGitHubEnvelope(storage)).toBeNull();
  });
});
