import { LandPlot, PortfolioSettings } from '../types/land';

export interface CloudflareD1Config {
  workerUrl: string;
  apiToken: string;
  databaseName: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

const DEFAULT_D1_CONFIG: CloudflareD1Config = {
  workerUrl: '',
  apiToken: '',
  databaseName: 'land-portfolio-db',
  autoSync: false,
};

const D1_CONFIG_STORAGE_KEY = 'cf_d1_config_v1';
const D1_SIMULATED_DB_KEY = 'cf_d1_simulated_db_v1';
let inMemoryD1Db: any = null;

export const loadD1Config = (): CloudflareD1Config => {
  try {
    const raw = localStorage.getItem(D1_CONFIG_STORAGE_KEY);
    return raw ? { ...DEFAULT_D1_CONFIG, ...JSON.parse(raw) } : DEFAULT_D1_CONFIG;
  } catch (e) {
    return DEFAULT_D1_CONFIG;
  }
};

export const saveD1Config = (cfg: CloudflareD1Config) => {
  try {
    localStorage.setItem(D1_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.error('Failed to save D1 config:', e);
  }
};

/**
 * Cloudflare D1 SQL Schema definition
 */
export const D1_SQL_SCHEMA = `-- ===================================================
-- Cloudflare D1 Database Schema for Land Portfolio
-- Database: land-portfolio-db
-- ===================================================

CREATE TABLE IF NOT EXISTS portfolio_settings (
  id TEXT PRIMARY KEY,
  owner_name TEXT NOT NULL,
  portfolio_title TEXT NOT NULL,
  default_commission_rate REAL DEFAULT 3.0,
  default_tax_rate REAL DEFAULT 2.0,
  currency TEXT DEFAULT 'บาท',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS land_plots (
  id TEXT PRIMARY KEY,
  order_number INTEGER NOT NULL,
  purchase_date TEXT,
  sale_date TEXT,
  title TEXT NOT NULL,
  land_type TEXT NOT NULL,
  subdistrict TEXT,
  district TEXT,
  province TEXT,
  primary_deed_number TEXT,
  maps_url TEXT,
  latitude REAL,
  longitude REAL,
  rai INTEGER DEFAULT 0,
  ngan INTEGER DEFAULT 0,
  sq_wah REAL DEFAULT 0,
  total_rai REAL DEFAULT 0,
  total_sq_wah REAL DEFAULT 0,
  price_per_rai REAL DEFAULT 0,
  price_per_sq_wah REAL DEFAULT 0,
  purchase_price REAL DEFAULT 0,
  tax_and_fees REAL DEFAULT 0,
  survey_cost REAL DEFAULT 0,
  other_expenses REAL DEFAULT 0,
  total_cost REAL DEFAULT 0,
  target_sale_price REAL DEFAULT 0,
  sold_price REAL DEFAULT 0,
  commission_fee REAL DEFAULT 0,
  net_received REAL DEFAULT 0,
  status TEXT DEFAULT 'holding',
  notes TEXT,
  images_json TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sub_parcels (
  id TEXT PRIMARY KEY,
  plot_id TEXT NOT NULL,
  deed_number TEXT NOT NULL,
  rai INTEGER DEFAULT 0,
  ngan INTEGER DEFAULT 0,
  sq_wah REAL DEFAULT 0,
  total_sq_wah REAL DEFAULT 0,
  maps_url TEXT,
  latitude REAL,
  longitude REAL,
  notes TEXT,
  FOREIGN KEY (plot_id) REFERENCES land_plots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL,
  plots_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_land_plots_province ON land_plots(province);
CREATE INDEX IF NOT EXISTS idx_land_plots_status ON land_plots(status);
CREATE INDEX IF NOT EXISTS idx_sub_parcels_plot_id ON sub_parcels(plot_id);
`;

/**
 * Cloudflare Worker Script (worker.js) for handling API and binding to D1
 */
export const D1_WORKER_CODE = `/**
 * Cloudflare Worker for Land Portfolio API
 * Connects to Cloudflare D1 Database (env.DB)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Optional API Key Verification
    const authHeader = request.headers.get('Authorization');
    if (env.API_TOKEN && authHeader !== \`Bearer \${env.API_TOKEN}\`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Route 1: Health check & info
      if (url.pathname === '/api/health') {
        return new Response(JSON.stringify({ status: 'ok', engine: 'Cloudflare D1', timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Route 2: Get all plots & settings from Cloudflare D1
      if (url.pathname === '/api/plots' && request.method === 'GET') {
        const { results: plots } = await env.DB.prepare('SELECT * FROM land_plots ORDER BY order_number ASC').all();
        const { results: subParcels } = await env.DB.prepare('SELECT * FROM sub_parcels').all();
        const settings = await env.DB.prepare('SELECT * FROM portfolio_settings LIMIT 1').first();

        // Merge sub-parcels into plots
        const fullPlots = plots.map(p => {
          const sps = subParcels.filter(sp => sp.plot_id === p.id).map(sp => ({
            id: sp.id,
            deedNumber: sp.deed_number,
            rai: sp.rai,
            ngan: sp.ngan,
            sqWah: sp.sq_wah,
            totalSqWah: sp.total_sq_wah,
            mapsUrl: sp.maps_url,
            latitude: sp.latitude,
            longitude: sp.longitude,
            notes: sp.notes,
          }));

          return {
            id: p.id,
            orderNumber: p.order_number,
            purchaseDate: p.purchase_date,
            saleDate: p.sale_date,
            title: p.title,
            landType: p.land_type,
            subdistrict: p.subdistrict,
            district: p.district,
            province: p.province,
            primaryDeedNumber: p.primary_deed_number,
            mapsUrl: p.maps_url,
            latitude: p.latitude,
            longitude: p.longitude,
            rai: p.rai,
            ngan: p.ngan,
            sqWah: p.sq_wah,
            totalRai: p.total_rai,
            totalSqWah: p.total_sq_wah,
            pricePerRai: p.price_per_rai,
            pricePerSqWah: p.price_per_sq_wah,
            purchasePrice: p.purchase_price,
            taxAndFees: p.tax_and_fees,
            surveyCost: p.survey_cost,
            otherExpenses: p.other_expenses,
            totalCost: p.total_cost,
            targetSalePrice: p.target_sale_price,
            soldPrice: p.sold_price,
            commissionFee: p.commission_fee,
            netReceived: p.net_received,
            status: p.status,
            notes: p.notes,
            images: p.images_json ? JSON.parse(p.images_json) : [],
            subParcels: sps,
            updatedAt: p.updated_at,
          };
        });

        return new Response(JSON.stringify({ plots: fullPlots, settings }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Route 3: Batch Sync / Upsert into Cloudflare D1
      if (url.pathname === '/api/plots/sync' && request.method === 'POST') {
        const body = await request.json();
        const { plots, settings } = body;

        const statements = [];

        // Save settings
        if (settings) {
          statements.push(
            env.DB.prepare(\`
              INSERT INTO portfolio_settings (id, owner_name, portfolio_title, default_commission_rate, default_tax_rate, currency)
              VALUES ('default', ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                owner_name = excluded.owner_name,
                portfolio_title = excluded.portfolio_title,
                default_commission_rate = excluded.default_commission_rate,
                default_tax_rate = excluded.default_tax_rate,
                currency = excluded.currency,
                updated_at = CURRENT_TIMESTAMP
            \`).bind(
              settings.ownerName || 'อภิวัชร์',
              settings.portfolioTitle || 'รายละเอียดการซื้อที่ดิน',
              settings.defaultCommissionRate || 3.0,
              settings.defaultTaxRate || 2.0,
              settings.currency || 'บาท'
            )
          );
        }

        // Clear existing sub-parcels to re-insert
        statements.push(env.DB.prepare('DELETE FROM sub_parcels'));

        // Upsert all plots
        for (const p of plots) {
          statements.push(
            env.DB.prepare(\`
              INSERT INTO land_plots (
                id, order_number, purchase_date, sale_date, title, land_type,
                subdistrict, district, province, primary_deed_number, maps_url,
                latitude, longitude, rai, ngan, sq_wah, total_rai, total_sq_wah,
                price_per_rai, price_per_sq_wah, purchase_price, tax_and_fees,
                survey_cost, other_expenses, total_cost, target_sale_price,
                sold_price, commission_fee, net_received, status, notes, images_json, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(id) DO UPDATE SET
                order_number = excluded.order_number,
                purchase_date = excluded.purchase_date,
                sale_date = excluded.sale_date,
                title = excluded.title,
                land_type = excluded.land_type,
                subdistrict = excluded.subdistrict,
                district = excluded.district,
                province = excluded.province,
                primary_deed_number = excluded.primary_deed_number,
                maps_url = excluded.maps_url,
                latitude = excluded.latitude,
                longitude = excluded.longitude,
                rai = excluded.rai,
                ngan = excluded.ngan,
                sq_wah = excluded.sq_wah,
                total_rai = excluded.total_rai,
                total_sq_wah = excluded.total_sq_wah,
                price_per_rai = excluded.price_per_rai,
                price_per_sq_wah = excluded.price_per_sq_wah,
                purchase_price = excluded.purchase_price,
                tax_and_fees = excluded.tax_and_fees,
                survey_cost = excluded.survey_cost,
                other_expenses = excluded.other_expenses,
                total_cost = excluded.total_cost,
                target_sale_price = excluded.target_sale_price,
                sold_price = excluded.sold_price,
                commission_fee = excluded.commission_fee,
                net_received = excluded.net_received,
                status = excluded.status,
                notes = excluded.notes,
                images_json = excluded.images_json,
                updated_at = CURRENT_TIMESTAMP
            \`).bind(
              p.id,
              p.orderNumber,
              p.purchaseDate || '',
              p.saleDate || '',
              p.title,
              p.landType,
              p.subdistrict || '',
              p.district || '',
              p.province || '',
              p.primaryDeedNumber || '',
              p.mapsUrl || '',
              p.latitude || null,
              p.longitude || null,
              p.rai || 0,
              p.ngan || 0,
              p.sqWah || 0,
              p.totalRai || 0,
              p.totalSqWah || 0,
              p.pricePerRai || 0,
              p.pricePerSqWah || 0,
              p.purchasePrice || 0,
              p.taxAndFees || 0,
              p.surveyCost || 0,
              p.otherExpenses || 0,
              p.totalCost || 0,
              p.targetSalePrice || 0,
              p.soldPrice || 0,
              p.commissionFee || 0,
              p.netReceived || 0,
              p.status || 'holding',
              p.notes || '',
              p.images ? JSON.stringify(p.images) : null
            )
          );

          // Sub-parcels
          if (p.subParcels && p.subParcels.length > 0) {
            for (const sp of p.subParcels) {
              statements.push(
                env.DB.prepare(\`
                  INSERT INTO sub_parcels (
                    id, plot_id, deed_number, rai, ngan, sq_wah, total_sq_wah, maps_url, latitude, longitude, notes
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                \`).bind(
                  sp.id,
                  p.id,
                  sp.deedNumber,
                  sp.rai || 0,
                  sp.ngan || 0,
                  sp.sqWah || 0,
                  sp.totalSqWah || 0,
                  sp.mapsUrl || '',
                  sp.latitude || null,
                  sp.longitude || null,
                  sp.notes || ''
                )
              );
            }
          }
        }

        // Add sync log
        statements.push(
          env.DB.prepare(\`
            INSERT INTO sync_logs (sync_type, plots_count, status, details)
            VALUES ('sync_full', ?, 'success', 'Synced from Web App Client')
          \`).bind(plots.length)
        );

        // Execute batch transaction in D1
        await env.DB.batch(statements);

        return new Response(JSON.stringify({ success: true, message: \`Successfully synced \${plots.length} plots to Cloudflare D1\`, timestamp: new Date().toISOString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
`;

/**
 * Cloudflare Wrangler configuration (wrangler.toml)
 */
export const D1_WRANGLER_TOML = `name = "land-portfolio-api"
main = "worker.js"
compatibility_date = "2024-04-01"

# Cloudflare D1 Database Binding
[[d1_databases]]
binding = "DB"
database_name = "land-portfolio-db"
database_id = "<YOUR_D1_DATABASE_ID_FROM_WRANGLER>"

# Optional API Token for securing endpoints
[vars]
API_TOKEN = "your-secret-api-token"
`;

/**
 * Synchronize plots with Cloudflare D1 via Worker API (or local D1 simulator if URL is not configured)
 */
export const syncWithCloudflareD1 = async (
  config: CloudflareD1Config,
  plots: LandPlot[],
  settings: PortfolioSettings
): Promise<{ success: boolean; mode: 'remote' | 'simulated'; message: string; timestamp: string }> => {
  const timestamp = new Date().toLocaleString('th-TH');

  if (config.workerUrl && config.workerUrl.trim().startsWith('http')) {
    // Real Cloudflare Worker call
    const res = await fetch(`${config.workerUrl.trim().replace(/\/$/, '')}/api/plots/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken.trim()}` } : {}),
      },
      body: JSON.stringify({ plots, settings }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Cloudflare Worker Error: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      success: true,
      mode: 'remote',
      message: data.message || `ซิงค์เข้า Cloudflare D1 เรียบร้อย (${plots.length} แปลง)`,
      timestamp,
    };
  } else {
    // Local Simulated D1 Database (Persistent in browser)
    // Strip heavy base64 data URLs in simulated D1 to prevent browser Storage quota exceeded errors
    const sanitizedPlots = plots.map((p) => {
      if (!p.images || p.images.length === 0) return p;
      return {
        ...p,
        images: p.images.map((img) => ({
          ...img,
          // Strip large base64 strings in duplicate simulation store to conserve 5MB localStorage quota
          url: img.url && img.url.length > 500 && img.url.startsWith('data:')
            ? `[image_ref_${img.id}]`
            : img.url,
        })),
      };
    });

    const simulatedD1 = {
      databaseName: config.databaseName || 'land-portfolio-db',
      syncedAt: new Date().toISOString(),
      plots: sanitizedPlots,
      settings,
      tables: ['portfolio_settings', 'land_plots', 'sub_parcels', 'sync_logs'],
      recordsCount: plots.length,
    };

    inMemoryD1Db = simulatedD1;

    try {
      localStorage.setItem(D1_SIMULATED_DB_KEY, JSON.stringify(simulatedD1));
    } catch (storageErr) {
      console.warn('localStorage quota exceeded for D1 simulator, using sessionStorage/in-memory fallback:', storageErr);
      try {
        // Try clearing previous corrupted or oversized key first
        localStorage.removeItem(D1_SIMULATED_DB_KEY);
      } catch (cleanErr) {}

      try {
        sessionStorage.setItem(D1_SIMULATED_DB_KEY, JSON.stringify(simulatedD1));
      } catch (sessionErr) {
        // In-memory fallback is already set above
      }
    }

    return {
      success: true,
      mode: 'simulated',
      message: `บันทึกข้อมูลเข้า Cloudflare D1 Simulator เรียบร้อย (${plots.length} แปลง) - พร้อมเชื่อม Worker จริงเมื่อกรอก URL`,
      timestamp,
    };
  }
};

