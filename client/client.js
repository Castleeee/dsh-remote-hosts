window.__ModuleLoader__.load({id:"dsh-remote-hosts",factory:(require)=>{const module={exports:{}};const exports=module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/entry.js
var entry_exports = {};
__export(entry_exports, {
  default: () => entry_default
});
module.exports = __toCommonJS(entry_exports);

// node_modules/@deepseek-ai/dsh-util-crypto/lib/index.js
function randomUUID() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte, index) => {
    return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
  }).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// node_modules/@deepseek-ai/dsh-brand/lib/index.js
function brandNumber(value) {
  return value;
}

// node_modules/@deepseek-ai/dsh-session/lib/types/types.js
function SessionSeq(value) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
  }
  return brandNumber(value);
}
function SessionLogOffset(value) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionLogOffset must be a non-negative safe integer, got ${String(value)}`);
  }
  return brandNumber(value);
}

// node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
var import_cordis = require("@deepseek-ai/cordis");
var RemoteError = class extends Error {
  code;
  details;
  /** Structural marker: cross-realm/bundle identification never uses instanceof. */
  isDSHRemoteError = true;
  /**
  * @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
  * @param message - human diagnostic carried across the wire.
  * @param details - structured payload typed by the code.
  * @param options - standard Error options (`cause` survives in-process only).
  */
  constructor(code, message, details, options) {
    super(message, options);
    this.code = code;
    this.details = details;
    this.name = "RemoteError";
  }
};
function remoteErrorOf(value) {
  if (typeof value === "object" && value !== null && value.isDSHRemoteError === true && typeof value.code === "string") return value;
}
function isRemoteJsonValue(value) {
  return visitJsonValue(value, /* @__PURE__ */ new Set());
}
function visitJsonValue(value, ancestors) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
      for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index) || !visitJsonValue(value[index], ancestors)) return false;
      return true;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return false;
      if (Object.getOwnPropertyDescriptor(value, key)?.enumerable !== true || !visitJsonValue(Reflect.get(value, key), ancestors)) return false;
    }
    return true;
  } finally {
    ancestors.delete(value);
  }
}

// node_modules/@deepseek-ai/dsh-api-gateway/lib/types/client/index.js
var import_cordis2 = require("@deepseek-ai/cordis");

// node_modules/@deepseek-ai/dsh-api-gateway/lib/types/stream-protocol.js
var REMOTE_STREAM_MUX_PATH = "/api/remote.mux";
function projectRemoteEventRejection(reason) {
  const record = typeof reason === "object" && reason !== null ? reason : void 0;
  const name = stringProperty(record, "name") ?? "Error";
  const message = stringProperty(record, "message") ?? String(reason);
  const code = stringProperty(record, "code");
  const details = record === void 0 ? void 0 : Reflect.get(record, "details");
  return {
    name,
    message,
    ...code === void 0 ? {} : { code },
    ...details === void 0 || !isRemoteJsonValue(details) ? {} : { details }
  };
}
function parseRemoteStreamServerMessage(text) {
  return parseMessage(text, (value) => {
    if (value.type === "item" && (exactKeys(value, ["type", "streamId"]) || exactKeys(value, ["type", "streamId", "value"])) && validId(value.streamId)) {
      return value;
    }
    if (value.type === "end" && exactKeys(value, ["type", "streamId"]) && validId(value.streamId)) {
      return value;
    }
    if (value.type === "error" && exactKeys(value, ["type", "streamId", "error"]) && validId(value.streamId) && isRecord(value.error) && exactKeys(value.error, ["code", "message", "details"]) && typeof value.error.code === "string" && typeof value.error.message === "string" && isRecord(value.error.details)) {
      return value;
    }
    throw new Error("api gateway: invalid Remote stream server message");
  });
}
function parseMessage(text, validate) {
  let decoded;
  try {
    decoded = JSON.parse(text);
  } catch (cause) {
    throw new Error("api gateway: Remote stream message is not JSON", { cause });
  }
  if (!isRecord(decoded))
    throw new Error("api gateway: Remote stream message must be an object");
  return validate(decoded);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactKeys(value, expected) {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}
function validId(value) {
  return typeof value === "string" && value.length > 0;
}
function stringProperty(value, key) {
  if (value === void 0)
    return void 0;
  const candidate = Reflect.get(value, key);
  return typeof candidate === "string" ? candidate : void 0;
}

// node_modules/@deepseek-ai/dsh-deque/lib/index.js
var MIN_CAPACITY = 16;
var Deque = class {
  buffer = new Array(MIN_CAPACITY);
  head = 0;
  count = 0;
  /** Number of entries available to remove. */
  get size() {
    return this.count;
  }
  /**
  * Append one entry after the current tail.
  * @param value - entry to append.
  */
  pushBack(value) {
    this.ensureCapacity();
    const tail = this.head + this.count;
    this.buffer[tail < this.buffer.length ? tail : tail - this.buffer.length] = value;
    this.count += 1;
  }
  /**
  * Insert one entry before the current head.
  * @param value - entry to prepend.
  */
  pushFront(value) {
    this.ensureCapacity();
    this.head = this.head === 0 ? this.buffer.length - 1 : this.head - 1;
    this.buffer[this.head] = value;
    this.count += 1;
  }
  /**
  * Remove the current head entry and clear its retained reference.
  * Callers whose element type includes `undefined` use {@link size} to
  * distinguish an empty deque from an `undefined` entry.
  * @returns the removed entry, or `undefined` when the deque is empty.
  */
  popFront() {
    if (this.count === 0) return void 0;
    const value = this.buffer[this.head];
    this.buffer[this.head] = void 0;
    this.head += 1;
    if (this.head === this.buffer.length) this.head = 0;
    this.count -= 1;
    this.compact();
    return value;
  }
  /** Drop every entry and release the current backing storage. */
  clear() {
    this.buffer = new Array(MIN_CAPACITY);
    this.head = 0;
    this.count = 0;
  }
  ensureCapacity() {
    if (this.count < this.buffer.length) return;
    this.resize(this.buffer.length * 2);
  }
  compact() {
    if (this.count === 0) {
      this.head = 0;
      return;
    }
    if (this.buffer.length > MIN_CAPACITY && this.count <= this.buffer.length / 4) this.resize(Math.max(MIN_CAPACITY, this.buffer.length / 2));
  }
  resize(capacity) {
    const next = new Array(capacity);
    let source = this.head;
    for (let index = 0; index < this.count; index += 1) {
      next[index] = this.buffer[source];
      source += 1;
      if (source === this.buffer.length) source = 0;
    }
    this.buffer = next;
    this.head = 0;
  }
};

// node_modules/@deepseek-ai/dsh-api-gateway/lib/types/client/stream-client.js
var RemoteStreamCarrierError = class extends Error {
  /**
   * @param message - physical carrier failure description.
   * @param options - optional causal error.
   */
  constructor(message, options) {
    super(message, options);
    this.name = "RemoteStreamCarrierError";
  }
};
var UPLINK_DONE = { value: void 0, done: true };
var RemoteStreamMuxClient = class {
  openSocket;
  waitForReconnect;
  socket;
  cancelCandidate;
  keepAlive;
  revision = 0;
  streams = /* @__PURE__ */ new Map();
  waiters = /* @__PURE__ */ new Set();
  socketClosures = /* @__PURE__ */ new Set();
  running = false;
  disposed = false;
  failure;
  /**
   * @param openSocket - selected authenticated carrier; omission uses the browser socket.
   * @param waitForReconnect - answering Clients wait for Connection to replace a lost socket; passive Clients fail later opens immediately.
   */
  constructor(openSocket = () => new WebSocket(remoteStreamUrl()), waitForReconnect = false) {
    this.openSocket = openSocket;
    this.waitForReconnect = waitForReconnect;
  }
  /** Ensure a physical attempt exists, following the current attempt once if needed. */
  start() {
    if (this.disposed)
      return;
    this.running = true;
    if (this.socket?.readyState === 1)
      return;
    const pending = this.keepAlive;
    if (pending === void 0)
      this.maintain();
    else
      void pending.then(() => {
        this.maintain();
      });
  }
  /** Cancel the current socket or retry wait and start a fresh attempt immediately. */
  reconnect() {
    if (!this.running || this.disposed)
      return;
    const failure = new RemoteStreamCarrierError("api gateway: Remote stream reconnect requested");
    const pending = this.keepAlive;
    this.revision++;
    this.failure = void 0;
    this.cancelCandidate?.(failure);
    const socket = this.socket;
    if (socket !== void 0) {
      this.socket = void 0;
      this.failAll(failure);
      socket.close(4e3, "reconnect requested");
    }
    if (pending === void 0)
      this.maintain();
    else
      void pending.then(() => {
        this.maintain();
      });
  }
  /**
   * Open one logical stream on the persistent physical connection.
   * After an established socket is lost, answering Clients wait for Connection
   * to reconnect or for their signal to abort; passive Clients reject immediately.
   * An initial socket failure rejects both modes.
   * @param endpoint - Typert Remote stream endpoint.
   * @param payload - endpoint request encoded on the wire.
   * @param signal - cancellation for this logical stream.
   * @param uplink - the Client's items: each is sent as an `item` frame, its end as `end`; its `return()`
   * runs when the stream finishes, and its failure cancels the stream and fails the downlink.
   * @returns Host items until completion, cancellation, or failure.
   */
  async *open(endpoint, payload, signal, uplink) {
    signal.throwIfAborted();
    const streamId = randomUUID();
    const inbox = new StreamInbox();
    const stream = { inbox, pump: void 0 };
    let carrier;
    let opened = false;
    let terminal = false;
    const abort = () => {
      inbox.fail(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      const socket = await this.waitForSocket(signal);
      signal.throwIfAborted();
      carrier = socket;
      this.streams.set(streamId, stream);
      this.send(socket, { type: "open", streamId, endpoint, payload });
      opened = true;
      if (uplink !== void 0)
        stream.pump = this.pumpUplink(socket, streamId, uplink, signal, inbox);
      while (true) {
        const frame = await inbox.next();
        signal.throwIfAborted();
        if (frame.type === "item") {
          yield frame.value;
          continue;
        }
        terminal = true;
        if (frame.type === "error") {
          throw new RemoteError(frame.error.code, frame.error.message, frame.error.details);
        }
        return;
      }
    } finally {
      signal.removeEventListener("abort", abort);
      this.streams.delete(streamId);
      stream.pump?.stop();
      if (opened && !terminal && carrier?.readyState === 1) {
        this.send(carrier, { type: "cancel", streamId });
      }
      if (stream.pump !== void 0)
        await stream.pump.done;
    }
  }
  /**
   * Send the caller's uplink items on this generation's socket. `stop()`
   * interrupts a pump blocked on `uplink.next()` and releases the iterator: a
   * handle's queue closes at once, so `send()` throws from then on, and any
   * other iterator's `return()` is invoked without being awaited because a
   * generator blocked in `next()` only completes it once it yields.
   */
  pumpUplink(socket, streamId, uplink, signal, inbox) {
    let stopped;
    const interruption = { value: void 0, done: true };
    const uplinkIterator = uplink[Symbol.asyncIterator]();
    const state = { stopping: false, exhausted: false, released: false };
    const release = () => {
      if (state.released || state.exhausted)
        return;
      state.released = true;
      if (uplink instanceof ClientUplinkQueue)
        uplink.close();
      void Promise.resolve().then(() => uplinkIterator.return?.()).catch(() => void 0);
    };
    const done = (async () => {
      try {
        while (true) {
          const stoppingBeforeRead = state.stopping;
          if (stoppingBeforeRead)
            return;
          stopped = Promise.withResolvers();
          const next = await Promise.race([uplinkIterator.next(), stopped.promise]);
          stopped = void 0;
          if (state.stopping || next === interruption || signal.aborted || this.socket !== socket)
            return;
          if (next.done === true) {
            state.exhausted = true;
            break;
          }
          this.send(socket, { type: "item", streamId, value: next.value });
        }
        this.send(socket, { type: "end", streamId });
      } catch (error) {
        inbox.fail(error);
      } finally {
        stopped = void 0;
        release();
      }
    })();
    return {
      done,
      stop: () => {
        if (state.stopping)
          return;
        state.stopping = true;
        stopped?.resolve(interruption);
        release();
      }
    };
  }
  /**
   * Permanently stop the carrier, close the physical socket, and fail every
   * active logical stream.
   * @returns once the connection attempt and every physical socket have closed.
   */
  async close() {
    if (!this.disposed) {
      this.disposed = true;
      this.running = false;
      const error = new Error("api gateway: Remote stream client disposed");
      this.failAll(error);
      for (const waiter of [...this.waiters])
        waiter.reject(error);
      this.cancelCandidate?.(error);
      const socket = this.socket;
      this.socket = void 0;
      socket?.close(1e3, "disposed");
    }
    await this.keepAlive;
    await Promise.all(this.socketClosures);
  }
  async connect() {
    const socket = this.openSocket(REMOTE_STREAM_MUX_PATH);
    const closed = new Promise((resolve) => {
      socket.addEventListener("close", () => {
        resolve();
      }, { once: true });
    });
    this.socketClosures.add(closed);
    void closed.then(() => {
      this.socketClosures.delete(closed);
    });
    const connecting = new Promise((resolve, reject) => {
      let settled = false;
      const rejectCandidate = (error) => {
        settled = true;
        socket.removeEventListener("open", opened);
        socket.removeEventListener("message", received);
        this.cancelCandidate = void 0;
        if (socket.readyState < 2)
          socket.close();
        reject(error);
      };
      const opened = () => {
        settled = true;
        this.cancelCandidate = void 0;
        this.socket = socket;
        for (const waiter of [...this.waiters])
          waiter.resolve(socket);
        resolve(socket);
      };
      const failed = () => {
        if (!settled) {
          rejectCandidate(new RemoteStreamCarrierError("api gateway: Remote stream WebSocket failed to open"));
          return;
        }
        const error = new RemoteStreamCarrierError("api gateway: Remote stream WebSocket failed");
        this.lost(socket, error);
        if (socket.readyState < 2)
          socket.close();
      };
      const closed2 = () => {
        socket.removeEventListener("open", opened);
        socket.removeEventListener("error", failed);
        socket.removeEventListener("message", received);
        if (!settled) {
          rejectCandidate(new RemoteStreamCarrierError("api gateway: Remote stream WebSocket closed before opening"));
          return;
        }
        this.lost(socket);
      };
      const received = (event) => {
        this.receive(socket, event.data);
      };
      this.cancelCandidate = rejectCandidate;
      socket.addEventListener("open", opened, { once: true });
      socket.addEventListener("error", failed);
      socket.addEventListener("message", received);
      socket.addEventListener("close", closed2, { once: true });
    });
    return connecting;
  }
  waitForSocket(signal) {
    signal.throwIfAborted();
    if (this.socket?.readyState === 1)
      return Promise.resolve(this.socket);
    if (this.disposed)
      return Promise.reject(new Error("api gateway: Remote stream client disposed"));
    if (!this.running)
      return Promise.reject(new Error("api gateway: Remote stream client not started"));
    if (this.failure !== void 0)
      return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      const aborted = () => {
        waiter.reject(signal.reason);
      };
      const cleanup = () => {
        this.waiters.delete(waiter);
        signal.removeEventListener("abort", aborted);
      };
      const waiter = {
        revision: this.revision,
        resolve: (socket) => {
          cleanup();
          resolve(socket);
        },
        reject: (error) => {
          cleanup();
          reject(error);
        }
      };
      this.waiters.add(waiter);
      signal.addEventListener("abort", aborted, { once: true });
    });
  }
  receive(socket, data) {
    if (socket !== this.socket)
      return;
    try {
      if (typeof data !== "string")
        throw new Error("api gateway: Remote stream WebSocket requires text messages");
      const frame = parseRemoteStreamServerMessage(data);
      const stream = this.streams.get(frame.streamId);
      if (stream === void 0)
        return;
      stream.inbox.push(frame);
      if (frame.type !== "item")
        stream.pump?.stop();
    } catch (error) {
      const failure = new RemoteStreamCarrierError("api gateway: invalid Remote stream frame", { cause: error });
      this.failAll(failure);
      this.lost(socket, failure);
      socket.close(4002, "invalid Remote stream frame");
    }
  }
  lost(socket, error = new RemoteStreamCarrierError("api gateway: Remote stream WebSocket closed")) {
    if (this.socket !== socket)
      return;
    this.socket = void 0;
    if (!this.waitForReconnect)
      this.failure = error;
    this.failAll(error);
    if (!this.waitForReconnect) {
      for (const waiter of [...this.waiters])
        waiter.reject(error);
    }
  }
  maintain() {
    if (!this.running || this.disposed)
      return;
    if (this.socket?.readyState === 1 || this.keepAlive !== void 0)
      return;
    const revision = this.revision;
    this.failure = void 0;
    const task = this.connect().then(() => void 0, (error) => {
      if (!this.running)
        return;
      const failure = error instanceof RemoteStreamCarrierError ? error : new RemoteStreamCarrierError("api gateway: Remote stream WebSocket failed to open", { cause: error });
      if (this.revision === revision)
        this.failure = failure;
      for (const waiter of [...this.waiters]) {
        if (waiter.revision <= revision)
          waiter.reject(failure);
      }
    });
    this.keepAlive = task;
    void task.then(() => {
      this.keepAlive = void 0;
    });
  }
  failAll(error) {
    for (const stream of this.streams.values()) {
      stream.inbox.fail(error);
      stream.pump?.stop();
    }
  }
  send(socket, message) {
    socket.send(JSON.stringify(message));
  }
};
var StreamInbox = class {
  frames = new Deque();
  wake;
  failure;
  push(frame) {
    if (this.failure !== void 0)
      return;
    this.frames.pushBack(frame);
    this.wake?.();
    this.wake = void 0;
  }
  fail(error) {
    if (this.failure !== void 0)
      return;
    this.failure = error instanceof Error ? error : new Error(String(error), { cause: error });
    this.frames.clear();
    this.wake?.();
    this.wake = void 0;
  }
  async next() {
    while (this.frames.size === 0) {
      if (this.failure !== void 0)
        throw this.failure;
      await new Promise((resolve) => {
        this.wake = resolve;
      });
    }
    return this.frames.popFront();
  }
};
var ClientUplinkQueue = class {
  endpoint;
  items = new Deque();
  ended = false;
  closed = false;
  wake;
  /** @param endpoint - canonical Remote endpoint named by failures. */
  constructor(endpoint) {
    this.endpoint = endpoint;
  }
  /**
   * Queue one item for the carrier.
   * @param item - item the Host validates against the method's uplink codec.
   * @throws {Error} after `end()` or once the stream has terminated.
   */
  push(item) {
    if (this.closed)
      throw new Error(`client api: ${this.endpoint} stream has terminated`);
    if (this.ended)
      throw new Error(`client api: ${this.endpoint} uplink was ended`);
    this.items.pushBack(item);
    this.signal();
  }
  /** Half-close: the carrier reads the queued items, then `end`. Idempotent; ignored after termination. */
  end() {
    if (this.ended || this.closed)
      return;
    this.ended = true;
    this.signal();
  }
  /** The carrier stopped reading: the logical stream terminated or was disposed. Idempotent. */
  close() {
    if (this.closed)
      return;
    this.closed = true;
    this.items.clear();
    this.signal();
  }
  [Symbol.asyncIterator]() {
    return this;
  }
  /**
   * Take the next queued item, waiting for one; ends after `end()` or `close()`.
   * @returns the next item, or the end of the uplink.
   * @throws {Error} when a read is already pending.
   */
  async next() {
    while (true) {
      if (this.closed)
        return UPLINK_DONE;
      if (this.items.size > 0)
        return { value: this.items.popFront(), done: false };
      if (this.ended)
        return UPLINK_DONE;
      if (this.wake !== void 0)
        throw new Error(`client api: ${this.endpoint} uplink has one pending read`);
      await new Promise((resolve) => {
        this.wake = resolve;
      });
    }
  }
  /**
   * The carrier is done with the uplink: close it.
   * @returns the end of the uplink.
   */
  return() {
    this.close();
    return Promise.resolve(UPLINK_DONE);
  }
  signal() {
    const wake = this.wake;
    this.wake = void 0;
    wake?.();
  }
};
function remoteStreamUrl() {
  const globals = globalThis;
  const url = new URL(REMOTE_STREAM_MUX_PATH.slice(1), globals.__DSH_TRANSPORT__?.streamBaseUrl ?? document.baseURI);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.href;
}

// node_modules/@deepseek-ai/dsh-api-gateway/lib/types/client/remote-stream.js
var RemoteStream = class {
  connection;
  options;
  lifetime = new AbortController();
  generationAbort;
  iterator;
  closing;
  revision = 0;
  taken = false;
  /**
   * @param connection - observable Host generation source used to pace retries.
   * @param options - domain stream opener, end classification, and diagnostics.
   */
  constructor(connection, options) {
    this.connection = connection;
    this.options = options;
  }
  /** Cancellation lifetime shared by the stream and sibling page requests. */
  get signal() {
    return this.lifetime.signal;
  }
  /** Interrupt the current generation and immediately request a replacement. */
  restart() {
    if (this.lifetime.signal.aborted)
      return;
    this.revision++;
    this.generationAbort?.abort(new Error(`${this.options.name} generation restarted`));
  }
  /**
   * Permanently stop this stream and wait for its iterator to close.
   * @returns when the active generation and consumer iterator are quiescent.
   */
  dispose() {
    if (this.closing !== void 0)
      return this.closing;
    if (!this.lifetime.signal.aborted) {
      const reason = new Error(`${this.options.name} disposed`);
      this.lifetime.abort(reason);
      this.generationAbort?.abort(reason);
    }
    const iterator = this.iterator;
    if (iterator === void 0)
      return Promise.resolve();
    const closing = closeRemoteStreamIterator(iterator);
    this.closing = closing;
    return closing;
  }
  /** @inheritdoc */
  [Symbol.asyncIterator]() {
    if (this.taken)
      throw new Error(`${this.options.name} already has a consumer`);
    this.taken = true;
    const iterator = this.read();
    this.iterator = iterator;
    return iterator;
  }
  async *read() {
    let attempt = 0;
    let generation = 0;
    let observedRevision = this.revision;
    try {
      while (!isAborted(this.lifetime.signal)) {
        if (observedRevision !== this.revision) {
          observedRevision = this.revision;
          attempt = 0;
        }
        const revision = this.revision;
        const generationAbort = new AbortController();
        this.generationAbort = generationAbort;
        const signal = AbortSignal.any([this.lifetime.signal, generationAbort.signal]);
        const generationId = ++generation;
        let accepted = false;
        try {
          for await (const value of this.options.open(signal)) {
            if (isAborted(this.lifetime.signal))
              return;
            if (revision !== this.revision)
              break;
            yield {
              generation: generationId,
              value,
              signal,
              accept: () => {
                if (this.generationAbort !== generationAbort || revision !== this.revision)
                  return;
                accepted = true;
                attempt = 0;
              }
            };
          }
          if (isAborted(this.lifetime.signal))
            return;
          if (revision !== this.revision)
            continue;
          throw this.options.ended(accepted);
        } catch (error) {
          if (isAborted(this.lifetime.signal))
            return;
          if (revision !== this.revision)
            continue;
          if (!(error instanceof RemoteStreamCarrierError))
            throw terminalStreamFailure(error);
          this.options.carrierFailed?.(error);
          if (revision !== this.revision)
            continue;
          attempt++;
          try {
            await waitForRemoteStreamRetry(this.connection, error, attempt, signal);
          } catch (retryError) {
            if (isAborted(this.lifetime.signal))
              return;
            if (revision !== this.revision)
              continue;
            throw terminalStreamFailure(retryError);
          }
        } finally {
          this.generationAbort = void 0;
          if (!generationAbort.signal.aborted) {
            generationAbort.abort(new Error(`${this.options.name} generation ended`));
          }
        }
      }
    } finally {
      if (!this.lifetime.signal.aborted) {
        this.lifetime.abort(new Error(`${this.options.name} consumer closed`));
      }
      this.generationAbort?.abort(this.lifetime.signal.reason);
      this.generationAbort = void 0;
    }
  }
};
async function waitForRemoteStreamRetry(connection, error, attempt, signal) {
  signal.throwIfAborted();
  if (connection.generation.getSnapshot() !== void 0) {
    if (attempt === 1)
      return;
    throw error;
  }
  await new Promise((resolve, reject) => {
    const subscription = { finished: false };
    const finish = (failure) => {
      if (subscription.finished)
        return;
      subscription.finished = true;
      subscription.dispose?.();
      signal.removeEventListener("abort", aborted);
      if (failure === void 0)
        resolve();
      else
        reject(failure);
    };
    const inspect = () => {
      if (connection.generation.getSnapshot() !== void 0)
        finish();
    };
    const aborted = () => {
      finish(new Error("Remote stream retry aborted", { cause: signal.reason }));
    };
    const dispose = connection.generation.subscribe(inspect);
    subscription.dispose = dispose;
    if (subscription.finished)
      dispose();
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted)
      aborted();
    else
      inspect();
  });
}
function terminalStreamFailure(error) {
  return remoteErrorOf(error) ?? new RemoteError("gateway/internal", error instanceof Error ? error.message : String(error), {}, { cause: error });
}
function isAborted(signal) {
  return signal.aborted;
}
async function closeRemoteStreamIterator(iterator) {
  try {
    await iterator.return?.();
  } catch {
  }
}

// node_modules/@deepseek-ai/dsh-api-gateway/lib/types/client/journal-stream.js
function protocolViolation(message) {
  return new RemoteError("gateway/internal", message, {});
}
var RemoteJournalStream = class {
  options;
  stream;
  initialRequest;
  resumeCursor;
  hasResumeCursor = false;
  generation = 0;
  firstCursor;
  lastCursor;
  started = false;
  opened = false;
  disposed = false;
  done;
  closing;
  pendingNext;
  /**
   * @param remote - Gateway factory for the reconnecting physical-generation stream.
   * @param options - cursor algebra and domain publication sinks.
   */
  constructor(remote, options) {
    this.options = options;
    this.stream = remote.$stream({
      name: options.name,
      open: (signal) => this.follow(this.initialRequest, signal),
      ended: (accepted) => accepted ? new RemoteStreamCarrierError(`${options.name} ended without a terminal result`) : protocolViolation(`${this.hasResumeCursor ? "resumed " : ""}${options.name} ended before its opening cursor`),
      ...options.carrierFailed === void 0 ? {} : { carrierFailed: options.carrierFailed }
    });
  }
  /** Cancellation lifetime shared by follow and page calls. */
  get signal() {
    return this.stream.signal;
  }
  /**
   * Establish follow and publish the opening snapshot carried by its first frame.
   * @param request - initial tail-page request.
   * @returns after the first complete window is published.
   */
  async open(request) {
    if (this.started)
      throw new Error(`${this.options.name} already opened`);
    this.started = true;
    this.initialRequest = request;
    const iterator = this.stream[Symbol.asyncIterator]();
    try {
      const first = await this.takeNext(iterator);
      if (first.done)
        throw protocolViolation(`${this.options.name} ended before its opening cursor`);
      this.replaceGeneration(first.value, false);
      this.opened = true;
      this.done = this.consume(iterator);
    } catch (error) {
      await this.stream.dispose();
      throw error;
    }
  }
  /**
   * Read and prepend one older page after a successful open.
   * @param request - domain page request bound to this stream's address.
   * @returns after the page is applied or rejected as discontinuous.
   */
  async prepend(request) {
    if (!this.opened || this.disposed)
      throw new Error(`${this.options.name} is not open`);
    const page = await this.readPage(request, this.currentCursor(), this.stream.signal);
    this.stream.signal.throwIfAborted();
    const entries = this.options.entries(page);
    this.assertPage(entries);
    const before = this.firstCursor;
    const accepted = before === void 0 ? [...entries] : entries.filter((entry) => this.options.compare(this.options.first(entry), before) < 0);
    const tail = accepted.at(-1);
    if (tail !== void 0 && before !== void 0 && !this.options.follows(this.options.last(tail), before)) {
      this.options.publish({ type: "prepend", page, entries: [], hasMore: false });
      throw protocolViolation(`${this.options.name} history page is discontinuous`);
    }
    const first = accepted[0];
    if (first !== void 0)
      this.firstCursor = this.options.first(first);
    this.options.publish({
      type: "prepend",
      page,
      entries: accepted,
      hasMore: this.options.hasMore(page)
    });
  }
  /** Replace the active physical generation while retaining the published window. */
  restart() {
    this.stream.restart();
  }
  /**
   * Permanently stop follow, page requests, and the background consumer.
   * @returns when no stream work or publication callback can still run.
   */
  dispose() {
    if (this.closing !== void 0)
      return this.closing;
    this.disposed = true;
    const done = this.done;
    const closing = (async () => {
      await this.stream.dispose();
      await done;
    })();
    this.closing = closing;
    return closing;
  }
  async consume(iterator) {
    try {
      while (true) {
        const next = await this.takeNext(iterator);
        if (next.done)
          return;
        const item = next.value;
        if (item.generation !== this.generation) {
          this.replaceGeneration(item, true);
          continue;
        }
        if (item.value.type === "opened") {
          throw protocolViolation(`${this.options.name} emitted more than one opening cursor`);
        }
        if (item.value.type === "notification") {
          this.publishNotification(item.value.notification);
          continue;
        }
        await this.acceptEntry(item.value.entry, item, iterator);
      }
    } catch (error) {
      if (!this.disposed)
        this.options.failed(error);
    }
  }
  replaceGeneration(initial, resumed) {
    const opening = this.opening(initial, resumed);
    this.replaceFromOpening(opening.page, opening.cursor);
  }
  opening(item, resumed) {
    if (item.value.type !== "opened") {
      throw protocolViolation(`${resumed ? "resumed " : ""}${this.options.name} emitted an entry before its opening cursor`);
    }
    const cursor = item.value.cursor;
    if (resumed && this.lastCursor !== void 0 && this.options.compare(cursor, this.lastCursor) < 0) {
      throw protocolViolation(`${this.options.name} resumed at a cursor behind the last applied entry`);
    }
    this.generation = item.generation;
    item.accept();
    return { cursor, page: item.value.page };
  }
  /** Publish a generation's opening page without issuing a second Remote call. */
  replaceFromOpening(page, cursor) {
    this.assertPageThrough(page, cursor);
    const entries = [...this.options.entries(page)];
    this.assertPage(entries);
    const first = entries[0];
    this.firstCursor = first === void 0 ? void 0 : this.options.first(first);
    this.lastCursor = cursor;
    this.setResumeCursor(cursor);
    this.options.publish({
      type: "replace",
      page,
      entries,
      hasMore: this.options.hasMore(page)
    });
  }
  async acceptEntry(entry, item, iterator) {
    const { first, last: cursor } = this.entryRange(entry);
    const last = this.lastCursor;
    if (this.options.compare(cursor, last) <= 0)
      return;
    if (this.options.compare(first, last) <= 0) {
      throw protocolViolation(`${this.options.name} emitted a partially overlapping entry`);
    }
    if (!this.options.follows(last, first)) {
      const request = this.repairPageRequest();
      const superseded = await this.replaceThrough(request, cursor, item.generation, item.signal, iterator, [entry], []);
      if (superseded !== void 0) {
        this.replaceGeneration(superseded, true);
      }
      return;
    }
    if (this.firstCursor === void 0)
      this.firstCursor = first;
    this.lastCursor = cursor;
    this.setResumeCursor(cursor);
    this.options.publish({ type: "append", entry });
  }
  async replaceThrough(request, requiredCursor, generation, signal, iterator, queued, notifications) {
    let read = await this.readPageWhileFollowing(request, requiredCursor, generation, signal, iterator, queued, notifications);
    if (read.type === "superseded")
      return read.item;
    let page = read.page;
    this.assertPageThrough(page, requiredCursor);
    let entries = this.mergeReplacement(page, queued);
    let target = this.maxCursor(requiredCursor, queued);
    if (entries === void 0 || this.options.compare(this.tailCursor(entries), target) < 0) {
      read = await this.readPageWhileFollowing(this.repairPageRequest(), target, generation, signal, iterator, queued, notifications);
      if (read.type === "superseded")
        return read.item;
      page = read.page;
      this.assertPageThrough(page, target);
      entries = this.mergeReplacement(page, queued);
      target = this.maxCursor(requiredCursor, queued);
    }
    if (entries === void 0 || this.options.compare(this.tailCursor(entries), target) < 0) {
      throw protocolViolation(`${this.options.name} page did not reach its opening cursor`);
    }
    const first = entries[0];
    this.firstCursor = first === void 0 ? void 0 : this.options.first(first);
    this.lastCursor = this.tailCursor(entries);
    this.setResumeCursor(this.lastCursor);
    this.options.publish({
      type: "replace",
      page,
      entries,
      hasMore: this.options.hasMore(page)
    });
    for (const notification of notifications) {
      this.publishNotification(notification);
    }
    return void 0;
  }
  async readPageWhileFollowing(request, through, generation, signal, iterator, queued, notifications) {
    const page = this.readPage(request, through, signal).then((value) => ({ type: "page", value }), (error) => ({ type: "page-error", error }));
    while (true) {
      const pending = this.nextResult(iterator);
      const next = pending.then((value) => ({ type: "next", value }), (error) => ({ type: "next-error", error }));
      const result = await Promise.race([page, next]);
      if (result.type === "page") {
        signal.throwIfAborted();
        return { type: "page", page: result.value };
      }
      if (result.type === "page-error") {
        if (!signal.aborted || this.stream.signal.aborted)
          throw result.error;
        return this.awaitReplacementGeneration(generation, iterator, pending);
      }
      this.releaseNext();
      if (result.type === "next-error")
        throw result.error;
      if (result.value.done) {
        signal.throwIfAborted();
        throw protocolViolation(`${this.options.name} ended while reading its replacement page`);
      }
      const item = result.value.value;
      if (item.generation !== generation)
        return { type: "superseded", item };
      if (item.value.type === "opened") {
        throw protocolViolation(`${this.options.name} emitted more than one opening cursor`);
      }
      if (item.value.type === "notification") {
        notifications.push(item.value.notification);
        continue;
      }
      queued.push(item.value.entry);
    }
  }
  async awaitReplacementGeneration(generation, iterator, initial) {
    let pending = initial;
    while (true) {
      let next;
      try {
        next = await pending;
      } finally {
        this.releaseNext();
      }
      if (next.done) {
        this.stream.signal.throwIfAborted();
        throw protocolViolation(`${this.options.name} ended while replacing an aborted page generation`);
      }
      const item = next.value;
      if (item.generation !== generation)
        return { type: "superseded", item };
      if (item.value.type === "opened") {
        throw protocolViolation(`${this.options.name} emitted more than one opening cursor`);
      }
      pending = this.nextResult(iterator);
    }
  }
  mergeReplacement(page, queued) {
    const entries = [...this.options.entries(page)];
    this.assertPage(entries);
    for (const entry of queued)
      this.entryRange(entry);
    const sorted = [...queued].sort((left, right) => this.options.compare(this.options.first(left), this.options.first(right)));
    let tail = this.tailCursor(entries);
    for (const entry of sorted) {
      const first = this.options.first(entry);
      const last = this.options.last(entry);
      if (this.options.compare(last, tail) <= 0)
        continue;
      if (this.options.compare(first, tail) <= 0) {
        throw protocolViolation(`${this.options.name} replacement contains a partially overlapping entry`);
      }
      if (!this.options.follows(tail, first))
        return void 0;
      entries.push(entry);
      tail = last;
    }
    return entries;
  }
  maxCursor(cursor, entries) {
    let result = cursor;
    for (const entry of entries) {
      const candidate = this.options.last(entry);
      if (this.options.compare(candidate, result) > 0)
        result = candidate;
    }
    return result;
  }
  nextResult(iterator) {
    this.pendingNext ??= iterator.next();
    return this.pendingNext;
  }
  async takeNext(iterator) {
    const pending = this.nextResult(iterator);
    try {
      return await pending;
    } finally {
      this.releaseNext();
    }
  }
  releaseNext() {
    this.pendingNext = void 0;
  }
  publishNotification(notification) {
    this.options.publish({
      type: "notification",
      notification
    });
  }
  repairPageRequest() {
    return this.repairRequest(this.initialRequest);
  }
  setResumeCursor(cursor) {
    this.resumeCursor = cursor;
    this.hasResumeCursor = true;
  }
  currentCursor() {
    return this.resumeCursor;
  }
  tailCursor(entries) {
    const tail = entries.at(-1);
    return tail === void 0 ? this.options.emptyCursor : this.options.last(tail);
  }
  assertPage(entries) {
    const iterator = entries[Symbol.iterator]();
    const first = iterator.next();
    if (first.done)
      return;
    let previousRange = this.entryRange(first.value);
    for (const entry of iterator) {
      const range2 = this.entryRange(entry);
      if (!this.options.follows(previousRange.last, range2.first)) {
        throw protocolViolation(`${this.options.name} page contains discontinuous entries`);
      }
      previousRange = range2;
    }
  }
  entryRange(entry) {
    const first = this.options.first(entry);
    const last = this.options.last(entry);
    if (this.options.compare(first, last) > 0) {
      throw protocolViolation(`${this.options.name} entry has an inverted cursor range`);
    }
    return { first, last };
  }
  assertPageThrough(page, through) {
    const tail = this.tailCursor(this.options.entries(page));
    if (this.options.compare(tail, through) !== 0) {
      throw protocolViolation(`${this.options.name} page did not end at its requested cursor`);
    }
  }
};

// node_modules/@deepseek-ai/dsh-api-gateway/lib/types/client/index.js
function isRemoteFailure(error) {
  return remoteErrorOf(error) !== void 0;
}

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/sessions/history-records.js
function historyEntries(records) {
  return records;
}
function historyRecordFirstSeq(record) {
  return record.event.seq;
}
function historyRecordLastSeq(record) {
  return record.event.seq;
}

// node_modules/@deepseek-ai/dsh-session/lib/types/known-event-types.js
var KNOWN_SESSION_EVENT_TYPES = /* @__PURE__ */ new Set([
  "agent-preset/selected",
  "agent/inbox/spliced",
  "approval/asked",
  "approval/decided",
  "approval/policy",
  "assistant/attempt",
  "assistant/message",
  "command/done",
  "command/run",
  "compaction/end",
  "compaction/prune",
  "compaction/start",
  "compaction/summary",
  "deliverables/presented",
  "developer/message",
  "feedback/message-delete",
  "feedback/message-put",
  "feedback/record",
  "goal/change",
  "hook/invoked",
  "hook/result",
  "image/offload",
  "job/registered",
  "job/settled",
  "llm/retry",
  "llm/retry-started",
  "model/selection",
  "permission/preset",
  "plan/mode",
  "request/context",
  "request/header",
  "sandbox/mode",
  "schedule/change",
  "session-log-deepseek/delivery-accepted",
  "session/end-seed",
  "session/title",
  "session/title-llm-request",
  "step/end",
  "step/start",
  "subagent/catalog",
  "subagent/descriptor",
  "subagent/model-selection-policy",
  "system/message",
  "team/member",
  "team/message/delivered",
  "team/message/queued",
  "team/task",
  "todo/write",
  "tool-workflow/agent-end",
  "tool-workflow/agent-start",
  "tool-workflow/run-end",
  "tool-workflow/run-start",
  "tool/call",
  "tool/ptc-dispatch",
  "tool/ptc-dispatch-start",
  "tool/result",
  "turn/end",
  "turn/start",
  "user/message",
  "web/deepseek-search-llm-request",
  "working-directory/change",
  "workspace/changes"
]);

// node_modules/@deepseek-ai/dsh-session/lib/types/surface.js
var SURFACE_EVENT_TYPES = /* @__PURE__ */ new Set([
  "system/message",
  "developer/message",
  "user/message",
  "assistant/message",
  "tool/result"
]);
function isSurfaceEligibleType(type) {
  return SURFACE_EVENT_TYPES.has(type);
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validateSessionEventData(event, subject) {
  const data = event.data;
  if (SURFACE_EVENT_TYPES.has(event.type) && isRecord2(data)) {
    const message = event.type === "user/message" ? data : data["message"];
    if (isRecord2(message)) {
      if (event.type === "developer/message" !== (message["role"] === "developer")) {
        throw new Error(`${subject} developer/message and developer role must occur together`);
      }
      if (message["role"] !== "developer" && Array.isArray(message["content"]) && message["content"].some((block) => isRecord2(block) && (block["type"] === "tool-addition" || block["type"] === "tool-removal"))) {
        throw new Error(`${subject} tool-change blocks require developer role`);
      }
      if (event.type === "developer/message" && Array.isArray(message["content"])) {
        let hasAdditions = false;
        for (const block of message["content"]) {
          if (!isRecord2(block) || block["type"] !== "tool-addition" && block["type"] !== "tool-removal")
            continue;
          if (typeof block["toolName"] !== "string" || block["toolName"].length === 0) {
            throw new Error(`${subject} ${block["type"]} requires a nonempty toolName`);
          }
          if (block["type"] === "tool-addition") {
            hasAdditions = true;
            if (Object.hasOwn(block, "tool"))
              throw new Error(`${subject} tool-addition must omit inline tool definitions`);
          }
        }
        if (hasAdditions ? !isEventSeq(data["headerSeq"]) : Object.hasOwn(data, "headerSeq")) {
          throw new Error(`${subject} requires headerSeq exactly when tool additions are present`);
        }
      }
    }
  }
  if (event.type === "request/header") {
    if (!isRecord2(data))
      throw new Error(`${subject} data must be an object`);
    const header = data["header"];
    if (!isRecord2(header))
      throw new Error(`${subject} header must be an object`);
    if (Object.hasOwn(header, "system"))
      throw new Error(`${subject} must omit header.system; use system/message`);
    if (Array.isArray(header["tools"]) && header["tools"].length === 0) {
      throw new Error(`${subject} must omit empty tools`);
    }
    const defaults = header["adapterDefaults"];
    if (isRecord2(defaults) && Object.keys(defaults).length === 0) {
      throw new Error(`${subject} must omit empty adapterDefaults`);
    }
  } else if (event.type === "tool/result") {
    if (!isRecord2(data))
      throw new Error(`${subject} data must be an object`);
    if (data["error"] === void 0)
      return;
    const message = data["message"];
    if (!isRecord2(message) || message["isError"] !== true) {
      throw new Error(`${subject} error requires message.isError === true`);
    }
  }
}
function isEventSeq(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}
function isReplaceOp(value) {
  const op = value;
  return Object.keys(op).length === 3 && Object.hasOwn(op, "op") && Object.hasOwn(op, "startSeq") && Object.hasOwn(op, "endSeq") && op["op"] === "replace" && isEventSeq(op["startSeq"]) && isEventSeq(op["endSeq"]);
}
function surfaceOpOf(event) {
  const raw = event;
  if (!isSurfaceEligibleType(event.type)) {
    if (!KNOWN_SESSION_EVENT_TYPES.has(event.type) && event.ignorable === true)
      return;
    if (raw.surfaceOp !== void 0) {
      throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry surfaceOp`);
    }
    if (raw.sourceEventSeqs !== void 0) {
      throw new Error(`session event "${event.type}" is not surface-eligible and cannot carry sourceEventSeqs`);
    }
    return;
  }
  const op = raw.surfaceOp;
  if (op === void 0) {
    throw new Error(`session event "${event.type}" is surface-eligible and requires a surfaceOp marker`);
  }
  if (op === "append")
    return op;
  if (op === null || typeof op !== "object" || Array.isArray(op)) {
    throw new Error(`session event "${event.type}" carries an invalid surfaceOp`);
  }
  if (!isReplaceOp(op)) {
    throw new Error(`session event "${event.type}" carries an invalid replace surfaceOp`);
  }
  return op;
}
function assertSourceEventReferences(event, shadowedSeqs) {
  const raw = event.sourceEventSeqs;
  if (event.type === "assistant/message" && raw !== void 0) {
    throw new Error("assistant/message embeds its source stream and cannot carry sourceEventSeqs");
  }
  const sources = /* @__PURE__ */ new Set();
  if (raw !== void 0) {
    if (!Array.isArray(raw)) {
      throw new Error(`sourceEventSeqs on event at seq ${event.seq} must be an array when present`);
    }
    if (raw.length === 0) {
      throw new Error("sourceEventSeqs must not be empty");
    }
    let nonEarlierSource;
    for (const source of raw) {
      if (!isEventSeq(source)) {
        throw new Error(`session event "${event.type}" sourceEventSeqs must densely contain non-negative safe integers`);
      }
      sources.add(source);
      if (nonEarlierSource === void 0 && source >= event.seq)
        nonEarlierSource = source;
    }
    if (sources.size !== raw.length) {
      throw new Error("sourceEventSeqs must not contain duplicates");
    }
    if (nonEarlierSource !== void 0) {
      throw new Error(`sourceEventSeqs must reference earlier events: ${nonEarlierSource} >= current seq ${event.seq}`);
    }
  }
  const missing = shadowedSeqs.filter((seq) => !sources.has(seq));
  if (missing.length > 0) {
    throw new Error(`surface replace: sourceEventSeqs must include every shadowed surface node; missing ${missing.join(", ")}`);
  }
}
function validateSurfaceMetadata(event) {
  const op = surfaceOpOf(event);
  if (op !== void 0 && op !== "append" && (op.startSeq >= event.seq || op.endSeq >= event.seq)) {
    throw new Error(`surface replace at seq ${event.seq}: startSeq and endSeq must reference earlier events`);
  }
  if (op !== void 0)
    assertSourceEventReferences(event, []);
  return op;
}

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/session-wire-event.js
function assertSessionWireEvent(value) {
  const subject = "session wire event";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${subject} must be an object`);
  }
  const event = value;
  for (const key of Object.keys(event)) {
    switch (key) {
      case "type":
      case "seq":
      case "time":
      case "data":
      case "ignorable":
      case "surfaceOp":
      case "sourceEventSeqs":
        break;
      default:
        throw new Error(`${subject} has unexpected field ${key}`);
    }
  }
  const seq = event["seq"];
  if (typeof event["type"] !== "string" || typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 0 || Object.is(seq, -0) || typeof event["time"] !== "number" || !Number.isSafeInteger(event["time"]) || !Object.hasOwn(event, "data") || event["data"] === void 0 || Object.hasOwn(event, "ignorable") && event["ignorable"] !== true) {
    throw new Error(`${subject} has an invalid envelope`);
  }
  const current = event;
  validateSurfaceMetadata(current);
  validateSessionEventData(current, subject);
}

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/transport.js
function toSessionJournalChange(change) {
  switch (change.type) {
    case "replace":
    case "prepend":
      return { ...change, entries: historyEntries(change.entries) };
    case "append": {
      return {
        type: "append",
        entry: change.entry
      };
    }
    case "notification":
      return { type: "assistant-stream", frame: change.notification };
  }
}
var SessionEventStream = class extends RemoteJournalStream {
  remote;
  address;
  /**
   * @param remote - generated Session namespace and Gateway stream factory.
   * @param address - durable ordinary-Session or direct-subagent address.
   * @param options - Session event-window destinations.
   */
  constructor(remote, address, options) {
    super(remote, {
      name: "session event stream",
      emptyCursor: -1,
      entries: (page) => page.records,
      hasMore: (page) => page.hasMore,
      first: historyRecordFirstSeq,
      last: historyRecordLastSeq,
      compare: (left, right) => left - right,
      follows: (left, right) => right === left + 1,
      publish: (change) => {
        options.publish(toSessionJournalChange(change));
      },
      ...options.carrierFailed === void 0 ? {} : { carrierFailed: options.carrierFailed },
      failed: options.failed
    });
    this.remote = remote;
    this.address = address;
  }
  /** @inheritdoc */
  async *follow(request, signal) {
    let assistantRevision;
    for await (const frame of this.remote.session.follow({
      address: this.address,
      activate: true,
      assistantStream: true,
      ...this.repairRequest(request)
    }, signal)) {
      if (frame.type === "snapshot") {
        for (const record of frame.records)
          assertSessionWireEvent(record.event);
        if (frame.assistantStream === void 0) {
          throw new RemoteError("gateway/internal", "session assistant stream omitted its opted-in opening baseline", {});
        }
        assistantRevision = frame.assistantStream.revision;
        yield {
          type: "opened",
          cursor: frame.cursor,
          page: {
            records: frame.records,
            hasMore: frame.hasMore,
            projections: frame.projections,
            assistantStream: frame.assistantStream
          }
        };
        continue;
      }
      if (frame.type === "assistant-stream") {
        const expected = (assistantRevision ?? 0) + 1;
        if (frame.frame.revision !== expected) {
          throw new RemoteStreamCarrierError(`session assistant stream skipped revision ${String(expected)}`);
        }
        assistantRevision = frame.frame.revision;
        yield { type: "notification", notification: frame.frame };
        continue;
      }
      assertSessionWireEvent(frame.event);
      yield { type: "entry", entry: frame };
    }
  }
  /** @inheritdoc */
  async readPage(request, throughSeq, signal) {
    const result = await this.remote.session.page({ address: this.address, throughSeq, ...request }, signal);
    if (!result.ok)
      throw result.error;
    for (const record of result.value.records)
      assertSessionWireEvent(record.event);
    return result.value;
  }
  /** @inheritdoc */
  repairRequest(request) {
    return {
      ...request.maxMessages === void 0 ? {} : { maxMessages: request.maxMessages },
      ...request.turnWindow === void 0 ? {} : { turnWindow: request.turnWindow }
    };
  }
};

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/contract/events.js
var import_dsh_client_store = require("@deepseek-ai/dsh-client-store");
function leaf(entries) {
  return { kind: "leaf", entries, length: entries.length };
}
function concat(left, right) {
  return { kind: "concat", left, right, length: left.length + right.length };
}
function materialize(node) {
  if (node.kind === "leaf")
    return node.entries;
  const entries = new Array(node.length);
  const pending = [node];
  let index = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current.kind === "concat") {
      pending.push(current.right, current.left);
      continue;
    }
    for (const entry of current.entries) {
      entries[index] = entry;
      index += 1;
    }
  }
  return entries;
}
function windowSnapshot(node, hasMore, revision, change) {
  let entries;
  return {
    get entries() {
      entries ??= materialize(node);
      return entries;
    },
    hasMore,
    revision,
    change
  };
}
var MutableSessionEventSource = class {
  listeners = /* @__PURE__ */ new Set();
  window = leaf([]);
  snapshot = windowSnapshot(this.window, false, 0, { kind: "replace", entries: [] });
  /** @returns the cached event-window snapshot. */
  getSnapshot() {
    return this.snapshot;
  }
  /**
   * Subscribe to synchronous window publication.
   * @param listener - invalidation callback.
   * @returns unsubscribe function.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /**
   * Replace the complete contiguous window.
   * @param entries - complete window.
   * @param hasMore - whether older history remains.
   */
  replace(entries, hasMore) {
    this.window = leaf(entries);
    this.publish(hasMore, { kind: "replace", entries });
  }
  /**
   * Prepend one older contiguous page.
   * @param entries - newly loaded older entries.
   * @param hasMore - whether still older history remains.
   */
  prepend(entries, hasMore) {
    this.window = concat(leaf(entries), this.window);
    this.publish(hasMore, { kind: "prepend", entries });
  }
  /**
   * Append one contiguous live entry.
   * @param entry - live tail entry.
   */
  append(entry) {
    const entries = [entry];
    this.window = concat(this.window, leaf(entries));
    this.publish(this.snapshot.hasMore, {
      kind: "append",
      entries
    });
  }
  /**
   * Replace one attempt's transient rows with its committed durable settlement.
   * @param attemptId - process-local attempt whose live rows are now redundant.
   * @param entry - durable settlement committed for that attempt.
   */
  settleAssistant(attemptId, entry) {
    const entries = materialize(this.window).filter((candidate) => candidate.type !== "transient" || candidate.event.data.attemptId !== attemptId);
    if (entry !== void 0) {
      const index = entries.findIndex((candidate) => candidate.event.seq > entry.event.seq);
      if (index < 0)
        entries.push(entry);
      else
        entries.splice(index, 0, entry);
    }
    this.window = leaf(entries);
    this.publish(this.snapshot.hasMore, {
      kind: "settle-assistant",
      attemptId,
      ...entry === void 0 ? {} : { entry }
    });
  }
  publish(hasMore, change) {
    this.snapshot = windowSnapshot(this.window, hasMore, this.snapshot.revision + 1, change);
    (0, import_dsh_client_store.notifySubscribers)(this.listeners, "[session-controller] event feed");
  }
};

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/sessions/notifier.js
var import_dsh_client_store2 = require("@deepseek-ai/dsh-client-store");
var Notifier = class {
  rebuild;
  listeners = /* @__PURE__ */ new Set();
  dirty = false;
  notifyPending = false;
  scheduled = "none";
  scheduleGeneration = 0;
  /** @param rebuild - snapshot rebuild function injected by the owner (writes the owner's snapshotCache). */
  constructor(rebuild) {
    this.rebuild = rebuild;
  }
  /**
   * uSES subscription entry.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /** Mark the snapshot dirty and notify in a microtask. */
  markDirty() {
    this.dirty = true;
    this.notifyPending = true;
    if (this.scheduled === "microtask")
      return;
    this.schedule("microtask");
  }
  /** Mark the snapshot dirty and publish cumulative state at most once per frame. */
  markFrameDirty() {
    this.dirty = true;
    this.notifyPending = true;
    if (this.scheduled !== "none")
      return;
    this.schedule(typeof globalThis.requestAnimationFrame === "function" ? "frame" : "microtask");
  }
  /**
   * Synchronous flush: controlled-input writes must notify in the same tick as
   * onChange, or React rolls the DOM back to the stale value and the caret jumps to the end.
   */
  notifyNow() {
    this.dirty = true;
    this.notifyPending = true;
    this.invalidateSchedule();
    this.flush();
  }
  /**
   * Pre-getSnapshot check: rebuild synchronously when dirty (read path
   * before first subscribe / while unobserved). Notification stays pending.
   */
  ensureFresh() {
    if (!this.dirty)
      return;
    this.dirty = false;
    this.rebuild();
  }
  schedule(kind) {
    const generation = ++this.scheduleGeneration;
    this.scheduled = kind;
    const publish = () => {
      if (generation !== this.scheduleGeneration)
        return;
      this.scheduled = "none";
      this.flush();
    };
    if (kind === "frame") {
      globalThis.requestAnimationFrame(publish);
    } else {
      queueMicrotask(publish);
    }
  }
  invalidateSchedule() {
    this.scheduleGeneration++;
    this.scheduled = "none";
  }
  flush() {
    if (!this.notifyPending)
      return;
    if (this.listeners.size === 0)
      return;
    this.notifyPending = false;
    if (this.dirty) {
      this.dirty = false;
      this.rebuild();
    }
    (0, import_dsh_client_store2.notifySubscribers)(this.listeners, "[session-controller]");
  }
};

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/sessions/projection-store.js
var ProjectionValueStore = class {
  rows = /* @__PURE__ */ new Map();
  channels = /* @__PURE__ */ new Map();
  valuesCache;
  /** Coarse any-key channel (no snapshot cache to rebuild: reads hit rows directly). */
  anyNotifier = new Notifier(() => {
  });
  /**
   * Key-addressed bare observable face (the useProjection resolution path).
   * Always defined — absence is an `undefined` snapshot, never a missing
   * face, so a component may subscribe before the key ever carries a value.
   * @param key - projection key.
   * @returns the identity-stable face for this key.
   */
  faceOf(key) {
    return this.channel(key).face;
  }
  /**
   * Current whole value for a key (erased framework read; typed reads go
   * through `useProjection`'s map lookup).
   * @param key - projection key.
   * @returns the value, or undefined while the key is absent.
   */
  get(key) {
    return this.rows.get(key)?.value;
  }
  /**
   * Read the accepted Host watermark without subscribing or copying a value.
   * @param key - projection key.
   * @returns the current sequence, or undefined for absent and cached values.
   */
  seqOf(key) {
    const row = this.rows.get(key);
    return row?.kind === "sequenced" ? row.seq : void 0;
  }
  /**
   * Read every current projection value as one reference-stable snapshot.
   * @returns The same frozen value map until a row changes.
   */
  values() {
    if (this.valuesCache === void 0) {
      this.valuesCache = Object.freeze(Object.fromEntries([...this.rows].map(([key, row]) => [key, row.value])));
    }
    return this.valuesCache;
  }
  /**
   * Subscribe to any-key changes (microtask-batched) — the manager's list
   * rebuild channel.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribeAny(listener) {
    return this.anyNotifier.subscribe(listener);
  }
  /**
   * Apply one finished value from the Session control stream.
   * @param key - projection key.
   * @param value - whole value computed by the host unit.
   * @param seq - the unit's watermark at emission.
   */
  apply(key, value, seq) {
    const row = this.rows.get(key);
    if (row?.kind === "sequenced" && seq <= row.seq)
      return;
    this.rows.set(key, { kind: "sequenced", value, seq });
    this.changed(key);
  }
  /**
   * Fill keys from a Host block labeled `cached`: a zero-I/O
   * view of the persisted checkpoint. A cached value lands only where no
   * sequenced row exists: a connected Session has already answered for such
   * a key, and the list's view of the persisted checkpoint cannot be newer
   * than it.
   * @param values - whole values by key viewed from the persisted checkpoint.
   */
  applyCached(values) {
    for (const key of Object.keys(values)) {
      if (this.rows.get(key)?.kind === "sequenced")
        continue;
      this.rows.set(key, { kind: "cached", value: values[key] });
      this.changed(key);
    }
  }
  /**
   * Seed from a history tail page's projections block. Every cached row is
   * discarded first, regardless of seq: the block comes from the connected
   * Session, and a value viewed from the persisted checkpoint never outranks
   * it. Then every carried key lands under the same seq rule as frames, and a
   * key the block omits is capability-absent as of the cut — its row clears
   * unless a newer frame already superseded the cut (a stale baseline can
   * neither overwrite nor clear newer sequenced values).
   * @param baseline - the response's projections block.
   */
  seed(baseline) {
    for (const [key, row] of this.rows) {
      if (row.kind !== "cached")
        continue;
      this.rows.delete(key);
      this.changed(key);
    }
    const values = baseline.values;
    for (const key of Object.keys(values))
      this.apply(key, values[key], baseline.asOfSeq);
    for (const [key, row] of this.rows) {
      if (Object.hasOwn(values, key))
        continue;
      if (row.kind === "sequenced" && row.seq > baseline.asOfSeq)
        continue;
      this.rows.delete(key);
      this.changed(key);
    }
  }
  /** Discard one Host generation's values and watermarks while preserving subscribed faces. */
  clear() {
    for (const key of this.rows.keys()) {
      this.rows.delete(key);
      this.changed(key);
    }
  }
  changed(key) {
    this.valuesCache = void 0;
    this.channels.get(key)?.notifier.markDirty();
    this.anyNotifier.markDirty();
  }
  channel(key) {
    let channel = this.channels.get(key);
    if (channel === void 0) {
      const notifier = new Notifier(() => {
      });
      channel = {
        notifier,
        face: {
          getSnapshot: () => this.rows.get(key)?.value,
          subscribe: (listener) => notifier.subscribe(listener)
        }
      };
      this.channels.set(key, channel);
    }
    return channel;
  }
};

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/time-zone.js
function resolvedClientTimeZone() {
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    throw new Error("browser time zone is unavailable");
  }
  return timeZone;
}

// node_modules/@deepseek-ai/dsh-util-values/lib/index.js
var SIMPLE_ESCAPES = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  b: "\b",
  f: "\f",
  n: "\n",
  r: "\r",
  t: "	"
};
var CONTENT_ESCAPE = /[\\\u0000-\u001f]/u;
function isWhitespace(c) {
  return c === " " || c === "\n" || c === "\r" || c === "	";
}
function isHex(c) {
  return c >= "0" && c <= "9" || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
var PartialArguments = class PartialArguments2 {
  /** The view of a call with no arguments available. */
  static EMPTY = PartialArguments2.fromObject({});
  /**
  * View finished argument text without scanning it until a reader asks.
  * @param text - the complete argument JSON text.
  * @returns a sealed view.
  */
  static fromText(text) {
    const view = new PartialArguments2();
    view.append(text);
    view.sealed = true;
    return view;
  }
  /**
  * View an already parsed argument payload, such as a PTC dispatch object.
  * @param value - the parsed argument value.
  * @returns a sealed view; a non-object payload has no fields.
  */
  static fromObject(value) {
    const view = new PartialArguments2();
    view.object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
    view.sealed = true;
    return view;
  }
  /**
  * The source: text so far or a parsed object, plus whether it can still grow.
  * These are the only enumerable fields, so two views over the same source
  * compare equal structurally however far each has been read.
  */
  chunks = [];
  object;
  sealed = false;
  #ends = [];
  #size = 0;
  #consumed = 0;
  #mode = "root";
  #escape = false;
  #keyStart = 0;
  #keyEscaped = false;
  #key = "";
  #current = null;
  #nestedEnds = [];
  #nestedInString = false;
  #invalidAt;
  #invalidValue = false;
  #entries = /* @__PURE__ */ new Map();
  #order = [];
  #reads = /* @__PURE__ */ new Map();
  /** Whether this view rejects further appends; does not scan text or register reads. */
  get isSealed() {
    return this.sealed;
  }
  /** Whether indexing or a content read found invalid JSON; unread value contents are not validated. */
  get invalid() {
    this.scan();
    return this.#mode === "invalid" || this.#invalidValue;
  }
  /**
  * Retain streamed argument text without scanning or comparing observed answers.
  * @param fragment - the text following every fragment appended before.
  */
  append(fragment) {
    if (this.sealed) throw new Error("PartialArguments: cannot append to a sealed view");
    if (fragment.length === 0) return;
    this.chunks.push(fragment);
    this.#size += fragment.length;
    this.#ends.push(this.#size);
  }
  /**
  * Reconcile a streamed prefix with authoritative complete text without joining the fragments.
  * @param text - the final argument text, which replaces missing or conflicting deltas.
  * @returns this view sealed with its caches retained when every character matches; otherwise a new sealed view.
  */
  settle(text) {
    if (this.object !== void 0 || text.length !== this.#size) return PartialArguments2.fromText(text);
    let offset = 0;
    for (const chunk of this.chunks) {
      if (!text.startsWith(chunk, offset)) return PartialArguments2.fromText(text);
      offset += chunk.length;
    }
    this.chunks = text.length === 0 ? [] : [text];
    this.#ends = text.length === 0 ? [] : [text.length];
    this.sealed = true;
    return this;
  }
  /**
  * Compare observed answers and advance their publication baseline. Unread views remain unscanned.
  * @returns whether any observed answer changed since its first read or the preceding refresh.
  */
  refresh() {
    if (this.#reads.size === 0) return false;
    this.scan();
    let changed = false;
    let completions = false;
    for (const read of this.#reads.values()) {
      if (read.completion) {
        completions = true;
        continue;
      }
      changed = this.refreshRead(read) || changed;
    }
    if (completions) {
      for (const read of this.#reads.values()) if (read.completion) changed = this.refreshRead(read) || changed;
    }
    if (this.sealed) this.#reads.clear();
    return changed;
  }
  refreshRead(read) {
    const now = read.answer();
    if (Object.is(now, read.last)) return false;
    read.last = now;
    return true;
  }
  /**
  * Check whether no further fields can arrive.
  * @returns whether the outer object closed, indexing failed, or the view is sealed; unread values are not validated.
  */
  closed() {
    return this.remember("closed", "", () => this.closedNow());
  }
  /**
  * List discovered fields in first-appearance order.
  * @returns top-level keys seen so far, in first-appearance order.
  */
  keys() {
    return this.remember("keys", "", () => this.keysNow(), (keys) => keys.length);
  }
  /**
  * Check whether a top-level field has appeared.
  * @param key - argument name.
  * @returns whether the field has appeared (a string opened or another value began).
  */
  has(key) {
    return this.remember("has", key, () => this.hasNow(key));
  }
  /**
  * Check whether a field's closing delimiter has arrived, without validating its contents.
  * @param key - argument name.
  * @returns whether its delimiter arrived and no content reader has reported an error for this value.
  */
  complete(key) {
    return this.remember("complete", key, () => this.completeNow(key));
  }
  /**
  * Read string length without materializing its text.
  * @param key - argument name.
  * @param options - change granularity for a streaming string.
  * @returns decoded UTF-16 length of the string field so far; undefined when absent or not a string.
  */
  stringLength(key, options) {
    const step = Math.max(1, Math.floor(options?.step ?? 1));
    const offset = options?.offset ?? 0;
    return this.remember(`length:${step}:${offset}`, key, () => this.lengthNow(key), (length) => length === void 0 ? void 0 : Math.ceil((length + offset) / step));
  }
  /**
  * Check a string against a decoded UTF-16 length limit without materializing it.
  * @param key - argument name.
  * @param maxLength - decoded UTF-16 limit, floored to at least zero.
  * @returns whether the string is longer than the limit; false when absent or not a string.
  */
  stringExceeds(key, maxLength) {
    const limit = Math.max(0, Math.floor(maxLength));
    return this.remember(`exceeds:${limit}`, key, () => (this.lengthNow(key, limit + 1) ?? 0) > limit);
  }
  /**
  * Read a decoded string, including a streaming prefix.
  * @param key - argument name.
  * @returns the string field's decoded text so far; undefined when absent or not a string.
  */
  text(key) {
    return this.remember("text", key, () => this.textNow(key));
  }
  /**
  * Read at most the first decoded UTF-16 units of a string.
  * @param key - argument name.
  * @param maxLength - maximum decoded UTF-16 length, floored to at least one.
  * @returns the bounded string prefix; undefined when absent or not a string.
  */
  textPrefix(key, maxLength) {
    const limit = Math.max(1, Math.floor(maxLength));
    return this.remember(`prefix:${limit}`, key, () => this.textPrefixNow(key, limit));
  }
  /**
  * Read a completed non-string argument.
  * @param key - argument name.
  * @returns the parsed non-string value once it closed; undefined while open, absent, or a string.
  */
  value(key) {
    return this.remember("value", key, () => this.valueNow(key));
  }
  /** Answer a question and, on a streaming view, remember it for change detection. */
  remember(kind, key, read, comparison) {
    this.scan();
    const result = read();
    if (!this.sealed) {
      const id = `${kind}/${key}`;
      if (!this.#reads.has(id)) this.#reads.set(id, {
        completion: kind === "complete",
        answer: comparison === void 0 ? read : () => comparison(read()),
        last: comparison === void 0 ? result : comparison(result)
      });
    }
    return result;
  }
  closedNow() {
    return this.sealed || this.#mode === "closed" || this.#mode === "invalid";
  }
  keysNow() {
    return this.object === void 0 ? this.#order : Object.keys(this.object);
  }
  hasNow(key) {
    return this.object === void 0 ? this.#entries.has(key) : Object.hasOwn(this.object, key);
  }
  completeNow(key) {
    if (this.object !== void 0) return Object.hasOwn(this.object, key);
    const entry = this.#entries.get(key);
    return entry !== void 0 && entry.end >= 0 && (entry.kind === "string" ? entry.invalidAt === void 0 : !entry.invalid);
  }
  lengthNow(key, limit = Number.POSITIVE_INFINITY) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.length : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text !== void 0 && entry.text.at === entry.end) return entry.text.length;
    const read = entry.length ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, limit, false);
    return read.length;
  }
  textNow(key) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    if (entry.text === void 0 && entry.end >= 0 && entry.needsDecoding && entry.invalidAt === void 0) {
      let text;
      try {
        text = JSON.parse(`"${this.slice(entry.start, entry.end)}"`);
      } catch (_error) {
      }
      if (text !== void 0) entry.text = {
        at: entry.end,
        length: text.length,
        text
      };
    }
    const read = entry.text ??= {
      at: entry.start,
      length: 0,
      text: ""
    };
    this.readString(entry, read, Number.POSITIVE_INFINITY, true);
    return read.text;
  }
  textPrefixNow(key, maxLength) {
    if (this.object !== void 0) {
      const field = Object.hasOwn(this.object, key) ? this.object[key] : void 0;
      return typeof field === "string" ? field.slice(0, maxLength) : void 0;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "string") return void 0;
    const prefixes = entry.prefixes ??= /* @__PURE__ */ new Map();
    let read = prefixes.get(maxLength);
    if (read === void 0) {
      read = {
        at: entry.start,
        length: 0,
        text: ""
      };
      prefixes.set(maxLength, read);
    }
    this.readString(entry, read, maxLength, true);
    return read.text;
  }
  valueNow(key) {
    if (this.object !== void 0) {
      if (!Object.hasOwn(this.object, key)) return void 0;
      const field = this.object[key];
      return typeof field === "string" ? void 0 : field;
    }
    const entry = this.#entries.get(key);
    if (entry?.kind !== "value" || entry.end < 0 || entry.invalid) return void 0;
    if (entry.parsed === void 0) try {
      entry.parsed = JSON.parse(this.slice(entry.start, entry.end));
    } catch (_error) {
      entry.invalid = true;
      this.#invalidValue = true;
    }
    return entry.parsed;
  }
  chunkAt(at) {
    let low = 0;
    let high = this.#ends.length;
    while (low < high) {
      const mid = low + high >>> 1;
      if (this.#ends[mid] <= at) low = mid + 1;
      else high = mid;
    }
    return low;
  }
  /** Materialize only a requested range, never the cumulative source. */
  slice(start, end) {
    if (start >= end) return "";
    const first = this.chunkAt(start);
    const last = this.chunkAt(end - 1);
    const base = first === 0 ? 0 : this.#ends[first - 1];
    if (first === last) return this.chunks[first].slice(start - base, end - base);
    const parts = [this.chunks[first].slice(start - base)];
    for (let i = first + 1; i < last; i++) parts.push(this.chunks[i]);
    parts.push(this.chunks[last].slice(0, end - this.#ends[last - 1]));
    return parts.join("");
  }
  readString(entry, read, limit, materialize2) {
    const end = Math.min(entry.end < 0 ? this.#consumed : entry.end, entry.invalidAt ?? Number.POSITIVE_INFINITY, this.#invalidAt ?? Number.POSITIVE_INFINITY);
    if (!entry.needsDecoding) {
      const length = Math.min(end - read.at, limit - read.length);
      if (length <= 0) return;
      if (materialize2) read.text += this.slice(read.at, read.at + length);
      read.at += length;
      read.length += length;
      return;
    }
    let chunkIndex = this.chunkAt(read.at);
    while (read.at < end && read.length < limit) {
      const base = chunkIndex === 0 ? 0 : this.#ends[chunkIndex - 1];
      const chunk = this.chunks[chunkIndex];
      const remaining = chunk.slice(read.at - base, Math.min(chunk.length, end - base));
      const boundary = remaining.search(CONTENT_ESCAPE);
      const length = Math.min(boundary < 0 ? remaining.length : boundary, limit - read.length);
      if (length > 0) {
        if (materialize2) read.text += remaining.slice(0, length);
        read.at += length;
        read.length += length;
        if (read.at === base + chunk.length) chunkIndex++;
        continue;
      }
      const type = remaining.length > 1 ? remaining[1] : read.at + 1 < end ? this.chunks[chunkIndex + 1][0] : void 0;
      let decoded;
      let width = 2;
      if (remaining[0] === "\\" && type === void 0 && entry.end < 0) return;
      if (remaining[0] === "\\" && type === "u") {
        const hex = this.slice(read.at + 2, Math.min(end, read.at + 6));
        let valid = true;
        for (let i = 0; i < hex.length; i++) if (!isHex(hex[i])) valid = false;
        if (valid) {
          if (hex.length < 4 && entry.end < 0) return;
          if (hex.length === 4) decoded = String.fromCharCode(Number.parseInt(hex, 16));
        }
        width = 6;
      } else if (remaining[0] === "\\" && type !== void 0) decoded = SIMPLE_ESCAPES[type];
      if (decoded === void 0) {
        entry.invalidAt = read.at;
        this.#invalidValue = true;
        return;
      }
      if (materialize2) read.text += decoded;
      read.length++;
      read.at += width;
      while (chunkIndex < this.chunks.length && read.at >= this.#ends[chunkIndex]) chunkIndex++;
    }
  }
  /** Locate new field ranges without decoding or parsing their contents. */
  scan() {
    if (this.object !== void 0 || this.#consumed === this.#size) return;
    for (let i = this.chunkAt(this.#consumed); i < this.chunks.length && this.#invalidAt === void 0; i++) {
      const pending = this.chunks[i];
      const base = i === 0 ? 0 : this.#ends[i - 1];
      for (let index = this.#consumed - base; index < pending.length && this.#mode !== "invalid"; index++) {
        if (this.#mode === "string" || this.#mode === "nested" && this.#nestedInString) {
          const end = this.stringBoundary(pending, index);
          this.#consumed += end - index;
          index = end;
          if (index === pending.length) break;
        }
        this.step(pending[index], this.#consumed);
        this.#consumed++;
      }
    }
  }
  /** Only raw quotes and their preceding backslash runs can terminate a string. */
  stringBoundary(fragment, start) {
    let at = start;
    while (true) {
      const quote = fragment.indexOf('"', at);
      const end = quote < 0 ? fragment.length : quote;
      if (this.#mode === "string") {
        const entry = this.#current;
        if (!entry.needsDecoding && CONTENT_ESCAPE.test(fragment.slice(at, end))) entry.needsDecoding = true;
      }
      let slashStart = end;
      while (slashStart > at && fragment[slashStart - 1] === "\\") slashStart--;
      const escaped = (end - slashStart) % 2 === 1 !== (slashStart === at && this.#escape);
      this.#escape = quote < 0 && escaped;
      if (quote < 0 || !escaped) return end;
      at = quote + 1;
    }
  }
  step(c, at) {
    switch (this.#mode) {
      case "root":
        if (isWhitespace(c)) return;
        if (c === "{") {
          this.#mode = "key-or-end";
          return;
        }
        this.fail();
        return;
      case "key-or-end":
        if (isWhitespace(c)) return;
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key-only":
        if (isWhitespace(c)) return;
        if (c === '"') {
          this.beginKey(at);
          return;
        }
        this.fail();
        return;
      case "key":
        this.stepKey(c, at);
        return;
      case "colon":
        if (isWhitespace(c)) return;
        if (c === ":") {
          this.#mode = "value";
          return;
        }
        this.fail();
        return;
      case "value":
        this.beginValue(c, at);
        return;
      case "string": {
        const entry = this.#current;
        entry.end = at;
        this.#current = null;
        this.#mode = "comma-or-end";
        return;
      }
      case "scalar":
        this.stepScalar(c, at);
        return;
      case "nested":
        this.stepNested(c, at);
        return;
      case "comma-or-end":
        if (isWhitespace(c)) return;
        if (c === ",") {
          this.#mode = "key-only";
          return;
        }
        if (c === "}") {
          this.#mode = "closed";
          return;
        }
        this.fail();
        return;
      case "closed":
        if (isWhitespace(c)) return;
        this.fail();
        return;
      /* v8 ignore next 2 -- scan() stops stepping once the view is invalid. */
      case "invalid":
        return;
      /* v8 ignore next 2 -- Every scanner mode has a handler above. */
      default:
        assertNever(this.#mode);
    }
  }
  fail() {
    this.#invalidAt = this.#consumed;
    this.#mode = "invalid";
    this.#current = null;
  }
  beginKey(at) {
    this.#mode = "key";
    this.#keyStart = at + 1;
    this.#keyEscaped = false;
    this.#escape = false;
  }
  stepKey(c, at) {
    if (c < " ") {
      this.fail();
      return;
    }
    if (this.#escape) {
      this.#escape = false;
      return;
    }
    if (c === "\\") {
      this.#escape = true;
      this.#keyEscaped = true;
      return;
    }
    if (c !== '"') return;
    const raw = this.slice(this.#keyStart, at);
    if (this.#keyEscaped) try {
      this.#key = JSON.parse(`"${raw}"`);
    } catch (_error) {
      this.fail();
      return;
    }
    else this.#key = raw;
    this.#mode = "colon";
  }
  open(entry) {
    if (!this.#entries.has(this.#key)) this.#order.push(this.#key);
    this.#entries.set(this.#key, entry);
    this.#current = entry;
  }
  beginValue(c, at) {
    if (isWhitespace(c)) return;
    if (c === '"') {
      this.open({
        kind: "string",
        start: at + 1,
        end: -1,
        needsDecoding: false,
        invalidAt: void 0,
        length: void 0,
        text: void 0,
        prefixes: void 0
      });
      this.#escape = false;
      this.#mode = "string";
      return;
    }
    if (c === "}" || c === "," || c === ":" || c === "]") {
      this.fail();
      return;
    }
    this.open({
      kind: "value",
      start: at,
      end: -1,
      parsed: void 0,
      invalid: false
    });
    if (c === "{" || c === "[") {
      this.#mode = "nested";
      this.#nestedEnds = [c === "{" ? "}" : "]"];
      this.#nestedInString = false;
      this.#escape = false;
      return;
    }
    this.#mode = "scalar";
  }
  stepScalar(c, at) {
    if (c !== "," && c !== "}" && !isWhitespace(c)) return;
    this.closeValue(at);
    this.#mode = c === "," ? "key-only" : c === "}" ? "closed" : "comma-or-end";
  }
  stepNested(c, at) {
    if (this.#nestedInString) {
      this.#nestedInString = false;
      return;
    }
    if (c === '"') {
      this.#nestedInString = true;
      return;
    }
    if (c === "{" || c === "[") {
      this.#nestedEnds.push(c === "{" ? "}" : "]");
      return;
    }
    if (c === "}" || c === "]") {
      if (this.#nestedEnds.pop() !== c) {
        this.fail();
        return;
      }
      if (this.#nestedEnds.length === 0) {
        this.closeValue(at + 1);
        this.#mode = "comma-or-end";
      }
    }
  }
  closeValue(end) {
    const entry = this.#current;
    entry.end = end;
    this.#current = null;
  }
};
function assertNever(value, context) {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context ? ` in ${context}` : ""}: ${rendered}`);
}
function hasIntrinsicConstructor(prototype, name) {
  const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value;
  if (typeof constructor !== "function") return false;
  try {
    return constructor.name === name && constructor.prototype === prototype && Function.prototype.toString.call(constructor) === Function.prototype.toString.call(name === "Array" ? Array : Object);
  } catch {
    return false;
  }
}
function isIntrinsicObjectPrototype(value) {
  return Object.getPrototypeOf(value) === null && hasIntrinsicConstructor(value, "Object");
}
function hasPlainArrayPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(prototype) || !hasIntrinsicConstructor(prototype, "Array")) return false;
  const objectPrototype = Object.getPrototypeOf(prototype);
  return typeof objectPrototype === "object" && objectPrototype !== null && isIntrinsicObjectPrototype(objectPrototype);
}
function hasPlainObjectPrototype(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || typeof prototype === "object" && isIntrinsicObjectPrototype(prototype);
}
function enumerableStringKeys(value) {
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string" || !Object.prototype.propertyIsEnumerable.call(value, key))) return void 0;
  return keys;
}
function walkJsonValue(value, detach) {
  const ancestors = /* @__PURE__ */ new Set();
  let root;
  let parent;
  const assign = (item) => {
    if (parent === void 0) {
      if (detach) root = item;
    } else if (parent.kind === "array") {
      if (parent.target !== void 0) parent.target[parent.key] = item;
    } else if (parent.target !== void 0) Object.defineProperty(parent.target, parent.key, {
      value: item,
      enumerable: true,
      configurable: true,
      writable: true
    });
  };
  const frames = [];
  let current = value;
  for (; ; ) {
    if (current === null) assign(null);
    else if (typeof current === "boolean" || typeof current === "string") assign(current);
    else if (typeof current === "number") {
      if (!Number.isFinite(current) || Object.is(current, -0)) return void 0;
      assign(current);
    } else {
      if (typeof current !== "object") return void 0;
      if (ancestors.has(current)) return void 0;
      if (Array.isArray(current)) {
        if (!hasPlainArrayPrototype(current)) return void 0;
        const length = current.length;
        if (Reflect.ownKeys(current).length !== length + 1) return void 0;
        const target = detach ? [] : void 0;
        if (target !== void 0) assign(target);
        let indices;
        if (!Number.isInteger(length)) {
          indices = [];
          for (let index = length - 1; index >= 0; index--) indices.push(index);
        }
        frames.push({
          kind: "array",
          source: current,
          length: indices?.length ?? length,
          index: 0,
          key: 0,
          indices,
          target
        });
      } else {
        if (!hasPlainObjectPrototype(current)) return void 0;
        const keys = enumerableStringKeys(current);
        if (keys === void 0) return void 0;
        const target = detach ? {} : void 0;
        if (target !== void 0) assign(target);
        frames.push({
          kind: "object",
          source: current,
          keys,
          index: 0,
          key: "",
          target
        });
      }
      ancestors.add(current);
    }
    for (; ; ) {
      const frame = frames.at(-1);
      if (frame === void 0) return detach ? root : true;
      const length = frame.kind === "array" ? frame.length : frame.keys.length;
      if (frame.index >= length) {
        ancestors.delete(frame.source);
        frames.pop();
        continue;
      }
      const index = frame.index++;
      parent = frame;
      if (frame.kind === "array") {
        const key = frame.indices === void 0 ? index : frame.indices[frame.indices.length - index - 1];
        if (key === void 0) return void 0;
        if (!Object.prototype.hasOwnProperty.call(frame.source, key)) return void 0;
        frame.key = key;
        current = frame.source[key];
      } else {
        const key = frame.keys[index];
        if (key === void 0) return void 0;
        frame.key = key;
        current = frame.source[key];
      }
      break;
    }
  }
}
function snapshotJsonValue(value) {
  return walkJsonValue(value, true);
}
function deepFreeze(value) {
  const seen = /* @__PURE__ */ new WeakSet();
  const pending = [{
    kind: "visit",
    node: value
  }];
  while (pending.length > 0) {
    const task = pending.pop();
    if (task === void 0) continue;
    if (task.kind === "property") {
      pending.push({
        kind: "visit",
        node: task.source[task.key]
      });
      continue;
    }
    const node = task.node;
    if (node === null || typeof node !== "object") continue;
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    const keys = Object.keys(node);
    for (let index = keys.length - 1; index >= 0; index--) {
      const key = keys[index];
      if (key === void 0) continue;
      pending.push({
        kind: "property",
        source: node,
        key
      });
    }
  }
  return value;
}

