const DATABASE_NAME = "lumos-browser-data";
const DATABASE_VERSION = 1;
const OBJECT_STORE = "records";
const memoryFallback = new Map();
let databasePromise = null;

function recordId(namespace, key) {
  return `${namespace}:${key}`;
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openDatabase() {
  if (!canUseIndexedDb()) return Promise.resolve(null);
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OBJECT_STORE)) {
        const store = database.createObjectStore(OBJECT_STORE, { keyPath: "id" });
        store.createIndex("namespace", "namespace", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB could not be opened."));
  }).catch((error) => {
    console.warn("LUMOS persistent browser storage is unavailable; using session memory.", error);
    return null;
  });
  return databasePromise;
}

function transactionPromise(database, mode, operation) {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE, mode);
    const store = transaction.objectStore(OBJECT_STORE);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error ?? request?.error ?? new Error("Browser storage transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Browser storage transaction was aborted."));
  });
}

export async function getStoredValue(namespace, key) {
  const id = recordId(namespace, key);
  const database = await openDatabase();
  if (!database) return memoryFallback.get(id)?.value ?? null;
  const record = await transactionPromise(database, "readonly", (store) => store.get(id));
  return record?.value ?? null;
}

export async function getStoredRecord(namespace, key) {
  const id = recordId(namespace, key);
  const database = await openDatabase();
  if (!database) return memoryFallback.get(id) ?? null;
  return await transactionPromise(database, "readonly", (store) => store.get(id)) ?? null;
}

export async function setStoredValue(namespace, key, value, metadata = {}) {
  const record = {
    id: recordId(namespace, key),
    namespace,
    key,
    value,
    updatedAt: Date.now(),
    ...metadata
  };
  const database = await openDatabase();
  if (!database) {
    memoryFallback.set(record.id, record);
    return record;
  }
  await transactionPromise(database, "readwrite", (store) => store.put(record));
  return record;
}

export async function deleteStoredValue(namespace, key) {
  const id = recordId(namespace, key);
  const database = await openDatabase();
  if (!database) return memoryFallback.delete(id);
  await transactionPromise(database, "readwrite", (store) => store.delete(id));
  return true;
}

export async function listStoredRecords(namespace) {
  const database = await openDatabase();
  if (!database) {
    return [...memoryFallback.values()]
      .filter((record) => record.namespace === namespace)
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }
  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE, "readonly");
    const store = transaction.objectStore(OBJECT_STORE);
    const index = store.index("namespace");
    const request = index.getAll(namespace);
    request.onsuccess = () => resolve((request.result ?? []).sort((left, right) => right.updatedAt - left.updatedAt));
    request.onerror = () => reject(request.error ?? new Error("Stored records could not be listed."));
  });
}

export async function clearStoredNamespace(namespace) {
  const records = await listStoredRecords(namespace);
  await Promise.all(records.map((record) => deleteStoredValue(namespace, record.key)));
  return records.length;
}

export function browserStorageAvailable() {
  return canUseIndexedDb();
}
