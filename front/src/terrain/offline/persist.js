const DB_NAME = "stokify-terrain-file";
const STORE = "actions";
const memory = new Map();
let driverOverride = null;

export function useMemoryQueueForTests() {
  memory.clear();
  driverOverride = "memory";
}

function useMemory() {
  return driverOverride === "memory" || typeof indexedDB === "undefined";
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function lireTout() {
  if (useMemory()) return [...memory.values()];
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const request = tx.objectStore(STORE).getAll();
  const rows = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  db.close();
  return rows;
}

export async function ecrire(row) {
  if (useMemory()) {
    memory.set(row.id, row);
    return row;
  }
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(row);
  await txDone(tx);
  db.close();
  return row;
}

export async function retirerId(id) {
  if (useMemory()) {
    memory.delete(id);
    return;
  }
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
  db.close();
}