// node_modules/@deepseek-ai/dsh-llm/lib/types/assistant-stream.js
function safeTime(value) {
  if (!Number.isSafeInteger(value))
    throw new TypeError(`Assistant stream time must be a safe integer, got ${String(value)}`);
  return value;
}
function safeIndex(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`${label} index must be a non-negative safe integer`);
  }
  return value;
}
function snapshotChunk(chunk) {
  const snapshot = snapshotJsonValue(chunk);
  if (snapshot === void 0)
    throw new TypeError("Assistant stream chunk must be losslessly JSON-serializable");
  return snapshot;
}
function expandAssistantStream(stream) {
  const chunks = [];
  for (const candidate of stream) {
    const record = validateRecord(candidate);
    if (record.type === "chunk") {
      chunks.push({ time: record.time, chunk: record.chunk });
      continue;
    }
    const members = record.type === "tool-call-chunks" ? record.args : record.texts;
    let time = record.time0;
    for (let index = 0; index < members.length; index += 1) {
      if (index > 0)
        time += record.dt[index - 1];
      let chunk;
      if (record.type === "text-chunks") {
        chunk = { type: "text-delta", index: record.index, text: members[index] };
      } else if (record.type === "reasoning-chunks") {
        chunk = { type: "reasoning-delta", index: record.index, text: members[index] };
      } else {
        chunk = {
          type: "tool-call-delta",
          index: record.index,
          id: record.id,
          ...Object.hasOwn(record, "name") ? { name: record.name } : {},
          argumentsDelta: members[index]
        };
      }
      chunks.push({ time, chunk });
    }
  }
  return chunks;
}
function validateRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Assistant stream record must be an object");
  }
  const record = value;
  switch (record.type) {
    case "text-chunks":
    case "reasoning-chunks": {
      exactKeys2(record, ["type", "time0", "index", "dt", "texts"], record.type);
      const texts = stringArray(record.texts, `${record.type} texts`);
      if (texts.length === 0)
        throw new TypeError(`${record.type} texts must be non-empty`);
      validateRun(record, texts.length, record.type);
      return record;
    }
    case "tool-call-chunks": {
      const keys = Object.hasOwn(record, "name") ? ["type", "time0", "index", "dt", "id", "name", "args"] : ["type", "time0", "index", "dt", "id", "args"];
      exactKeys2(record, keys, record.type);
      const args = stringArray(record.args, "tool-call-chunks args");
      if (args.length === 0)
        throw new TypeError("tool-call-chunks args must be non-empty");
      if (typeof record.id !== "string" || record.id.length === 0) {
        throw new TypeError("tool-call-chunks id must be a non-empty string");
      }
      if (record.name !== void 0 && (typeof record.name !== "string" || record.name.length === 0)) {
        throw new TypeError("tool-call-chunks name must be a non-empty string");
      }
      validateRun(record, args.length, record.type);
      return record;
    }
    case "chunk": {
      exactKeys2(record, ["type", "time", "chunk"], "chunk");
      const time = safeTime(record.time);
      if (typeof record.chunk !== "object" || record.chunk === null || Array.isArray(record.chunk)) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object");
      }
      let chunk;
      try {
        chunk = snapshotChunk(record.chunk);
      } catch (error) {
        throw new TypeError("Assistant stream raw chunk must be a lossless JSON object", { cause: error });
      }
      return deepFreeze({ type: "chunk", time, chunk });
    }
    default:
      throw new TypeError(`Unsupported Assistant stream record ${JSON.stringify(record.type)}`);
  }
}
function validateRun(record, members, label) {
  safeTime(record.time0);
  safeIndex(record.index, label);
  if (!Array.isArray(record.dt) || record.dt.some((value) => !Number.isSafeInteger(value))) {
    throw new TypeError(`${label} dt must contain safe integers`);
  }
  if (record.dt.length !== members - 1) {
    throw new TypeError(`${label} dt length must be one less than its members`);
  }
  let time = record.time0;
  for (const gap of record.dt) {
    time += gap;
    if (!Number.isSafeInteger(time))
      throw new TypeError(`${label} member times must stay safe integers`);
  }
}
function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((member) => typeof member !== "string")) {
    throw new TypeError(`${label} must be a string array`);
  }
  return value;
}
function exactKeys2(record, keys, label) {
  if (Object.keys(record).length !== keys.length || !keys.every((key) => Object.hasOwn(record, key))) {
    throw new TypeError(`${label} Assistant stream record must contain exactly ${keys.join(", ")}`);
  }
}

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/sessions/assistant-stream.js
var ClientAssistantStream = class {
  activeAttempt;
  retainedAttempt;
  pending = /* @__PURE__ */ new Map();
  publishedSeqs = /* @__PURE__ */ new Set();
  durableCursor = -1;
  transientInGap = 0;
  /**
   * Replace the durable Web window and adopt an optional reconnect baseline.
   * @param entries - durable entries in the replacement window.
   * @param baseline - compact prefix for an Assistant attempt that is still live.
   * @returns immediately visible durable entries plus reconstructed transient chunks.
   */
  replace(entries, baseline) {
    this.pending.clear();
    this.transientInGap = 0;
    this.activeAttempt = void 0;
    this.retainedAttempt = void 0;
    const opening = baseline?.activeAttempt;
    if (opening !== void 0) {
      this.activeAttempt = {
        attemptId: opening.attemptId,
        startedAfterSeq: opening.startedAfterSeq,
        turn: opening.turn,
        step: opening.step,
        nextIndex: opening.nextIndex
      };
    }
    const visible = [...entries];
    this.publishedSeqs = new Set(visible.map((entry) => entry.event.seq));
    this.durableCursor = visible.reduce((cursor, entry) => Math.max(cursor, entry.event.seq), -1);
    if (opening !== void 0) {
      for (const [index, member] of expandAssistantStream(opening.stream).entries()) {
        this.transientInGap += 1;
        visible.push({
          type: "transient",
          event: {
            type: "assistant/live-chunk",
            seq: this.durableCursor + 1 - 1 / (this.transientInGap + 1),
            time: member.time,
            data: {
              attemptId: opening.attemptId,
              turn: opening.turn,
              step: opening.step,
              chunk: member.chunk
            }
          }
        });
        if (index + 1 >= opening.nextIndex)
          break;
      }
    }
    return visible;
  }
  /**
   * Stage one durable v2 settlement while its matching live attempt is open.
   * @param entry - newly followed durable entry.
   * @returns a publication decision, or `undefined` when no entry becomes visible.
   */
  acceptDurable(entry) {
    const event = entry.event;
    this.durableCursor = Math.max(this.durableCursor, event.seq);
    this.transientInGap = 0;
    const settlement = assistantSettlementEntry(entry);
    if (settlement !== void 0 && this.attemptForSettlement(settlement.event) !== void 0) {
      if (this.pending.has(event.seq))
        return { type: "rebaseline" };
      this.pending.set(event.seq, settlement);
      return void 0;
    }
    return this.publish(entry);
  }
  /**
   * Fold one dense transient frame and release its named durable settlement.
   * Successful messages retain their transient rows until the owning Step ends;
   * interrupted messages, failed attempts, and abandonment retire them immediately.
   * @param frame - next Assistant stream frame received by the follow connection.
   * @returns a transient, publication, or rebaseline decision, or `undefined` when no entry becomes visible.
   */
  acceptFrame(frame) {
    switch (frame.type) {
      case "start":
        if (this.activeAttempt !== void 0 || this.retainedAttempt !== void 0 || this.pending.size > 0)
          return { type: "rebaseline" };
        this.pending.clear();
        this.activeAttempt = {
          attemptId: frame.attemptId,
          startedAfterSeq: frame.startedAfterSeq,
          turn: frame.turn,
          step: frame.step,
          nextIndex: 0
        };
        return void 0;
      case "chunk": {
        const attempt = this.activeAttempt;
        if (attempt === void 0 || attempt.attemptId !== frame.attemptId)
          return void 0;
        if (frame.index !== attempt.nextIndex)
          return { type: "rebaseline" };
        attempt.nextIndex += 1;
        this.transientInGap += 1;
        return {
          type: "transient",
          entry: {
            type: "transient",
            event: {
              type: "assistant/live-chunk",
              seq: this.durableCursor + 1 - 1 / (this.transientInGap + 1),
              time: frame.time,
              data: {
                attemptId: frame.attemptId,
                turn: attempt.turn,
                step: attempt.step,
                chunk: frame.chunk
              }
            }
          }
        };
      }
      case "end": {
        const attempt = this.activeAttempt;
        if (attempt === void 0 || attempt.attemptId !== frame.attemptId) {
          return void 0;
        }
        this.activeAttempt = void 0;
        if (frame.index !== attempt.nextIndex)
          return { type: "rebaseline" };
        if (frame.outcome.kind === "abandoned") {
          return this.pending.size === 0 ? { type: "abandonment", attemptId: attempt.attemptId } : { type: "rebaseline" };
        }
        if (this.publishedSeqs.has(frame.outcome.seq))
          return void 0;
        const entry = this.pending.get(frame.outcome.seq);
        if (entry === void 0 || entry.event.type !== frame.outcome.eventType) {
          return { type: "rebaseline" };
        }
        this.pending.delete(frame.outcome.seq);
        if (entry.event.type === "assistant/message" && entry.event.data.interrupted !== true) {
          this.retainedAttempt = { attemptId: attempt.attemptId, turn: attempt.turn, step: attempt.step };
          return this.publish(entry);
        }
        this.publishedSeqs.add(entry.event.seq);
        return { type: "settlement", attemptId: attempt.attemptId, entry };
      }
    }
  }
  attemptForSettlement(event) {
    const attempt = this.activeAttempt;
    if (attempt === void 0 || event.type === "assistant/message" && event.surfaceOp !== "append" || event.seq <= attempt.startedAfterSeq || attempt.turn !== event.data.turn || attempt.step !== event.data.step)
      return void 0;
    return attempt;
  }
  publish(entry) {
    this.publishedSeqs.add(entry.event.seq);
    const retained = this.retainedAttempt;
    if (retained !== void 0 && entry.event.type === "step/end" && entry.event.data.turn === retained.turn && entry.event.data.step === retained.step) {
      this.retainedAttempt = void 0;
      return { type: "publish", entry, retireAttemptId: retained.attemptId };
    }
    return { type: "publish", entry };
  }
};
function assistantSettlementEntry(entry) {
  return entry.event.type === "assistant/message" || entry.event.type === "assistant/attempt" ? entry : void 0;
}

