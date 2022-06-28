import fs from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { promisify } from "util";

import tmp from "tmp";
import mkdirp from "mkdirp";

const removeCallbacks = [];

const open = promisify(fs.open);
const close = promisify(fs.close);
const exists = promisify(fs.exists);
const unlink = promisify(fs.unlink);

function garbageCollector() {
  while (removeCallbacks.length) removeCallbacks.shift()();
  process.removeListener("exit", garbageCollector);
}

let hookedUpListeners = false;
function hookupListeners() {
  if (!hookedUpListeners) {
    hookedUpListeners = true;
    process.addListener("exit", garbageCollector);
  }
}

export default async function genFile(opts) {
  opts = opts || {};
  if (opts.filename) {
    opts.tmpdir = opts.tmpdir || tmpdir();
    if (!(await exists(opts.tmpdir))) throw new Error("tmpdir does not exist");
    const dir = join(opts.tmpdir, opts.dirname || ".");
    await mkdirp(dir);
    const name = join(dir, opts.filename);
    const fd = await open(name, fs.constants.O_CREAT);
    hookupListeners();
    let closed = false;
    const garbageHandler = () => {
      if (closed) return;
      fs.closeSync(fd);
      closed = true;
      if (!opts.keep) fs.unlinkSync(name);
    };
    removeCallbacks.unshift(garbageHandler);
    return {
      fd,
      name,
      removeCallback: async () => {
        if (closed) return;
        await close(fd);
        closed = true;
        await unlink(name);
        removeCallbacks.splice(removeCallbacks.indexOf(garbageHandler), 1);
      },
    };
  }
  return new Promise((res, rej) =>
    tmp.file(opts, (err, name, fd, removeCallback) =>
      err ? rej(err) : res({ fd, name, removeCallback })
    )
  );
}
