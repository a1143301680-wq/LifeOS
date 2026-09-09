import {
  createEmptySyncState,
  loadSyncState,
  persistSyncState,
  syncStorageKey,
} from "./sync-state";

const meId = "6dc20f43-14a3-45f0-b646-5077f6802586";
const partnerId = "e088bca1-3bf2-4a2d-b73b-40ee44b3ad2c";

test("stores one versioned cursor and normalized cache per validated identity id", () => {
  const me = createEmptySyncState(meId);
  me.cursor = 12;
  me.todos["d26be12d-16d7-4fd1-8965-0f1fe7224595"] = {
    last_cursor: 12,
    entity_version: 2,
    snapshot: { id: "d26be12d-16d7-4fd1-8965-0f1fe7224595", title: "Mine" },
    tombstone: null,
  };

  persistSyncState(me);
  persistSyncState(createEmptySyncState(partnerId));

  expect(syncStorageKey(meId)).not.toContain("token");
  expect(loadSyncState(meId)).toEqual(me);
  expect(loadSyncState(partnerId)).toEqual(createEmptySyncState(partnerId));
  expect(localStorage).toHaveLength(2);
});

test("resets only malformed or unsupported identity state", () => {
  const partner = createEmptySyncState(partnerId);
  partner.cursor = 9;
  persistSyncState(partner);
  localStorage.setItem(syncStorageKey(meId), JSON.stringify({ version: 99, cursor: 40 }));

  expect(loadSyncState(meId)).toEqual(createEmptySyncState(meId));
  expect(localStorage.getItem(syncStorageKey(meId))).toBeNull();
  expect(loadSyncState(partnerId)).toEqual(partner);
});

test("rejects stored cache entries ahead of their serialized cursor", () => {
  const inconsistent = createEmptySyncState(meId);
  inconsistent.todos["d26be12d-16d7-4fd1-8965-0f1fe7224595"] = {
    last_cursor: 2,
    entity_version: 1,
    snapshot: { id: "d26be12d-16d7-4fd1-8965-0f1fe7224595" },
    tombstone: null,
  };
  localStorage.setItem(syncStorageKey(meId), JSON.stringify(inconsistent));

  expect(loadSyncState(meId)).toEqual(createEmptySyncState(meId));
  expect(localStorage.getItem(syncStorageKey(meId))).toBeNull();
});