// node_modules/@deepseek-ai/dsh-api-session-controller/lib/types/client/sessions/session.js
function projectionsBaseline(value) {
  return {
    ...value,
    asOfSeq: value.asOfSeq === -1 ? -1 : SessionSeq(value.asOfSeq)
  };
}
var PAGE_MESSAGES = 50;
var HISTORY_PAGE_OPTIONS = { maxMessages: 500, turnWindow: { minMessages: PAGE_MESSAGES, minTurns: 2 } };
var JUMP_PAGE_MESSAGES = 200;
var JUMP_PAGE_OPTIONS = {
  ...HISTORY_PAGE_OPTIONS,
  turnWindow: { ...HISTORY_PAGE_OPTIONS.turnWindow, minMessages: JUMP_PAGE_MESSAGES }
};
var Session = class {
  sessionId;
  remote;
  options;
  // ---- Window and derived state (all private; the snapshot is the only read API) ----
  baseSeq = SessionLogOffset(0);
  hasMore = false;
  openState = "cold";
  openError = null;
  openPromise = null;
  /** Bumped by stream replacement to invalidate an in-flight doOpen. Stale
   *  passes drop all writes once the generation moves on. */
  openGeneration = 0;
  loadingOlder = false;
  /** Shared low-water target of the running jump loop; null when no jump is paging. */
  jumpTargetSeq = null;
  /** The running jump loop's completion, shared by retargeting callers. */
  jumpPromise = null;
  pendingHistory = null;
  stopObservingInbox;
  assistantStream = new ClientAssistantStream();
  running = false;
  address;
  parentAvailable;
  /**
   * Sticky send marker, private input of the composerPhase derivation: set
   * when the Host accepts a prompt, never reset — the blank → engaging edge of
   * the phase machine (see ComposerPhase).
   */
  promptAttempted = false;
  /** A first accepted prompt stays in the engaging phase until its turn is observable. */
  firstPromptPendingTurn = false;
  /** New Session display state; unknown bare sessions begin conservatively blank. */
  blankBit = true;
  removed = false;
  promptError = null;
  lastAgentError = null;
  /** Local submission echoes, insertion-ordered, including those the Host has not accepted yet. */
  pendingSubmissions = [];
  /** The accepted echoes, published as SessionSnapshot.pendingSubmissions; rebuilt when one is accepted or removed. */
  acceptedSubmissions = [];
  /** Per-echo settlement state; `retiring` latches the first observation so a
   *  Inbox projection and its durable event cannot both retire one echo. */
  submissionSettlements = /* @__PURE__ */ new Map();
  /** Owns the addressed page/follow lifecycle while this Session is open. */
  events;
  /**
   * Per-session projection value store (push model; see the session-projection
   * subsystem page, docs/subsystems/session-projection.md): finished whole
   * values computed on the Host, seeded by the tail page's
   * projections block and updated by Session Controller control frames;
   * Host-sequenced writes merge under higher-seq-wins and cached list blocks
   * yield to them (projection-store.ts). Keys are read via `projections.faceOf(key)`
   * (the useProjection resolution face); the conversation snapshot never
   * carries projection values, and no client-side domain folding exists.
   * Manager-owned when constructed through SessionManager (frames route and
   * the store outlives instantiation, the title-snapshot precedent); a bare
   * construction gets a private store.
   */
  projections;
  /** Contiguous history and live tail consumed by Conversation assembly. */
  eventSource = new MutableSessionEventSource();
  snapshotCache;
  notifier;
  /**
   * Agent-scoped cordis context, bound once by ClientSessions when it
   * mints the scope (the client mirror of the host Agent's loopCtx). The
   * Session dispatches its own scoped events through it; undefined means
   * unbound (bare object-layer construction) or already pruned — both skip
   * dispatch-dependent behavior rather than fail.
   */
  actx;
  /**
   * @param sessionId - Host session identity (client sessions are always Host-born).
   * @param remote - generated Remote namespaces this session calls.
   * @param options - optional manager-owned state observers.
   */
  constructor(sessionId, remote, options = {}) {
    this.sessionId = sessionId;
    this.remote = remote;
    this.options = options;
    this.projections = options.projections ?? new ProjectionValueStore();
    this.address = options.address;
    this.parentAvailable = options.parentAvailable;
    this.notifier = new Notifier(() => {
      this.snapshotCache = this.buildSnapshot();
    });
    this.snapshotCache = this.buildSnapshot();
    this.stopObservingInbox = this.projections.faceOf("inbox").subscribe(() => {
      this.observeSubmissionInbox();
    });
  }
  /**
   * Bind the Agent-scoped context minted by ClientSessions (single write;
   * a second bind is a wiring error and throws). Direction stays one-way at
   * this binding boundary: consumers still reach the Session via `sessions.sessionOf`,
   * while the Session holds its own dispatch point (host Agent.loopCtx
   * mirror).
   * @param actx - the agent's scoped context.
   */
  bindScope(actx) {
    if (this.actx !== void 0)
      throw new Error(`session ${this.sessionId} already has a bound scope`);
    this.actx = actx;
  }
  /** Release the bound scope at prune time (a later rebind accompanies a freshly minted scope). */
  unbindScope() {
    this.actx = void 0;
  }
  // ---- Operations ----
  /**
   * Register one local submission echo (see the ISession declaration). The
   * echo reconciles against Host events from now on, but it enters the
   * snapshot only once the prompt receipt or an Inbox row carrying its
   * request id shows that the Host accepted it.
   * @param input - echo content and the optional settlement callback.
   * @returns the minted identity for {@link prompt} plus the pre-prompt abandon path.
   */
  beginSubmission(input) {
    const requestId = randomUUID();
    const placement = this.running ? input.mode === "steer" ? "steering" : "queued" : "transcript";
    this.pendingSubmissions = [...this.pendingSubmissions, {
      requestId,
      placement,
      time: Date.now(),
      text: input.text,
      attachments: input.attachments
    }];
    this.submissionSettlements.set(requestId, {
      placement,
      accepted: false,
      onAccept: input.onAccept,
      onRetire: input.onRetire,
      retiring: false
    });
    return { requestId, abandon: () => {
      this.retireFailedSubmission(requestId);
    } };
  }
  /**
   * Send (queue/steer passed through 1:1); failures land in the snapshot's
   * promptError. The Host can hold the prompt at its admission stage, so the
   * call can stay open; the echo appears and the blank → engaging edge flips
   * only once the Host accepts the prompt.
   * @param content - text, browser-owned temporary image uploads, and staged-file receipts.
   * @param mode - queue appends after the current turn; steer interrupts it.
   * @param signal - optional caller cancellation for the complete admission round-trip.
   * @param requestId - identity from {@link beginSubmission}; a failed identified prompt retires its echo.
   * @returns the prompt result (also mirrored into promptError on failure).
   */
  async prompt(content, mode, signal, requestId) {
    this.promptError = null;
    this.lastAgentError = null;
    const firstPrompt = this.blankBit && !this.firstPromptPendingTurn;
    if (firstPrompt)
      this.firstPromptPendingTurn = true;
    let result;
    if (this.address === void 0) {
      const clientTimeZone = resolvedClientTimeZone();
      result = await this.remote.session.prompt({
        requestId: requestId ?? randomUUID(),
        sessionId: this.sessionId,
        mode,
        content,
        clientTimeZone
      }, signal);
    } else if (content.some((part) => part.type === "file")) {
      result = {
        ok: false,
        error: new RemoteError("subagent/attachment-invalid", "subagent continuation does not accept files", { reason: "SUBAGENT_FILE_UNSUPPORTED" })
      };
    } else {
      const routedContent = content;
      const routed = await this.remote.subagents.prompt({
        requestId: requestId ?? randomUUID(),
        parentSessionId: this.address.parentSessionId,
        childSessionId: this.address.childSessionId,
        mode: "continuable",
        delivery: mode,
        content: routedContent,
        clientTimeZone: resolvedClientTimeZone()
      }, signal);
      result = routed.ok ? { ok: true, value: { accepted: true } } : routed;
    }
    if (!result.ok) {
      if (firstPrompt)
        this.firstPromptPendingTurn = false;
      if (requestId !== void 0)
        this.retireFailedSubmission(requestId);
      this.promptError = { op: "send", error: result.error };
      this.notifier.markDirty();
      return result;
    }
    this.acceptPrompt(requestId);
    return result;
  }
  /**
   * Apply the Host's acceptance of one prompt: publish its echo, move a blank
   * Session to engaging, and tell the submitter. The prompt receipt and an
   * Inbox row carrying the prompt's request id both prove acceptance.
   * Whichever arrives first publishes the echo; a later proof for an echo
   * still pending changes nothing.
   * @param requestId - identity from {@link beginSubmission}; absent for a prompt sent without an echo.
   */
  acceptPrompt(requestId) {
    const settlement = requestId === void 0 ? void 0 : this.submissionSettlements.get(requestId);
    if (settlement?.accepted === true)
      return;
    if (settlement !== void 0) {
      settlement.accepted = true;
      this.refreshAcceptedSubmissions();
    }
    this.promptAttempted = true;
    this.blankBit = false;
    this.notifier.markDirty();
    this.options.onEngaged?.(this);
    settlement?.onAccept?.();
  }
  /**
   * Resolve one stored image into browser-consumable bytes using this Session's gateway permission scope.
   * @param attachment - complete image reference from the folded session log.
   * @returns the supplied reference after storage verification, and decoded bytes.
   */
  async readAttachment(attachment) {
    const result = await this.remote.session.attachment({
      sessionId: this.sessionId,
      attachment
    });
    if (!result.ok)
      return result;
    const binary = atob(result.value.data);
    const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return { ok: true, value: { attachment: result.value.attachment, data } };
  }
  /** Apply one operation to a still-pending queue occurrence. */
  async updateQueue(itemId, action) {
    return this.remote.session.updateQueue({ sessionId: this.sessionId, itemId, action });
  }
  /**
   * Stop the active turn while the Host preserves pending inbox work; failures
   * land in promptError (same error-strip display slot). A subagent address
   * routes through `subagents.interruptByParent`, whose durable parent-address
   * authority works without a live parent Agent.
   * @returns the cancel result.
   */
  async cancel() {
    const address = this.address;
    const result = address !== void 0 ? await this.remote.subagents.interruptByParent(address.childSessionId, address.parentSessionId, "continuable") : await this.remote.session.cancel({ sessionId: this.sessionId });
    if (!result.ok) {
      this.promptError = { op: "stop", error: result.error };
      this.notifier.markDirty();
    }
    return result;
  }
  /**
   * Rename: contract session.rename 1:1. On success settle the 'title'
   * projection cell from the response's `{title, seq}` under the store's
   * higher-seq-wins rule (the push frame arriving later is a no-op replay),
   * so the list row and any useProjection('title') reader update without
   * waiting for the control-stream projection update.
   * @param title - raw title text (the host normalizes acceptance).
   * @returns the rename result (normalized accepted title + title event seq).
   */
  async rename(title) {
    const result = await this.remote.session.rename({ sessionId: this.sessionId, title });
    if (!result.ok)
      return result;
    const seq = SessionSeq(result.value.seq);
    this.projections.apply("title", result.value.title, seq);
    return { ok: true, value: { title: result.value.title, seq } };
  }
  /**
   * Execute one slash-command line against this session's agent — pure
   * admission semantics (the host executor durably logs the lifecycle;
   * outcomes render as flow nodes, never as a response echo).
   * @param line - the full command line, leading slash included.
   * @returns the admission result.
   */
  async command(line) {
    const result = await this.remote.commands.execute(this.sessionId, line, []);
    if (!result.ok)
      return result;
    return { ok: true, value: { matched: result.value !== void 0 } };
  }
  /** First open: pull the tail page (idempotent — in-flight/already-open returns the existing promise). */
  open() {
    if (this.openState === "open")
      return Promise.resolve();
    if (this.openPromise !== null)
      return this.openPromise;
    const promise = this.doOpen(this.openGeneration).finally(() => {
      if (this.openPromise === promise)
        this.openPromise = null;
    });
    this.openPromise = promise;
    return promise;
  }
  /** Prepend one Turn-aligned page: at least 50 messages and two Turn starts, capped at 500 messages. */
  async loadOlder() {
    if (this.openState !== "open" || !this.hasMore || this.loadingOlder)
      return;
    const events = this.events;
    if (events === void 0)
      return;
    this.loadingOlder = true;
    this.notifier.markDirty();
    try {
      await events.prepend({
        beforeSeq: this.baseSeq,
        ...HISTORY_PAGE_OPTIONS
      });
    } catch (error) {
      if (!isRemoteFailure(error)) {
        console.error("[session-controller] loadOlder failed:", error);
      }
    } finally {
      this.loadingOlder = false;
      this.notifier.markDirty();
    }
  }
  /** Jump loader: page backwards until the window covers seq (see ISession.loadThrough). */
  loadThrough(seq) {
    if (this.openState !== "open" || !this.hasMore || this.baseSeq <= seq)
      return Promise.resolve();
    if (this.jumpPromise !== null) {
      this.jumpTargetSeq = SessionSeq(Math.min(this.jumpTargetSeq ?? seq, seq));
      return this.jumpPromise;
    }
    if (this.loadingOlder)
      return Promise.resolve();
    const events = this.events;
    if (events === void 0)
      return Promise.resolve();
    const pending = {
      beforeSeq: this.baseSeq,
      hasMore: this.hasMore,
      pages: []
    };
    this.pendingHistory = pending;
    this.jumpTargetSeq = seq;
    this.loadingOlder = true;
    this.notifier.markDirty();
    const generation = this.openGeneration;
    this.jumpPromise = (async () => {
      try {
        while (pending.hasMore && this.jumpTargetSeq !== null && pending.beforeSeq > this.jumpTargetSeq) {
          if (generation !== this.openGeneration)
            return;
          const before = pending.beforeSeq;
          await events.prepend({ beforeSeq: before, ...JUMP_PAGE_OPTIONS });
          if (pending.beforeSeq >= before)
            return;
        }
      } catch (error) {
        if (!isRemoteFailure(error)) {
          console.error("[session-controller] loadThrough failed:", error);
        }
      } finally {
        this.jumpTargetSeq = null;
        this.jumpPromise = null;
        this.pendingHistory = null;
        this.loadingOlder = false;
        if (generation === this.openGeneration && pending.pages.length > 0) {
          this.prependWindow(pending.pages.reverse().flat(), pending.hasMore);
        }
        this.notifier.markDirty();
      }
    })();
    return this.jumpPromise;
  }
  /** Rebuild an opened history source after address replacement.
   *  Invalidates any in-flight open first; projection state belongs to the independently
   *  reconnecting control stream and remains untouched. */
  async resync() {
    if (this.openState === "cold")
      return;
    this.openGeneration++;
    const events = this.events;
    this.events = void 0;
    await events?.dispose();
    this.openPromise = null;
    this.openState = "cold";
    this.openError = null;
    this.baseSeq = SessionLogOffset(0);
    this.notifier.markDirty();
    await this.open();
  }
  // ---- Subscription API (useSyncExternalStore direct wiring) ----
  /**
   * uSES subscription entry.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribe(listener) {
    return this.notifier.subscribe(listener);
  }
  /**
   * Cached Session snapshot (rebuilt lazily when dirty with no listeners).
   * @returns the cached reference (stable until the next flush).
   */
  getSnapshot() {
    this.notifier.ensureFresh();
    return this.snapshotCache;
  }
  // ---- Manager-only entry points (@internal; never called by the UI) ----
  /**
   * Running-bit relay from the host stream (list entry and snapshot stay consistent).
   * @param running - the new running state.
   */
  handleRunning(running) {
    if (running && this.blankBit) {
      this.blankBit = false;
      this.notifier.markDirty();
    }
    if (running)
      this.firstPromptPendingTurn = false;
    if (this.running === running)
      return;
    this.running = running;
    this.notifier.markDirty();
  }
  /**
   * Install or clear the catalog-discovered transport address. A changed
   * address rebuilds an already-open window through its new history route.
   * @param address - direct parent/child address, or undefined for ordinary transport.
   * @param parentAvailable - latest exact-parent availability hint, or undefined before a catalog read.
   */
  configureSubagent(address, parentAvailable) {
    const same = this.address?.parentSessionId === address?.parentSessionId && this.address?.childSessionId === address?.childSessionId && this.address?.mode === address?.mode;
    this.address = address;
    this.parentAvailable = parentAvailable;
    if (!same && this.openState !== "cold")
      void this.resync();
    else
      this.notifier.markDirty();
  }
  /**
   * Update only the parent availability hint from a catalog refresh.
   * @param available - whether the exact direct parent is live.
   */
  handleSubagentParentAvailable(available) {
    if (this.parentAvailable === available)
      return;
    this.parentAvailable = available;
    this.notifier.markDirty();
  }
  /**
   * Apply the Manager's effective display blank, further reconciled with the
   * current `sessionListMetadata` projection. Local send attempts and current
   * running state prevent re-blanking; an earlier false summary alone does not.
   * The Manager retains acceptance and earlier running observations across
   * Session-object replacement.
   * @param blank - New Session display state after Manager reconciliation.
   */
  handleBlank(blank) {
    blank = blank && this.projections.values().sessionListMetadata?.blank !== false;
    if (blank === this.blankBit)
      return;
    if (blank && (this.promptAttempted || this.running))
      return;
    this.blankBit = blank;
    this.notifier.markDirty();
  }
  /** `api-session/removed` relay: flag the snapshot while retaining the resident instance. */
  handleRemoved() {
    this.removed = true;
    this.notifier.markDirty();
  }
  /**
   * `api-session/error` relay: the outlet for live failures with no turn position.
   * @param message - the stringified error.
   */
  handleAgentError(message) {
    this.lastAgentError = message;
    this.notifier.markDirty();
  }
  /**
   * Stop the Session's live Remote source.
   * @returns when the Remote iterator has completed teardown.
   */
  async dispose() {
    this.stopObservingInbox();
    for (const [requestId, settlement] of [...this.submissionSettlements]) {
      if (settlement.admitted !== void 0)
        this.scheduleObservedRetirement(requestId, settlement.admitted);
      else
        this.retireFailedSubmission(requestId);
    }
    this.openGeneration++;
    const events = this.events;
    this.events = void 0;
    await events?.dispose();
  }
  // ---- Private ----
  /** @param generation - openGeneration at launch; stale passes cannot publish after replacement. */
  async doOpen(generation) {
    this.openState = "loading";
    this.openError = null;
    this.notifier.markDirty();
    const events = new SessionEventStream(this.remote, this.sessionAddress(), {
      publish: (change) => {
        if (generation !== this.openGeneration || this.events !== events)
          return;
        this.acceptEventChange(change);
      },
      failed: (error) => {
        this.failEventStream(events, generation, error);
      }
    });
    this.events = events;
    try {
      await events.open(HISTORY_PAGE_OPTIONS);
      if (generation !== this.openGeneration || this.events !== events)
        return;
      this.openState = "open";
    } catch (error) {
      if (generation !== this.openGeneration || this.events !== events)
        return;
      if (!isRemoteFailure(error))
        throw error;
      this.events = void 0;
      this.openState = "error";
      this.openError = error;
    } finally {
      if (generation === this.openGeneration)
        this.notifier.markDirty();
    }
  }
  /** Apply one contiguous journal update already reconciled by the Remote stream. */
  acceptEventChange(change) {
    switch (change.type) {
      case "replace":
        this.installWindow(change.entries, change.hasMore, change.page.projections === void 0 ? void 0 : projectionsBaseline(change.page.projections), change.page.assistantStream);
        return;
      case "prepend":
        this.prependWindow(change.entries, change.hasMore);
        return;
      case "append":
        this.publishAssistantEntry(this.assistantStream.acceptDurable(change.entry));
        return;
      case "assistant-stream":
        this.publishAssistantEntry(this.assistantStream.acceptFrame(change.frame));
    }
  }
  /** Replace the complete contiguous window and apply page-owned projection metadata. */
  installWindow(entries, hasMore, projections, assistantStream) {
    const visible = this.assistantStream.replace(entries, assistantStream);
    this.baseSeq = SessionLogOffset(entries[0]?.event.seq ?? 0);
    this.hasMore = hasMore;
    if (this.pendingHistory !== null) {
      this.pendingHistory.beforeSeq = this.baseSeq;
      this.pendingHistory.hasMore = hasMore;
      this.pendingHistory.pages.length = 0;
    }
    if (visible.some((entry) => entry.event.type === "turn/start"))
      this.firstPromptPendingTurn = false;
    if (projections !== void 0)
      this.projections.seed(projections);
    this.eventSource.replace(visible, hasMore);
    if (projections !== void 0) {
      for (const [requestId, { receipt }] of this.submissionSettlements) {
        if (receipt !== void 0 && receipt.seq <= projections.asOfSeq) {
          this.scheduleObservedRetirement(requestId, receipt.attachments);
        }
      }
    }
    for (const entry of visible)
      this.observeSubmissionEvent(entry.event);
    if (projections !== void 0) {
      const inbox = projections.values.inbox;
      for (const target of ["next-turn", "next-step"]) {
        this.observeSubmissionInsertions(target, inbox?.[target] ?? [], 0, projections.asOfSeq);
      }
    }
    this.notifier.markDirty();
  }
  publishAssistantEntry(result) {
    if (result?.type === "rebaseline") {
      const events = this.events;
      queueMicrotask(() => {
        if (events !== void 0 && this.events === events)
          events.restart();
      });
      return;
    }
    if (result?.type === "settlement") {
      this.eventSource.settleAssistant(result.attemptId, result.entry);
      this.observeSubmissionEvent(result.entry.event);
      this.notifier.markDirty();
      return;
    }
    if (result?.type === "abandonment") {
      this.eventSource.settleAssistant(result.attemptId);
      this.notifier.markDirty();
      return;
    }
    if (result?.type === "publish") {
      const changed = this.appendLive(result.entry);
      if (result.retireAttemptId !== void 0)
        this.eventSource.settleAssistant(result.retireAttemptId);
      if (changed || result.retireAttemptId !== void 0)
        this.notifier.markDirty();
    } else if (result?.type === "transient") {
      this.eventSource.append(result.entry);
      this.notifier.markDirty();
    }
  }
  /** Prepend one stream-validated history page. */
  prependWindow(entries, hasMore) {
    if (this.pendingHistory !== null) {
      const pending = this.pendingHistory;
      pending.beforeSeq = entries[0] === void 0 ? pending.beforeSeq : SessionLogOffset(entries[0].event.seq);
      pending.hasMore = hasMore;
      pending.pages.push(entries);
      return;
    }
    this.baseSeq = entries[0] === void 0 ? this.baseSeq : SessionLogOffset(entries[0].event.seq);
    this.hasMore = hasMore;
    this.eventSource.prepend(entries, hasMore);
  }
  /** Append one stream-validated live event. */
  appendLive(entry) {
    const event = entry.event;
    const awaitingFirstTurn = this.firstPromptPendingTurn;
    if (event.type === "turn/start")
      this.firstPromptPendingTurn = false;
    this.eventSource.append(entry);
    this.observeSubmissionEvent(event);
    return awaitingFirstTurn !== this.firstPromptPendingTurn;
  }
  /** Observe durable acceptance even when insertion and claim share one projection notification. */
  observeSubmissionEvent(event) {
    if (this.submissionSettlements.size === 0)
      return;
    if (event.type === "agent/inbox/spliced") {
      const { target, start, removedCount = 0, inserted, outcome } = event.data;
      for (const [requestId, settlement] of this.submissionSettlements) {
        const receipt = settlement.receipt;
        if (receipt?.target !== target || receipt.index === null || receipt.seq >= event.seq)
          continue;
        const removed = receipt.index >= start && receipt.index < start + removedCount;
        if (removed && outcome === "canceled")
          this.retireFailedSubmission(requestId);
        else
          settlement.receipt = {
            ...receipt,
            seq: event.seq,
            index: removed ? null : receipt.index < start ? receipt.index : receipt.index + inserted.length - removedCount
          };
      }
      this.observeSubmissionInsertions(target, inserted, start, event.seq);
      for (const message of inserted)
        this.observeSubmissionMessage(message, false, false);
      return;
    }
    if (event.type === "request/context" || event.type === "turn/end") {
      for (const [requestId, settlement] of this.submissionSettlements) {
        if (settlement.admitted === void 0 && settlement.receipt?.index === null && settlement.receipt.seq < event.seq)
          this.retireFailedSubmission(requestId);
      }
      return;
    }
    if (event.type === "user/message")
      this.observeSubmissionMessage(event.data, true);
  }
  observeSubmissionInsertions(target, messages, start, seq) {
    for (const [index, message] of messages.entries()) {
      const source = message.source;
      if (source.kind !== "user" || !("rpcId" in source))
        continue;
      const settlement = this.submissionSettlements.get(source.rpcId);
      if (settlement === void 0 || settlement.retiring || (settlement.receipt?.seq ?? -1) > seq)
        continue;
      settlement.receipt = { target, seq, index: start + index, attachments: attachmentRefsIn(message.content) };
      this.acceptPrompt(source.rpcId);
    }
  }
  observeSubmissionMessage(message, admitted, retireQueued = true) {
    const source = message.source;
    if (source.kind !== "user" || !("rpcId" in source))
      return;
    const settlement = this.submissionSettlements.get(source.rpcId);
    if (settlement === void 0 || settlement.retiring)
      return;
    if (!admitted) {
      if (settlement.placement === "queued" && retireQueued) {
        this.scheduleObservedRetirement(source.rpcId, attachmentRefsIn(message.content));
      }
      return;
    }
    settlement.admitted = attachmentRefsIn(message.content);
    this.retireAdmittedSubmission(source.rpcId);
  }
  /** Retire admitted Chat identities only after stale Inbox rows can no longer reappear. */
  retireAdmittedSubmission(requestId) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement?.admitted === void 0)
      return;
    const receipt = settlement.receipt;
    if (receipt?.index === null && (this.projections.seqOf("inbox") ?? -1) < receipt.seq)
      return;
    this.scheduleObservedRetirement(requestId, settlement.admitted);
  }
  /** Inbox acceptance retires queued echoes; its watermark completes admitted Chat handoffs. */
  observeSubmissionInbox() {
    if (this.submissionSettlements.size === 0)
      return;
    const inbox = this.projections.get("inbox");
    if (inbox === void 0)
      return;
    const seq = this.projections.seqOf("inbox");
    for (const target of ["next-turn", "next-step"]) {
      if (seq !== void 0)
        this.observeSubmissionInsertions(target, inbox[target], 0, seq);
      for (const message of inbox[target])
        this.observeSubmissionMessage(message, false);
    }
    for (const requestId of this.submissionSettlements.keys())
      this.retireAdmittedSubmission(requestId);
  }
  /**
   * Latch one observed settlement and remove the echo an animation frame
   * later. The delay keeps the echo in the snapshot until the frame in which
   * the durable node (whose assembly frame was registered first) is
   * renderable; the render-time rpcId dedupe hides the one-frame overlap.
   */
  scheduleObservedRetirement(requestId, attachments) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement === void 0 || settlement.retiring)
      return;
    settlement.retiring = true;
    scheduleFrame(() => {
      this.finishSubmission(requestId, { reason: "observed", attachments });
    });
  }
  /** Remove one unsettled echo immediately (prompt rejection, abort, or disposal). */
  retireFailedSubmission(requestId) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement === void 0 || settlement.retiring || settlement.admitted !== void 0)
      return;
    settlement.retiring = true;
    this.finishSubmission(requestId, { reason: "failed" });
  }
  refreshAcceptedSubmissions() {
    this.acceptedSubmissions = this.pendingSubmissions.filter((echo) => this.submissionSettlements.get(echo.requestId)?.accepted === true);
  }
  /** Single removal point: drop the echo, publish, then notify the owner. */
  finishSubmission(requestId, retirement) {
    const settlement = this.submissionSettlements.get(requestId);
    if (settlement === void 0)
      return;
    this.submissionSettlements.delete(requestId);
    this.pendingSubmissions = this.pendingSubmissions.filter((echo) => echo.requestId !== requestId);
    if (settlement.accepted)
      this.refreshAcceptedSubmissions();
    this.notifier.markDirty();
    settlement.onRetire?.(retirement);
  }
  /** Publish a terminal background failure only while this stream still owns the Session. */
  failEventStream(events, generation, error) {
    if (generation !== this.openGeneration || this.events !== events)
      return;
    if (!isRemoteFailure(error))
      throw error;
    this.openGeneration++;
    this.events = void 0;
    this.openPromise = null;
    this.openState = "error";
    this.openError = error;
    void events.dispose();
    this.notifier.markDirty();
  }
  buildSnapshot() {
    const identity = this.projections.values().subagent;
    return {
      sessionId: this.sessionId,
      pendingSubmissions: this.acceptedSubmissions,
      running: this.running,
      subagent: this.address === void 0 ? null : {
        address: this.address.mode === "unknown" && identity != null ? { ...this.address, mode: identity.mode } : this.address,
        ...this.parentAvailable === void 0 ? {} : { parentAvailable: this.parentAvailable }
      },
      removed: this.removed,
      openState: this.openState,
      openError: this.openError,
      hasMore: this.hasMore,
      loadingOlder: this.loadingOlder,
      promptError: this.promptError,
      blank: this.blankBit,
      lastAgentError: this.lastAgentError,
      promptAttempted: this.promptAttempted,
      // The flag is set before the receipt; the Session leaves blank only once the Host accepted the prompt.
      awaitingFirstTurn: this.firstPromptPendingTurn && !this.blankBit
    };
  }
  sessionAddress() {
    return this.address === void 0 ? { kind: "session", sessionId: this.sessionId } : { kind: "subagent", ...this.address };
  }
};
function scheduleFrame(fn) {
  if (typeof requestAnimationFrame === "function")
    requestAnimationFrame(() => {
      fn();
    });
  else
    setTimeout(fn, 0);
}
function attachmentRefsIn(content) {
  if (!Array.isArray(content))
    return [];
  const refs = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null)
      continue;
    const candidate = block;
    if ((candidate.type === "image" || candidate.type === "file") && typeof candidate.attachment === "object" && candidate.attachment !== null) {
      refs.push(candidate.attachment);
    }
  }
  return refs;
}

