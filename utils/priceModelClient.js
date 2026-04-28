const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const readline = require('readline');

const DEFAULT_TIMEOUT_MS = Number(process.env.PRICE_MODEL_TIMEOUT_MS || 15000);

const buildRequestId = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `pm-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

class PriceModelClient {
    constructor() {
        this.proc = null;
        this.rl = null;
        this.pending = new Map();
        this.startCount = 0;
    }

    isRunning() {
        return Boolean(this.proc && this.proc.exitCode === null && !this.proc.killed);
    }

    ensureProcess() {
        if (this.isRunning()) return;
        this.startProcess();
    }

    startProcess() {
        this.startCount += 1;

        const pythonBin = process.env.PRICE_MODEL_PYTHON || process.env.PYTHON_BIN || 'python';
        const workerPath =
            process.env.PRICE_MODEL_WORKER_PATH ||
            path.join(__dirname, '..', 'ml', 'price_model_worker.py');
        const modelPath =
            process.env.PRICE_MODEL_PATH || path.join(__dirname, '..', 'models', 'price_model.pkl');

        const proc = spawn(pythonBin, ['-u', workerPath, '--model-path', modelPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PYTHONIOENCODING: 'utf-8'
            }
        });

        this.proc = proc;

        this.rl = readline.createInterface({ input: proc.stdout });
        this.rl.on('line', (line) => this.handleLine(line));

        proc.stderr.on('data', (chunk) => {
            const text = chunk.toString('utf8').trim();
            if (!text) return;
            console.warn('[PriceModel]', text);
        });

        proc.on('exit', (code, signal) => {
            const reason = `worker exited (code=${code}, signal=${signal})`;
            this.cleanup(reason);
        });

        proc.on('error', (err) => {
            const reason = `worker error: ${err?.message || err}`;
            this.cleanup(reason);
        });
    }

    cleanup(reason) {
        if (this.rl) {
            try {
                this.rl.removeAllListeners();
                this.rl.close();
            } catch (_) {
                // ignore
            }
            this.rl = null;
        }

        if (this.proc) {
            try {
                this.proc.removeAllListeners();
            } catch (_) {
                // ignore
            }
            this.proc = null;
        }

        const error = new Error(`Price model ${reason}`);
        for (const [id, pending] of this.pending.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(error);
            this.pending.delete(id);
        }
    }

    handleLine(line) {
        const raw = (line || '').trim();
        if (!raw) return;

        let msg;
        try {
            msg = JSON.parse(raw);
        } catch (err) {
            console.warn('[PriceModel] invalid JSON from worker:', raw.slice(0, 200));
            return;
        }

        const id = msg?.id;
        if (!id) {
            if (msg?.ok === false && msg?.error) {
                console.warn('[PriceModel] worker error:', msg.error);
            }
            return;
        }

        const pending = this.pending.get(id);
        if (!pending) return;

        clearTimeout(pending.timeout);
        this.pending.delete(id);

        if (msg.ok) {
            pending.resolve(msg.predicted_price);
            return;
        }

        pending.reject(new Error(msg.error || 'Price model prediction failed'));
    }

    async predict(features, { timeoutMs } = {}) {
        this.ensureProcess();

        if (!this.proc || !this.proc.stdin) {
            throw new Error('Price model worker unavailable');
        }

        const id = buildRequestId();
        const payload = { id, features };

        const effectiveTimeoutMs =
            Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`Price model timeout after ${effectiveTimeoutMs}ms`));
            }, effectiveTimeoutMs);

            this.pending.set(id, { resolve, reject, timeout });

            try {
                this.proc.stdin.write(`${JSON.stringify(payload)}\n`);
            } catch (err) {
                clearTimeout(timeout);
                this.pending.delete(id);
                reject(err);
            }
        });
    }
}

let singleton;
const getPriceModelClient = () => {
    if (!singleton) singleton = new PriceModelClient();
    return singleton;
};

module.exports = { getPriceModelClient };
