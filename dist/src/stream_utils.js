"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = __importDefault(require("stream"));
const isbinaryfile_1 = require("isbinaryfile");
/**
 * Generate a stream transformer splitting at match locations
 * @param {string[]} patterns Patterns to be matches within the stream
 * @param {boolean} allowBinaryFile Whether or not to scan binary files
 */
function buildSplitter(patterns, allowBinaryFile = false) {
    return new stream_1.default.Transform({
        defaultEncoding: 'utf8',
        objectMode: true,
        write(chunk, encoding, callback) {
            // merge chunk with buffer, initialize a buffer if none is found
            this.buffer = Buffer.concat([this.buffer || Buffer.alloc(0), chunk]);
            if (!allowBinaryFile && (0, isbinaryfile_1.isBinaryFileSync)(this.buffer))
                return callback(new Error('Detected binary content in stream'));
            // identify which match exists and at what index within the match and in the buffer
            let match;
            while (this.buffer &&
                this.buffer.length > 0 &&
                ([match] = patterns
                    // use reduce as opposed to map-filter for efficiency
                    .reduce((result, item) => {
                    if (item) {
                        // find index of pattern
                        const index = this.buffer.indexOf(item, 0, encoding);
                        // push to results if non-zero
                        if (~index)
                            result.push({ index, length: item.length });
                    }
                    return result;
                }, [])
                    // sort matches to identify patterns closest to origin
                    .sort((a, b) => (a.index > b.index ? 1 : -1)))[0]) {
                // support empty strings
                const adjustedIndex = match.length === 0 ? 1 : match.index;
                // push whatever comes before
                this.push(this.buffer.slice(0, adjustedIndex));
                // resize the buffer to exclude pushed content and split range
                this.buffer = this.buffer.slice(adjustedIndex + match.length);
                // delete empty buffers if matching with empty-strings
                if (match.length === 0 && this.buffer.length === 0)
                    delete this.buffer;
            }
            return callback();
        },
        flush(callback) {
            callback(null, this.buffer);
        },
    });
}
/**
 * **UNRECOMMENDED**: Synchronously collect chunks into an array of buffers
 * @param {NodeJS.ReadableStream} input Readable input stream
 * @param {object} [opts] Optional configuration options
 * @param {number} [opts.max] Maximum number of bytes to be buffered, reject if larger
 * @param {number} [opts.timeout] Timeout to fully read, buffer and return, otherwise reject
 */
function collectBuffers(input, opts) {
    return new Promise((res, rej) => {
        const result = [];
        const spaceErr = new Error(`Error, input stream maxed out allowed space ${opts.max}`);
        const timeoutErr = new Error(`Timeout after ${opts.timeout}ms of reading input stream`);
        spaceErr.code = 1;
        timeoutErr.code = 2;
        const self = new stream_1.default.Writable({
            write(v, _e, c) {
                if (opts.max && (this.bytesBuffered = (this.bytesBuffered || 0) + v.length) > opts.max)
                    c(spaceErr);
                else
                    c(null, result.push(v));
            },
        });
        let timeout;
        if (opts.timeout)
            timeout = setTimeout(() => self.destroy(timeoutErr), opts.timeout);
        stream_1.default.pipeline(input, self, err => {
            clearTimeout(timeout);
            err ? rej(err) : res(result);
        });
    });
}
exports.default = {
    buildSplitter,
    collectBuffers,
};