// client/entry.js
var import_client4 = require("@deepseek-ai/dsh-api-session-controller/client");
var import_client5 = require("@deepseek-ai/dsh-client-ui-model-selection/client");

// node_modules/@deepseek-ai/dsh-api-remote-access/lib/types/client/state.js
var CLOSED = Object.freeze({ kind: "closed" });
var OWNER_SNAPSHOT = Object.freeze({ kind: "owner" });
var GLOBAL_KEY = "\0global";
var ClientAccessState = class {
  snapshot = CLOSED;
  /** @param initial - the page's injected opening baseline; without one every answer is false until a baseline arrives. */
  constructor(initial) {
    if (initial !== void 0)
      this.replace(initial);
  }
  listeners = /* @__PURE__ */ new Set();
  sources = /* @__PURE__ */ new Map();
  /**
   * Answer for one action on the global resource.
   * @param action - endpoint action the caller may invoke.
   * @returns identity-stable boolean source.
   */
  global(action) {
    return this.cached(GLOBAL_KEY, "", action);
  }
  /**
   * Answer for one action on one resource of a declared kind.
   * @param kind - declared resource kind.
   * @param id - resource identity.
   * @param action - endpoint action the caller may invoke.
   * @returns identity-stable boolean source.
   */
  resource(kind, id, action) {
    return this.cached(kind, id, action);
  }
  /**
   * Replace the snapshot from one generation's opening frame.
   * @param frame - owner or non-owner baseline.
   */
  replace(frame) {
    if (frame.owner) {
      this.publish(OWNER_SNAPSHOT);
      return;
    }
    let global = /* @__PURE__ */ new Set();
    const resources = /* @__PURE__ */ new Map();
    for (const { resource, actions } of frame.grants) {
      if (resource.kind === "global") {
        global = new Set(actions);
        continue;
      }
      let grants = resources.get(resource.kind);
      if (grants === void 0) {
        grants = /* @__PURE__ */ new Map();
        resources.set(resource.kind, grants);
      }
      grants.set(resource.id, new Set(actions));
    }
    this.publish({ kind: "granted", global, resources });
  }
  /**
   * Apply one increment of the current generation.
   * @param frame - `upsert` or `remove`.
   */
  update(frame) {
    const current = this.snapshot;
    if (current.kind !== "granted")
      return;
    switch (frame.type) {
      case "upsert":
        this.publish(withGrant(current, frame.grant));
        return;
      case "remove":
        this.publish(withGrant(current, { resource: frame.resource, actions: [] }, true));
        return;
      /* v8 ignore next -- the generated Remote codec validates this closed union. */
      default:
        return assertNever2(frame);
    }
  }
  /** Whether the current snapshot is the owner's, whose answers never depend on the stream. */
  get owner() {
    return this.snapshot.kind === "owner";
  }
  /** The stream failed terminally: the owner keeps every answer; a non-owner's answers become false. */
  unavailable() {
    if (this.snapshot.kind !== "owner")
      this.publish(CLOSED);
  }
  cached(kind, id, action) {
    const key = `${kind}\0${id}\0${action}`;
    let source = this.sources.get(key);
    if (source === void 0) {
      source = {
        getSnapshot: () => answer(this.snapshot, kind, id, action),
        subscribe: (listener) => {
          this.listeners.add(listener);
          return () => {
            this.listeners.delete(listener);
          };
        }
      };
      this.sources.set(key, source);
    }
    return source;
  }
  publish(next) {
    this.snapshot = next;
    for (const listener of [...this.listeners])
      listener();
  }
};
function answer(snapshot, kind, id, action) {
  switch (snapshot.kind) {
    case "closed":
      return false;
    case "owner":
      return true;
    case "granted": {
      const allowed = kind === GLOBAL_KEY ? snapshot.global : snapshot.resources.get(kind)?.get(id);
      return allowed?.has(action) ?? false;
    }
    /* v8 ignore next -- closed union. */
    default:
      return assertNever2(snapshot);
  }
}
function withGrant(snapshot, grant, remove = false) {
  const resource = grant.resource;
  if (resource.kind === "global")
    return { ...snapshot, global: new Set(grant.actions) };
  const resources = new Map(snapshot.resources);
  const grants = new Map(resources.get(resource.kind));
  if (remove)
    grants.delete(resource.id);
  else
    grants.set(resource.id, new Set(grant.actions));
  resources.set(resource.kind, grants);
  return { ...snapshot, resources };
}
function assertNever2(value) {
  throw new Error(`unreachable access frame: ${JSON.stringify(value)}`);
}

// node_modules/@deepseek-ai/dsh-api-remote-access/lib/types/client/when-allowed.js
function whenAllowed(ctx, answer2, callback, label) {
  const disposeController = ctx.effect(() => {
    let installed;
    let stopped = false;
    const uninstall = () => {
      const dispose = installed;
      installed = void 0;
      dispose?.();
    };
    const reconcile = () => {
      if (stopped)
        return;
      const allowed = answer2.getSnapshot();
      if (allowed === (installed !== void 0))
        return;
      if (!allowed) {
        uninstall();
        return;
      }
      const disposeEffect = ctx.effect(callback, `${label}: allowed`);
      installed = () => {
        void disposeEffect();
      };
    };
    const unsubscribe = answer2.subscribe(() => {
      changed();
    });
    const stop = () => {
      if (stopped)
        return;
      stopped = true;
      unsubscribe();
      uninstall();
    };
    const changed = () => {
      try {
        reconcile();
      } catch (error) {
        stop();
        if (error?.code === "INACTIVE_EFFECT")
          return;
        const failure = error instanceof Error ? error : new Error(String(error));
        queueMicrotask(() => {
          throw failure;
        });
      }
    };
    try {
      reconcile();
    } catch (error) {
      stop();
      throw error;
    }
    return stop;
  }, label);
  return () => {
    void disposeController();
  };
}

