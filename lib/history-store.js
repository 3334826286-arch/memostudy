const DB_NAME = "memostudy-history-db";
const STORE_NAME = "sessions";
const DB_VERSION = 1;

function buildEntryFingerprint(entry) {
  return [
    entry?.title ?? "",
    entry?.projectCategory ?? "",
    entry?.settings?.mode ?? "",
    entry?.settings?.language ?? "",
    (entry?.text ?? "").trim()
  ].join("::");
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, handler) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = handler(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function saveHistoryEntry(entry, limit = 16) {
  await withStore("readwrite", (store) => {
    store.put({
      ...entry,
      fingerprint: buildEntryFingerprint(entry)
    });
    return null;
  });

  const items = await listHistoryEntries();
  const seenFingerprints = new Set();
  const staleItems = [];

  items.forEach((item, index) => {
    const fingerprint = item.fingerprint ?? buildEntryFingerprint(item);

    if (seenFingerprints.has(fingerprint) || index >= limit) {
      staleItems.push(item);
      return;
    }

    seenFingerprints.add(fingerprint);
  });

  await Promise.all(staleItems.map((item) => deleteHistoryEntry(item.id)));
}

export async function listHistoryEntries() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = (request.result ?? []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      db.close();
      resolve(items);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function deleteHistoryEntry(id) {
  await withStore("readwrite", (store) => {
    store.delete(id);
    return null;
  });
}
