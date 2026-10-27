import { LandPlot, PortfolioSettings } from '../types/land';

const DB_NAME = 'LandPortfolio_DB';
const DB_VERSION = 1;
const PLOTS_STORE = 'plots';
const SETTINGS_STORE = 'settings';

/**
 * Open and initialize native browser IndexedDB
 */
export const openLandDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for Land Plots (keyed by plot id)
      if (!db.objectStoreNames.contains(PLOTS_STORE)) {
        db.createObjectStore(PLOTS_STORE, { keyPath: 'id' });
      }

      // Store for App Settings (keyed by 'key')
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
  });
};

/**
 * Save all plots with complete image data directly into IndexedDB
 * (No 5MB quota limit - safe for high-res deed images and photos)
 */
export const savePlotsToIndexedDB = async (plots: LandPlot[]): Promise<void> => {
  try {
    const db = await openLandDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PLOTS_STORE], 'readwrite');
      const store = tx.objectStore(PLOTS_STORE);

      // Clear existing to keep it synchronized with state
      const clearReq = store.clear();

      clearReq.onsuccess = () => {
        plots.forEach((plot) => {
          store.put(plot);
        });
      };

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        console.error('IndexedDB transaction error during savePlots:', tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('Failed to save plots to IndexedDB:', err);
  }
};

/**
 * Load all plots from IndexedDB (with complete full-resolution images)
 */
export const loadPlotsFromIndexedDB = async (): Promise<LandPlot[] | null> => {
  try {
    const db = await openLandDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([PLOTS_STORE], 'readonly');
      const store = tx.objectStore(PLOTS_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result as LandPlot[];
        if (Array.isArray(results) && results.length > 0) {
          // Sort by orderNumber
          results.sort((a, b) => (a.orderNumber || 0) - (b.orderNumber || 0));
          resolve(results);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        console.error('IndexedDB getAll error:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.error('Failed to load plots from IndexedDB:', err);
    return null;
  }
};

/**
 * Save application settings into IndexedDB
 */
export const saveSettingsToIndexedDB = async (settings: PortfolioSettings): Promise<void> => {
  try {
    const db = await openLandDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SETTINGS_STORE], 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      store.put({ key: 'main_settings', value: settings });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save settings to IndexedDB:', err);
  }
};

/**
 * Load application settings from IndexedDB
 */
export const loadSettingsFromIndexedDB = async (): Promise<PortfolioSettings | null> => {
  try {
    const db = await openLandDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SETTINGS_STORE], 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get('main_settings');

      req.onsuccess = () => {
        if (req.result && req.result.value) {
          resolve(req.result.value as PortfolioSettings);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Failed to load settings from IndexedDB:', err);
    return null;
  }
};

/**
 * Image compression utility for high-resolution camera deeds & photos
 * Compresses large 10MB+ smartphone images to lightweight crisp ~250KB JPEG
 */
export const compressImageForStorage = (
  fileOrDataUrl: File | string,
  maxWidth = 1600,
  quality = 0.82
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const processImage = (src: string) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxWidth) {
            if (width > height) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxWidth) / height);
              height = maxWidth;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(src); // fallback
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (e) {
          console.warn('Canvas compression error, using original src:', e);
          resolve(src);
        }
      };

      img.onerror = (err) => {
        console.warn('Image load error during compression:', err);
        resolve(src);
      };

      img.src = src;
    };

    if (typeof fileOrDataUrl === 'string') {
      processImage(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          processImage(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
};
