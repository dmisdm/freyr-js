"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _StackLogger_store;
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-underscore-dangle */
const fs_1 = __importDefault(require("fs"));
const tty_1 = __importDefault(require("tty"));
const util_1 = __importDefault(require("util"));
function isActivelyWritable(stream) {
    return (stream &&
        [stream.on, stream.once, stream.pipe, stream.write].every(slot => typeof slot === 'function') &&
        !(stream._writableState.ended ||
            stream._writableState.closed ||
            (typeof stream.destroyed === 'function' ? stream.destroyed() : stream.destroyed)));
}
function getPersistentStream(store, prop = null, isTTY = false) {
    // if persistence is allowed and one active stream exists, return that
    // else, if stored stream is active, return that
    // else, if prop is active, return that
    // else, test stdout and stderr for activity
    // else, create forced tty. Store if persistence is allowed
    const devices = [
        [store.cache ? getPersistentStream.persist : null, true],
        [store.output, store.isTTY],
        [prop, isTTY],
        [process.stdout, true],
        [process.stderr, true],
    ];
    let [device] = devices.find(([output, shouldBeTTY]) => output && isActivelyWritable(output) && (!shouldBeTTY || (output instanceof tty_1.default.WriteStream && output.isTTY))) || [];
    if (!device) {
        // create persistent tty if neither options are writable or valid TTYs
        device = new tty_1.default.WriteStream(fs_1.default.openSync('/dev/tty', 'w'));
        store.output = device;
        store.isTTY = true;
        if (store.cache)
            getPersistentStream.persist = device;
    }
    return device;
}
class StackLogger {
    /**
     * Create stacking loggers by means of indentation
     * @param {{}} [opts] Options
     * @param {NodeJS.WritableStream} [opts.output] Optional output stream to write to.
     * @param {boolean} [opts.isTTY] Whether or not the output stream can be expected to be a TTY
     * @param {boolean} [opts.cache] Whether or not to cache custom-created TTYs.
     * @param {number} [opts.indent] Indentation from 0 for this instance.
     * @param {any} [opts.indentor] Indentation fill for indentation range.
     * @param {number} [opts.indentSize] Size for subsequent instances created from self.
     * @param {boolean} [opts.autoTick] Whether or not to auto tick printers.
     */
    constructor(opts) {
        _StackLogger_store.set(this, {
            output: null,
            isTTY: null,
            cache: false,
            indent: 0,
            indentSize: 0,
            indentor: ' ',
            autoTick: false, // whether or not to auto tick printers
        });
        opts = opts || {};
        __classPrivateFieldGet(this, _StackLogger_store, "f").isTTY = opts.isTTY || false;
        __classPrivateFieldGet(this, _StackLogger_store, "f").persist = opts.persist || false;
        __classPrivateFieldGet(this, _StackLogger_store, "f").output = opts.output;
        __classPrivateFieldGet(this, _StackLogger_store, "f").indent = opts.indent && typeof opts.indent === 'number' ? opts.indent : 0;
        __classPrivateFieldGet(this, _StackLogger_store, "f").indentor = opts.indentor || ' ';
        __classPrivateFieldGet(this, _StackLogger_store, "f").indentSize = opts.indentSize && typeof opts.indentSize === 'number' ? opts.indentSize : 2;
        __classPrivateFieldGet(this, _StackLogger_store, "f").autoTick = typeof opts.autoTick === 'boolean' ? opts.autoTick : true;
    }
    /**
     * Get/Set the current instance's indentation
     * @param {number} [value] New indentation
     */
    indentation(val) {
        if (val && typeof val === 'number')
            __classPrivateFieldGet(this, _StackLogger_store, "f").indent = val;
        return __classPrivateFieldGet(this, _StackLogger_store, "f").indent;
    }
    /**
     * Get/Set the current instance's indentation
     * @param {any} [indentor] The new indentor
     */
    indentor(indentor) {
        if (indentor)
            __classPrivateFieldGet(this, _StackLogger_store, "f").indentor = indentor;
        return __classPrivateFieldGet(this, _StackLogger_store, "f").indentor;
    }
    /**
     * Get/Set the currently held indentSize
     * @param {number} [size] New indentSize
     */
    indentSize(size) {
        if (size && typeof size === 'number')
            __classPrivateFieldGet(this, _StackLogger_store, "f").indentSize = size;
        return __classPrivateFieldGet(this, _StackLogger_store, "f").indentSize;
    }
    /**
     * Opts to extend self with
     * @param {{}} [opts] Options
     * @param {NodeJS.WritableStream} [opts.isTTY] Optional output stream to write to.
     * @param {boolean} [opts.isTTY] Whether or not the output stream can be expected to be a TTY
     * @param {boolean} [opts.cache] Whether or not to cache custom-created TTYs.
     * @param {number} [opts.indent] Indentation from 0 for this instance.
     * @param {any} [opts.indentor] Indentation fill for indentation range.
     * @param {number} [opts.indentSize] Size for subsequent instances created from self.
     */
    extend(opts) {
        return new StackLogger({ ...__classPrivateFieldGet(this, _StackLogger_store, "f"), ...(typeof opts === 'object' ? opts : {}) });
    }
    /**
     * Create a logger instance whose indentation is extended from the former
     * If `indent` is omitted, it will autoTick with `opts.indentSize`
     * If `indentSize` is omitted, it will not increment and use `this`
     * @param {number} [indent] Size to add to self's `indentation`
     * @param {number} [indentSize] Size to add to self's `indentSize`
     */
    tick(indent, indentSize) {
        return this.extend({
            indent: __classPrivateFieldGet(this, _StackLogger_store, "f").indent + (typeof indent === 'number' ? indent : __classPrivateFieldGet(this, _StackLogger_store, "f").indentSize),
            indentSize: __classPrivateFieldGet(this, _StackLogger_store, "f").indentSize + (typeof indentSize === 'number' ? indent : 0),
        });
    }
    /**
     * Write messages. Optionally to the specified stream.
     * @param {any[]} content Messages to be written
     * @param {NodeJS.ReadableStream} [stream] Fallback stream to be written to
     * @param {boolean} [isTTY] Whether or not fallback stream is expected to be a TTY (default: `false`)
     */
    _write(content, stream, isTTY = false) {
        const out = getPersistentStream(__classPrivateFieldGet(this, _StackLogger_store, "f"), stream, isTTY);
        out.write(content);
    }
    /**
     * Write raw text to the output device
     * * Adds no indentation and no EOL
     * * Returns self without extending indentation
     * @param {...any} msgs Messages to write out
     */
    write(...msgs) {
        this._write(this.getText(0, msgs), process.stdout, true);
        return this;
    }
    /**
     * Write raw text to the output device
     * * Adds indentation but no EOL
     * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
     * @param {...any} msgs Messages to write out
     */
    print(...msgs) {
        this._write(this.getText(__classPrivateFieldGet(this, _StackLogger_store, "f").indent, msgs), process.stdout, true);
        return __classPrivateFieldGet(this, _StackLogger_store, "f").autoTick ? this.tick(__classPrivateFieldGet(this, _StackLogger_store, "f").indentSize) : this;
    }
    /**
     * Write primarily to stdout with an EOL
     * * Adds indentation and EOL
     * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
     * @param {...any} msgs Messages to write out
     */
    log(...msgs) {
        this._write(this.getText(__classPrivateFieldGet(this, _StackLogger_store, "f").indent, msgs).concat('\n'), process.stdout, true);
        return __classPrivateFieldGet(this, _StackLogger_store, "f").autoTick ? this.tick(__classPrivateFieldGet(this, _StackLogger_store, "f").indentSize) : this;
    }
    /**
     * Write primarily to stderr with an EOL
     * * Adds indentation and EOL
     * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
     * @param {...any} msgs Messages to write out
     */
    error(...msgs) {
        return this.warn(...msgs);
    }
    /**
     * Write primarily to stderr with an EOL
     * * Adds indentation and EOL
     * * Returns a stacklogger with extended indentation if `opts.autoTick` else `this`
     * @param {...any} msgs Messages to write out
     */
    warn(...msgs) {
        this._write(this.getText(__classPrivateFieldGet(this, _StackLogger_store, "f").indent, msgs).concat('\n'), process.stderr, true);
        return __classPrivateFieldGet(this, _StackLogger_store, "f").autoTick ? this.tick(__classPrivateFieldGet(this, _StackLogger_store, "f").indentSize) : this;
    }
    /**
     * Generate formated text with proper indentation
     * @param {number} [indent] Proper indentation
     * @param {string|string[]} [msgs] Message(s) to be written
     */
    getText(indent, msgs) {
        if (typeof indent === 'object' && !Array.isArray(indent))
            ({ msgs, indent } = indent);
        if (Array.isArray(indent))
            [msgs, indent] = [indent, msgs];
        if (typeof indent === 'string')
            [msgs, indent] = [[indent], msgs];
        indent = typeof indent !== 'number' ? __classPrivateFieldGet(this, _StackLogger_store, "f").indent : indent;
        msgs = Array.isArray(msgs) ? msgs : [msgs];
        msgs = indent
            ? [__classPrivateFieldGet(this, _StackLogger_store, "f").indentor.repeat(indent).concat(util_1.default.formatWithOptions({ color: true }, msgs[0])), ...msgs.slice(1)]
            : msgs;
        return util_1.default.formatWithOptions({ colors: true }, ...msgs);
    }
}
exports.default = StackLogger;
_StackLogger_store = new WeakMap();