// client/transport.js
var identityKeys = /* @__PURE__ */ new Set(["sessionId", "agentId", "childSessionId", "parentSessionId", "workspaceId", "beforeWorkspaceId", "beforeSessionId"]);
function remoteIdentity(id) {
  if (typeof id !== "string" || !id.startsWith("remote:")) return void 0;
  const separator = id.indexOf(":", 7);
  if (separator < 8 || separator === id.length - 1) return void 0;
  return { hostId: id.slice(7, separator), rawId: id.slice(separator + 1) };
}
function remoteInvocationIdentity(descriptor, args) {
  for (let index = 0; index < descriptor.parameters.length; index++) {
    const parameter = descriptor.parameters[index];
    const value = args[index];
    const candidates = identityKeys.has(parameter.wire) ? [value] : ["request", "_request"].includes(parameter.wire) && value !== null && typeof value === "object" ? [...Object.entries(value).filter(([key]) => identityKeys.has(key)).map(([, id]) => id), value.address?.sessionId] : [];
    for (const id of candidates) {
      const parsed = remoteIdentity(id);
      if (parsed !== void 0) return parsed;
    }
  }
}
function wireValue(value, hostId, key) {
  if (identityKeys.has(key) && typeof value === "string") {
    const id = remoteIdentity(value);
    if (id === void 0) return value;
    if (id.hostId !== hostId) throw new Error("\u4E0D\u80FD\u5411\u53E6\u4E00\u53F0\u673A\u5668\u53D1\u9001\u4F1A\u8BDD\u64CD\u4F5C");
    return id.rawId;
  }
  if (Array.isArray(value)) return value.map((item) => wireValue(item, hostId));
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, wireValue(item, hostId, name)]));
}
function createHostTransport(ctx, hostId, baseUrl, runtime, warn) {
  const { RemoteStream: RemoteStream2, RemoteStreamMuxClient: RemoteStreamMuxClient2, RemoteError: RemoteError2 } = runtime;
  const lifetime = new AbortController();
  const access = new runtime.ClientAccessState();
  const listeners = /* @__PURE__ */ new Set();
  let generationValue;
  let generationNumber = 0;
  let reconnectTimer;
  const generation = {
    getSnapshot: () => generationValue,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
  const publish = (value) => {
    generationValue = value;
    for (const listener of listeners) listener();
  };
  const socketUrl = `${baseUrl.replace(/^http/, "ws")}/host/${encodeURIComponent(hostId)}/api/remote.mux`;
  const mux = new RemoteStreamMuxClient2(() => {
    const socket = new WebSocket(socketUrl);
    socket.addEventListener("open", () => publish({ id: ++generationNumber, host: { home: void 0 } }));
    socket.addEventListener("close", () => {
      if (lifetime.signal.aborted) return;
      publish(void 0);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => mux.reconnect(), 1e3);
    });
    return socket;
  }, true);
  mux.start();
  async function request(endpoint, args, signal) {
    const combined = AbortSignal.any([lifetime.signal, signal ?? AbortSignal.timeout(3e4)]);
    try {
      const response = await fetch(`${baseUrl}/host/${encodeURIComponent(hostId)}/api/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: combined,
        body: JSON.stringify({ type: "client-request", rpcId: crypto.randomUUID(), method: endpoint, payload: { args: wireValue(args, hostId) } })
      });
      if (!response.ok) throw new Error(`\u8FDC\u7A0B\u8BF7\u6C42\u5931\u8D25\uFF1AHTTP ${response.status}`);
      const body = await response.json();
      if (body.result?.ok !== true) {
        const error = body.result?.error;
        return { ok: false, error: new RemoteError2(error?.code ?? "gateway/internal", error?.message ?? "\u8FDC\u7A0B\u8C03\u7528\u5931\u8D25", error?.details ?? {}) };
      }
      return body.result;
    } catch (error) {
      return { ok: false, error: new RemoteError2(combined.aborted ? "gateway/cancelled" : "gateway/internal", error.message, {}) };
    }
  }
  function invoke(endpoint, values, sessionId) {
    const descriptor = ctx.typert.remotes.get(endpoint);
    if (descriptor === void 0) throw new Error(`\u5F53\u524D DSH \u672A\u63D0\u4F9B\u63A5\u53E3 ${endpoint}`);
    const projection = descriptor.scope;
    const scoped = sessionId !== void 0 && projection !== void 0;
    const parameters = descriptor.parameters;
    const expected = parameters.length - (scoped ? 1 : 0);
    const args = {};
    let index = 0;
    for (const parameter of parameters) {
      const value = scoped && parameter.wire === projection.wire ? sessionId : values[index++];
      if (value !== void 0) args[parameter.wire] = value;
    }
    const signal = values[expected] instanceof AbortSignal ? values[expected] : void 0;
    if (descriptor.mode !== void 0) {
      const controller = new AbortController();
      const combined = AbortSignal.any([lifetime.signal, controller.signal, ...signal === void 0 ? [] : [signal]]);
      const stream = mux.open(endpoint, { args: wireValue(args, hostId) }, combined);
      return {
        [Symbol.asyncIterator]: () => stream[Symbol.asyncIterator](),
        dispose: () => controller.abort()
      };
    }
    return request(endpoint, args, signal);
  }
  const remotes = /* @__PURE__ */ new Map();
  function remoteFor(sessionId) {
    const key = sessionId ?? "";
    if (remotes.has(key)) return remotes.get(key);
    const namespaces = /* @__PURE__ */ new Map();
    const remote = new Proxy({}, {
      get(_target, namespace) {
        if (namespace === "$stream") return (options) => new RemoteStream2({ generation }, options);
        if (namespace === "$host") return { home: generationValue?.host.home, isLoopback: false };
        if (typeof namespace !== "string") return void 0;
        if (!namespaces.has(namespace)) {
          const methods = /* @__PURE__ */ new Map();
          namespaces.set(namespace, new Proxy({}, {
            get(_namespace, method) {
              if (typeof method !== "string" || method === "then") return void 0;
              if (!methods.has(method)) methods.set(method, (...args) => invoke(`${namespace}/${method}`, args, sessionId));
              return methods.get(method);
            }
          }));
        }
        return namespaces.get(namespace);
      }
    });
    remotes.set(key, remote);
    return remote;
  }
  const accessStream = remoteFor().$stream({
    name: `Remote access ${hostId}`,
    open: (signal) => remoteFor().remoteAccess.follow(signal),
    ended: () => new runtime.RemoteStreamCarrierError("Remote access stream ended")
  });
  const accessTask = (async () => {
    try {
      for await (const item of accessStream) {
        const frame = item.value;
        if (frame.type === "baseline") {
          access.replace(frame);
          item.accept();
        } else access.update(frame);
      }
    } catch (error) {
      access.unavailable();
      if (!lifetime.signal.aborted) warn(`access ${hostId}: ${error.message}`);
    }
  })();
  return {
    hostId,
    access,
    accessFor(scope) {
      return {
        source: (kind, id, action) => access.resource(kind, remoteIdentity(id)?.rawId ?? id, action),
        whenAccess: (action, callback) => runtime.whenAllowed(scope, access.global(action), callback, `remote ${hostId} access`),
        whenResourceAccess: (kind, id, action, callback) => runtime.whenAllowed(scope, access.resource(kind, remoteIdentity(id)?.rawId ?? id, action), callback, `remote ${hostId} resource access`)
      };
    },
    remote: remoteFor(),
    remoteFor,
    request,
    stream: (endpoint, args, signal = lifetime.signal) => mux.open(endpoint, { args: wireValue(args, hostId) }, signal),
    async dispose() {
      lifetime.abort();
      clearTimeout(reconnectTimer);
      await accessStream.dispose();
      await accessTask;
      await mux.close();
      listeners.clear();
      remotes.clear();
    }
  };
}

// client/host-manager.js
function openSshManager({ gateway, mark, close, connected }) {
  const element = (tag, text, marker) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (marker) node.setAttribute(mark, marker);
    return node;
  };
  const backdrop = element("div", "", "dialogBackdrop");
  const panel = element("div", "", "hostManager");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "\u8FDC\u7A0B\u673A\u5668\u7BA1\u7406");
  const dismiss = element("button", "\xD7", "close");
  dismiss.setAttribute("aria-label", "\u5173\u95ED\u673A\u5668\u7BA1\u7406");
  dismiss.onclick = close;
  const description = element("p", "\u8BFB\u53D6 SSH \u914D\u7F6E\uFF0C\u4E0E VS Code \u5171\u7528\u673A\u5668\u548C\u8FDE\u63A5\u9009\u9879\u3002", "muted");
  const path = element("div", "", "hostManagerSubhead");
  const status = element("div", "", "hostManagerStatus");
  status.setAttribute("role", "status");
  const list = element("div", "", "sshHosts");
  const form = element("form", "", "sshCommand");
  const input = element("input");
  input.placeholder = "ssh root@hostname -p 22";
  input.setAttribute("aria-label", "SSH \u8FDE\u63A5\u547D\u4EE4");
  input.autocomplete = "off";
  const add = element("button", "\u6DFB\u52A0\u65B0\u673A\u5668");
  add.type = "submit";
  const refresh = element("button", "\u5237\u65B0\u914D\u7F6E");
  refresh.type = "button";
  const challenge = element("form", "", "sshChallenge");
  challenge.hidden = true;
  const prompt = element("label");
  const answer2 = element("input");
  answer2.setAttribute("aria-label", "SSH \u8BA4\u8BC1\u8F93\u5165");
  answer2.autocomplete = "off";
  const submit = element("button", "\u786E\u5B9A");
  submit.type = "submit";
  const cancel = element("button", "\u53D6\u6D88\u8FDE\u63A5");
  cancel.type = "button";
  challenge.append(prompt, answer2, submit, cancel);
  const installation = element("section", "", "installConfirmation");
  installation.hidden = true;
  installation.setAttribute("role", "group");
  installation.setAttribute("aria-label", "\u5B89\u88C5\u786E\u8BA4");
  const installationTitle = element("h4", "\u5B89\u88C5\u8FDC\u7AEF DSH \u4E0E\u8FD0\u884C\u73AF\u5883");
  const installationDetails = element("p");
  const installationPath = element("p", "\u5B89\u88C5\u76EE\u5F55\uFF1A~/.local/share/dsh-remote-hosts\uFF1B\u4F1A\u8BDD\u4E0E\u914D\u7F6E\uFF1A~/.dsh\u3002", "muted");
  const backgroundHint = element("p", "\u786E\u8BA4\u5B89\u88C5\u540E\uFF0C\u5173\u95ED\u6B64\u7A97\u53E3\u4ECD\u4F1A\u5728\u540E\u53F0\u7EE7\u7EED\uFF1B\u91CD\u65B0\u6253\u5F00\u53EF\u67E5\u770B\u8FDB\u5EA6\u6216\u53D6\u6D88\u5B89\u88C5\u3002", "muted");
  const approve = element("button", "\u5B89\u88C5\u5E76\u8FDE\u63A5");
  approve.type = "button";
  const decline = element("button", "\u62D2\u7EDD\u5E76\u65AD\u5F00");
  decline.type = "button";
  installation.append(installationTitle, installationDetails, installationPath, backgroundHint, approve, decline);
  form.append(input, add, refresh);
  panel.append(dismiss, element("h3", "\u8FDC\u7A0B\u673A\u5668\u7BA1\u7406"), description, path, status, list, form, challenge, installation);
  backdrop.append(panel);
  backdrop.onclick = (event) => {
    if (event.target === backdrop) close();
  };
  backdrop.onkeydown = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
    if (event.key === "Tab") {
      const controls = [...panel.querySelectorAll("button,input")].filter((node) => !node.disabled && node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  document.body.append(backdrop);
  let timer;
  let disposed = false;
  let active;
  let challengeId;
  let installationId;
  let installationDecision;
  let lastHosts = "";
  let completed = /* @__PURE__ */ new Set();
  const phases = { checking: "\u68C0\u67E5\u4E2D\u2026", "awaiting-installation": "\u7B49\u5F85\u786E\u8BA4", installing: "\u5B89\u88C5\u4E2D\u2026", preparing: "\u542F\u52A8\u4E2D\u2026", connecting: "\u8FDE\u63A5\u4E2D\u2026", cancelling: "\u53D6\u6D88\u4E2D\u2026" };
  const request = async (payload) => {
    const response = await fetch(`${gateway}/manage/ssh`, { method: payload ? "POST" : "GET", headers: payload && { "content-type": "application/json" }, body: payload && JSON.stringify(payload), signal: AbortSignal.timeout(2e4) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  };
  const perform = async (operation) => {
    try {
      await operation();
    } catch (error) {
      status.textContent = error.message;
      status.dataset.error = "true";
    }
  };
  const connect = async (alias) => {
    const result = await request({ action: "connect", alias });
    active = result.operation.id;
    if (disposed) {
      await request({ action: "dismiss", id: active });
      return;
    }
    status.dataset.error = "false";
    status.textContent = `\u6B63\u5728\u8FDE\u63A5 ${alias}\u2026`;
    lastHosts = "";
    await poll();
  };
  const poll = async () => {
    if (disposed) return;
    clearTimeout(timer);
    try {
      const data = await request();
      if (disposed) return;
      path.textContent = data.configFile;
      const hostKey = JSON.stringify([data.hosts, data.operations.map((op) => [op.id, op.alias, op.phase])]);
      if (lastHosts !== hostKey) {
        lastHosts = hostKey;
        list.replaceChildren();
        for (const host of data.hosts) {
          const row = element("div", "", "hostManagerRow");
          row.dataset.sshAlias = host.alias;
          const label = element("span", host.alias);
          const meta = element("span", host.configFile, "muted");
          meta.className = "meta";
          const actions = element("div");
          actions.className = "actions";
          const button = element("button", "\u8FDE\u63A5");
          const operation2 = data.operations.findLast((op) => op.alias === host.alias);
          button.disabled = Boolean(phases[operation2?.phase]);
          button.textContent = phases[operation2?.phase] || (operation2?.phase === "ready" ? "\u91CD\u65B0\u8FDE\u63A5" : "\u8FDE\u63A5");
          button.onclick = () => perform(() => connect(host.alias));
          actions.append(button);
          if (operation2?.phase === "installing") {
            const cancelInstall = element("button", "\xD7");
            cancelInstall.type = "button";
            cancelInstall.setAttribute("aria-label", `\u53D6\u6D88 ${host.alias} \u7684\u5B89\u88C5`);
            cancelInstall.title = "\u53D6\u6D88\u5B89\u88C5";
            cancelInstall.onclick = () => perform(async () => {
              cancelInstall.disabled = true;
              try {
                await request({ action: "cancel", id: operation2.id });
                active = operation2.id;
                await poll();
              } finally {
                cancelInstall.disabled = false;
              }
            });
            actions.append(cancelInstall);
          }
          row.append(label, meta, actions);
          list.append(row);
        }
        if (!data.hosts.length) list.append(element("p", "SSH \u914D\u7F6E\u4E2D\u8FD8\u6CA1\u6709\u673A\u5668\u3002", "muted"));
      }
      const operation = data.operations.find((op) => op.id === active) ?? data.operations.findLast((op) => op.prompt || op.installation || phases[op.phase]) ?? data.operations.at(-1);
      if (operation) {
        active = operation.id;
        status.dataset.error = "false";
        if (operation.prompt) {
          challenge.hidden = false;
          if (challengeId !== operation.prompt.id) {
            challengeId = operation.prompt.id;
            challenge.dataset.challengeId = challengeId;
            prompt.textContent = operation.prompt.text;
            answer2.type = operation.prompt.secret ? "password" : "text";
            answer2.value = "";
            answer2.placeholder = operation.prompt.secret ? "\u5BC6\u7801\u6216\u5BC6\u94A5\u53E3\u4EE4" : "\u786E\u8BA4\u4E3B\u673A\u6307\u7EB9\u540E\u8F93\u5165 yes";
            answer2.focus();
          }
        } else {
          challenge.hidden = true;
          challengeId = void 0;
          answer2.value = "";
        }
        if (operation.installation) {
          installation.hidden = false;
          if (installationId !== operation.installation.id) {
            installationId = operation.installation.id;
            const plan = operation.installation;
            const changes = [];
            if (plan.installDsh) changes.push(`DSH ${plan.dshVersion} \u53CA\u5176 npm \u5305\u4F9D\u8D56`);
            if (plan.installNode) changes.push(`Node.js ${plan.nodeVersion}\uFF08\u5305\u542B npm\uFF09`);
            installationDetails.textContent = `\u5C06\u901A\u8FC7 SSH \u547D\u4EE4\u5728 ${operation.alias} \u4E0A\u5B89\u88C5\uFF1A
${changes.join("\n")}
${plan.installNode ? `\u73B0\u6709 Node.js ${plan.existingNode ?? "\u672A\u5B89\u88C5"}\uFF0C\u51C6\u5907\u73AF\u5883\u9700\u8981 Node.js \u226524.9.0 \u548C npm\uFF1B\u65B0\u8FD0\u884C\u73AF\u5883\u5355\u72EC\u5B89\u88C5\u3002` : `\u590D\u7528\u5DF2\u6709 Node.js ${plan.existingNode}\u3002`}
\u786E\u8BA4\u540E\u5B89\u88C5\u3001\u542F\u52A8 DSH \u5E76\u8FDE\u63A5\uFF1B\u62D2\u7EDD\u5C06\u7ED3\u675F\u672C\u6B21\u8FDE\u63A5\u3002`;
            approve.disabled = false;
            decline.disabled = false;
            approve.focus();
          }
        } else {
          installation.hidden = true;
          installationId = void 0;
        }
        if (operation.phase === "checking") status.textContent = `\u6B63\u5728\u68C0\u67E5 ${operation.alias} \u4E0A\u7684 DSH \u4E0E\u8FD0\u884C\u73AF\u5883\u2026`;
        if (operation.phase === "awaiting-installation") status.textContent = "\u7B49\u5F85\u786E\u8BA4\u5B89\u88C5\uFF1B\u5C1A\u672A\u6267\u884C\u5B89\u88C5\u3002";
        if (operation.phase === "preparing") status.textContent = `\u6B63\u5728\u51C6\u5907 ${operation.alias} \u4E0A\u7684 DSH\u2026`;
        if (operation.phase === "installing") status.textContent = `\u6B63\u5728\u5B89\u88C5 ${operation.alias} \u4E0A\u7684 DSH \u4E0E\u8FD0\u884C\u73AF\u5883\uFF1B\u5173\u95ED\u7A97\u53E3\u540E\u4F1A\u7EE7\u7EED\u5728\u540E\u53F0\u5B89\u88C5\u3002`;
        if (operation.phase === "cancelling") status.textContent = "\u6B63\u5728\u53D6\u6D88\u5E76\u505C\u6B62\u8FDC\u7AEF\u51C6\u5907\u8FDB\u7A0B\u2026";
        if (operation.phase === "connecting") status.textContent = `\u6B63\u5728\u8FDE\u63A5 ${operation.alias}\u2026`;
        if (operation.phase === "ready" && !completed.has(operation.id)) {
          completed.add(operation.id);
          status.textContent = `\u5DF2\u8FDE\u63A5 ${operation.alias}`;
          await connected();
        }
        if (operation.phase === "failed" || operation.phase === "cancelled") {
          status.dataset.error = "true";
          status.textContent = operation.error || "\u8FDE\u63A5\u5DF2\u53D6\u6D88";
        }
      }
    } catch (error) {
      status.textContent = error.message;
      status.dataset.error = "true";
    } finally {
      if (!disposed) timer = setTimeout(poll, 700);
    }
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    void perform(async () => {
      add.disabled = true;
      try {
        const result = await request({ action: "add", command: input.value });
        input.value = "";
        await connect(result.alias);
      } finally {
        add.disabled = false;
      }
    });
  };
  refresh.onclick = () => {
    lastHosts = "";
    void poll();
  };
  challenge.onsubmit = (event) => {
    event.preventDefault();
    const value = answer2.value;
    answer2.value = "";
    void perform(async () => {
      await request({ action: "answer", id: challengeId, answer: value });
      await poll();
    });
  };
  cancel.onclick = () => perform(async () => {
    await request({ action: "cancel", id: active });
    status.textContent = "\u8FDE\u63A5\u5DF2\u53D6\u6D88";
    await poll();
  });
  const decideInstallation = (accepted) => perform(async () => {
    approve.disabled = true;
    decline.disabled = true;
    try {
      await request({ action: "confirm-installation", id: active, confirmationId: installationId, accepted });
      await poll();
    } finally {
      approve.disabled = false;
      decline.disabled = false;
    }
  });
  approve.onclick = () => {
    installationDecision = decideInstallation(true);
  };
  decline.onclick = () => {
    installationDecision = decideInstallation(false);
  };
  backdrop.dispose = () => {
    disposed = true;
    clearTimeout(timer);
    answer2.value = "";
    if (active && !completed.has(active)) void (async () => {
      await installationDecision;
      await request({ action: "dismiss", id: active });
    })().catch((error) => console.warn("[remote-hosts]", error.message));
  };
  void poll();
  input.focus();
  return backdrop;
}

// client/path-completion.js
function attachPathCompletion({ input, mark, listDirectories }) {
  const lifetime = new AbortController();
  const field = document.createElement("div");
  field.setAttribute(mark, "pathField");
  input.before(field);
  field.append(input);
  const viewport = document.createElement("div");
  viewport.setAttribute(mark, "pathViewport");
  const list = document.createElement("div");
  list.setAttribute(mark, "pathSuggestions");
  list.id = `remote-path-${crypto.randomUUID()}`;
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "\u8FDC\u7AEF\u76EE\u5F55\u5019\u9009");
  list.hidden = true;
  const status = document.createElement("div");
  status.setAttribute(mark, "pathStatus");
  status.setAttribute("role", "status");
  viewport.append(list);
  field.append(viewport);
  field.after(status);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-expanded", "false");
  input.autocomplete = "off";
  let homeRequest, timer, loadingTimer, pending, generation = 0, selected = -1, choices = [], loading = false;
  const cache = /* @__PURE__ */ new Map();
  const hint = "\u2191 \u2193 \u9009\u62E9\uFF0CEnter \u6216 Tab \u8865\u5168\uFF1B~/ \u8868\u793A\u8FDC\u7AEF\u4E3B\u76EE\u5F55\u3002";
  status.textContent = hint;
  function remember(listing) {
    cache.delete(listing.path);
    cache.set(listing.path, { listing, expires: Date.now() + 15e3 });
    if (cache.size > 32) cache.delete(cache.keys().next().value);
    return listing;
  }
  const home = () => homeRequest ??= listDirectories(void 0, lifetime.signal).then(remember);
  async function resolve(value) {
    if (value === "") throw new Error("\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A");
    const listing = await home();
    if (value === "~") return listing.home;
    if (value.startsWith("~") && !value.startsWith("~/")) throw new Error("\u8BF7\u4F7F\u7528 ~/ \u8868\u793A\u8FD9\u53F0\u673A\u5668\u7684\u4E3B\u76EE\u5F55\u3002");
    if (value.startsWith("/")) return value;
    return `${listing.home.replace(/\/$/, "")}/${value.startsWith("~/") ? value.slice(2) : value}`;
  }
  function hide() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    selected = -1;
  }
  function highlight(index) {
    selected = index;
    const rows = [...list.children];
    rows.forEach((row, i) => row.setAttribute("aria-selected", String(i === selected)));
    input.setAttribute("aria-activedescendant", rows[selected].id);
    rows[selected].scrollIntoView({ block: "nearest" });
  }
  function choose(index) {
    if (loading) return;
    input.value = `${choices[index].path.replace(/\/$/, "")}/`;
    input.focus();
    schedule(0);
  }
  async function update(version, value, signal) {
    try {
      const initial = await home();
      const expanded = await resolve(value || "~");
      const slash = expanded.lastIndexOf("/");
      const homeInput = value === "" || value === "~";
      const directory = homeInput ? initial.home : expanded.endsWith("/") ? expanded : expanded.slice(0, slash) || "/";
      const parent = directory === "/" ? directory : directory.replace(/\/+$/, "");
      const prefix = homeInput || expanded.endsWith("/") ? "" : expanded.slice(slash + 1);
      const cached = cache.get(parent);
      const listing = cached && cached.expires > Date.now() ? cached.listing : remember(await listDirectories(parent, signal));
      if (version !== generation || signal.aborted) return;
      clearTimeout(loadingTimer);
      loading = false;
      viewport.setAttribute("aria-busy", "false");
      choices = listing.entries.filter((entry) => entry.name.startsWith(prefix) && (!entry.hidden || prefix.startsWith("."))).slice(0, 20);
      list.replaceChildren();
      selected = -1;
      input.removeAttribute("aria-activedescendant");
      for (const [index, entry] of choices.entries()) {
        const option = document.createElement("button");
        option.type = "button";
        option.tabIndex = -1;
        option.id = `${list.id}-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        option.textContent = `${entry.name}/`;
        option.title = entry.path;
        option.onmousedown = (event) => event.preventDefault();
        option.onclick = () => choose(index);
        list.append(option);
      }
      list.hidden = choices.length === 0;
      list.scrollTop = 0;
      input.setAttribute("aria-expanded", String(choices.length > 0));
      status.dataset.error = "false";
      status.textContent = !choices.length ? "\u6CA1\u6709\u5339\u914D\u7684\u76EE\u5F55\uFF0C\u53EF\u7EE7\u7EED\u8F93\u5165\u5B8C\u6574\u8DEF\u5F84\u3002" : listing.truncated || choices.length === 20 ? "\u76EE\u5F55\u8F83\u591A\uFF0C\u8BF7\u7EE7\u7EED\u8F93\u5165\u540D\u79F0\u7B5B\u9009\u3002" : hint;
    } catch (error) {
      if (version !== generation || signal.aborted || lifetime.signal.aborted) return;
      clearTimeout(loadingTimer);
      loading = false;
      viewport.setAttribute("aria-busy", "false");
      hide();
      status.dataset.error = "true";
      status.textContent = error.code === "directory-picker/unreadable" ? "\u8FDC\u7AEF\u76EE\u5F55\u4E0D\u5B58\u5728\u6216\u6CA1\u6709\u8BFB\u53D6\u6743\u9650\u3002" : error.message;
    }
  }
  function schedule(delay = 100) {
    clearTimeout(timer);
    clearTimeout(loadingTimer);
    pending?.abort();
    loading = true;
    selected = -1;
    input.removeAttribute("aria-activedescendant");
    list.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-selected", "false");
    });
    viewport.setAttribute("aria-busy", "true");
    const version = ++generation;
    const value = input.value;
    pending = new AbortController();
    const signal = AbortSignal.any([pending.signal, lifetime.signal]);
    status.dataset.error = "false";
    loadingTimer = setTimeout(() => {
      if (version === generation) status.textContent = "\u6B63\u5728\u8BFB\u53D6\u8FDC\u7AEF\u76EE\u5F55\u2026";
    }, 250);
    timer = setTimeout(() => {
      void update(version, value, signal);
    }, delay);
  }
  const changed = () => schedule();
  const focused = () => schedule(0);
  const blurred = () => {
    clearTimeout(timer);
    clearTimeout(loadingTimer);
    pending?.abort();
    generation++;
    loading = false;
    viewport.setAttribute("aria-busy", "false");
    hide();
    status.textContent = hint;
  };
  const keydown = (event) => {
    if (event.isComposing || loading) return;
    if (list.hidden || !choices.length) return;
    if (["ArrowDown", "ArrowUp", "Escape"].includes(event.key) || event.key === "Tab" && !event.shiftKey || event.key === "Enter" && selected >= 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        blurred();
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        choose(Math.max(0, selected));
        return;
      }
      highlight(event.key === "ArrowDown" ? (selected + 1) % choices.length : selected < 0 ? choices.length - 1 : (selected - 1 + choices.length) % choices.length);
    }
  };
  input.addEventListener("input", changed);
  input.addEventListener("focus", focused);
  input.addEventListener("blur", blurred);
  input.addEventListener("keydown", keydown, true);
  return {
    resolve,
    dispose() {
      clearTimeout(timer);
      clearTimeout(loadingTimer);
      generation++;
      lifetime.abort();
      pending?.abort();
      input.removeEventListener("input", changed);
      input.removeEventListener("focus", focused);
      input.removeEventListener("blur", blurred);
      input.removeEventListener("keydown", keydown, true);
    }
  };
}

