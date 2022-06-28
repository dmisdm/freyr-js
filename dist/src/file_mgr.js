"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = require("path");
const os_1 = require("os");
const util_1 = require("util");
const tmp_1 = __importDefault(require("tmp"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const removeCallbacks = [];
const open = (0, util_1.promisify)(fs_1.default.open);
const close = (0, util_1.promisify)(fs_1.default.close);
const exists = (0, util_1.promisify)(fs_1.default.exists);
const unlink = (0, util_1.promisify)(fs_1.default.unlink);
function garbageCollector() {
    while (removeCallbacks.length)
        removeCallbacks.shift()();
    process.removeListener("exit", garbageCollector);
}
let hookedUpListeners = false;
function hookupListeners() {
    if (!hookedUpListeners) {
        hookedUpListeners = true;
        process.addListener("exit", garbageCollector);
    }
}
async function genFile(opts) {
    opts = opts || {};
    if (opts.filename) {
        opts.tmpdir = opts.tmpdir || (0, os_1.tmpdir)();
        if (!(await exists(opts.tmpdir)))
            throw new Error("tmpdir does not exist");
        const dir = (0, path_1.join)(opts.tmpdir, opts.dirname || ".");
        await (0, mkdirp_1.default)(dir);
        const name = (0, path_1.join)(dir, opts.filename);
        const fd = await open(name, fs_1.default.constants.O_CREAT);
        hookupListeners();
        let closed = false;
        const garbageHandler = () => {
            if (closed)
                return;
            fs_1.default.closeSync(fd);
            closed = true;
            if (!opts.keep)
                fs_1.default.unlinkSync(name);
        };
        removeCallbacks.unshift(garbageHandler);
        return {
            fd,
            name,
            removeCallback: async () => {
                if (closed)
                    return;
                await close(fd);
                closed = true;
                await unlink(name);
                removeCallbacks.splice(removeCallbacks.indexOf(garbageHandler), 1);
            },
        };
    }
    return new Promise((res, rej) => tmp_1.default.file(opts, (err, name, fd, removeCallback) => err ? rej(err) : res({ fd, name, removeCallback })));
}
exports.default = genFile;
