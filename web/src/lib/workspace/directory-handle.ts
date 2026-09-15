const DATABASE_NAME = "infinite-canvas-workspace";
const STORE_NAME = "handles";
const HANDLE_KEY = "directory";

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
    database.close();
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    const database = await openDatabase();
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
        const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(HANDLE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
    database.close();
    return handle;
}

export async function clearDirectoryHandle(): Promise<void> {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite");
        transaction.objectStore(STORE_NAME).delete(HANDLE_KEY);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
    database.close();
}