/**
 * Pull plots from Cloudflare D1 (remote worker or local simulator)
 */
export const fetchFromCloudflareD1 = async (
  config: CloudflareD1Config
): Promise<{ plots: LandPlot[]; settings?: PortfolioSettings; mode: 'remote' | 'simulated' } | null> => {
  if (config.workerUrl && config.workerUrl.trim().startsWith('http')) {
    const res = await fetch(`${config.workerUrl.trim().replace(/\/$/, '')}/api/plots`, {
      headers: {
        ...(config.apiToken ? { Authorization: `Bearer ${config.apiToken.trim()}` } : {}),
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to load from Cloudflare Worker: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      plots: data.plots || [],
      settings: data.settings,
      mode: 'remote',
    };
  } else {
    // Read from simulated D1 (checking localStorage, then sessionStorage, then in-memory)
    try {
      const raw = localStorage.getItem(D1_SIMULATED_DB_KEY) || sessionStorage.getItem(D1_SIMULATED_DB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          plots: parsed.plots || [],
          settings: parsed.settings,
          mode: 'simulated',
        };
      }
    } catch (e) {
      console.warn('Error reading simulated D1 from storage, falling back to memory:', e);
    }

    if (inMemoryD1Db) {
      return {
        plots: inMemoryD1Db.plots || [],
        settings: inMemoryD1Db.settings,
        mode: 'simulated',
      };
    }

    return null;
  }
};

/**
 * Download helper for schema.sql, worker.js, and wrangler.toml
 */
export const downloadCloudflareDeployFiles = () => {
  // Download schema.sql
  const blobSql = new Blob([D1_SQL_SCHEMA], { type: 'text/plain;charset=utf-8;' });
  const urlSql = URL.createObjectURL(blobSql);
  const aSql = document.createElement('a');
  aSql.href = urlSql;
  aSql.download = 'schema.sql';
  aSql.click();

  // Download worker.js
  setTimeout(() => {
    const blobWorker = new Blob([D1_WORKER_CODE], { type: 'application/javascript;charset=utf-8;' });
    const urlWorker = URL.createObjectURL(blobWorker);
    const aWorker = document.createElement('a');
    aWorker.href = urlWorker;
    aWorker.download = 'worker.js';
    aWorker.click();
  }, 400);

  // Download wrangler.toml
  setTimeout(() => {
    const blobToml = new Blob([D1_WRANGLER_TOML], { type: 'text/plain;charset=utf-8;' });
    const urlToml = URL.createObjectURL(blobToml);
    const aToml = document.createElement('a');
    aToml.href = urlToml;
    aToml.download = 'wrangler.toml';
    aToml.click();
  }, 800);
};