// client/lifetime.js
var Lifetime = class {
  #active = true;
  #disposers = [];
  get active() {
    return this.#active;
  }
  defer(dispose) {
    if (!this.#active) throw new Error("\u63D2\u4EF6\u751F\u547D\u5468\u671F\u5DF2\u7ECF\u7ED3\u675F");
    this.#disposers.push(dispose);
    return dispose;
  }
  wrap(target, name, intercept) {
    if (!this.#active) throw new Error("\u63D2\u4EF6\u751F\u547D\u5468\u671F\u5DF2\u7ECF\u7ED3\u675F");
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    const original = target[name];
    if (typeof original !== "function") throw new Error(`DSH \u63A5\u53E3 ${name} \u4E0D\u53EF\u7528`);
    let handler = intercept;
    const wrapped = function(...args) {
      const next = (...values) => original.apply(this, values);
      return handler === void 0 ? next(...args) : handler.call(this, next, ...args);
    };
    Object.defineProperty(target, name, { configurable: true, writable: true, value: wrapped });
    this.defer(() => {
      handler = void 0;
      if (Object.getOwnPropertyDescriptor(target, name)?.value !== wrapped) return;
      if (descriptor === void 0) delete target[name];
      else Object.defineProperty(target, name, descriptor);
    });
    return wrapped;
  }
  dispose() {
    if (!this.#active) return;
    this.#active = false;
    const errors = [];
    for (const dispose of this.#disposers.splice(0).reverse()) {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, `\u63D2\u4EF6\u6E05\u7406\u5931\u8D25\uFF1A${errors.map((error) => error.message).join("\uFF1B")}`);
  }
};

// client/compatibility.js
var supportedVersion = "0.2.2-rc.1";
var supportedHostVersions = [supportedVersion, "0.2.2-rc.3"];
function assertCompatible(ctx, runtime, version) {
  if (!supportedHostVersions.includes(version)) throw new Error(`\u8FDC\u7A0B\u673A\u5668\u63D2\u4EF6\u9002\u914D DSH ${supportedHostVersions.join("\u3001")}\uFF0C\u5F53\u524D\u7248\u672C\u4E3A ${version}`);
  const required = {
    sessions: ["binding", "retain", "using", "retainInfo", "scope", "scopeOf", "sessionOf", "retainAgentScope"],
    uiWorkspace: ["openSession", "clearMain", "startSession", "connectBlank"],
    fileUpload: ["upload", "uploadImage"],
    uiSession: ["materializeAbsent", "provide"],
    slots: ["subscribe", "entries"],
    modelDirectories: ["directoryFor"],
    remoteAccess: ["source", "whenResourceAccess"]
  };
  for (const [service, methods] of Object.entries(required)) {
    for (const method of methods) {
      if (typeof ctx?.[service]?.[method] !== "function") throw new Error(`DSH ${version} \u7F3A\u5C11\u517C\u5BB9\u63A5\u53E3 ${service}.${method}`);
    }
  }
  for (const method of ["getSnapshot", "subscribe", "set"]) {
    if (typeof ctx.sessions.list?.[method] !== "function") throw new Error(`DSH \u4F1A\u8BDD\u5217\u8868\u7F3A\u5C11 ${method}`);
  }
  for (const method of ["getSnapshot", "subscribe"]) {
    if (typeof ctx.uiSession.sessionStatus?.[method] !== "function") throw new Error(`DSH \u4F1A\u8BDD\u72B6\u6001\u7F3A\u5C11 ${method}`);
  }
  if (typeof runtime.ModelDirectory !== "function" || typeof ctx.modelDirectories.catalog?.constructor !== "function" || typeof ctx.modelDirectories.catalog?.resetGeneration !== "function") throw new Error("DSH \u6A21\u578B\u76EE\u5F55\u7ED3\u6784\u4E0D\u517C\u5BB9");
  if (typeof ctx.typert?.remotes?.list !== "function") throw new Error("DSH Remote \u6CE8\u518C\u63A5\u53E3\u4E0D\u53EF\u7528");
}
function gatewayAddress(config) {
  const url = new URL(config?.gateway);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("\u5BBF\u4E3B\u63D0\u4F9B\u4E86\u65E0\u6548\u7684\u8FDC\u7A0B\u673A\u5668\u8FDE\u63A5\u5730\u5740");
  }
  return url.origin;
}
var sidebarSelectors = {
  sidebar: '[class*="_sidebarCol"]',
  tree: '[role="tree"]',
  region: '[class*="_root"]',
  group: '[class*="_groupSection"]',
  session: '[data-row-key^="session:"]'
};

// client/remote-agent-presets.js
var import_dsh_client_store3 = require("@deepseek-ai/dsh-client-store");

// client/slot-adapter.js
function adaptSlot(slots, lifetime, name, matches, intercept) {
  const entries = /* @__PURE__ */ new Map();
  const reconcile = () => {
    const desired = new Set(slots.entries(name).filter(matches));
    for (const [entry, patch] of entries) {
      if (desired.has(entry)) continue;
      patch.dispose();
      entries.delete(entry);
    }
    for (const entry of desired) {
      if (entries.has(entry)) continue;
      const patch = new Lifetime();
      patch.wrap(entry, "inject", intercept);
      entries.set(entry, patch);
    }
  };
  lifetime.defer(() => {
    for (const patch of entries.values()) patch.dispose();
    entries.clear();
  });
  lifetime.defer(slots.subscribe(name, reconcile));
  reconcile();
}

// client/remote-agent-presets.js
function remoteSeat(binding, remote) {
  const session = binding.session;
  const store = (0, import_dsh_client_store3.createSnapshotStore)({ options: [], current: "", error: null, busy: false, introduce: false });
  const developerTools = (0, import_dsh_client_store3.createSnapshotStore)(false);
  let loading;
  let active = true;
  const set = (patch) => {
    if (active) store.set({ ...store.getSnapshot(), ...patch });
  };
  const current = () => session.projections.get("agentPreset") ?? "";
  const sync = () => {
    if (!store.getSnapshot().busy) set({ current: current() });
  };
  const unsubscribe = session.projections.faceOf("agentPreset").subscribe(sync);
  const load = () => loading ??= (async () => {
    try {
      const [roster, settings] = await Promise.all([remote.agentPresets.list(), remote.settings.describe()]);
      if (!roster.ok) throw new Error(roster.error.message);
      if (!settings.ok) throw new Error(settings.error.message);
      if (!active) return;
      developerTools.set(settings.value.namespaces.find((item) => item.ns === "ui-settings")?.value?.enabled ?? false);
      const options = roster.value.presets.filter((preset) => preset.broken === void 0).map(({ id, name, description }) => ({
        id,
        ...name === void 0 ? {} : { name },
        ...description === void 0 ? {} : { description }
      }));
      set({ options, current: current(), error: null });
    } catch (error) {
      set({ error: error.message });
    } finally {
      loading = void 0;
    }
  })();
  const select = async (id) => {
    if (store.getSnapshot().busy || !session.getSnapshot().blank) return;
    set({ busy: true, error: null });
    try {
      const result = await remote.agentPresets.select(binding.sessionId, id);
      if (!result.ok) throw new Error(result.error.details?.reason ?? result.error.message);
      set({ current: result.value });
    } catch (error) {
      set({ current: current(), error: { reason: error.message, preset: store.getSnapshot().options.find((option) => option.id === id) ?? { id } } });
      return error.message;
    } finally {
      set({ busy: false });
    }
  };
  return {
    store,
    developerTools,
    load,
    select,
    dismissRefusal(error) {
      if (store.getSnapshot().error === error) set({ error: error.reason });
    },
    introduced() {
    },
    dispose() {
      active = false;
      unsubscribe();
    }
  };
}
function installRemoteAgentPresets(ctx, lifetime, hostTransport) {
  const seats = /* @__PURE__ */ new Map();
  lifetime.defer(() => {
    for (const seat of seats.values()) seat.dispose();
    seats.clear();
  });
  const seatFor = (id) => {
    const parsed = remoteIdentity(id);
    if (parsed === void 0) return void 0;
    const binding = ctx.sessions.binding(id);
    if (binding === void 0) throw new Error(`\u8FDC\u7A0B\u4F1A\u8BDD ${id} \u5C1A\u672A\u4FDD\u7559`);
    if (!seats.has(binding)) {
      const seat = remoteSeat(binding, hostTransport(parsed.hostId).remote);
      seats.set(binding, seat);
      binding.ctx.effect(() => () => {
        seat.dispose();
        seats.delete(binding);
      }, "remote-hosts: Agent preset binding");
    }
    return seats.get(binding);
  };
  for (const [name, hero] of [["conversation.hero.agentPreset", true], ["conversation.session.header.actions", false]]) {
    adaptSlot(
      ctx.slots,
      lifetime,
      name,
      (entry) => entry.locale === "settings.agentPreset" && (hero ? entry.component.name === "AgentPresetSeat" : entry.options.id === "agent-preset" && entry.component.name === "AgentPresetLabel"),
      (next, id, ...args) => {
        if (remoteIdentity(id) === void 0) return next(id, ...args);
        const injected = hero ? void 0 : next(id, ...args);
        const seat = seatFor(id);
        if (!hero) return { ...injected, hooks: { ...injected.hooks, agentPresets: seat.store }, load: seat.load };
        return {
          hooks: { agentPresetSeat: seat.store, developerTools: seat.developerTools },
          load: seat.load,
          select: seat.select,
          dismissRefusal: seat.dismissRefusal,
          introduced: seat.introduced
        };
      }
    );
  }
}

// client/remote-workspace-picker.js
function installRemoteWorkspacePicker(ctx, lifetime, workspaceRecord, hostTransport, createRemoteWorkspace, pickRemoteDirectory) {
  const selection = ctx.uiWorkspace.selection;
  const localWorkspaces = ctx.workspaces.list;
  const selectedHost = () => lifetime.active ? remoteIdentity(selection.getSnapshot().sessionId)?.hostId : void 0;
  const source = () => {
    const hostId = selectedHost();
    return hostId === void 0 ? localWorkspaces : workspaceRecord(hostId).source;
  };
  const workspaces = {
    getSnapshot: () => source().getSnapshot(),
    subscribe(listener) {
      let stop = source().subscribe(listener);
      const select = selection.subscribe(() => {
        stop();
        stop = source().subscribe(listener);
        listener();
      });
      return () => {
        select();
        stop();
      };
    }
  };
  for (const name of ["conversation.hero.workspace", "conversation.hero.workspace.directoryFlow"]) {
    adaptSlot(
      ctx.slots,
      lifetime,
      name,
      (entry) => name === "conversation.hero.workspace" ? entry.locale === "workspace" && entry.component.name === "WorkspacePicker" : ["NativeDirectoryFlow", "BrowseDirectoryFlow"].includes(entry.component.name),
      (next, ...args) => {
        const injected = next(...args);
        if (name === "conversation.hero.workspace") return {
          ...injected,
          hooks: { ...injected.hooks, workspaces },
          createWorkspace: (input) => {
            const hostId = selectedHost();
            return hostId === void 0 ? injected.createWorkspace(input) : createRemoteWorkspace(hostId, input);
          }
        };
        if (injected.listDirectory !== void 0) return {
          ...injected,
          listDirectory: async (path, signal) => {
            const hostId = selectedHost();
            if (hostId === void 0) return injected.listDirectory(path, signal);
            const result = await hostTransport(hostId).remote.directoryPicker.list(path, signal);
            if (!result.ok) throw new Error(result.error.message);
            return result.value;
          },
          createDirectory: async (path, name2) => {
            const hostId = selectedHost();
            if (hostId === void 0) return injected.createDirectory(path, name2);
            const result = await hostTransport(hostId).remote.directoryPicker.createDirectory(path, name2);
            if (!result.ok) throw new Error(result.error.message);
            return result.value;
          }
        };
        if (injected.pick !== void 0) return {
          ...injected,
          pick: () => {
            const hostId = selectedHost();
            return hostId === void 0 ? injected.pick() : pickRemoteDirectory(hostId);
          }
        };
        return injected;
      }
    );
  }
}

// client/native-adapter.js
var routedEndpoints = /* @__PURE__ */ new Set([
  "commands/execute",
  ...["attachment", "cancel", "create", "events", "follow", "fork", "observeEvent", "observeProjections", "observeState", "openWorkspacePath", "page", "projections", "prompt", "rename", "selectModel", "state", "updateQueue", "wait", "workspacePathApplications"].map((method) => `session/${method}`),
  ...["archiveSession", "delete", "insertBefore", "insertSessionBefore", "pinSession", "rename", "unarchiveSession", "unpinSession"].map((method) => `workspace/${method}`)
]);
function installNativeAdapter(ctx, runtime, native, lifetime, operations) {
  const { nativeRecord, retainNative, retainObserver, workspaceRecord, hostTransport, ensureNativeRows, syncSidebarSelection, connectRemoteWorkspace, createRemoteWorkspace, pickRemoteDirectory, gateway } = operations;
  const sessions = ctx.sessions;
  const patches = new Lifetime();
  lifetime.defer(() => patches.dispose());
  const connecting = /* @__PURE__ */ new Map();
  const creation = new AbortController();
  lifetime.defer(() => creation.abort(new Error("\u8FDC\u7A0B\u673A\u5668\u63D2\u4EF6\u5DF2\u7ECF\u505C\u7528")));
  patches.wrap(ctx.uiWorkspace, "connectBlank", (next, id, options = {}) => {
    const parsed = remoteIdentity(id);
    if (parsed === void 0) return next(id, options);
    const key = JSON.stringify([id, options.agentPreset]);
    if (connecting.has(key)) return connecting.get(key);
    const attempt = connectRemoteWorkspace(parsed.hostId, parsed.rawId, options, creation.signal).finally(() => {
      if (connecting.get(key) === attempt) connecting.delete(key);
    });
    connecting.set(key, attempt);
    return attempt;
  });
  patches.wrap(ctx.uiWorkspace, "startSession", (next, id, options) => {
    if (id !== void 0) return next(id, options);
    const current = ctx.uiWorkspace.mainReference?.sessionId;
    const parsed = remoteIdentity(current);
    if (parsed === void 0) return next(id, options);
    const workspace = workspaceRecord(parsed.hostId).source.getSnapshot().items.find((item) => item.sessionIds.includes(current));
    if (workspace === void 0) throw new Error("\u5F53\u524D\u8FDC\u7A0B\u4F1A\u8BDD\u6CA1\u6709\u53EF\u7528\u7684\u5DE5\u4F5C\u533A");
    return next(workspace.workspaceId, options);
  });
  installRemoteAgentPresets(ctx, lifetime, hostTransport);
  installRemoteWorkspacePicker(ctx, lifetime, workspaceRecord, hostTransport, createRemoteWorkspace, pickRemoteDirectory);
  let sidebarInput;
  let sidebarSnapshot;
  const localSessions = {
    getSnapshot() {
      const input = sessions.list.getSnapshot();
      if (input !== sidebarInput) {
        sidebarInput = input;
        const ids = input.ids.filter((id) => remoteIdentity(id) === void 0);
        sidebarSnapshot = { ...input, ids, byId: Object.fromEntries(ids.map((id) => [id, input.byId[id]])) };
      }
      return sidebarSnapshot;
    },
    subscribe: (listener) => sessions.list.subscribe(listener)
  };
  adaptSlot(
    ctx.slots,
    lifetime,
    "sidebar.workspaces",
    (entry) => entry.locale === "workspace" && entry.component.name === "WorkspaceBrowser",
    (next, ...args) => {
      const injected = next(...args);
      return { ...injected, hooks: { ...injected.hooks, sessions: localSessions, workspaces: ctx.workspaces.list } };
    }
  );
  patches.wrap(ctx.uiSession, "materializeAbsent", (next) => {
    const binding = next();
    delete binding.hooks.workspaces;
    return binding;
  });
  lifetime.defer(ctx.uiSession.provide({
    hooks: ["workspaces"],
    resolve: (binding) => {
      const parsed = remoteIdentity(binding.sessionId);
      return { hooks: { workspaces: parsed === void 0 ? ctx.workspaces.list : workspaceRecord(parsed.hostId).source } };
    }
  }));
  patches.wrap(sessions, "binding", (next, id) => remoteIdentity(id) === void 0 ? next(id) : native.records.get(id)?.binding);
  patches.wrap(sessions, "retainInfo", (next, id) => remoteIdentity(id) === void 0 ? next(id) : retainObserver(id).source);
  patches.wrap(sessions, "retain", (next, target, options) => {
    const parsed = remoteIdentity(target);
    return parsed === void 0 ? next(target, options) : retainNative(nativeRecord(parsed.hostId, parsed.rawId), options);
  });
  patches.wrap(sessions, "using", async (next, target, options, operation) => {
    const parsed = remoteIdentity(target);
    if (parsed === void 0) return next(target, options, operation);
    const reference = retainNative(nativeRecord(parsed.hostId, parsed.rawId), options);
    try {
      await reference.ready;
      return await operation(reference);
    } finally {
      reference.release();
    }
  });
  patches.wrap(sessions, "scope", (next, id) => remoteIdentity(id) === void 0 ? next(id) : native.records.get(id)?.binding.ctx);
  patches.wrap(sessions, "sessionOf", (next, owner) => {
    const id = sessions.scopeOf(owner);
    return remoteIdentity(id) === void 0 ? next(owner) : native.records.get(id)?.binding.session;
  });
  patches.wrap(sessions, "retainAgentScope", (next, id) => {
    const parsed = remoteIdentity(id);
    return parsed === void 0 ? next(id) : retainNative(nativeRecord(parsed.hostId, parsed.rawId), { source: "remote-event" });
  });
  async function upload(sessionId, data, name, mediaType, signal) {
    const parsed = remoteIdentity(sessionId);
    const query = new URLSearchParams({ sessionId: parsed.rawId });
    if (name !== void 0) query.set("name", name);
    if (mediaType !== void 0) query.set("mediaType", mediaType);
    const init = { method: "POST", headers: { "content-type": "application/octet-stream" }, body: data, signal };
    if (data instanceof ReadableStream) init.duplex = "half";
    const response = await fetch(`${gateway}/host/${encodeURIComponent(parsed.hostId)}/api/session/uploadFileBinary?${query}`, init);
    const body = await response.json();
    if (!response.ok || body?.ok !== true) return { ok: false, error: { code: body?.error?.code ?? "upload-failed", message: body?.error?.message ?? `HTTP ${response.status}` } };
    return { ok: true, value: body.value };
  }
  patches.wrap(ctx.fileUpload, "upload", (next, id, data, name, signal) => remoteIdentity(id) === void 0 ? next(id, data, name, signal) : upload(id, data, name, void 0, signal));
  patches.wrap(ctx.fileUpload, "uploadImage", (next, id, data, mediaType, name, signal) => remoteIdentity(id) === void 0 ? next(id, data, mediaType, name, signal) : upload(id, data, mediaType, name, signal));
  const directories = /* @__PURE__ */ new WeakMap();
  patches.wrap(ctx.modelDirectories, "directoryFor", (next, id) => {
    const parsed = remoteIdentity(id);
    if (parsed === void 0) return next(id);
    const binding = sessions.binding(id);
    if (binding === void 0) throw new Error(`\u8FDC\u7A0B\u4F1A\u8BDD ${id} \u5C1A\u672A\u4FDD\u7559`);
    if (directories.has(binding)) return directories.get(binding);
    let catalog = native.catalogs.get(parsed.hostId);
    if (catalog === void 0) {
      catalog = new ctx.modelDirectories.catalog.constructor({ remote: hostTransport(parsed.hostId).remote });
      native.catalogs.set(parsed.hostId, catalog);
    }
    const directory = new runtime.ModelDirectory(
      hostTransport(parsed.hostId).remote.session,
      id,
      () => true,
      catalog,
      binding.session.projections.faceOf("modelSelection"),
      () => binding.session.getSnapshot().blank
    );
    directories.set(binding, directory);
    binding.ctx.effect(() => () => {
      directory.dispose();
      directories.delete(binding);
    }, "remote-hosts: model directory");
    return directory;
  });
  patches.wrap(ctx.remoteAccess, "source", (next, kind, id, action) => {
    const parsed = remoteIdentity(id);
    return parsed === void 0 ? next(kind, id, action) : hostTransport(parsed.hostId).access.resource(kind, parsed.rawId, action);
  });
  patches.wrap(ctx.remoteAccess, "whenResourceAccess", function(next, kind, id, action, callback) {
    const parsed = remoteIdentity(id);
    return parsed === void 0 ? next(kind, id, action, callback) : runtime.whenAllowed(this.ctx, hostTransport(parsed.hostId).access.resource(kind, parsed.rawId, action), callback, `remote ${parsed.hostId} access`);
  });
  native.routedEndpoints = [];
  for (const descriptor of ctx.typert.remotes.list()) {
    if (descriptor.invocation.kind !== "direct" || !routedEndpoints.has(`${descriptor.namespace}/${descriptor.method}`)) continue;
    const namespace = ctx.get(`remote.${descriptor.namespace}`);
    if (typeof namespace?.[descriptor.method] !== "function") throw new Error(`DSH \u63A5\u53E3 ${descriptor.namespace}/${descriptor.method} \u4E0D\u53EF\u7528`);
    patches.wrap(namespace, descriptor.method, (next, ...args) => {
      const parsed = remoteInvocationIdentity(descriptor, args);
      return parsed === void 0 ? next(...args) : hostTransport(parsed.hostId).remote[descriptor.namespace][descriptor.method](...args);
    });
    native.routedEndpoints.push(`${descriptor.namespace}/${descriptor.method}`);
  }
  lifetime.defer(ctx.uiWorkspace.selection.subscribe(syncSidebarSelection));
  lifetime.defer(sessions.list.subscribe(ensureNativeRows));
}

// node_modules/morphdom/dist/morphdom-esm.js
var DOCUMENT_FRAGMENT_NODE = 11;
function morphAttrs(fromNode, toNode) {
  var toNodeAttrs = toNode.attributes;
  var attr;
  var attrName;
  var attrNamespaceURI;
  var attrValue;
  var fromValue;
  if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE || fromNode.nodeType === DOCUMENT_FRAGMENT_NODE) {
    return;
  }
  for (var i = toNodeAttrs.length - 1; i >= 0; i--) {
    attr = toNodeAttrs[i];
    attrName = attr.name;
    attrNamespaceURI = attr.namespaceURI;
    attrValue = attr.value;
    if (attrNamespaceURI) {
      attrName = attr.localName || attrName;
      fromValue = fromNode.getAttributeNS(attrNamespaceURI, attrName);
      if (fromValue !== attrValue) {
        if (attr.prefix === "xmlns") {
          attrName = attr.name;
        }
        fromNode.setAttributeNS(attrNamespaceURI, attrName, attrValue);
      }
    } else {
      fromValue = fromNode.getAttribute(attrName);
      if (fromValue !== attrValue) {
        fromNode.setAttribute(attrName, attrValue);
      }
    }
  }
  var fromNodeAttrs = fromNode.attributes;
  for (var d = fromNodeAttrs.length - 1; d >= 0; d--) {
    attr = fromNodeAttrs[d];
    attrName = attr.name;
    attrNamespaceURI = attr.namespaceURI;
    if (attrNamespaceURI) {
      attrName = attr.localName || attrName;
      if (!toNode.hasAttributeNS(attrNamespaceURI, attrName)) {
        fromNode.removeAttributeNS(attrNamespaceURI, attrName);
      }
    } else {
      if (!toNode.hasAttribute(attrName)) {
        fromNode.removeAttribute(attrName);
      }
    }
  }
}
var range;
var NS_XHTML = "http://www.w3.org/1999/xhtml";
var doc = typeof document === "undefined" ? void 0 : document;
var HAS_TEMPLATE_SUPPORT = !!doc && "content" in doc.createElement("template");
var HAS_RANGE_SUPPORT = !!doc && doc.createRange && "createContextualFragment" in doc.createRange();
function createFragmentFromTemplate(str) {
  var template = doc.createElement("template");
  template.innerHTML = str;
  return template.content.childNodes[0];
}
function createFragmentFromRange(str) {
  if (!range) {
    range = doc.createRange();
    range.selectNode(doc.body);
  }
  var fragment = range.createContextualFragment(str);
  return fragment.childNodes[0];
}
function createFragmentFromWrap(str) {
  var fragment = doc.createElement("body");
  fragment.innerHTML = str;
  return fragment.childNodes[0];
}
function toElement(str) {
  str = str.trim();
  if (HAS_TEMPLATE_SUPPORT) {
    return createFragmentFromTemplate(str);
  } else if (HAS_RANGE_SUPPORT) {
    return createFragmentFromRange(str);
  }
  return createFragmentFromWrap(str);
}
function compareNodeNames(fromEl, toEl) {
  var fromNodeName = fromEl.nodeName;
  var toNodeName = toEl.nodeName;
  var fromCodeStart, toCodeStart;
  if (fromNodeName === toNodeName) {
    return true;
  }
  fromCodeStart = fromNodeName.charCodeAt(0);
  toCodeStart = toNodeName.charCodeAt(0);
  if (fromCodeStart <= 90 && toCodeStart >= 97) {
    return fromNodeName === toNodeName.toUpperCase();
  } else if (toCodeStart <= 90 && fromCodeStart >= 97) {
    return toNodeName === fromNodeName.toUpperCase();
  } else {
    return false;
  }
}
function createElementNS(name, namespaceURI) {
  return !namespaceURI || namespaceURI === NS_XHTML ? doc.createElement(name) : doc.createElementNS(namespaceURI, name);
}
function moveChildren(fromEl, toEl) {
  var curChild = fromEl.firstChild;
  while (curChild) {
    var nextChild = curChild.nextSibling;
    toEl.appendChild(curChild);
    curChild = nextChild;
  }
  return toEl;
}
function syncBooleanAttrProp(fromEl, toEl, name) {
  if (fromEl[name] !== toEl[name]) {
    fromEl[name] = toEl[name];
    if (fromEl[name]) {
      fromEl.setAttribute(name, "");
    } else {
      fromEl.removeAttribute(name);
    }
  }
}
var specialElHandlers = {
  OPTION: function(fromEl, toEl) {
    var parentNode = fromEl.parentNode;
    if (parentNode) {
      var parentName = parentNode.nodeName.toUpperCase();
      if (parentName === "OPTGROUP") {
        parentNode = parentNode.parentNode;
        parentName = parentNode && parentNode.nodeName.toUpperCase();
      }
      if (parentName === "SELECT" && !parentNode.hasAttribute("multiple")) {
        if (fromEl.hasAttribute("selected") && !toEl.selected) {
          fromEl.setAttribute("selected", "selected");
          fromEl.removeAttribute("selected");
        }
        parentNode.selectedIndex = -1;
      }
    }
    syncBooleanAttrProp(fromEl, toEl, "selected");
  },
  /**
   * The "value" attribute is special for the <input> element since it sets
   * the initial value. Changing the "value" attribute without changing the
   * "value" property will have no effect since it is only used to the set the
   * initial value.  Similar for the "checked" attribute, and "disabled".
   */
  INPUT: function(fromEl, toEl) {
    syncBooleanAttrProp(fromEl, toEl, "checked");
    syncBooleanAttrProp(fromEl, toEl, "disabled");
    if (fromEl.value !== toEl.value) {
      fromEl.value = toEl.value;
    }
    if (!toEl.hasAttribute("value")) {
      fromEl.removeAttribute("value");
    }
  },
  TEXTAREA: function(fromEl, toEl) {
    var newValue = toEl.value;
    if (fromEl.value !== newValue) {
      fromEl.value = newValue;
    }
    var firstChild = fromEl.firstChild;
    if (firstChild) {
      var oldValue = firstChild.nodeValue;
      if (oldValue == newValue || !newValue && oldValue == fromEl.placeholder) {
        return;
      }
      firstChild.nodeValue = newValue;
    }
  },
  SELECT: function(fromEl, toEl) {
    if (!toEl.hasAttribute("multiple")) {
      var selectedIndex = -1;
      var i = 0;
      var curChild = fromEl.firstChild;
      var optgroup;
      var nodeName;
      while (curChild) {
        nodeName = curChild.nodeName && curChild.nodeName.toUpperCase();
        if (nodeName === "OPTGROUP") {
          optgroup = curChild;
          curChild = optgroup.firstChild;
          if (!curChild) {
            curChild = optgroup.nextSibling;
            optgroup = null;
          }
        } else {
          if (nodeName === "OPTION") {
            if (curChild.hasAttribute("selected")) {
              selectedIndex = i;
              break;
            }
            i++;
          }
          curChild = curChild.nextSibling;
          if (!curChild && optgroup) {
            curChild = optgroup.nextSibling;
            optgroup = null;
          }
        }
      }
      fromEl.selectedIndex = selectedIndex;
    }
  }
};
var ELEMENT_NODE = 1;
var DOCUMENT_FRAGMENT_NODE$1 = 11;
var TEXT_NODE = 3;
var COMMENT_NODE = 8;
function noop() {
}
function defaultGetNodeKey(node) {
  if (node) {
    return node.getAttribute && node.getAttribute("id") || node.id;
  }
}
function morphdomFactory(morphAttrs2) {
  return function morphdom2(fromNode, toNode, options) {
    if (!options) {
      options = {};
    }
    if (typeof toNode === "string") {
      if (fromNode.nodeName === "#document" || fromNode.nodeName === "HTML") {
        var toNodeHtml = toNode;
        toNode = doc.createElement("html");
        toNode.innerHTML = toNodeHtml;
      } else if (fromNode.nodeName === "BODY") {
        var toNodeBody = toNode;
        toNode = doc.createElement("html");
        toNode.innerHTML = toNodeBody;
        var bodyElement = toNode.querySelector("body");
        if (bodyElement) {
          toNode = bodyElement;
        }
      } else {
        toNode = toElement(toNode);
      }
    } else if (toNode.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
      toNode = toNode.firstElementChild;
    }
    var getNodeKey = options.getNodeKey || defaultGetNodeKey;
    var onBeforeNodeAdded = options.onBeforeNodeAdded || noop;
    var onNodeAdded = options.onNodeAdded || noop;
    var onBeforeElUpdated = options.onBeforeElUpdated || noop;
    var onElUpdated = options.onElUpdated || noop;
    var onBeforeNodeDiscarded = options.onBeforeNodeDiscarded || noop;
    var onNodeDiscarded = options.onNodeDiscarded || noop;
    var onBeforeElChildrenUpdated = options.onBeforeElChildrenUpdated || noop;
    var skipFromChildren = options.skipFromChildren || noop;
    var addChild = options.addChild || function(parent, child) {
      return parent.appendChild(child);
    };
    var childrenOnly = options.childrenOnly === true;
    var fromNodesLookup = /* @__PURE__ */ Object.create(null);
    var keyedRemovalList = [];
    function addKeyedRemoval(key) {
      keyedRemovalList.push(key);
    }
    function walkDiscardedChildNodes(node, skipKeyedNodes) {
      if (node.nodeType === ELEMENT_NODE) {
        var curChild = node.firstChild;
        while (curChild) {
          var key = void 0;
          if (skipKeyedNodes && (key = getNodeKey(curChild))) {
            addKeyedRemoval(key);
          } else {
            onNodeDiscarded(curChild);
            if (curChild.firstChild) {
              walkDiscardedChildNodes(curChild, skipKeyedNodes);
            }
          }
          curChild = curChild.nextSibling;
        }
      }
    }
    function removeNode(node, parentNode, skipKeyedNodes) {
      if (onBeforeNodeDiscarded(node) === false) {
        return;
      }
      if (parentNode) {
        parentNode.removeChild(node);
      }
      onNodeDiscarded(node);
      walkDiscardedChildNodes(node, skipKeyedNodes);
    }
    function indexTree(node) {
      if (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE$1) {
        var curChild = node.firstChild;
        while (curChild) {
          var key = getNodeKey(curChild);
          if (key) {
            fromNodesLookup[key] = curChild;
          }
          indexTree(curChild);
          curChild = curChild.nextSibling;
        }
      }
    }
    indexTree(fromNode);
    function handleNodeAdded(el) {
      onNodeAdded(el);
      var curChild = el.firstChild;
      while (curChild) {
        var nextSibling = curChild.nextSibling;
        var key = getNodeKey(curChild);
        if (key) {
          var unmatchedFromEl = fromNodesLookup[key];
          if (unmatchedFromEl && compareNodeNames(curChild, unmatchedFromEl)) {
            curChild.parentNode.replaceChild(unmatchedFromEl, curChild);
            morphEl(unmatchedFromEl, curChild);
          } else {
            handleNodeAdded(curChild);
          }
        } else {
          handleNodeAdded(curChild);
        }
        curChild = nextSibling;
      }
    }
    function cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey) {
      while (curFromNodeChild) {
        var fromNextSibling = curFromNodeChild.nextSibling;
        if (curFromNodeKey = getNodeKey(curFromNodeChild)) {
          addKeyedRemoval(curFromNodeKey);
        } else {
          removeNode(
            curFromNodeChild,
            fromEl,
            true
            /* skip keyed nodes */
          );
        }
        curFromNodeChild = fromNextSibling;
      }
    }
    function morphEl(fromEl, toEl, childrenOnly2) {
      var toElKey = getNodeKey(toEl);
      if (toElKey) {
        delete fromNodesLookup[toElKey];
      }
      if (!childrenOnly2) {
        var beforeUpdateResult = onBeforeElUpdated(fromEl, toEl);
        if (beforeUpdateResult === false) {
          return;
        } else if (beforeUpdateResult instanceof HTMLElement) {
          fromEl = beforeUpdateResult;
          indexTree(fromEl);
        }
        morphAttrs2(fromEl, toEl);
        onElUpdated(fromEl);
        if (onBeforeElChildrenUpdated(fromEl, toEl) === false) {
          return;
        }
      }
      if (fromEl.nodeName !== "TEXTAREA") {
        morphChildren(fromEl, toEl);
      } else {
        specialElHandlers.TEXTAREA(fromEl, toEl);
      }
    }
    function morphChildren(fromEl, toEl) {
      var skipFrom = skipFromChildren(fromEl, toEl);
      var curToNodeChild = toEl.firstChild;
      var curFromNodeChild = fromEl.firstChild;
      var curToNodeKey;
      var curFromNodeKey;
      var fromNextSibling;
      var toNextSibling;
      var matchingFromEl;
      outer: while (curToNodeChild) {
        toNextSibling = curToNodeChild.nextSibling;
        curToNodeKey = getNodeKey(curToNodeChild);
        while (!skipFrom && curFromNodeChild) {
          fromNextSibling = curFromNodeChild.nextSibling;
          if (curToNodeChild.isSameNode && curToNodeChild.isSameNode(curFromNodeChild)) {
            curToNodeChild = toNextSibling;
            curFromNodeChild = fromNextSibling;
            continue outer;
          }
          curFromNodeKey = getNodeKey(curFromNodeChild);
          var curFromNodeType = curFromNodeChild.nodeType;
          var isCompatible = void 0;
          if (curFromNodeType === curToNodeChild.nodeType) {
            if (curFromNodeType === ELEMENT_NODE) {
              if (curToNodeKey) {
                if (curToNodeKey !== curFromNodeKey) {
                  if (matchingFromEl = fromNodesLookup[curToNodeKey]) {
                    if (fromNextSibling === matchingFromEl) {
                      isCompatible = false;
                    } else {
                      fromEl.insertBefore(matchingFromEl, curFromNodeChild);
                      if (curFromNodeKey) {
                        addKeyedRemoval(curFromNodeKey);
                      } else {
                        removeNode(
                          curFromNodeChild,
                          fromEl,
                          true
                          /* skip keyed nodes */
                        );
                      }
                      curFromNodeChild = matchingFromEl;
                      curFromNodeKey = getNodeKey(curFromNodeChild);
                    }
                  } else {
                    isCompatible = false;
                  }
                }
              } else if (curFromNodeKey) {
                isCompatible = false;
              }
              isCompatible = isCompatible !== false && compareNodeNames(curFromNodeChild, curToNodeChild);
              if (isCompatible) {
                morphEl(curFromNodeChild, curToNodeChild);
              }
            } else if (curFromNodeType === TEXT_NODE || curFromNodeType == COMMENT_NODE) {
              isCompatible = true;
              if (curFromNodeChild.nodeValue !== curToNodeChild.nodeValue) {
                curFromNodeChild.nodeValue = curToNodeChild.nodeValue;
              }
            }
          }
          if (isCompatible) {
            curToNodeChild = toNextSibling;
            curFromNodeChild = fromNextSibling;
            continue outer;
          }
          if (curFromNodeKey) {
            addKeyedRemoval(curFromNodeKey);
          } else {
            removeNode(
              curFromNodeChild,
              fromEl,
              true
              /* skip keyed nodes */
            );
          }
          curFromNodeChild = fromNextSibling;
        }
        if (curToNodeKey && (matchingFromEl = fromNodesLookup[curToNodeKey]) && compareNodeNames(matchingFromEl, curToNodeChild)) {
          if (!skipFrom) {
            addChild(fromEl, matchingFromEl);
          }
          morphEl(matchingFromEl, curToNodeChild);
        } else {
          var onBeforeNodeAddedResult = onBeforeNodeAdded(curToNodeChild);
          if (onBeforeNodeAddedResult !== false) {
            if (onBeforeNodeAddedResult) {
              curToNodeChild = onBeforeNodeAddedResult;
            }
            if (curToNodeChild.actualize) {
              curToNodeChild = curToNodeChild.actualize(fromEl.ownerDocument || doc);
            }
            addChild(fromEl, curToNodeChild);
            handleNodeAdded(curToNodeChild);
          }
        }
        curToNodeChild = toNextSibling;
        curFromNodeChild = fromNextSibling;
      }
      cleanupFromEl(fromEl, curFromNodeChild, curFromNodeKey);
      var specialElHandler = specialElHandlers[fromEl.nodeName];
      if (specialElHandler) {
        specialElHandler(fromEl, toEl);
      }
    }
    var morphedNode = fromNode;
    var morphedNodeType = morphedNode.nodeType;
    var toNodeType = toNode.nodeType;
    if (!childrenOnly) {
      if (morphedNodeType === ELEMENT_NODE) {
        if (toNodeType === ELEMENT_NODE) {
          if (!compareNodeNames(fromNode, toNode)) {
            onNodeDiscarded(fromNode);
            morphedNode = moveChildren(fromNode, createElementNS(toNode.nodeName, toNode.namespaceURI));
          }
        } else {
          morphedNode = toNode;
        }
      } else if (morphedNodeType === TEXT_NODE || morphedNodeType === COMMENT_NODE) {
        if (toNodeType === morphedNodeType) {
          if (morphedNode.nodeValue !== toNode.nodeValue) {
            morphedNode.nodeValue = toNode.nodeValue;
          }
          return morphedNode;
        } else {
          morphedNode = toNode;
        }
      }
    }
    if (morphedNode === toNode) {
      onNodeDiscarded(fromNode);
    } else {
      if (toNode.isSameNode && toNode.isSameNode(morphedNode)) {
        return;
      }
      morphEl(morphedNode, toNode, childrenOnly);
      if (keyedRemovalList) {
        for (var i = 0, len = keyedRemovalList.length; i < len; i++) {
          var elToRemove = fromNodesLookup[keyedRemovalList[i]];
          if (elToRemove) {
            removeNode(elToRemove, elToRemove.parentNode, false);
          }
        }
      }
    }
    if (!childrenOnly && morphedNode !== fromNode && fromNode.parentNode) {
      if (morphedNode.actualize) {
        morphedNode = morphedNode.actualize(fromNode.ownerDocument || doc);
      }
      fromNode.parentNode.replaceChild(morphedNode, fromNode);
    }
    return morphedNode;
  };
}
var morphdom = morphdomFactory(morphAttrs);
var morphdom_esm_default = morphdom;

// client/sidebar-status.js
var import_react = require("react");
var import_client3 = require("react-dom/client");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
function sidebarStatus(session) {
  const pending = {
    approval: { state: "warning", label: "\u7B49\u5F85\u5BA1\u6279", trailing: "\u5F85\u5BA1\u6279" },
    "plan-review": { state: "warning", label: "\u7B49\u5F85\u8BA1\u5212\u786E\u8BA4", trailing: "\u5F85\u786E\u8BA4" },
    question: { state: "warning", label: "\u7B49\u5F85\u56DE\u590D", trailing: "\u5F85\u56DE\u590D" }
  }[session.pendingInteraction];
  if (pending !== void 0) return pending;
  if (session.running) return { state: "ongoing", label: "\u8FD0\u884C\u4E2D" };
  if (session.completionUnread) return { state: "done", label: "\u5DF2\u5B8C\u6210" };
  return { state: "idle", label: "\u7A7A\u95F2" };
}
function createSidebarStatusRenderer() {
  const roots = /* @__PURE__ */ new Map();
  return {
    sync(section) {
      const present = new Set(section.querySelectorAll('[data-dsh-remote-hosts="sessionStatus"]'));
      for (const [element, entry] of roots) {
        if (present.has(element)) continue;
        entry.root.unmount();
        roots.delete(element);
      }
      for (const element of present) {
        const state = element.dataset.state;
        let entry = roots.get(element);
        if (entry === void 0) {
          if (state === "idle") continue;
          entry = { root: (0, import_client3.createRoot)(element) };
          roots.set(element, entry);
        }
        if (entry.state === state) continue;
        entry.state = state;
        entry.root.render(state === "idle" ? null : (0, import_react.createElement)(import_dsh_client_ui_primitives.StateDot, { state }));
      }
    },
    dispose() {
      for (const { root } of roots.values()) root.unmount();
      roots.clear();
    }
  };
}

// client/source.js
function createPlugin(runtime) {
  const MARK = "data-dsh-remote-hosts";
  let GATEWAY;
  const VERSION = window.__DSH_BOOT__?.release?.version ?? "unknown";
  const LOG = "[remote-hosts]";
  const statusRenderer = createSidebarStatusRenderer();
  const state = {
    started: false,
    loadGeneration: 0,
    stopped: false,
    rendering: false,
    misses: 0,
    lastJSON: "",
    data: { hosts: [] },
    timer: void 0,
    observer: void 0,
    section: void 0,
    localHeading: void 0,
    templates: {},
    templateRevision: 0,
    renderTimer: void 0,
    groups: /* @__PURE__ */ new Map(),
    style: void 0,
    expandedHosts: /* @__PURE__ */ new Set(),
    expandedWorkspaces: /* @__PURE__ */ new Set(),
    workspaces: /* @__PURE__ */ new Map(),
    events: /* @__PURE__ */ new Map(),
    dialog: void 0,
    native: {
      ctx: void 0,
      patched: false,
      lifetime: void 0,
      records: /* @__PURE__ */ new Map(),
      transports: /* @__PURE__ */ new Map(),
      catalogs: /* @__PURE__ */ new Map(),
      retainObservers: /* @__PURE__ */ new Map(),
      repairing: false
    }
  };
  const log = (...args) => console.info(LOG, ...args);
  const warn = (...args) => console.warn(LOG, ...args);
  function findSidebar() {
    const cols = [...document.querySelectorAll(sidebarSelectors.sidebar)];
    return cols.find((el) => el.offsetParent !== null) ?? cols[0] ?? null;
  }
  function findRegion() {
    const sidebar = findSidebar();
    return sidebar?.querySelector(sidebarSelectors.tree)?.closest(sidebarSelectors.region) ?? null;
  }
  function findList(region) {
    return region?.querySelector(sidebarSelectors.tree) ?? null;
  }
  function findTemplates(list) {
    const group = [...list?.querySelectorAll(sidebarSelectors.group) ?? []].find((row) => !row.closest(`[${MARK}]`)) ?? null;
    const session = [...list?.querySelectorAll(sidebarSelectors.session) ?? []].find((row) => !row.closest(`[${MARK}]`)) ?? null;
    for (const [key, element] of [["group", group], ["session", session]]) {
      if (element !== null && state.templates[key]?.className !== element.className) {
        state.templates[key] = element.cloneNode(true);
        state.templateRevision++;
      }
    }
    return { group: state.templates.group, session: state.templates.session };
  }
  function addStyle() {
    if (state.style !== void 0) return;
    const style = document.createElement("style");
    style.setAttribute(MARK, "style");
    style.textContent = `
      [class*="_treeBody"]:has(>[${MARK}="section"]){overflow-y:auto;scrollbar-gutter:stable;scrollbar-width:thin;padding-bottom:16px}
      [class*="_treeBody"]:has(>[${MARK}="section"])>[role="tree"]{flex:0 0 auto;min-height:auto;overflow:visible;scrollbar-gutter:auto;padding-bottom:0}
      [class*="_treeBody"]:has(>[${MARK}="section"])>[class*="_fade"]{display:none}
      [${MARK}="section"]{display:contents}
      [data-dsh-remote-row][hidden]{display:none!important}
      [data-dsh-remote-row]{box-sizing:border-box}
      [data-dsh-remote-row="session"][aria-selected="true"]{background-color:var(--dsw-alias-interactive-bg-hover)}
      [${MARK}="sessionStatus"]{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none}
      [data-dsh-remote-row="workspace"] [class*="_projectText"]{flex-direction:row;align-items:center}
      [data-dsh-remote-row="workspace"] [class*="_title"]{flex:1;min-width:0}
      [${MARK}="count"]{flex:none;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-variant-numeric:tabular-nums}
      [data-dsh-remote-row="workspace"] [class*="_arrow"]{transform:none}
      [data-dsh-remote-row="workspace"][aria-expanded="true"] [class*="_arrow"]{transform:rotate(90deg)}
      [data-dsh-remote-row="workspace"] [class*="_folder"]{color:var(--dsw-alias-label-tertiary)}
      [data-dsh-remote-row="workspace"][data-active="true"] [class*="_folder"]{color:var(--dsw-alias-state-business-primary)}
      [${MARK}="hostBadge"]{flex:none;padding:1px 5px;border-radius:var(--dsw-radius-xs,4px);font-size:10px;line-height:14px;
        color:var(--dsw-alias-label-tertiary, #888)}
      [${MARK}="dot"]{display:inline-block;width:6px;height:6px;border-radius:50%;margin-right:5px;vertical-align:middle;
        background:#c9a227}
      [${MARK}="dot"][data-online="true"]{background:#2f9e44}
      [${MARK}="dot"][data-online="false"]{background:#c92a2a}
      [${MARK}="row"]{display:flex;align-items:center;gap:6px;padding:6px 10px;font-size:12px;cursor:pointer;
        color:var(--dsw-alias-label-primary, inherit)}
      [${MARK}="row"]:hover{background:var(--dsw-alias-bg-layer-3, rgba(127,127,127,.12))}
      [${MARK}="row"][data-depth="1"]{padding-left:24px}
      [${MARK}="row"][data-depth="2"]{padding-left:38px}
      [${MARK}="muted"]{color:var(--dsw-alias-label-tertiary, #888);font-size:11px}
      [${MARK}="divider"]{display:flex;align-items:center;gap:6px;min-height:34px;padding:0 var(--dsh-sidebar-row-padding,16px);margin-top:8px;
        cursor:pointer;user-select:none}
      [${MARK}="dividerChevron"]{display:inline-flex;flex:none;width:12px;height:16px;align-items:center;justify-content:center;
        color:var(--dsw-alias-label-tertiary,#888);transition:transform .12s ease}
      [${MARK}="divider"][aria-expanded="true"] [${MARK}="dividerChevron"]{transform:rotate(90deg)}
      [${MARK}="dividerLabel"]{min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary,#ddd);white-space:nowrap}
      [${MARK}="dividerLine"]{flex:1;min-width:0}
      [${MARK}="action"]{display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0;width:24px;height:24px;border:0;
        border-radius:var(--dsw-radius-xs,4px);background:transparent;color:var(--dsw-alias-label-tertiary,#888);font:inherit;font-size:16px;line-height:20px;cursor:pointer}
      [${MARK}="action"]:hover{color:var(--dsw-alias-label-primary,#eee);background:var(--dsw-alias-interactive-bg-hover)}
      [${MARK}="action"]:focus-visible,[data-dsh-remote-row]:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:-2px}
      [${MARK}="dialogBackdrop"]{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,.35)}
      [${MARK}="dialog"]{width:380px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;border:1px solid var(--dsw-alias-border-l1,#444);border-radius:10px;
        padding:14px;background:var(--dsw-alias-bg-layer-1,#1b1b1b);color:var(--dsw-alias-label-primary,#eee);
        box-shadow:0 18px 50px rgba(0,0,0,.45);font-size:12px;line-height:18px}
      [${MARK}="dialog"] h3{margin:0 0 4px;font-size:14px}
      [${MARK}="dialog"] label{display:block;margin:10px 0 4px;color:var(--dsw-alias-label-secondary,#888)}
      [${MARK}="dialog"] input{width:100%;box-sizing:border-box;padding:7px 8px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1,#444);
        background:var(--dsw-alias-bg-layer-2,transparent);color:inherit;font:inherit;font-size:12px}
      [${MARK}="dialogActions"]{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
      [${MARK}="dialogActions"] button{font:inherit;font-size:12px;padding:6px 10px;border-radius:7px;border:1px solid var(--dsw-alias-border-l1,#444);
        background:transparent;color:inherit;cursor:pointer}
      [${MARK}="dialogActions"] button[type=submit]{background:var(--dsw-alias-brand-primary,#4c6ef5);border-color:transparent;color:#fff}
      [${MARK}="dialogActions"] button:disabled{opacity:.5;cursor:default}
      [${MARK}="dialogError"]{margin-top:8px;color:#c92a2a;white-space:pre-wrap}
      [${MARK}="pathField"]{position:relative}
      [${MARK}="pathViewport"]{height:min(180px,25vh);margin-top:5px;border:1px solid var(--dsw-alias-border-l1,#444);border-radius:7px;overflow:hidden}
      [${MARK}="pathSuggestions"]{height:100%;overflow:auto}
      [${MARK}="pathSuggestions"][hidden]{display:none}
      [${MARK}="pathSuggestions"] button{display:block;width:100%;padding:5px 8px;border:0;text-align:left;background:transparent;color:inherit;font:inherit;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      [${MARK}="pathSuggestions"] button:disabled{cursor:progress}
      [${MARK}="pathSuggestions"] button:hover,[${MARK}="pathSuggestions"] button[aria-selected="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.15))}
      [${MARK}="pathStatus"]{margin-top:5px;height:32px;overflow:auto;color:var(--dsw-alias-label-tertiary,#888);font-size:11px;line-height:16px}
      [${MARK}="pathStatus"][data-error="true"]{color:var(--dsw-alias-state-error-primary,#c92a2a)}
      [${MARK}="localHeading"],[${MARK}="manageBar"]{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 var(--dsh-sidebar-row-padding,16px);color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
      [${MARK}="manageBar"]{justify-content:space-between;margin-top:12px}
      [${MARK}="manageButton"]{font:inherit;font-size:11px;padding:3px 8px;border-radius:6px;border:0;
        background:transparent;color:var(--dsw-alias-label-secondary,#888);cursor:pointer}
      [${MARK}="manageButton"]:hover{color:var(--dsw-alias-label-primary,#eee)}
      [${MARK}="hostManager"]{position:relative;width:460px;max-width:calc(100vw - 32px);max-height:80vh;overflow:auto;border:1px solid var(--dsw-alias-border-l1,#444);
        border-radius:10px;padding:14px;background:var(--dsw-alias-bg-layer-1,#1b1b1b);color:var(--dsw-alias-label-primary,#eee);
        box-shadow:0 18px 50px rgba(0,0,0,.45);font-size:12px;line-height:18px}
      [${MARK}="hostManager"] h3{margin:0 0 8px;font-size:14px}
      [${MARK}="hostManagerRow"]{display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--dsw-alias-border-l1,#333)}
      [${MARK}="hostManagerRow"] .meta{color:var(--dsw-alias-label-tertiary,#888);font-size:11px}
      [${MARK}="hostManagerSubhead"]{margin-top:10px;color:var(--dsw-alias-label-tertiary,#888);font-size:11px}
      [${MARK}="hostManagerRow"] .actions{display:flex;gap:4px;margin-left:auto}
      [${MARK}="hostManagerRow"] .actions button{margin-left:0;font:inherit;font-size:11px;padding:2px 6px;border-radius:5px;
        border:1px solid var(--dsw-alias-border-l1,#444);background:transparent;color:inherit;cursor:pointer}
      [${MARK}="sshHosts"]{max-height:40vh;overflow:auto;margin:10px 0}
      [${MARK}="hostManagerRow"]{flex-wrap:wrap}
      [${MARK}="hostManagerRow"] .meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:45%}
      [${MARK}="sshCommand"],[${MARK}="sshChallenge"]{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
      [${MARK}="sshChallenge"][hidden]{display:none}
      [${MARK}="sshChallenge"] label{flex-basis:100%;white-space:pre-wrap;overflow-wrap:anywhere}
      [${MARK}="installConfirmation"]{margin-top:12px;padding:12px;border:1px solid var(--dsw-alias-border-l1,#444);border-radius:8px}
      [${MARK}="installConfirmation"][hidden]{display:none}
      [${MARK}="installConfirmation"] h4{margin:0 0 8px;font:inherit;font-weight:600}
      [${MARK}="installConfirmation"] p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}
      [${MARK}="installConfirmation"] button+button{margin-left:8px}
      [${MARK}="hostManager"] input{flex:1;min-width:120px;box-sizing:border-box;padding:7px 10px;border-radius:8px;
        border:1px solid var(--dsw-alias-border-l1,#888);background:transparent;color:inherit;font:inherit}
      [${MARK}="hostManager"] button{font:inherit;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l1,#888);border-radius:6px;padding:5px 8px;cursor:pointer}
      [${MARK}="hostManager"] button:disabled{opacity:.5;cursor:default}
      [${MARK}="hostManagerStatus"]{margin-top:8px;white-space:pre-wrap;overflow-wrap:anywhere}
      [${MARK}="hostManagerStatus"][data-error="true"]{color:var(--dsw-alias-state-error-primary,#c92a2a)}
    `;
    document.head.appendChild(style);
    state.style = style;
  }
  function relativeTime(ms) {
    if (!Number.isFinite(ms)) return "";
    const delta = Math.max(0, Date.now() - ms);
    const minutes = Math.floor(delta / 6e4);
    if (minutes < 1) return "\u521A\u521A";
    if (minutes < 60) return `${minutes} \u5206\u949F`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} \u5C0F\u65F6`;
    return `${Math.floor(hours / 24)} \u5929`;
  }
  function makeDot(online) {
    const dot = document.createElement("span");
    dot.setAttribute(MARK, "dot");
    dot.dataset.online = online ? "true" : "false";
    return dot;
  }
  function makeBadge(text) {
    const badge = document.createElement("span");
    badge.setAttribute(MARK, "hostBadge");
    badge.textContent = text;
    return badge;
  }
  function workspaceTitle(cwd) {
    if (typeof cwd !== "string" || cwd === "") return "\u672A\u5206\u7EC4";
    const parts = cwd.split("/").filter(Boolean);
    return parts.at(-1) ?? cwd;
  }
  function workspaceGroups(host, sessions) {
    const record = state.workspaces.get(host.id);
    const archived = new Set(Array.isArray(record?.archivedSessionIds) ? record.archivedSessionIds : []);
    sessions = sessions.filter((session) => !archived.has(session.sessionId));
    const items = Array.isArray(record?.items) ? record.items : [];
    const matched = /* @__PURE__ */ new Set();
    const groups = [];
    for (const item of items) {
      const workspaceSessions = sessions.filter((session) => {
        if (matched.has(session.sessionId)) return false;
        if (Array.isArray(item.sessionIds) && item.sessionIds.includes(session.sessionId)) return true;
        if (typeof item.path !== "string" || item.path === "") return false;
        return session.cwd === item.path || typeof session.cwd === "string" && session.cwd.startsWith(item.path + "/");
      });
      for (const session of workspaceSessions) matched.add(session.sessionId);
      groups.push({
        key: `ws:${item.workspaceId}`,
        workspaceId: item.workspaceId,
        cwd: item.path,
        title: item.title !== "" && item.title !== void 0 ? item.title : workspaceTitle(item.path),
        sessions: workspaceSessions
      });
    }
    const byCwd = /* @__PURE__ */ new Map();
    for (const session of sessions) {
      if (matched.has(session.sessionId)) continue;
      const cwd = typeof session.cwd === "string" ? session.cwd : "";
      const key = cwd === "" ? "(unknown)" : cwd;
      if (!byCwd.has(key)) byCwd.set(key, { key, cwd, sessions: [] });
      byCwd.get(key).sessions.push(session);
    }
    for (const group of byCwd.values()) {
      groups.push({
        key: `cwd:${group.key}`,
        cwd: group.cwd,
        title: workspaceTitle(group.cwd),
        sessions: group.sessions
      });
    }
    return groups;
  }
  function actionButton(label, title, handler, template) {
    const button = template?.cloneNode(true) ?? document.createElement("button");
    button.type = "button";
    if (template === void 0) {
      button.setAttribute(MARK, "action");
      button.textContent = label;
    }
    button.removeAttribute("aria-keyshortcuts");
    button.title = title;
    button.setAttribute("aria-label", title);
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    };
    return button;
  }
  function hostDivider(host) {
    const divider = document.createElement("div");
    divider.setAttribute(MARK, "divider");
    divider.dataset.dshRemoteRow = "host";
    divider.dataset.hostId = host.id;
    divider.dataset.rowKey = `remote-host:${host.id}`;
    divider.setAttribute("aria-expanded", String(state.expandedHosts.has(host.id)));
    divider.setAttribute("role", "treeitem");
    divider.tabIndex = -1;
    const chevron = document.createElement("span");
    chevron.setAttribute(MARK, "dividerChevron");
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    arrow.setAttribute("width", "12");
    arrow.setAttribute("height", "12");
    arrow.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#dsw-icon-triangle-right-fill-regular");
    arrow.append(use);
    chevron.append(arrow);
    const label = document.createElement("span");
    label.setAttribute(MARK, "dividerLabel");
    label.textContent = host.label;
    const line = document.createElement("span");
    line.setAttribute(MARK, "dividerLine");
    divider.append(
      chevron,
      makeDot(host.online),
      label,
      makeBadge("SSH"),
      line,
      actionButton("+", "\u65B0\u5EFA\u8FDC\u7A0B\u5DE5\u4F5C\u533A", () => openWorkspaceDialog(host))
    );
    return divider;
  }
  function clearRowState(row) {
    for (const element of [row, ...row.querySelectorAll("*")]) {
      for (const name of [...element.classList]) {
        if (/_(selected|menuOpen|archived|dropBefore|dropAfter|folderActive|arrowOpen)$/.test(name)) element.classList.remove(name);
      }
      element.removeAttribute("data-scrolled");
      element.removeAttribute("data-clipped");
    }
  }
  function setWorkspaceExpanded(row, expanded) {
    row.setAttribute("aria-expanded", String(expanded));
    const folder = row.querySelector('[class*="_folder"] svg');
    if (folder !== null) {
      const icon = `dsw-icon-folder-${expanded ? "open" : "close"}-regular`;
      folder.setAttribute("data-icon", icon);
      folder.querySelector("use")?.setAttribute("href", `#${icon}`);
    }
  }
  function hostRow(host, template, sessions) {
    const group = template.group?.cloneNode(false) ?? document.createElement("div");
    group.dataset.dshRemoteGroup = host.id;
    const workspaceTemplate = template.group?.querySelector('[class*="_projectRow"]') ?? null;
    group.append(hostDivider(host));
    const hostExpanded = state.expandedHosts.has(host.id);
    for (const workspace of workspaceGroups(host, sessions)) {
      let workspaceRow = workspaceTemplate?.cloneNode(true) ?? null;
      if (workspaceRow === null) {
        workspaceRow = document.createElement("div");
        workspaceRow.setAttribute(MARK, "row");
        workspaceRow.append(document.createTextNode(workspace.title ?? workspaceTitle(workspace.cwd)));
      } else {
        clearRowState(workspaceRow);
        workspaceRow.removeAttribute("draggable");
        const workspaceTitleEl = workspaceRow.querySelector('[class*="_title"]');
        if (workspaceTitleEl !== null) {
          workspaceTitleEl.textContent = workspace.title ?? workspaceTitle(workspace.cwd);
        }
        workspaceRow.querySelector('[class*="_rowActions"]')?.remove();
        workspaceRow.querySelector('[class*="_meta"]')?.remove();
      }
      workspaceRow.dataset.dshRemoteRow = "workspace";
      workspaceRow.dataset.hostId = host.id;
      workspaceRow.dataset.workspaceKey = workspace.key;
      workspaceRow.dataset.rowKey = `remote-workspace:${host.id}:${workspace.key}`;
      workspaceRow.setAttribute("role", "treeitem");
      workspaceRow.tabIndex = -1;
      workspaceRow.title = workspace.cwd === "" ? "\u672A\u5206\u7EC4" : workspace.cwd;
      const count = document.createElement("span");
      count.setAttribute(MARK, "count");
      count.textContent = String(workspace.sessions.length);
      count.setAttribute("aria-label", `${workspace.sessions.length} \u4E2A\u4F1A\u8BDD`);
      workspaceRow.append(count);
      const workspaceExpanded = state.expandedWorkspaces.has(`${host.id}:${workspace.key}`);
      setWorkspaceExpanded(workspaceRow, workspaceExpanded);
      if (workspace.workspaceId !== void 0) {
        const actionTemplate = workspaceTemplate?.querySelector('[class*="_rowActions"] button:last-child');
        const action = actionButton("+", "\u5728\u6B64\u5DE5\u4F5C\u533A\u65B0\u5EFA\u8FDC\u7A0B\u4F1A\u8BDD", () => state.native.ctx.uiWorkspace.startSession(nativeId(host.id, workspace.workspaceId)), actionTemplate ?? void 0);
        const actions = workspaceTemplate?.querySelector('[class*="_rowActions"]')?.cloneNode(false);
        if (actions !== void 0) {
          actions.append(action);
          workspaceRow.append(actions);
        } else workspaceRow.append(action);
      }
      workspaceRow.hidden = !hostExpanded;
      group.append(workspaceRow);
      for (const session of workspace.sessions) {
        const row = sessionRow(host, session, template.session);
        row.dataset.workspaceKey = workspace.key;
        row.hidden = !hostExpanded || !workspaceExpanded;
        group.append(row);
      }
    }
    return group;
  }
  function sessionRow(host, session, template) {
    const row = template?.cloneNode(true) ?? null;
    const status = sidebarStatus(session);
    const title = state.native.records.get(nativeId(host.id, session.sessionId))?.binding.session.projections.get("title") ?? session.projections?.values?.title ?? session.title ?? session.cwd?.split("/").filter(Boolean).at(-1) ?? session.sessionId;
    if (row === null) {
      const fallback = document.createElement("div");
      fallback.setAttribute(MARK, "row");
      fallback.dataset.depth = "1";
      fallback.dataset.dshRemoteRow = "session";
      fallback.dataset.hostId = host.id;
      fallback.dataset.sessionId = session.sessionId;
      fallback.dataset.rowKey = `remote-session:${host.id}:${session.sessionId}`;
      fallback.append(document.createTextNode(title));
      const meta = document.createElement("span");
      meta.setAttribute(MARK, "muted");
      meta.dataset.updatedAt = String(session.updatedAt ?? "");
      meta.dataset.running = String(session.running === true);
      meta.textContent = `${relativeTime(session.updatedAt)}${session.running ? " \xB7 \u8FD0\u884C\u4E2D" : ""}`;
      fallback.append(meta);
      appendSessionStatus(fallback, session, status);
      return fallback;
    }
    row.dataset.dshRemoteRow = "session";
    row.dataset.hostId = host.id;
    row.dataset.sessionId = session.sessionId;
    row.dataset.rowKey = `remote-session:${host.id}:${session.sessionId}`;
    row.removeAttribute("draggable");
    clearRowState(row);
    row.setAttribute("aria-selected", "false");
    row.tabIndex = -1;
    const titleEl = row.querySelector('[class*="_title"]');
    if (titleEl !== null) titleEl.textContent = title;
    const timeEl = row.querySelector('[class*="_time"]')?.cloneNode(false) ?? document.createElement("span");
    for (const child of [...row.children]) {
      if (child === titleEl) continue;
      if (child.matches('[class*="_slot"]')) child.replaceChildren();
      else child.remove();
    }
    appendSessionStatus(row, session, status);
    if (session.blank !== true && titleEl !== null) {
      timeEl.className = [...titleEl.classList].find((name) => name.endsWith("_title")).replace(/_title$/, "_time");
      timeEl.textContent = status.trailing ?? relativeTime(session.updatedAt);
      if (status.trailing === void 0) timeEl.dataset.updatedAt = String(session.updatedAt ?? "");
      row.append(timeEl);
    }
    return row;
  }
  function appendSessionStatus(row, session, status) {
    row.dataset.sessionState = status.state;
    row.setAttribute("aria-description", status.label);
    let slot = row.querySelector('[class*="_slot"]');
    if (slot === null) {
      slot = document.createElement("span");
      row.prepend(slot);
    }
    const indicator = document.createElement("span");
    indicator.setAttribute(MARK, "sessionStatus");
    indicator.dataset.state = session.blank === true ? "idle" : status.state;
    indicator.setAttribute("role", "img");
    indicator.setAttribute("aria-label", status.label);
    indicator.title = status.label;
    slot.append(indicator);
  }
  function createSection() {
    const section = document.createElement("section");
    section.setAttribute(MARK, "section");
    section.setAttribute("data-dsh-remote-section", "true");
    const manageBar = document.createElement("div");
    manageBar.setAttribute(MARK, "manageBar");
    const manageLabel = document.createElement("span");
    manageLabel.textContent = "SSH \u673A\u5668";
    const manageButton = document.createElement("button");
    manageButton.type = "button";
    manageButton.setAttribute(MARK, "manageButton");
    manageButton.textContent = "\u673A\u5668\u7BA1\u7406";
    manageButton.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openHostManager();
    };
    manageBar.append(manageLabel, manageButton);
    section.append(manageBar);
    section.addEventListener("click", onSectionClick);
    return section;
  }
  function hostView(host) {
    return {
      id: host.id,
      label: host.label,
      sshAlias: host.sshAlias,
      online: host.online,
      workspaces: state.workspaces.get(host.id)?.snapshot,
      sessions: (host.sessions ?? []).map((session) => ({
        sessionId: session.sessionId,
        cwd: session.cwd,
        blank: session.blank,
        running: session.running,
        updatedAt: session.updatedAt,
        ...sessionStatusFacts(host.id, session),
        title: state.native.records.get(nativeId(host.id, session.sessionId))?.binding.session.projections.get("title") ?? session.projections?.values?.title ?? session.title
      }))
    };
  }
  function sessionStatusFacts(hostId, session) {
    const id = nativeId(hostId, session.sessionId);
    const status = state.native.ctx.uiSession.sessionStatus.getSnapshot().get(id);
    const summary = state.native.ctx.sessions.list.getSnapshot().byId[id];
    return { blank: summary?.blank ?? session.blank, running: status?.running ?? session.running, completionUnread: status?.completionUnread === true, pendingInteraction: status?.pendingInteraction?.kind };
  }
  function updateTimes() {
    for (const element of state.section?.querySelectorAll("[data-updated-at]") ?? []) {
      const value = `${relativeTime(Number(element.dataset.updatedAt))}${element.dataset.running === "true" ? " \xB7 \u8FD0\u884C\u4E2D" : ""}`;
      if (element.textContent !== value) element.textContent = value;
    }
  }
  function removeInjected() {
    statusRenderer.dispose();
    state.section?.remove();
    state.section = void 0;
    state.localHeading?.remove();
    state.localHeading = void 0;
    state.groups.clear();
    state.lastJSON = "";
  }
  function render() {
    if (state.stopped || state.rendering) return;
    state.rendering = true;
    try {
      const region = findRegion();
      const list = findList(region);
      if (region === null || list === null) {
        state.misses += 1;
        if (state.misses >= 8) throw new Error(`DSH ${VERSION} \u7684\u5DE5\u4F5C\u533A\u4FA7\u680F\u7ED3\u6784\u4E0D\u517C\u5BB9`);
        scheduleRender(800);
        return;
      }
      state.misses = 0;
      if (state.section === void 0) state.section = createSection();
      const section = state.section;
      if (section.previousElementSibling !== list) {
        list.after(section);
        observe();
      }
      if (state.localHeading?.nextElementSibling !== list) {
        state.localHeading?.remove();
        const localHeading = document.createElement("div");
        localHeading.setAttribute(MARK, "localHeading");
        localHeading.textContent = "\u672C\u673A";
        list.before(localHeading);
        state.localHeading = localHeading;
      }
      const templates = findTemplates(list);
      const views = state.data.hosts.map(hostView);
      const json = JSON.stringify([state.templateRevision, views]);
      if (json === state.lastJSON) {
        updateTimes();
        return;
      }
      const desired = new Set(views.map((view) => view.id));
      for (const [id, group] of state.groups) {
        if (!desired.has(id)) {
          group.element.remove();
          state.groups.delete(id);
        }
      }
      let previous = section.firstElementChild;
      for (let index = 0; index < views.length; index++) {
        const view = views[index];
        const signature = JSON.stringify([state.templateRevision, view]);
        let group = state.groups.get(view.id);
        if (group?.signature !== signature) {
          let element = hostRow(state.data.hosts[index], templates, view.sessions);
          if (group !== void 0) element = morphdom_esm_default(group.element, element, {
            getNodeKey: (node) => node.dataset?.rowKey,
            onBeforeElUpdated: (current, incoming) => {
              if (current.getAttribute(MARK) === "sessionStatus") {
                for (const name of incoming.getAttributeNames()) current.setAttribute(name, incoming.getAttribute(name));
                return false;
              }
              current.onclick = incoming.onclick;
              return !current.isEqualNode(incoming);
            }
          });
          group = { element, signature };
          state.groups.set(view.id, group);
        }
        if (previous.nextElementSibling !== group.element) previous.after(group.element);
        previous = group.element;
      }
      syncSidebarSelection();
      state.lastJSON = json;
      updateTimes();
      statusRenderer.sync(section);
    } finally {
      state.rendering = false;
    }
  }
  function closeDialog() {
    state.dialog?.dispose?.();
    state.dialog?.remove();
    state.dialog = void 0;
  }
  function showDialog(options) {
    closeDialog();
    const backdrop = document.createElement("div");
    backdrop.setAttribute(MARK, "dialogBackdrop");
    const panel = document.createElement("div");
    panel.setAttribute(MARK, "dialog");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", options.title);
    const title = document.createElement("h3");
    title.textContent = options.title;
    const subtitle = document.createElement("div");
    subtitle.setAttribute(MARK, "muted");
    subtitle.textContent = options.subtitle ?? "";
    const form = document.createElement("form");
    const label = document.createElement("label");
    label.textContent = options.label ?? "";
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = options.placeholder ?? "";
    input.value = options.value ?? "";
    input.id = `remote-dialog-${crypto.randomUUID()}`;
    label.htmlFor = input.id;
    const error = document.createElement("div");
    error.setAttribute(MARK, "dialogError");
    error.hidden = true;
    const actions = document.createElement("div");
    actions.setAttribute(MARK, "dialogActions");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "\u53D6\u6D88";
    cancel.onclick = closeDialog;
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = options.submitText ?? "\u786E\u5B9A";
    actions.append(cancel, submit);
    form.append(label, input, error, actions);
    const paths = options.listDirectories && attachPathCompletion({ input, mark: MARK, listDirectories: options.listDirectories });
    backdrop.dispose = () => {
      paths?.dispose();
      options.onClose?.();
    };
    panel.append(title, subtitle, form);
    backdrop.append(panel);
    backdrop.onclick = (event) => {
      if (event.target === backdrop) closeDialog();
    };
    input.onkeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
    };
    let busy = false;
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (busy) return;
      busy = true;
      submit.disabled = true;
      error.hidden = true;
      try {
        const value = paths ? await paths.resolve(input.value.trim()) : input.value.trim();
        await options.onSubmit(value);
        if (state.dialog === backdrop) closeDialog();
      } catch (failure) {
        error.hidden = false;
        error.textContent = failure instanceof Error ? failure.message : String(failure);
      } finally {
        busy = false;
        submit.disabled = false;
      }
    };
    document.body.appendChild(backdrop);
    state.dialog = backdrop;
    setTimeout(() => input.focus(), 0);
  }
  function openWorkspaceDialog(host) {
    showDialog({
      title: "\u65B0\u5EFA\u8FDC\u7A0B\u5DE5\u4F5C\u533A",
      subtitle: `${host.label} \xB7 ${host.sshAlias ?? ""}`,
      label: "\u8FDC\u7A0B\u8DEF\u5F84",
      placeholder: "/root/project",
      value: "~/",
      submitText: "\u521B\u5EFA\u5DE5\u4F5C\u533A",
      listDirectories: (path, signal) => callApi(host.id, "directoryPicker/list", path === void 0 ? {} : { path }, signal),
      onSubmit: async (value) => {
        if (value === "") throw new Error("\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A");
        await callApi(host.id, "workspace/create", { request: { path: value } });
        await load();
      }
    });
  }
  async function connectRemoteWorkspace(hostId, workspaceId, options, signal) {
    const host = state.data.hosts.find((host2) => host2.id === hostId);
    const workspaces = workspaceRecord(hostId);
    const workspace = workspaces.items.find((item) => item.workspaceId === workspaceId);
    if (host === void 0 || workspace === void 0) throw new Error("\u8FDC\u7A0B\u5DE5\u4F5C\u533A\u5DF2\u4E0D\u53EF\u7528\uFF0C\u8BF7\u68C0\u67E5\u673A\u5668\u8FDE\u63A5\u3002");
    const sessions = await fetchSessions(hostId, signal);
    const blank = sessions.find((session) => session.blank && session.cwd === workspace.path && workspace.sessionIds.includes(session.sessionId) && !workspaces.archivedSessionIds.includes(session.sessionId) && (options.agentPreset === void 0 || typeof session.projections?.values?.agentPreset !== "string" || session.projections.values.agentPreset === options.agentPreset));
    const preset = options.agentPreset ?? blank?.projections?.values?.agentPreset;
    const request = {
      workspaceId,
      ...blank === void 0 ? {} : { sessionId: blank.sessionId },
      ...typeof preset === "string" ? { agentPreset: preset } : {}
    };
    const result = await callApi(hostId, "session/create", { request }, signal);
    signal.throwIfAborted();
    const currentHost = state.data.hosts.find((host2) => host2.id === hostId);
    if (currentHost === void 0) throw new Error("\u8FDC\u7A0B\u673A\u5668\u5DF2\u7ECF\u79FB\u9664");
    const refreshed = await fetchSessions(hostId, signal);
    signal.throwIfAborted();
    currentHost.sessions = refreshed;
    ensureNativeRows();
    return nativeId(hostId, result.sessionId);
  }
  async function createRemoteWorkspace(hostId, request) {
    const { workspace } = await callApi(hostId, "workspace/create", { request });
    applyWorkspaceFrame(workspaceRecord(hostId), { type: "upsert", workspace });
    return { ...workspace, workspaceId: nativeId(hostId, workspace.workspaceId), sessionIds: workspace.sessionIds.map((id) => nativeId(hostId, id)) };
  }
  function pickRemoteDirectory(hostId) {
    const host = state.data.hosts.find((host2) => host2.id === hostId);
    if (host === void 0) throw new Error("\u8FDC\u7A0B\u673A\u5668\u5DF2\u7ECF\u79FB\u9664");
    return new Promise((resolve) => showDialog({
      title: "\u9009\u62E9\u8FDC\u7A0B\u76EE\u5F55",
      subtitle: host.label,
      label: "\u8FDC\u7A0B\u8DEF\u5F84",
      value: "~/",
      submitText: "\u9009\u62E9\u76EE\u5F55",
      listDirectories: (path, signal) => callApi(hostId, "directoryPicker/list", path === void 0 ? {} : { path }, signal),
      onSubmit: (path) => {
        if (path === "") throw new Error("\u8DEF\u5F84\u4E0D\u80FD\u4E3A\u7A7A");
        resolve(path);
      },
      onClose: () => resolve(null)
    }));
  }
  function openHostManager() {
    closeDialog();
    state.dialog = openSshManager({ gateway: GATEWAY, mark: MARK, close: closeDialog, connected: load });
  }
  function onSectionClick(event) {
    const row = event.target?.closest?.("[data-dsh-remote-row]");
    if (row === null || row === void 0) return;
    if (row.dataset.dshRemoteRow === "host") {
      const group = row.closest("[data-dsh-remote-group]");
      const expanded = row.getAttribute("aria-expanded") === "true";
      if (expanded) state.expandedHosts.delete(row.dataset.hostId);
      else state.expandedHosts.add(row.dataset.hostId);
      row.setAttribute("aria-expanded", expanded ? "false" : "true");
      for (const workspace of group?.querySelectorAll?.('[data-dsh-remote-row="workspace"]') ?? []) {
        workspace.hidden = expanded;
      }
      for (const session of group?.querySelectorAll?.('[data-dsh-remote-row="session"]') ?? []) {
        session.hidden = expanded || !state.expandedWorkspaces.has(`${row.dataset.hostId}:${session.dataset.workspaceKey}`);
      }
      return;
    }
    if (row.dataset.dshRemoteRow === "workspace") {
      const group = row.closest("[data-dsh-remote-group]");
      const expanded = row.getAttribute("aria-expanded") === "true";
      const key = `${row.dataset.hostId}:${row.dataset.workspaceKey}`;
      if (expanded) state.expandedWorkspaces.delete(key);
      else state.expandedWorkspaces.add(key);
      setWorkspaceExpanded(row, !expanded);
      for (const session of group?.querySelectorAll?.('[data-dsh-remote-row="session"]') ?? []) {
        if (session.dataset.workspaceKey === row.dataset.workspaceKey) session.hidden = expanded;
      }
      return;
    }
    if (row.dataset.dshRemoteRow === "session") {
      openNativeSession(row.dataset.hostId, row.dataset.sessionId);
    }
  }
  function syncSidebarSelection() {
    const selected = state.native.ctx?.uiWorkspace.selection.getSnapshot().sessionId;
    for (const row of state.section?.querySelectorAll('[data-dsh-remote-row="session"]') ?? []) {
      row.setAttribute("aria-selected", String(nativeId(row.dataset.hostId, row.dataset.sessionId) === selected));
    }
    const active = state.section?.querySelector('[data-dsh-remote-row="session"][aria-selected="true"]');
    for (const row of state.section?.querySelectorAll('[data-dsh-remote-row="workspace"]') ?? []) {
      row.dataset.active = String(active !== void 0 && active !== null && row.dataset.hostId === active.dataset.hostId && row.dataset.workspaceKey === active.dataset.workspaceKey);
    }
  }
  function workspaceRecord(hostId) {
    let record = state.workspaces.get(hostId);
    if (record === void 0) {
      record = { hostId, items: [], archivedSessionIds: [], pinnedSessionIds: [], socket: void 0, timer: void 0, listeners: /* @__PURE__ */ new Set() };
      record.source = {
        getSnapshot: () => record.snapshot ??= { items: [], archivedSessionIds: [], pinnedSessionIds: [], state: "loading", phase: "pending", error: null },
        subscribe: (listener) => {
          record.listeners.add(listener);
          return () => record.listeners.delete(listener);
        }
      };
      state.workspaces.set(hostId, record);
    }
    return record;
  }
  function applyWorkspaceState(record, baseline) {
    record.items = Array.isArray(baseline?.items) ? baseline.items : [];
    record.archivedSessionIds = Array.isArray(baseline?.archivedSessionIds) ? baseline.archivedSessionIds : [];
    record.pinnedSessionIds = Array.isArray(baseline?.pinnedSessionIds) ? baseline.pinnedSessionIds : [];
  }
  function applyWorkspaceFrame(record, value) {
    if (value === void 0 || value === null) return;
    if (value.type === "baseline") {
      applyWorkspaceState(record, value.value);
    } else if (value.type === "replace") {
      applyWorkspaceState(record, value.value);
    } else if (value.type === "upsert") {
      const workspace = value.workspace;
      if (workspace === void 0) return;
      const index = record.items.findIndex((item) => item.workspaceId === workspace.workspaceId);
      if (index === -1) record.items = [...record.items, workspace];
      else record.items = record.items.map((item, itemIndex) => itemIndex === index ? workspace : item);
    } else if (value.type === "remove") {
      record.items = record.items.filter((item) => item.workspaceId !== value.workspaceId);
    } else if (value.type === "order") {
      const byId = new Map(record.items.map((item) => [item.workspaceId, item]));
      const ordered = [];
      for (const id of value.workspaceIds ?? []) {
        const item = byId.get(id);
        if (item !== void 0) {
          ordered.push(item);
          byId.delete(id);
        }
      }
      record.items = [...ordered, ...byId.values()];
    } else if (value.type === "archived") {
      record.archivedSessionIds = Array.isArray(value.archivedSessionIds) ? value.archivedSessionIds : [];
    } else if (value.type === "pinned") {
      record.pinnedSessionIds = Array.isArray(value.pinnedSessionIds) ? value.pinnedSessionIds : [];
    }
    record.snapshot = {
      items: record.items.map((workspace) => ({
        ...workspace,
        workspaceId: nativeId(record.hostId, workspace.workspaceId),
        sessionIds: workspace.sessionIds.map((id) => nativeId(record.hostId, id))
      })),
      archivedSessionIds: record.archivedSessionIds.map((id) => nativeId(record.hostId, id)),
      pinnedSessionIds: record.pinnedSessionIds.map((id) => nativeId(record.hostId, id)),
      state: "idle",
      phase: "ready",
      error: null
    };
    for (const listener of record.listeners) listener();
    scheduleRender();
  }
  function startWorkspaceStream(hostId) {
    if (state.stopped) return;
    const record = workspaceRecord(hostId);
    if (record.socket !== void 0) return;
    if (record.timer !== void 0) {
      clearTimeout(record.timer);
      record.timer = void 0;
    }
    let socket;
    try {
      socket = new WebSocket(`${GATEWAY.replace(/^http/, "ws")}/host/${encodeURIComponent(hostId)}/api/remote.mux`);
    } catch (error) {
      warn(`workspace socket ${hostId}: ${error.message}`);
      return;
    }
    record.socket = socket;
    socket.onopen = () => {
      try {
        socket.send(JSON.stringify({
          type: "open",
          streamId: "workspace",
          endpoint: "workspace/follow",
          payload: { args: {} }
        }));
      } catch (error) {
        warn(`workspace open ${hostId}: ${error.message}`);
      }
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type === "item") applyWorkspaceFrame(record, message.value);
      else if (message.type === "error") warn(`workspace stream ${hostId}: ${message.error?.message ?? "unknown"}`);
    };
    socket.onerror = () => warn(`workspace socket error ${hostId}`);
    socket.onclose = () => {
      if (record.socket === socket) record.socket = void 0;
      if (state.stopped) return;
      if (!state.data.hosts.some((host) => host.id === hostId)) return;
      record.timer = setTimeout(() => {
        record.timer = void 0;
        startWorkspaceStream(hostId);
      }, 3e3);
    };
  }
  function startHostEvents(hostId) {
    if (state.stopped || state.native.patched !== true) return;
    let record = state.events.get(hostId);
    if (record === void 0) {
      record = { socket: void 0, timer: void 0, clientId: void 0, pending: /* @__PURE__ */ new Set() };
      state.events.set(hostId, record);
    }
    if (record.socket !== void 0) return;
    if (record.timer !== void 0) {
      clearTimeout(record.timer);
      record.timer = void 0;
    }
    let socket;
    try {
      socket = new WebSocket(`${GATEWAY.replace(/^http/, "ws")}/host/${encodeURIComponent(hostId)}/api/remote.mux`);
    } catch (error) {
      warn(`events socket ${hostId}: ${error.message}`);
      return;
    }
    record.socket = socket;
    socket.onopen = () => {
      try {
        socket.send(JSON.stringify({ type: "open", streamId: "events", endpoint: "$events", payload: { args: {} } }));
        socket.send(JSON.stringify({ type: "open", streamId: "control", endpoint: "session/control", payload: { args: {} } }));
      } catch (error) {
        warn(`events open ${hostId}: ${error.message}`);
      }
    };
    socket.onmessage = (event) => {
      let message;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      if (message.type !== "item") return;
      const value = message.value;
      if (message.streamId === "control") {
        if (value.type === "baseline") {
          record.baselines = value.value.projections;
          for (const session of state.native.records.values()) {
            if (session.hostId !== hostId) continue;
            session.binding.session.projections.clear();
            const baseline = record.baselines?.[session.rawId];
            if (baseline !== void 0) session.binding.session.projections.seed(baseline);
          }
        } else if (value.type === "projection") {
          const session = state.native.records.get(nativeId(hostId, value.sessionId));
          if (session !== void 0) {
            for (const change of value.changes) session.binding.session.projections.apply(change.key, change.val, value.seq);
          }
        }
        return;
      }
      if (value?.type === "ready") {
        record.clientId = value.clientId;
        log(`events ready ${hostId} client=${String(value.clientId).slice(0, 8)}`);
        return;
      }
      if (value?.type === "emit") {
        if (value.event === "api-session/added") {
          const host = state.data.hosts.find((host2) => host2.id === hostId);
          if (host !== void 0) {
            const summary = value.args[0];
            host.sessions = [...(host.sessions ?? []).filter((session) => session.sessionId !== summary.sessionId), summary];
            ensureNativeRows();
            render();
          }
        } else if (value.event === "api-session/activity") {
          const summary = state.data.hosts.find((host) => host.id === hostId)?.sessions?.find((session) => session.sessionId === value.args[0]);
          if (summary !== void 0) summary.updatedAt = value.args[1];
          ensureNativeRows();
        } else if (value.event === "api-session/status") {
          const summary = state.data.hosts.find((host) => host.id === hostId)?.sessions?.find((session2) => session2.sessionId === value.args[0]);
          if (summary !== void 0) {
            summary.running = value.args[1];
            if (summary.running) summary.blank = false;
          }
          const session = state.native.records.get(nativeId(hostId, value.args[0]));
          session?.binding.session.handleRunning(value.args[1]);
          ensureNativeRows();
        } else if (value.event === "api-session/error") {
          state.native.records.get(nativeId(hostId, value.args[0]))?.binding.session.handleAgentError(value.args[1]);
        } else if (value.event === "api-session/removed") {
          state.native.records.get(nativeId(hostId, value.args[0]))?.binding.session.handleRemoved();
          void load();
        } else if (["llm/models-updated", "llm/adapters-updated", "settings/document-updated", "credentials/record-updated", "credentials/reference-updated"].includes(value.event)) {
          state.native.catalogs.get(hostId)?.refresh();
        }
        return;
      }
      if (value?.type === "waterfall") {
        void handleRemoteApproval(hostId, value, record);
        return;
      }
      if (value?.type === "cancel") {
        for (const pending of record.pending) {
          if (pending.eventId === value.eventId) pending.controller.abort(new Error("remote approval cancelled"));
        }
      }
    };
    socket.onerror = () => warn(`events socket error ${hostId}`);
    socket.onclose = () => {
      if (record.socket === socket) record.socket = void 0;
      for (const pending of record.pending) pending.controller.abort(new Error("events stream closed"));
      record.pending.clear();
      if (state.stopped) return;
      if (!state.data.hosts.some((host) => host.id === hostId)) return;
      record.timer = setTimeout(() => {
        record.timer = void 0;
        startHostEvents(hostId);
      }, 3e3);
    };
  }
  async function handleRemoteApproval(hostId, frame, record) {
    if (state.native.ctx === void 0 || state.remote === void 0) return;
    if (record.clientId === void 0) return;
    const rawId = frame.agentId;
    if (typeof rawId !== "string" || rawId === "") return;
    const session = nativeRecord(hostId, rawId);
    const reference = retainNative(session, { source: "gateway" });
    const target = session.binding.ctx;
    const controller = new AbortController();
    const pending = { eventId: frame.eventId, controller };
    record.pending.add(pending);
    let outcome = { kind: "next" };
    try {
      void loadNativePage(session).catch((error) => warn(`native open ${session.id}: ${error.message}`));
      const result = await state.remote.events.dispatchWaterfall(target, frame, controller.signal);
      if (result?.kind === "result") {
        outcome = { kind: "result", value: result.value };
      } else if (result?.kind === "next") {
        outcome = { kind: "next" };
      }
    } catch (error) {
      if (!controller.signal.aborted) warn(`remote approval ${frame.eventId}: ${error.message}`);
      outcome = { kind: "rejected", error: runtime.projectRemoteEventRejection(error) };
    } finally {
      record.pending.delete(pending);
    }
    if (controller.signal.aborted) {
      reference.release();
      return;
    }
    try {
      await callApi(hostId, "$events/result", {
        clientId: record.clientId,
        eventId: frame.eventId,
        outcome
      });
    } catch (error) {
      warn(`approval result ${frame.eventId}: ${error.message}`);
    } finally {
      reference.release();
    }
  }
  function stopHostEvents() {
    for (const record of state.events.values()) {
      if (record.timer !== void 0) clearTimeout(record.timer);
      for (const pending of record.pending) pending.controller.abort(new Error("plugin stopped"));
      record.pending.clear();
      try {
        record.socket?.close();
      } catch {
      }
    }
    state.events.clear();
  }
  function refreshEventStreams(hosts) {
    const desired = new Set(hosts.map((host) => host.id));
    const selected = remoteIdentity(state.native.ctx?.uiWorkspace.mainReference?.sessionId);
    if (selected !== void 0 && !desired.has(selected.hostId)) state.native.ctx.uiWorkspace.clearMain();
    for (const [id, record] of state.native.records) {
      if (desired.has(record.hostId)) continue;
      record.binding.session.handleRemoved();
      disposeNativeRecord(record);
    }
    for (const [hostId, transport] of state.native.transports) {
      if (desired.has(hostId)) continue;
      void transport.dispose();
      state.native.transports.delete(hostId);
      state.native.catalogs.delete(hostId);
    }
    for (const [hostId, record] of state.events) {
      if (desired.has(hostId)) continue;
      if (record.timer !== void 0) clearTimeout(record.timer);
      for (const pending of record.pending) pending.controller.abort(new Error("host removed"));
      try {
        record.socket?.close();
      } catch {
      }
      state.events.delete(hostId);
    }
    for (const host of hosts) startHostEvents(host.id);
  }
  function refreshWorkspaceStreams(hosts) {
    const desired = new Set(hosts.map((host) => host.id));
    for (const [hostId, record] of state.workspaces) {
      if (desired.has(hostId)) continue;
      if (record.timer !== void 0) clearTimeout(record.timer);
      try {
        record.socket?.close();
      } catch {
      }
      state.workspaces.delete(hostId);
    }
    for (const host of hosts) startWorkspaceStream(host.id);
  }
  function stopWorkspaceStreams() {
    for (const record of state.workspaces.values()) {
      if (record.timer !== void 0) clearTimeout(record.timer);
      try {
        record.socket?.close();
      } catch {
      }
    }
    state.workspaces.clear();
  }
  async function fetchStatus() {
    const response = await fetch(`${GATEWAY}/status`, { signal: AbortSignal.timeout(4e3) });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return response.json();
  }
  async function fetchSessions(hostId, signal) {
    const rpcId = crypto.randomUUID();
    const response = await fetch(`${GATEWAY}/host/${encodeURIComponent(hostId)}/api/session/list`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.any([AbortSignal.timeout(6e3), ...signal === void 0 ? [] : [signal]]),
      body: JSON.stringify({
        type: "client-request",
        rpcId,
        method: "session/list",
        payload: { args: { _request: {} } }
      })
    });
    if (!response.ok) throw new Error(`api ${response.status}`);
    const body = await response.json();
    return body?.result?.ok === true ? body.result.value?.items ?? [] : [];
  }
  async function load() {
    const generation = ++state.loadGeneration;
    try {
      const status = await fetchStatus();
      if (status.sshAuthenticationPending && state.dialog === void 0) openHostManager();
      const hosts = await Promise.all((status.hosts ?? []).map(async (host) => {
        let sessions = [];
        try {
          sessions = await fetchSessions(host.id);
        } catch (error) {
          warn(`sessions ${host.id}: ${error.message}`);
        }
        return { ...host, sessions };
      }));
      if (state.stopped || generation !== state.loadGeneration) return;
      state.data = { hosts };
      refreshWorkspaceStreams(hosts);
      refreshEventStreams(hosts);
      ensureNativeRows();
      render();
    } catch (error) {
      if (state.stopped || generation !== state.loadGeneration) return;
      warn(`status: ${error.message}`);
      if (state.data.hosts.length === 0) {
        state.data = {
          hosts: [{ id: "gateway", label: "remote gateway offline", online: false, auth: "failed", sessions: [] }]
        };
        render();
      }
    }
  }
  function nativeId(hostId, rawId) {
    return `remote:${hostId}:${rawId}`;
  }
  function nativeRecord(hostId, rawId) {
    const id = nativeId(hostId, rawId);
    const existing = state.native.records.get(id);
    if (existing !== void 0) return existing;
    const record = {
      hostId,
      rawId,
      id,
      retained: false,
      references: /* @__PURE__ */ new Map()
    };
    const transport = hostTransport(hostId);
    const face = new runtime.Session(id, transport.remote);
    const { fiber, ctx: scope } = runtime.createScope(state.native.ctx, id);
    Object.defineProperty(scope, "remote", { value: transport.remoteFor(id), configurable: true });
    Object.defineProperty(scope, "remoteAccess", { value: transport.accessFor(scope), configurable: true });
    face.bindScope(scope);
    record.fiber = fiber;
    record.binding = { sessionId: id, session: face, eventSource: face.eventSource, ctx: scope };
    const baseline = state.events.get(hostId)?.baselines?.[rawId];
    if (baseline !== void 0) face.projections.seed(baseline);
    record.stopProjection = face.projections.subscribeAny(() => {
      ensureNativeRows();
    });
    record.retainInfo = retainObserver(id).source;
    state.native.records.set(id, record);
    return record;
  }
  function loadNativePage(record) {
    return record.binding.session.open();
  }
  function retainObserver(id) {
    let observer = state.native.retainObservers.get(id);
    if (observer !== void 0) return observer;
    observer = { snapshot: { referenceCount: 0, retainedBy: /* @__PURE__ */ Object.create(null) }, listeners: /* @__PURE__ */ new Set() };
    observer.source = {
      getSnapshot: () => observer.snapshot,
      subscribe: (listener) => {
        observer.listeners.add(listener);
        return () => observer.listeners.delete(listener);
      }
    };
    state.native.retainObservers.set(id, observer);
    return observer;
  }
  function disposeNativeRecord(record) {
    if (state.native.records.get(record.id) !== record) return;
    state.native.records.delete(record.id);
    record.live = false;
    record.stopProjection();
    record.binding.session.unbindScope();
    void record.binding.session.dispose();
    void record.fiber.dispose();
    record.references.clear();
    publishNativeRetain(record);
  }
  function hostTransport(hostId) {
    let transport = state.native.transports.get(hostId);
    if (transport === void 0) {
      transport = runtime.createHostTransport(state.native.ctx, hostId, GATEWAY, runtime, warn);
      state.native.transports.set(hostId, transport);
    }
    return transport;
  }
  function publishNativeRetain(record) {
    const retainedBy = /* @__PURE__ */ Object.create(null);
    for (const source of record.references.values()) retainedBy[source] = (retainedBy[source] ?? 0) + 1;
    record.retained = (retainedBy.mainView ?? 0) > 0;
    const observer = retainObserver(record.id);
    observer.snapshot = { referenceCount: record.references.size, retainedBy };
    for (const listener of observer.listeners) listener();
    ensureNativeRows();
  }
  function retainNative(record, options = {}) {
    options.signal?.throwIfAborted();
    const token = {};
    record.live = true;
    record.references.set(token, options.source ?? "plugin");
    publishNativeRetain(record);
    const released = new AbortController();
    const signal = options.signal === void 0 ? released.signal : AbortSignal.any([released.signal, options.signal]);
    const reference = {
      sessionId: record.id,
      get binding() {
        if (released.signal.aborted || record.live === false) throw new Error(`Session reference "${record.id}" is released`);
        return record.binding;
      },
      release() {
        if (!record.references.delete(token)) return;
        released.abort(new Error(`Session reference "${record.id}" is released`));
        publishNativeRetain(record);
        queueMicrotask(() => {
          if (record.references.size === 0) disposeNativeRecord(record);
        });
      },
      [Symbol.dispose]() {
        this.release();
      }
    };
    reference.ready = new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      loadNativePage(record).then(() => {
        try {
          signal.throwIfAborted();
          resolve(reference.binding);
        } catch (error) {
          reject(error);
        }
      }, reject).finally(() => signal.removeEventListener("abort", abort));
    });
    void reference.ready.catch(() => {
    });
    return reference;
  }
  function ensureNativeRows() {
    const native = state.native;
    if (native.patched !== true || native.repairing) return;
    const sessions = native.ctx?.sessions;
    if (sessions === void 0) return;
    try {
      const current = sessions.list.getSnapshot();
      const byId = { ...current.byId };
      let changed = false;
      const desired = /* @__PURE__ */ new Set();
      for (const host of state.data.hosts) {
        for (const session of host.sessions ?? []) {
          const id = nativeId(host.id, session.sessionId);
          desired.add(id);
          const record = native.records.get(id);
          if (record !== void 0) {
            record.binding.session.handleRunning(session.running === true);
            record.binding.session.handleBlank(session.blank === true);
            const projectionKey = JSON.stringify(session.projections);
            if (session.projections?.values !== void 0 && projectionKey !== record.lastSummaryProjections) {
              record.lastSummaryProjections = projectionKey;
              if (session.projections.kind === "sequenced") {
                for (const [key, value] of Object.entries(session.projections.values)) record.binding.session.projections.apply(key, value, session.projections.asOfSeq);
              } else record.binding.session.projections.applyCached(session.projections.values);
            }
          }
          const title = record?.binding.session.projections.get("title") ?? session.projections?.values?.title ?? session.title ?? session.cwd?.split("/").filter(Boolean).at(-1) ?? session.sessionId;
          const summary = {
            id,
            displayTitle: title,
            cwd: session.cwd,
            running: record?.binding.session.getSnapshot().running ?? session.running === true,
            blank: record?.binding.session.getSnapshot().blank ?? session.blank === true,
            updatedAt: session.updatedAt,
            retainedBy: record?.retainInfo.getSnapshot().retainedBy ?? {},
            projectionValues: record?.binding.session.projections.values() ?? session.projections?.values ?? {}
          };
          const existing = byId[id];
          if (existing === void 0 || existing.displayTitle !== summary.displayTitle || existing.cwd !== summary.cwd || existing.updatedAt !== summary.updatedAt || existing.running !== summary.running || existing.blank !== summary.blank || JSON.stringify(existing.retainedBy) !== JSON.stringify(summary.retainedBy) || JSON.stringify(existing.projectionValues) !== JSON.stringify(summary.projectionValues)) {
            byId[id] = summary;
            changed = true;
          }
        }
      }
      for (const id of Object.keys(byId)) {
        if (id.startsWith("remote:") && !desired.has(id)) {
          delete byId[id];
          changed = true;
        }
      }
      if (!changed) return;
      const ids = [...current.ids.filter((id) => byId[id] !== void 0)];
      for (const id of Object.keys(byId)) if (!ids.includes(id)) ids.push(id);
      native.repairing = true;
      try {
        sessions.list.set({ ...current, ids, byId });
      } finally {
        native.repairing = false;
      }
      scheduleRender();
    } catch (error) {
      warn(`native rows: ${error.message}`);
    }
  }
  function patchNativeSessions(ctx) {
    const native = state.native;
    if (native.patched) return;
    native.lifetime = new Lifetime();
    native.ctx = ctx;
    installNativeAdapter(ctx, runtime, native, native.lifetime, {
      nativeRecord,
      retainNative,
      retainObserver,
      workspaceRecord,
      hostTransport,
      ensureNativeRows,
      syncSidebarSelection,
      connectRemoteWorkspace,
      createRemoteWorkspace,
      pickRemoteDirectory,
      gateway: GATEWAY
    });
    native.patched = true;
    native.lifetime.defer(ctx.uiSession.sessionStatus.subscribe(() => scheduleRender()));
    ensureNativeRows();
    log("native adapter patched");
  }
  function openNativeSession(hostId, rawId) {
    if (state.native.patched !== true) throw new Error("\u8FDC\u7A0B\u4F1A\u8BDD\u9002\u914D\u5C1A\u672A\u542F\u52A8");
    const record = nativeRecord(hostId, rawId);
    ensureNativeRows();
    state.native.ctx.uiWorkspace.openSession(record.id);
  }
  function stopNative() {
    const native = state.native;
    if (native.lifetime === void 0) return;
    if (remoteIdentity(native.ctx.uiWorkspace.mainReference?.sessionId) !== void 0) native.ctx.uiWorkspace.clearMain();
    native.patched = false;
    const sessions = native.ctx?.sessions;
    try {
      native.lifetime.dispose();
    } finally {
      native.lifetime = void 0;
      for (const record of [...native.records.values()]) disposeNativeRecord(record);
      for (const transport of native.transports.values()) void transport.dispose();
      native.transports.clear();
      native.records.clear();
      const current = sessions.list.getSnapshot();
      const byId = { ...current.byId };
      for (const id of Object.keys(byId)) if (remoteIdentity(id) !== void 0) delete byId[id];
      sessions.list.set({ ...current, ids: current.ids.filter((id) => byId[id] !== void 0), byId });
      native.catalogs.clear();
    }
  }
  async function callApi(hostId, method, args, signal) {
    const rpcId = crypto.randomUUID();
    let response;
    try {
      response = await fetch(`${GATEWAY}/host/${encodeURIComponent(hostId)}/api/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.any([AbortSignal.timeout(8e3), ...signal ? [signal] : []]),
        body: JSON.stringify({ type: "client-request", rpcId, method, payload: { args } })
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(error.name === "TimeoutError" ? "\u8FDC\u7A0B\u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u673A\u5668\u8FDE\u63A5\u540E\u91CD\u8BD5\u3002" : "\u65E0\u6CD5\u8FDE\u63A5\u672C\u5730 DSH \u670D\u52A1\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5\u3002", { cause: error });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body?.result?.ok !== true) {
      const error = new Error(body?.result?.error?.message ?? "remote error");
      error.code = body?.result?.error?.code;
      throw error;
    }
    return body.result.value;
  }
  function scheduleRender(delay = 0) {
    if (state.stopped || state.renderTimer !== void 0) return;
    state.renderTimer = setTimeout(() => {
      state.renderTimer = void 0;
      render();
    }, delay);
  }
  function observe() {
    state.observer?.disconnect();
    state.observer = new MutationObserver(() => {
      if (!state.section?.isConnected || !state.localHeading?.isConnected || state.templates.group === void 0 || state.templates.session === void 0) scheduleRender(120);
    });
    const sidebar = findSidebar();
    if (sidebar !== null) state.observer.observe(sidebar, { childList: true, subtree: true });
    for (let parent = sidebar?.parentElement ?? document.body; parent !== null; parent = parent.parentElement) {
      state.observer.observe(parent, { childList: true });
    }
  }
  function start(ctx) {
    if (state.started) return;
    const context = ctx ?? state.native.ctx;
    assertCompatible(context, runtime, VERSION);
    GATEWAY = gatewayAddress(window.__DSH_REMOTE_HOSTS_CONFIG__);
    state.started = true;
    state.stopped = false;
    state.misses = 0;
    try {
      state.native.ctx = context;
      state.remote = context.remote;
      patchNativeSessions(context);
      addStyle();
      log(`start version=${VERSION} gateway=${GATEWAY}`);
      void load();
      observe();
      state.timer = setInterval(() => {
        void load();
      }, 15e3);
    } catch (error) {
      try {
        stop();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], "\u8FDC\u7A0B\u673A\u5668\u63D2\u4EF6\u542F\u52A8\u53CA\u6E05\u7406\u5931\u8D25");
      }
      throw error;
    }
  }
  function stop() {
    state.stopped = true;
    state.started = false;
    state.loadGeneration++;
    clearInterval(state.timer);
    state.timer = void 0;
    clearTimeout(state.renderTimer);
    state.renderTimer = void 0;
    state.observer?.disconnect();
    state.observer = void 0;
    removeInjected();
    stopWorkspaceStreams();
    stopHostEvents();
    closeDialog();
    state.style?.remove();
    state.style = void 0;
    stopNative();
  }
  function snapshot() {
    return {
      version: VERSION,
      mode: "inline",
      started: state.started,
      hosts: state.data.hosts.length,
      sectionConnected: state.section?.isConnected === true,
      misses: state.misses,
      gateway: GATEWAY,
      native: state.native.patched ? { patched: true, records: state.native.records.size, routedEndpoints: state.native.routedEndpoints } : null
    };
  }
  window.__DSH_REMOTE_HOSTS__ = { start, stop, snapshot, render, refresh: load };
  const plugin = {
    name: "dsh-remote-hosts",
    inject: ["sessions", "uiWorkspace", "remote", "remote.session", "fileUpload", "typert", "modelDirectories", "remoteAccess", "uiSession", "workspaces", "slots"],
    apply(ctx) {
      ctx.effect(() => {
        start(ctx);
        return stop;
      }, "remote-hosts: injection");
    }
  };
  return plugin;
}

// client/entry.js
var entry_default = createPlugin({ Session, ModelDirectory: import_client5.ModelDirectory, RemoteStream, RemoteStreamMuxClient, RemoteStreamCarrierError, RemoteError, ClientAccessState, whenAllowed, createScope: import_client4.createScope, createHostTransport, projectRemoteEventRejection });
return module.exports.default;}});
