#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = void 0;
/* eslint-disable consistent-return, camelcase, prefer-promise-reject-errors */
const fs_1 = __importDefault(require("fs"));
const url_1 = __importDefault(require("url"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const child_process_1 = require("child_process");
const conf_1 = __importDefault(require("conf"));
const open_1 = __importDefault(require("open"));
const libxget_1 = __importDefault(require("libxget"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const lodash_1 = __importDefault(require("lodash"));
const merge2_1 = __importDefault(require("merge2"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const xbytes_1 = __importDefault(require("xbytes"));
const bluebird_1 = __importDefault(require("bluebird"));
const stringd_colors_1 = __importDefault(require("stringd-colors"));
const pretty_ms_1 = __importDefault(require("pretty-ms"));
const minimatch_1 = __importDefault(require("minimatch"));
const filenamify_1 = __importDefault(require("filenamify"));
const hh_mm_ss_1 = __importDefault(require("hh-mm-ss"));
const xprogress_1 = __importDefault(require("xprogress"));
const isbinaryfile_1 = require("isbinaryfile");
const html_entities_1 = require("html-entities");
const symbols_js_1 = __importDefault(require("./symbols.js"));
const file_mgr_js_1 = __importDefault(require("./file_mgr.js"));
const p_flatten_js_1 = __importDefault(require("./p_flatten.js"));
const freyr_js_1 = __importDefault(require("./freyr.js"));
const cli_server_js_1 = __importDefault(require("./cli_server.js"));
const async_queue_js_1 = __importDefault(require("./async_queue.js"));
const parse_range_js_1 = __importDefault(require("./parse_range.js"));
const stack_logger_js_1 = __importDefault(require("./stack_logger.js"));
const stream_utils_js_1 = __importDefault(require("./stream_utils.js"));
const filter_parser_js_1 = __importDefault(require("./filter_parser.js"));
const package_json_1 = __importDefault(require("../package.json"));
const conf_json_1 = __importDefault(require("../conf.json"));
function parseMeta(params) {
    return Object.entries(params || {})
        .filter(([, value]) => ![undefined, null].includes(value))
        .map(([key, value]) => Array.isArray(value)
        ? value.map((tx) => tx ? [`--${key}`, ...(Array.isArray(tx) ? tx : [tx])] : "")
        : [`--${key}`, value])
        .flat(Infinity);
}
function extendPathOnEnv(path) {
    return {
        ...process.env,
        PATH: [process.env.PATH, path].join(process.platform === "win32" ? ";" : ":"),
    };
}
function ensureBinExtIfWindows(isWin, command) {
    return command.replace(/(\.exe)?$/, isWin ? ".exe" : "$1");
}
function check_bin_is_existent(bin, path) {
    const isWin = process.platform === "win32";
    const command = isWin ? "where" : "which";
    const { status } = (0, child_process_1.spawnSync)(ensureBinExtIfWindows(isWin, command), [bin], {
        env: extendPathOnEnv(path),
    });
    if ([127, null].includes(status))
        throw Error(`Unable to locate the command [${command}] within your PATH`);
    return status === 0;
}
function wrapCliInterface(binaryNames, binaryPath) {
    binaryNames = Array.isArray(binaryNames) ? binaryNames : [binaryNames];
    const isWin = process.platform === "win32";
    const path = path_1.default.join(__dirname, "bins", isWin ? "windows" : "posix");
    if (!binaryPath) {
        for (let name of binaryNames) {
            if (!check_bin_is_existent(name, path))
                continue;
            binaryPath = ensureBinExtIfWindows(isWin, name);
            break;
        }
        if (!binaryPath)
            throw new Error(`Unable to find an executable named ${((a) => [a.slice(0, -1).join(", "), ...a.slice(-1)]
                .filter((e) => e != "")
                .join(" or "))(binaryNames)}. Please install.`);
    }
    return (file, args, cb) => {
        if (typeof file === "string")
            (0, child_process_1.spawn)(binaryPath, [file, ...parseMeta(args)], {
                env: extendPathOnEnv(path),
            }).on("close", cb);
    };
}
function getRetryMessage({ meta, ref, retryCount, maxRetries, bytesRead, totalBytes, lastErr, }) {
    // @ts-expect-error
    return (0, stringd_colors_1.default)([
        ":{color(red)}{⯈}:{color:close(red)} ",
        `:{color(cyan)}@${meta ? "meta" : ref}:{color:close(cyan)}`,
        `{:{color(yellow)}${retryCount}:{color:close(yellow)}${Number.isFinite(maxRetries)
            ? `/:{color(yellow)}${maxRetries}:{color:close(yellow)}`
            : ""}}: `,
        lastErr
            ? `${lastErr.code
                ? `[:{color(yellow)}${lastErr.code}:{color:close(yellow)}] `
                : ""}(:{color(yellow)}${lastErr.message || lastErr}:{color:close(yellow)}) `
            : "",
        totalBytes
            ? `(:{color(cyan)}${Number.isFinite(totalBytes)
                ? `${bytesRead}`.padStart(`${totalBytes}`.length, " ")
                : bytesRead}:{color:close(cyan)}${Number.isFinite(totalBytes)
                ? `/:{color(cyan)}${totalBytes}:{color:close(cyan)}`
                : ""})`
            : "",
    ].join(""));
}
function prePadNum(val, total, min = 2) {
    return `${val}`.padStart(Math.max(`${total}`.length, min), "0");
}
function prepProgressGen(options) {
    return (size, slots, opts, indentLen, isFragment) => {
        const forceFirst = options.singleBar || slots.length === 1 || slots.length > 20;
        //@ts-expect-error
        return xprogress_1.default.stream(size, slots, {
            forceFirst,
            length: 47,
            pulsate: options.pulsateBar || !Number.isFinite(size),
            bar: { separator: "|" },
            // eslint-disable-next-line prettier/prettier
            template: [
                ":{indent} [:{bullet}] :{label} :{flipper}",
                ":{indent}  | :{bullet} :{_tag}",
                ":{bars}",
            ],
            clean: true,
            flipper: [...Array(10)].map((...[, i]) => `:{color}${":{bullet}".repeat(i + 1)}:{color:close}`),
            label: "Downloading",
            variables: {
                _tag: `:{tag} (${isFragment ? "fragments" : "chunks"}: ${slots.length})`,
                bullet: "\u2022",
                bars: ({ total }) => (Number.isFinite(total) && !forceFirst
                    ? [
                        ":{indent}  | [:{bar:complete}] [:3{percentage}%] [:{speed}] (:{eta})",
                        ":{indent}  | [:{bar}] [:{size}]",
                    ]
                    : [
                        `:{indent}  | [:{bar}]${Number.isFinite(total) ? " [:3{percentage}%]" : ""} [:{speed}] (:{eta}) [:{size}]`,
                    ]).join("\n"),
                size: (stack, _size, total) => ((total = stack.total),
                    `${stack.size()}${total !== Infinity ? `/:{size:total}` : ""}`),
                indent: ` `.repeat(indentLen),
                ...opts,
            },
        });
    };
}
/**
 * Concise promise handler for ensuring proper core method dispatches and logging
 *
 * **Handlers**:
 *  * `onInit`: printed before the promise is awaited
 *  * `onErr`: printed if the promise was rejected
 *  * `noVal`: printed if a successfully resolved promise returned a null-ish value
 *  * `arrIsEmpty`: printed if a successfully resolved promise returned an empty array or if an array contains only null-ish values
 *  * `onPass`: printed only if the promise successfully fulfilled with a proper value
 *
 * In the event that any handler is `true`, its default printer would be used
 * Except in the case of `onInit` and `onPass` whose default printer would be called even if a handler isn't specified
 *
 * If a handler's value is a function, its return value would only be printed if it is an array.
 * Otherwise, `processPromise` assumes that you took care of the printing.
 * @param {() => Promise<any>|Promise<any>} promise Promise to be awaited on
 * @param {StackLogger} logger Logger to be used
 * @param {{
 *   onInit: string | boolean | (() => any[] | boolean);
 *   onErr: string | boolean | (() => any[] | boolean);
 *   noVal: string | boolean | (() => any[] | boolean);
 *   arrIsEmpty: string | boolean | (() => any[] | boolean);
 *   onPass: string | boolean | (() => any[] | boolean);
 * }} messageHandlers State logging handlers
 */
async function processPromise(promise, logger, messageHandlers) {
    /**
     * TODO: Add retry functionality
     * ? Checking...(failed)
     * ?  [2/4] Retrying...(failed)
     * ?  [3/4] Retrying...(failed)
     * ?  [4/4] Retrying...(done)
     */
    if (!messageHandlers)
        messageHandlers = {};
    const isNdef = (v) => [undefined, null].includes(v);
    function handleResultOf(value, msg, defaultHandler) {
        if (msg === true || isNdef(msg))
            msg = defaultHandler;
        if (isNdef(msg))
            return;
        if (typeof msg === "function") {
            value = msg(value, logger);
            if (Array.isArray(value))
                logger.write(...value);
            else if (typeof value === "string")
                logger.write(value);
        }
        else
            logger.print(msg);
    }
    // formerly .pre
    if (messageHandlers.onInit !== false)
        //@ts-expect-error
        handleResultOf(null, messageHandlers.onInit);
    const result = await bluebird_1.default.resolve(typeof promise === "function" ? promise() : promise).reflect();
    if (result.isRejected()) {
        // formerly .err
        if (messageHandlers.onErr !== false)
            handleResultOf(result.reason(), messageHandlers.onErr, (reason) => [
                "(failed%s)",
                reason
                    ? `: [${reason["SHOW_DEBUG_STACK" in process.env ? "stack" : "message"] ||
                        reason}]`
                    : "",
                "\n",
            ]);
        return null;
    }
    const value = result.value();
    // formerly .xerr
    if (messageHandlers.noVal && (!value || value.err))
        handleResultOf(value, messageHandlers.noVal, () => ["(no data)", "\n"]);
    // formerly .aerr
    else if (messageHandlers.arrIsEmpty &&
        Array.isArray(value) &&
        (value.length === 0 || value.every((item) => [undefined, null].some(item))))
        handleResultOf(value, messageHandlers.arrIsEmpty, () => [
            "(array contains no data)",
            "\n",
        ]);
    // formerly .post
    else if (messageHandlers.onPass !== false)
        handleResultOf(value, messageHandlers.onPass, () => ["[done]", "\n"]);
    return value;
}
const VALIDS = {
    bitrates: freyr_js_1.default.getBitrates(),
    downloaders: freyr_js_1.default.getEngineMetas()
        .filter((meta) => meta.PROPS.isSourceable)
        .map((meta) => meta.ID),
    concurrency: [
        "queries",
        "tracks",
        "trackStage",
        "downloader",
        "encoder",
        "embedder",
    ],
};
function CHECK_FLAG_IS_NUM(variable, flagref, untype) {
    // eslint-disable-next-line valid-typeof
    if (typeof variable !== untype)
        if (!(parseFloat(variable).toString() === variable &&
            parseFloat(variable) >= 0))
            throw new Error(`\`${flagref}\` if specified, must be given a valid positive \`${untype}\` datatype`);
        else
            variable = parseInt(variable, 10);
    return variable;
}
function CHECK_BIT_RATE_VAL(bitrate_arg) {
    const bitrate = ((match) => (match ? match[1] : ""))((bitrate_arg || "").match(/^(\d+)(?:k(?:b(?:it)?)?(?:ps|\/s)?)?$/i));
    if (!(bitrate && VALIDS.bitrates.includes(+bitrate)))
        throw new Error(`Invalid bitrate specification: [${bitrate_arg}]. Bitrate should be either of [${VALIDS.bitrates.join(", ")}]`);
    return `${bitrate}k`;
}
async function PROCESS_INPUT_FILE(input_arg, type, allowBinary = false) {
    if (!fs_1.default.existsSync(input_arg))
        throw new Error(`${type} file [${input_arg}] is inexistent`);
    const stat = fs_1.default.statSync(input_arg);
    if (stat.size > 1048576)
        throw new Error(`${type} file [${input_arg}] is beyond the maximum 1 MiB size limit`);
    if (!stat.isFile())
        throw new Error(`${type} file [${input_arg}] is not a file`);
    if (!allowBinary && (await (0, isbinaryfile_1.isBinaryFile)(input_arg, stat.size)))
        throw new Error(`${type} file [${input_arg}] cannot be a binary file`);
    return input_arg;
}
function PARSE_INPUT_LINES(lines) {
    return lines
        .map((line) => line.toString().trim()) // Trim whitespaces
        .filter((line) => !!line && /^(?!\s*#)/.test(line)) // Ignore empty lines or lines that start with comments
        .map((line) => line.replace(/#.*$/, "").trim()) // Ignore comments at the end of lines
        .flatMap((line) => line.split(" "));
}
async function PROCESS_INPUT_ARG(input_arg) {
    if (!input_arg)
        return [];
    const inputSource = input_arg === "-"
        ? process.stdin
        : fs_1.default.createReadStream(await PROCESS_INPUT_FILE(input_arg, "Input", false));
    const lines = await stream_utils_js_1.default
        .collectBuffers(inputSource.pipe(stream_utils_js_1.default.buildSplitter(["\n", "\r\n"])), {
        max: 1048576,
        timeout: 15000, // Timeout read op after 15 seconds
    })
        .catch((er) => {
        if (er.code === 1)
            throw new Error(`Input stream is beyond the maximum 1 MiB size limit`);
        if (er.code === 2)
            throw new Error(`Input stream read timed out after 15 seconds`);
    });
    return PARSE_INPUT_LINES(lines);
}
async function PROCESS_CONFIG_ARG(config_arg) {
    const local_config = path_1.default.join(__dirname, "../", "conf.json");
    if (!config_arg)
        return local_config;
    return PROCESS_INPUT_FILE(config_arg, "Config", false);
}
function PROCESS_IMAGE_SIZE(value) {
    if (!["string", "number"].includes(typeof value))
        value = `${value.width}x${value.height}`;
    let parts = value.toString().split(/(?<=\d+)x(?=\d+)/);
    if (parts.some((part) => parseInt(part, 10).toString() !== part))
        return false;
    parts = parts.map((part) => parseInt(part, 10));
    return { width: parts[0], height: parts[1] || parts[0] };
}
function PROCESS_DOWNLOADER_ORDER(value, throwEr) {
    if (!Array.isArray(value))
        return throwEr();
    return value
        .filter(Boolean)
        .map((item) => (!VALIDS.downloaders.includes(item) ? throwEr(item) : item));
}
const [RULE_DEFAULTS, RULE_HANDLERS] = [
    ["id", "uri", "album", "album_artist", "isrc", "label"],
    {
        title(spec, object, props) {
            if (!("name" in object))
                return;
            return (0, minimatch_1.default)(object.name, spec, { nocase: !props.filterCase });
        },
        type(spec, object) {
            if (spec && !["album", "single", "compilation"].includes(spec))
                throw new Error(`Invalid rule specification: \`${spec}\``);
            if (!("compilation" in object))
                return;
            return spec === object.album_type;
        },
        artist(spec, object, props) {
            if (!("artists" in object))
                return;
            return object.artists.some((artist) => (0, minimatch_1.default)(artist, spec, { nocase: !props.filterCase }));
        },
        ntracks(spec, object) {
            const parsed = parse_range_js_1.default.num(spec, true);
            if (!("total_tracks" in object))
                return;
            return parsed.check(object.total_tracks);
        },
        trackn(spec, object) {
            const parsed = parse_range_js_1.default.num(spec, true);
            if (!("track_number" in object))
                return;
            return parsed.check(object.track_number);
        },
        duration(spec, object) {
            const parsed = parse_range_js_1.default.time(spec, true);
            if (!("duration" in object))
                return;
            return parsed.check(object.duration);
        },
        year(spec, object) {
            const parsed = parse_range_js_1.default.num(spec, true);
            if (!("release_date" in object))
                return;
            return parsed.check(new Date(object.release_date).getFullYear());
        },
        diskn(spec, object) {
            const parsed = parse_range_js_1.default.num(spec, true);
            if (!("track_number" in object))
                return;
            return parsed.check(object.disc_number);
        },
        explicit(spec, object) {
            if (spec && !["true", "false", "inoffensive"].includes(spec))
                throw new Error(`Invalid rule specification: \`${spec}\``);
            if (!("contentRating" in object))
                return;
            return (object.contentRating ===
                (spec === "true" ? "explicit" : spec === "false" ? "clean" : undefined));
        },
    },
];
function CHECK_FILTER_FIELDS(arrayOfFields, props = {}) {
    // use different rules to indicate "OR", not "AND"
    const coreHandler = (rules, trackObject, error = null) => {
        for (let ruleObject of rules) {
            try {
                Object.entries(ruleObject).forEach(([rule, value]) => {
                    try {
                        const status = (RULE_HANDLERS[rule] ||
                            ((spec, object) => {
                                if (!(rule in object))
                                    return;
                                return (0, minimatch_1.default)(`${object[rule]}`, spec, {
                                    //@ts-expect-error
                                    nocase: !props.filterCase,
                                });
                            }))(value, trackObject, props);
                        if (status !== undefined && !status)
                            throw new Error(`expected \`${value}\``);
                    }
                    catch (reason) {
                        throw new Error(`<${rule}>, ${reason.message}`);
                    }
                });
                return { status: true, reason: null };
            }
            catch (reason) {
                error = reason;
            }
        }
        if (error)
            return { status: false, reason: error };
        return { status: true, reason: null };
    };
    const chk = (rules) => {
        rules
            .reduce((a, r) => a.concat(Object.keys(r)), [])
            .forEach((rule) => {
            if (!(rule in RULE_HANDLERS || RULE_DEFAULTS.includes(rule)))
                throw new Error(`Invalid filter rule: [${rule}]`);
        });
        return rules;
    };
    const rules = chk((arrayOfFields || []).reduce((a, v) => a.concat((0, filter_parser_js_1.default)(v).filters), []));
    const handler = (trackObject = {}) => coreHandler(rules, trackObject);
    handler.extend = (_rules) => {
        if (!Array.isArray(_rules))
            throw new TypeError("Filter rules must be a valid array");
        rules.push(...chk(_rules));
        return handler;
    };
    return handler;
}
async function init(queries, ytdl, _options) {
    const options = Object.assign({
        retries: 10,
        metaRetries: 5,
        chunks: 7,
        timeout: 10000,
        bitrate: "320k",
        format: "mp3",
        tree: true,
    }, _options);
    const initTimeStamp = Date.now();
    const stackLogger = new stack_logger_js_1.default({ indentSize: 1, autoTick: false });
    if (!((Array.isArray(queries) && queries.length > 0) || options.input))
        stackLogger.error("\x1b[31m[i]\x1b[0m Please enter a valid query"),
            process.exit(1);
    try {
        options.filter = CHECK_FILTER_FIELDS([], {
            filterCase: undefined,
        });
        options.concurrency = Object.fromEntries([]
            .map((item) => (([k, v]) => (v ? [k, v] : ["tracks", k]))(item.split("=")))
            .map(([k, v]) => {
            if (!VALIDS.concurrency.includes(k))
                throw Error(`key identifier for the \`-z, --concurrency\` flag must be valid. found [key: ${k}]`);
            return [k, CHECK_FLAG_IS_NUM(v, "-z, --concurrency", "number")];
        }));
        options.downloader = PROCESS_DOWNLOADER_ORDER("".split(","), (item) => {
            throw new Error(`downloader specification within the \`--downloader\` must be valid. found [${item}]`);
        });
    }
    catch (err) {
        stackLogger.error("\x1b[31m[i]\x1b[0m", err.message || err);
        process.exit(2);
    }
    let Config = lodash_1.default.merge({
        server: {
            hostname: "localhost",
            port: 36346,
            useHttps: false,
        },
        opts: {
            netCheck: true,
            attemptAuth: true,
            autoOpenBrowser: true,
        },
        dirs: {
            output: ".",
        },
        playlist: {
            always: false,
            append: true,
            escape: true,
            forceAppend: false,
            dir: null,
            namespace: null, // namespace to prefix playlist entries with
        },
        image: {
            width: 640,
            height: 640,
        },
        filters: [],
        concurrency: {
            queries: 1,
            tracks: 1,
            trackStage: 6,
            downloader: 4,
            encoder: 6,
            embedder: 10,
        },
        downloader: {
            memCache: true,
            cacheSize: 209715200,
            order: ["yt_music", "youtube"],
        },
    }, conf_json_1.default);
    try {
        const errMessage = new Error(`[key: image, value: ${JSON.stringify(Config.image)}]`);
        if (!(Config.image = PROCESS_IMAGE_SIZE(Config.image)))
            throw errMessage;
        Config.downloader.order = PROCESS_DOWNLOADER_ORDER(Config.downloader.order, (item) => {
            if (item)
                throw new Error(`Downloader order within the config file must be valid. found [${item}]`);
            throw new Error(`Downloader order must be an array of strings`);
        });
    }
    catch (err) {
        stackLogger.error(`\x1b[31m[!]\x1b[0m Configuration file [${options.config}] wrongly formatted`);
        stackLogger.error(err.message || err);
        process.exit(3);
    }
    Config.image = lodash_1.default.merge(Config.image, options.coverSize);
    Config.concurrency = lodash_1.default.merge(Config.concurrency, options.concurrency);
    Config.dirs = lodash_1.default.merge(Config.dirs, {
        output: options.directory,
        cache: options.cacheDir,
    });
    Config.opts = lodash_1.default.merge(Config.opts, {
        netCheck: options.netCheck,
        attemptAuth: options.auth,
        autoOpenBrowser: options.browser,
    });
    Config.playlist = lodash_1.default.merge(Config.playlist, {
        always: !!options.playlist,
        append: !options.playlistNoappend,
        escape: !options.playlistNoescape,
        forceAppend: options.playlistForceAppend,
        dir: options.playlistDir,
        namespace: options.playlistNamespace,
    });
    Config.downloader = lodash_1.default.mergeWith(Config.downloader, {
        memCache: options.memCache !== undefined ? !!options.memCache : undefined,
        cacheSize: options.memCache,
        order: options.downloader,
    }, (a, b, k) => k === "order"
        ? Array.from(new Set(b.concat(a)))
        : b !== undefined
            ? b
            : undefined);
    const BASE_DIRECTORY = ((path) => path_1.default.isAbsolute(path) ? path : path_1.default.relative(".", path || ".") || ".")(Config.dirs.output);
    if (!fs_1.default.existsSync(BASE_DIRECTORY))
        stackLogger.error(`\x1b[31m[!]\x1b[0m Working directory [${BASE_DIRECTORY}] doesn't exist`),
            process.exit(5);
    if ((await processPromise(bluebird_1.default.promisify(fs_1.default.access)(BASE_DIRECTORY, fs_1.default.constants.W_OK), stackLogger, {
        onInit: "Checking directory permissions...",
    })) === null)
        process.exit(5);
    let freyrCore;
    try {
        freyrCore = new freyr_js_1.default(Config.services, cli_server_js_1.default, Config.server, ytdl);
    }
    catch (err) {
        stackLogger.error(`\x1b[31m[!]\x1b[0m Failed to initialize a Freyr Instance`);
        stackLogger.error(err.message || err);
        process.exit(6);
    }
    const schema = {
        services: {
            type: "object",
            additionalProperties: false,
            default: {},
            properties: {},
        },
    };
    freyrCore.ENGINES.forEach((engine) => {
        schema.services.default[engine[symbols_js_1.default.meta].ID] = {};
        schema.services.properties[engine[symbols_js_1.default.meta].ID] = {
            type: "object",
            additionalProperties: false,
            properties: engine[symbols_js_1.default.meta].PROP_SCHEMA || {},
        };
    });
    const freyrCoreConfig = new conf_1.default({
        projectName: "FreyrCLI",
        projectSuffix: "",
        configName: "d3fault",
        fileExtension: "x4p",
        schema,
    });
    const sourceStack = freyrCore.sortSources(Config.downloader.order);
    let atomicParsley;
    try {
        atomicParsley = wrapCliInterface(["AtomicParsley", "atomicparsley"], undefined);
    }
    catch (err) {
        stackLogger.error(err.message);
        process.exit(7);
    }
    const progressGen = prepProgressGen(options);
    function createPlaylist(header, stats, logger, filename, playlistTitle, shouldAppend) {
        if (options.playlist !== false) {
            const validStats = stats.filter((stat) => stat.code === 0 ? stat.complete : !stat.code);
            if (validStats.length) {
                logger.print("[\u2022] Creating playlist...");
                const playlistFile = path_1.default.join(Config.playlist.dir || BASE_DIRECTORY, `${(0, filenamify_1.default)(filename, { replacement: "_" })}.m3u8`);
                const isNew = !(fs_1.default.existsSync(playlistFile) && fs_1.default.statSync(playlistFile).size) ||
                    !(!options.playlistNoappend || shouldAppend);
                const plStream = fs_1.default.createWriteStream(playlistFile, {
                    encoding: "utf8",
                    flags: !isNew ? "a" : "w",
                });
                if (isNew) {
                    plStream.write("#EXTM3U\n");
                    if (playlistTitle)
                        plStream.write(`#${playlistTitle.replace(/\n/gm, "\n# ")}\n`);
                    if (header)
                        plStream.write(`#${header}\n`);
                }
                let { namespace } = Config.playlist;
                namespace = namespace
                    ? url_1.default.format(url_1.default.parse(namespace)).concat("/")
                    : "";
                validStats.forEach(({ meta: { track: { uri, name, artists, duration }, service, outFilePath, }, }) => plStream.write([
                    "",
                    `#${service[symbols_js_1.default.meta].DESC} URI: ${uri}`,
                    `#EXTINF:${Math.round(duration / 1e3)},${artists[0]} - ${name}`,
                    `${namespace.concat(((entry) => !Config.playlist.escape
                        ? entry
                        : encodeURI(entry).replace(/#/g, "%23"))(path_1.default.relative(BASE_DIRECTORY, outFilePath)))}`,
                    "",
                ].join("\n")));
                plStream.close();
                logger.write("[done]\n");
                logger.log(`[\u2022] Playlist file: [${playlistFile}]`);
            }
        }
        else
            logger.log(`[\u2022] Skipped playlist creation`);
    }
    function downloadToStream({ urlOrFragments, outputFile, logger, opts }) {
        opts = {
            tag: "",
            successMessage: "",
            failureMessage: "",
            retryMessage: "",
            ...opts,
        };
        [
            opts.tag,
            opts.errorHandler,
            opts.retryMessage,
            opts.failureMessage,
            opts.successMessage,
        ] = [
            opts.tag,
            opts.errorHandler,
            opts.retryMessage,
            opts.failureMessage,
            opts.successMessage,
        ].map((val) => typeof val === "function" || val === false ? val : () => val);
        return new bluebird_1.default((res, rej) => {
            let completed = false;
            if (!Array.isArray(urlOrFragments)) {
                const feed = (0, libxget_1.default)(urlOrFragments, {
                    auto: false,
                    cache: Config.downloader.memCache,
                    chunks: options.chunks,
                    retries: options.retries,
                    timeout: options.timeout,
                    cacheSize: Config.downloader.cacheSize,
                })
                    .with("progressBar", (urlMeta) => progressGen(urlMeta.size, urlMeta.chunkStack.map((chunk) => chunk.size), { tag: opts.tag(urlMeta) }, logger.indentation(), false))
                    .use("progressBar", (dataSlice, store) => 
                //@ts-expect-error
                store.get("progressBar").next(dataSlice.next))
                    .on("end", () => {
                    if (feed.store.has("progressBar"))
                        feed.store.get("progressBar").end(opts.successMessage(), "\n");
                    else
                        logger.write(opts.successMessage(), "\n");
                })
                    .on("retry", (data) => {
                    if (opts.retryMessage !== false) {
                        if (feed.store.has("progressBar"))
                            data.store
                                .get("progressBar")
                                .print(opts.retryMessage({ ref: data.index + 1, ...data }));
                        else
                            logger.write(opts.retryMessage(data), "\n");
                    }
                })
                    .once("error", (err) => {
                    if (completed)
                        return;
                    err = Object(err);
                    if (feed.store.has("progressBar"))
                        feed.store.get("progressBar").end(opts.failureMessage(err), "\n");
                    else
                        logger.write(opts.failureMessage(err), "\n");
                    opts.errorHandler(err);
                    rej(err);
                });
                feed.setHeadHandler(({ acceptsRanges }) => {
                    //@ts-expect-error
                    let [offset, writeStream] = [];
                    if (acceptsRanges && fs_1.default.existsSync(outputFile))
                        //@ts-expect-error
                        ({ size: offset } = fs_1.default.statSync(outputFile));
                    if (offset) {
                        opts.resumeHandler(offset);
                        //@ts-expect-error
                        writeStream = fs_1.default.createWriteStream(outputFile, { flags: "a" });
                        //@ts-expect-error
                    }
                    else
                        writeStream = fs_1.default.createWriteStream(outputFile, { flags: "w" });
                    //@ts-expect-error
                    feed.pipe(writeStream).on("finish", 
                    //@ts-expect-error
                    () => ((completed = true), res(writeStream.bytesWritten)));
                    return offset;
                });
                feed.start();
            }
            else {
                const barGen = progressGen(urlOrFragments.reduce((total, fragment) => total + fragment.size, 0), urlOrFragments.map((fragment) => fragment.size), { tag: opts.tag() }, logger.indentation(), true);
                let has_erred = false;
                const writeStream = fs_1.default.createWriteStream(outputFile);
                (0, merge2_1.default)(...urlOrFragments.map((frag, i) => {
                    const feed = (0, libxget_1.default)(frag.url, {
                        cache: Config.downloader.memCache,
                        chunks: 1,
                        retries: options.retries,
                        timeout: options.timeout,
                        cacheSize: Config.downloader.cacheSize,
                    })
                        .on("retry", (data) => {
                        if (opts.retryMessage !== false)
                            barGen.print(opts.retryMessage({
                                ref: `${i}[${data.index + 1}]`,
                                ...data,
                            }));
                    })
                        .once("error", (err) => {
                        if (completed)
                            return;
                        if (has_erred)
                            return feed.destroy();
                        err = Object(err);
                        has_erred = true;
                        //@ts-expect-error
                        err.segment_index = i;
                        barGen.end(opts.failureMessage(err), "\n");
                        opts.errorHandler(err);
                        rej(err);
                    });
                    return feed.pipe(barGen.next(frag.size));
                }))
                    .once("end", () => barGen.end(opts.successMessage(), "\n"))
                    .pipe(writeStream)
                    .on("finish", () => ((completed = true), res(writeStream.bytesWritten)));
                // TODO: support resumption of segmented resources
                // TODO: retry fragments?
            }
        });
    }
    const downloadQueue = new async_queue_js_1.default("cli:downloadQueue", Config.concurrency.downloader, async ({ track, meta, feedMeta, trackLogger }) => {
        const baseCacheDir = "fr3yrcach3";
        const imageFile = await (0, file_mgr_js_1.default)({
            filename: `freyrcli-${meta.fingerprint}.x4i`,
            tempdir: Config.dirs.cacheDir === "<tmp>" ? undefined : Config.dirs.cacheDir,
            dirname: baseCacheDir,
            keep: true,
        });
        const imageBytesWritten = await downloadToStream({
            urlOrFragments: track.getImage(Config.image.width, Config.image.height),
            outputFile: imageFile.name,
            logger: trackLogger,
            opts: {
                tag: "[Retrieving album art]...",
                // errorHandler: () => imageFile.removeCallback(),
                retryMessage: (data) => trackLogger.getText(`| ${getRetryMessage(data)}`),
                resumeHandler: (offset) => trackLogger.log(
                //@ts-expect-error
                (0, stringd_colors_1.default)(`| :{color(yellow)}{i}:{color:close(yellow)} Resuming at ${offset}`)),
                failureMessage: (err) => trackLogger.getText(`| [\u2715] Failed to get album art${err ? ` [${err.code || err.message}]` : ""}`),
                successMessage: trackLogger.getText(`| [\u2713] Got album art`),
            },
        }).catch((err) => bluebird_1.default.reject({ err, code: 3 }));
        const rawAudio = await (0, file_mgr_js_1.default)({
            filename: `freyrcli-${meta.fingerprint}.x4a`,
            tempdir: Config.dirs.cacheDir === "<tmp>" ? undefined : Config.dirs.cacheDir,
            dirname: baseCacheDir,
            keep: true,
        });
        const audioBytesWritten = await downloadToStream(lodash_1.default.merge({
            outputFile: rawAudio.name,
            logger: trackLogger,
            opts: {
                tag: `[‘${meta.trackName}’]`,
                retryMessage: (data) => trackLogger.getText(`| ${getRetryMessage(data)}`),
                resumeHandler: (offset) => trackLogger.log(
                //@ts-expect-error
                (0, stringd_colors_1.default)(`| :{color(yellow)}{i}:{color:close(yellow)} Resuming at ${offset}`)),
                successMessage: trackLogger.getText("| [\u2713] Got raw track file"),
            },
        }, feedMeta.protocol !== "http_dash_segments"
            ? {
                urlOrFragments: feedMeta.url,
                opts: {
                    errorHandler: () => rawAudio.removeCallback(),
                    failureMessage: (err) => trackLogger.getText(`| [\u2715] Failed to get raw media stream${err ? ` [${err.code || err.message}]` : ""}`),
                },
            }
            : {
                urlOrFragments: feedMeta.fragments.map(({ path }) => ({
                    url: `${feedMeta.fragment_base_url}${path}`,
                    ...(([, min, max]) => ({
                        min: +min,
                        max: +max,
                        size: +max - +min + 1,
                    }))(path.match(/range\/(\d+)-(\d+)$/)),
                })),
                opts: {
                    failureMessage: (err) => trackLogger.getText(`| [\u2715] Segment error while getting raw media${err ? ` [${err.code || err.message}]` : ""}`),
                },
            })).catch((err) => bluebird_1.default.reject({ err, code: 4 }));
        return {
            image: { file: imageFile, bytesWritten: imageBytesWritten },
            audio: { file: rawAudio, bytesWritten: audioBytesWritten },
        };
    });
    const embedQueue = new async_queue_js_1.default("cli:postprocessor:embedQueue", Config.concurrency.embedder, async ({ track, meta, files, audioSource }) => {
        return bluebird_1.default.promisify(atomicParsley)(meta.outFilePath, {
            overWrite: "",
            title: track.name,
            artist: track.artists[0],
            composer: track.composers,
            album: track.album,
            genre: ((genre) => (genre ? genre.concat(" ") : ""))((track.genres || [])[0]),
            tracknum: `${track.track_number}/${track.total_tracks}`,
            disk: `${track.disc_number}/${track.disc_number}`,
            year: new Date(track.release_date).toISOString().split("T")[0],
            compilation: track.compilation,
            gapless: options.gapless,
            rDNSatom: [
                // ----
                ["Digital Media", "name=MEDIA", "domain=com.apple.iTunes"],
                [track.isrc, "name=ISRC", "domain=com.apple.iTunes"],
                [track.artists[0], "name=ARTISTS", "domain=com.apple.iTunes"],
                [track.label, "name=LABEL", "domain=com.apple.iTunes"],
                [
                    `${meta.service[symbols_js_1.default.meta].DESC}: ${track.uri}`,
                    "name=SOURCE",
                    "domain=com.apple.iTunes",
                ],
                [
                    `${audioSource.service[symbols_js_1.default.meta].DESC}: ${audioSource.source.videoId}`,
                    "name=PROVIDER",
                    "domain=com.apple.iTunes",
                ],
            ],
            advisory: ["explicit", "clean"].includes(track.contentRating) // rtng
                ? track.contentRating
                : track.contentRating === true
                    ? "explicit"
                    : "Inoffensive",
            stik: "Normal",
            // geID: 0, // geID: genreID. See `AtomicParsley --genre-list`
            // sfID: 0, // ~~~~: store front ID
            // cnID: 0, // cnID: catalog ID
            albumArtist: track.album_artist,
            // ownr? <owner>
            purchaseDate: "timestamp",
            apID: "cli@freyr.git",
            copyright: track.copyrights.sort(({ type }) => type === "P" ? -1 : 1)[0].text,
            encodingTool: `freyr-js cli v${package_json_1.default.version}`,
            encodedBy: "d3vc0dr",
            artwork: files.image.file.name, // covr
            // sortOrder: [
            //   ['name', 'NAME'], // sonm
            //   ['album', 'NAME'], // soal
            //   ['artist', 'NAME'], // soar
            //   ['albumartist', 'NAME'], // soaa
            // ],
        })
            .finally(() => files.image.file.removeCallback())
            .catch((err) => bluebird_1.default.reject({ err, code: 8 }));
    });
    const encodeQueue = new async_queue_js_1.default("cli:postprocessor:encodeQueue", Config.concurrency.encoder, async ({ track, meta, files }) => {
        return new bluebird_1.default((res, rej) => (0, fluent_ffmpeg_1.default)()
            .addInput(files.audio.file.name)
            .audioCodec("aac")
            .audioBitrate(options.bitrate)
            .audioFrequency(44100)
            .noVideo()
            .setDuration(hh_mm_ss_1.default.fromMs(track.duration, "hh:mm:ss.sss"))
            .toFormat("ipod")
            .saveToFile(meta.outFilePath)
            .on("error", (err) => rej({ err, code: 7 }))
            .on("end", res)).finally(() => files.audio.file.removeCallback());
    });
    const postProcessor = new async_queue_js_1.default("cli:postProcessor", 4, async ({ track, meta, files, audioSource }) => {
        await (0, mkdirp_1.default)(meta.outFileDir).catch((err) => bluebird_1.default.reject({ err, code: 6 }));
        const wroteImage = !!options.cover &&
            ((outArtPath) => !(fs_1.default.existsSync(outArtPath) && !fs_1.default.statSync(outArtPath).isFile()) &&
                (fs_1.default.copyFileSync(files.image.file.name, outArtPath), true))(path_1.default.join(meta.outFileDir, options.cover));
        //@ts-expect-error
        await encodeQueue.push({ track, meta, files });
        //@ts-expect-error
        await embedQueue.push({ track, meta, files, audioSource });
        return { wroteImage, finalSize: fs_1.default.statSync(meta.outFilePath).size };
    });
    function buildSourceCollectorFor(track, selector) {
        async function handleSource(iterator, lastErr) {
            const result = { service: null, sources: null, lastErr };
            if ((result.service = iterator.next().value)) {
                result.sources = bluebird_1.default.resolve(result.service.search(track.artists, track.name.replace(/\s*\((((feat|ft).)|with).+\)/, ""), track.duration)).then((sources) => {
                    if ([undefined, null].includes(sources))
                        throw new Error(`incompatible source response. recieved [${sources}]`);
                    // arrays returned from service source calls should have at least one item
                    if (Array.isArray(sources) && sources.length === 0)
                        throw new Error("Zero sources found");
                    const source = (selector ||
                        ((results) => {
                            try {
                                return results[0];
                            }
                            catch {
                                throw new Error(`error while extracting feed from source, try defining a <selector>. recieved [${results}]`);
                            }
                        }))(sources);
                    if ([undefined, null].includes(source))
                        throw new Error(`incompatible response item. recieved: [${source}]`);
                    if (!("getFeeds" in source))
                        throw new Error(`service provided no means for source to collect feeds`);
                    let feedTries = 1;
                    const getFeeds = () => source
                        .getFeeds()
                        .catch((err) => (feedTries += 1) <= options.metaRetries
                        ? getFeeds()
                        : bluebird_1.default.reject(err));
                    const feeds = getFeeds();
                    bluebird_1.default.resolve(feeds).catch(() => { }); // diffuse feeds result, in case of an asynchronous promise rejection
                    if ([undefined, null].includes(feeds))
                        throw new Error(`service returned no valid feeds for source`);
                    return { sources, source, feeds, service: result.service };
                });
                //@ts-expect-error
                result.results = result.sources.catch((err) => ({
                    next: handleSource(iterator, err),
                }));
            }
            return result;
        }
        async function collect_contained(process, handler) {
            process = await process;
            if (!process.sources)
                return { err: process.lastErr };
            await handler(process.service, process.sources);
            const results = await process.results;
            if (results.next)
                return collect_contained(results.next, handler);
            return results;
        }
        //@ts-expect-error
        const process = handleSource(sourceStack.values());
        return async (handler) => collect_contained(process, handler);
    }
    const trackQueue = new async_queue_js_1.default("cli:trackQueue", Config.concurrency.tracks, async ({ track, meta, props }) => {
        const trackLogger = props.logger
            .log(`\u2022 [${meta.trackName}]`)
            .tick(3);
        const filterStat = options.filter(track, false);
        if (!filterStat.status) {
            trackLogger.log("| [\u2022] Didn't match filter. Skipping...");
            return {
                meta,
                code: 0,
                skip_reason: `filtered out: ${filterStat.reason.message}`,
                complete: false,
            };
        }
        if (props.fileExists) {
            if (!props.processTrack) {
                trackLogger.log("| [\u00bb] Track exists. Skipping...");
                return { meta, code: 0, skip_reason: "exists", complete: true };
            }
            trackLogger.log("| [\u2022] Track exists. Overwriting...");
        }
        trackLogger.log("| \u27a4 Collating sources...");
        const audioSource = await props.collectSources((service, sourcesPromise) => processPromise(sourcesPromise, trackLogger, {
            onInit: `|  \u27a4 [\u2022] ${service[symbols_js_1.default.meta].DESC}...`,
            arrIsEmpty: () => "[Unable to gather sources]\n",
            onPass: ({ sources }) => `[success, found ${sources.length} source${sources.length === 1 ? "" : "s"}]\n`,
        }));
        if ("err" in audioSource)
            return { meta, code: 1, err: audioSource.err }; // zero sources found
        const audioFeeds = await processPromise(audioSource.feeds, trackLogger, {
            onInit: "| \u27a4 Awaiting audiofeeds...",
            noVal: () => "[Unable to collect source feeds]\n",
        });
        if (!audioFeeds || audioFeeds.err)
            return { meta, err: (audioFeeds || {}).err, code: 2 };
        const feedMeta = audioFeeds.formats.sort((meta1, meta2) => meta1.abr > meta2.abr ? -1 : meta1.abr < meta2.abr ? 1 : 0)[0];
        meta.fingerprint = crypto_1.default
            .createHash("md5")
            .update(`${audioSource.source.videoId} ${feedMeta.format_id}`)
            .digest("hex");
        const files = await downloadQueue
            //@ts-expect-error
            .push({ track, meta, feedMeta, trackLogger })
            .catch((errObject) => bluebird_1.default.reject({
            meta,
            code: 5,
            ...(errObject.code ? errObject : { err: errObject }),
        }));
        trackLogger.log(`| [\u2022] Post Processing...`);
        return {
            files,
            postprocess: postProcessor
                //@ts-expect-error
                .push({ track, meta, files, audioSource })
                .catch((errObject) => ({ code: 9, ...errObject })),
        };
    });
    const trackBroker = new async_queue_js_1.default("cli:trackBroker", Config.concurrency.trackStage, async (track, { logger, service, isPlaylist }) => {
        try {
            if (!(track = await track))
                throw new Error("no data recieved from track");
        }
        catch (err) {
            return { code: -1, err };
        }
        if ((track[symbols_js_1.default.errorStack] || {}).code === 1)
            return {
                code: -1,
                err: new Error("local-typed tracks aren't supported"),
                meta: { track: { uri: track[symbols_js_1.default.errorStack].uri } },
            };
        const outFileDir = path_1.default.join(BASE_DIRECTORY, ...(options.tree
            ? [track.album_artist, track.album].map((name) => (0, filenamify_1.default)(name, { replacement: "_" }))
            : []));
        const trackBaseName = `${prePadNum(track.track_number, track.total_tracks, 2)} ${track.name}`;
        const trackName = trackBaseName.concat(isPlaylist ||
            (track.compilation && track.album_artist === "Various Artists")
            ? ` \u2012 ${track.artists.join(", ")}`
            : "");
        const outFileName = `${(0, filenamify_1.default)(trackBaseName, {
            replacement: "_",
        })}.m4a`;
        const outFilePath = path_1.default.join(outFileDir, outFileName);
        const fileExists = fs_1.default.existsSync(outFilePath);
        const processTrack = !fileExists || options.force;
        let collectSources;
        if (processTrack)
            collectSources = buildSourceCollectorFor(track, (results) => results[0]);
        const meta = { trackName, outFileDir, outFilePath, track, service };
        return (trackQueue
            //@ts-expect-error
            .push({
            track,
            meta,
            props: { collectSources, fileExists, processTrack, logger },
        })
            .then((trackObject) => ({ ...trackObject, meta }))
            .catch((errObject) => ({ meta, code: 10, ...errObject })));
    });
    async function trackHandler(query, { service, queryLogger }) {
        const logger = queryLogger.print(`Obtaining track metadata...`).tick();
        const track = await processPromise(service.getTrack(query, options.storefront), logger, { noVal: true });
        if (!track)
            return bluebird_1.default.reject();
        logger.log(`\u27a4 Title: ${track.name}`);
        logger.log(`\u27a4 Album: ${track.album}`);
        logger.log(`\u27a4 Artist: ${track.album_artist}`);
        logger.log(`\u27a4 Year: ${new Date(track.release_date).getFullYear()}`);
        logger.log(`\u27a4 Playtime: ${hh_mm_ss_1.default.fromMs(track.duration, "mm:ss").match(/(\d{2}:\d{2})(.+)?/)[1]}`);
        const collationLogger = queryLogger.log("[\u2022] Collating...");
        return {
            meta: track,
            isCollection: false,
            tracks: trackBroker.push([track], {
                logger: collationLogger,
                service,
                isPlaylist: false,
            }),
        };
    }
    async function albumHandler(query, { service, queryLogger }) {
        const logger = queryLogger.print(`Obtaining album metadata...`).tick();
        const album = await processPromise(service.getAlbum(query, options.storefront), logger, { noVal: true });
        if (!album)
            return bluebird_1.default.reject();
        logger.log(`\u27a4 Album Name: ${album.name}`);
        logger.log(`\u27a4 Artist: ${album.artists[0]}`);
        logger.log(`\u27a4 Tracks: ${album.ntracks}`);
        logger.log(`\u27a4 Type: ${album.type === "compilation" ? "Compilation" : "Album"}`);
        logger.log(`\u27a4 Year: ${new Date(album.release_date).getFullYear()}`);
        if (album.genres.length)
            logger.log(`\u27a4 Genres: ${album.genres.join(", ")}`);
        const collationLogger = queryLogger
            .log(`[\u2022] Collating [${album.name}]...`)
            .tick();
        const tracks = await processPromise(service.getAlbumTracks(album.uri, options.storefront), collationLogger, {
            onInit: "[\u2022] Inquiring tracks...",
        });
        if (!tracks)
            throw new Error("Failed to collect album tracks");
        if (!tracks.length)
            return;
        return {
            meta: album,
            isCollection: album.type === "compilation",
            tracks: trackBroker.push(tracks, {
                logger: collationLogger.tick(),
                service,
                isPlaylist: false,
            }),
        };
    }
    async function artistHandler(query, { service, queryLogger }) {
        const logger = queryLogger.print(`Obtaining artist metadata...`).tick();
        const artist = await processPromise(service.getArtist(query, options.storefront), logger, { noVal: true });
        if (!artist)
            return bluebird_1.default.reject();
        logger.log(`\u27a4 Artist: ${artist.name}`);
        if (artist.followers)
            logger.log(`\u27a4 Followers: ${`${artist.followers}`.replace(/(\d)(?=(\d{3})+$)/g, "$1,")}`);
        if (artist.genres && artist.genres.length)
            logger.log(`\u27a4 Genres: ${artist.genres.join(", ")}`);
        const albumsStack = await processPromise(service.getArtistAlbums(artist.uri, options.storefront), logger, {
            onInit: "> Gathering collections...",
        });
        if (!albumsStack)
            return;
        const collationLogger = queryLogger.log(`[\u2022] Collating...`).tick();
        return bluebird_1.default.mapSeries(albumsStack, async ({ uri }, index) => {
            const album = await service.getAlbum(uri, options.storefront);
            const albumLogger = collationLogger
                .log(`(${prePadNum(index + 1, albumsStack.length)}) [${album.name}] (${album.type})`)
                .tick();
            const tracks = await processPromise(service.getAlbumTracks(album.uri, options.storefront), albumLogger, {
                onInit: "[\u2022] Inquiring tracks...",
            });
            if (!(tracks && tracks.length))
                return;
            return {
                meta: album,
                isCollection: album.type === "collection",
                tracks: await bluebird_1.default.all(trackBroker.push(tracks, {
                    logger: albumLogger.tick(),
                    service,
                    isPlaylist: false,
                })),
            };
        });
    }
    async function playlistHandler(query, { service, queryLogger }) {
        const logger = queryLogger.print(`Obtaining playlist metadata...`).tick();
        const playlist = await processPromise(service.getPlaylist(query, options.storefront), logger, { noVal: true });
        if (!playlist)
            return bluebird_1.default.reject();
        logger.log(`\u27a4 Playlist Name: ${playlist.name}`);
        logger.log(`\u27a4 By: ${playlist.owner_name}`);
        if (playlist.description)
            logger.log(`\u27a4 Description: ${(0, html_entities_1.decode)(playlist.description)}`);
        logger.log(`\u27a4 Type: ${playlist.type}`);
        if (playlist.followers)
            logger.log(`\u27a4 Followers: ${`${playlist.followers}`.replace(/(\d)(?=(\d{3})+$)/g, "$1,")}`);
        logger.log(`\u27a4 Tracks: ${playlist.ntracks}`);
        const collationLogger = queryLogger.log(`[\u2022] Collating...`).tick();
        const tracks = await processPromise(service.getPlaylistTracks(playlist.uri, options.storefront), collationLogger, {
            onInit: "[\u2022] Inquiring tracks...",
        });
        if (!tracks)
            throw new Error("Failed to collect playlist tracks");
        if (!tracks.length)
            return;
        return {
            meta: playlist,
            isCollection: true,
            tracks: trackBroker.push(tracks, {
                logger: collationLogger.tick(),
                service,
                isPlaylist: true,
            }),
        };
    }
    const authQueue = new async_queue_js_1.default("cli:authQueue", 1, async (service, logger) => {
        async function coreAuth(loginLogger) {
            if (!Config.opts.attemptAuth)
                return;
            const authHandler = service.newAuth();
            const url = await authHandler.getUrl;
            if (Config.opts.autoOpenBrowser)
                await processPromise((0, open_1.default)(url), loginLogger, {
                    onInit: `[\u2022] Attempting to open [ ${url} ] within browser...`,
                });
            else
                loginLogger.log(`[\u2022] Open [ ${url} ] in a browser to proceed with authentication`);
            await processPromise(authHandler.userToAuth(), loginLogger, {
                onInit: "[\u2022] Awaiting user authentication...",
            });
        }
        service.loadConfig(freyrCoreConfig.get(`services.${service[symbols_js_1.default.meta].ID}`));
        if (service.isAuthed())
            logger.write("[authenticated]\n");
        else {
            logger.write(service.hasOnceAuthed() ? "[expired]\n" : "[unauthenticated]\n");
            const loginLogger = logger
                .log(`[${service[symbols_js_1.default.meta].DESC} Login]`)
                .tick();
            service.canTryLogin()
                ? (await processPromise(service.login(), loginLogger, {
                    onInit: "[\u2022] Logging in...",
                })) || (await coreAuth(loginLogger))
                : await coreAuth(loginLogger);
        }
        return service.isAuthed();
    });
    const queryQueue = new async_queue_js_1.default("cli:queryQueue", Config.concurrency.queries, async (query) => {
        const queryLogger = stackLogger.log(`[${query}]`).tick();
        const service = await processPromise(freyrCore.identifyService(query), queryLogger, {
            onInit: "[\u2022] Identifying service...",
            noVal: () => "(failed: \x1b[33mInvalid Query\x1b[0m)\n",
            onPass: (engine) => `[${engine[symbols_js_1.default.meta].DESC}]\n`,
        });
        if (!service)
            return;
        const isAuthenticated = !!(await processPromise(authQueue.push(service, queryLogger), queryLogger, {
            onInit: "[\u2022] Checking authentication...",
            noVal: () => "[\u2715] Failed to authenticate client!\n",
            onPass: false,
        }));
        if (!isAuthenticated)
            return;
        if (service.hasProps())
            freyrCoreConfig.set(`services.${service[symbols_js_1.default.meta].ID}`, service.getProps());
        const contentType = service.identifyType(query);
        queryLogger.log(`Detected [${contentType}]`);
        let queryStats = await (0, p_flatten_js_1.default)((contentType === "track"
            ? trackHandler
            : contentType === "album"
                ? albumHandler
                : contentType === "artist"
                    ? artistHandler
                    : playlistHandler)(query, { service, queryLogger })
            .then((stats) => (Array.isArray(stats) ? stats : [stats]))
            .catch((err) => queryLogger.error(`\x1b[31m[i]\x1b[0m An error occurred while processing the query${err ? ` (${err.message || err})` : ""}`)));
        if (queryStats.length === 0)
            return null;
        queryStats = (await bluebird_1.default.mapSeries(queryStats.flat(), async (item) => {
            if (!item)
                return;
            await bluebird_1.default.all(item.tracks);
            return item;
        })).filter(Boolean);
        queryLogger.log("[\u2022] Download Complete");
        const embedLogger = queryLogger
            .log("[\u2022] Embedding Metadata...")
            .tick();
        const allTrackStats = await bluebird_1.default.mapSeries(queryStats, async (queryStat) => {
            const source = queryStat.meta;
            const trackStats = await (0, p_flatten_js_1.default)(queryStat.tracks);
            await bluebird_1.default.mapSeries(trackStats, async (trackStat) => {
                if (trackStat.postprocess) {
                    trackStat.postprocess = await trackStat.postprocess;
                    if ("code" in trackStat.postprocess) {
                        trackStat.code = trackStat.postprocess.code;
                        trackStat.err = trackStat.postprocess.err;
                    }
                }
                if (trackStat.code) {
                    const reason = trackStat.code === -1
                        ? "Failed getting track data"
                        : trackStat.code === 1
                            ? "Failed collecting sources"
                            : trackStat.code === 2
                                ? "Error while collecting sources feeds"
                                : trackStat.code === 3
                                    ? "Error downloading album art"
                                    : trackStat.code === 4
                                        ? "Error downloading raw audio"
                                        : trackStat.code === 5
                                            ? "Unknown Download Error"
                                            : trackStat.code === 6
                                                ? "Error ensuring directory integrity"
                                                : trackStat.code === 7
                                                    ? "Error while encoding audio"
                                                    : trackStat.code === 8
                                                        ? "Failed while embedding metadata"
                                                        : trackStat.code === 9
                                                            ? "Unknown postprocessing error"
                                                            : "Unknown track processing error";
                    embedLogger.error(`\u2022 [\u2715] ${trackStat.meta && trackStat.meta.trackName
                        ? `${trackStat.meta.trackName}`
                        : "<unknown track>"}${trackStat.meta && trackStat.meta.track.uri
                        ? ` [${trackStat.meta.track.uri}]`
                        : ""} (failed:${reason ? ` ${reason}` : ""}${trackStat.err
                        ? ` [${trackStat.err["SHOW_DEBUG_STACK" in process.env
                            ? "stack"
                            : "message"] || trackStat.err}]`
                        : ""})`);
                }
                else if (trackStat.code === 0)
                    embedLogger.log(`\u2022 [\u00bb] ${trackStat.meta.trackName} (skipped: ${trackStat.skip_reason})`);
                else
                    embedLogger.log(`\u2022 [\u2713] ${trackStat.meta.trackName}${!!options.cover && !trackStat.postprocess.wroteImage
                        ? " [(i) unable to write cover art]"
                        : ""}`);
            });
            if (queryStat.isCollection)
                createPlaylist(`Collection URI: ${source.uri}`, trackStats, queryLogger, `${source.name}${source.owner_name ? `-${source.owner_name}` : ""}`, `Playlist: ${source.name}${source.owner_name ? ` by ${source.owner_name}` : ""}`, Config.playlist.forceAppend);
            return trackStats;
        }).then((trackStats) => trackStats.flat());
        stackLogger.log("[\u2022] Collation Complete");
        return allTrackStats;
    });
    const totalQueries = queries;
    //@ts-expect-error
    const trackStats = (await (0, p_flatten_js_1.default)(queryQueue.push(totalQueries))).filter(Boolean);
    if ((options.playlist && typeof options.playlist === "string") ||
        Config.playlist.always)
        createPlaylist(null, trackStats, stackLogger, options.playlist, `Queries:\n${totalQueries.join("\n")}`, Config.playlist.append);
    const finalStats = trackStats.reduce((total, current) => {
        if (current.postprocess && current.postprocess.finalSize) {
            total.outSize += current.postprocess.finalSize;
        }
        if (current.files) {
            const audio = current.files.audio
                ? current.files.audio.bytesWritten
                : 0;
            const image = current.files.image
                ? current.files.image.bytesWritten
                : 0;
            total.netSize += audio + image;
            total.mediaSize += audio;
            total.imageSize += image;
        }
        if (current.code === 0)
            if (current.complete)
                total.passed += 1;
            else
                total.skipped += 1;
        else if (!("code" in current))
            (total.new += 1), (total.passed += 1);
        else
            total.failed += 1;
        return total;
    }, {
        outSize: 0,
        mediaSize: 0,
        imageSize: 0,
        netSize: 0,
        passed: 0,
        new: 0,
        failed: 0,
        skipped: 0,
    });
    if (options.stats) {
        stackLogger.log("============ Stats ============");
        stackLogger.log(` [\u2022] Runtime: [${(0, pretty_ms_1.default)(Date.now() - initTimeStamp)}]`);
        stackLogger.log(` [\u2022] Total queries: [${prePadNum(totalQueries.length, 10)}]`);
        stackLogger.log(` [\u2022] Total tracks: [${prePadNum(trackStats.length, 10)}]`);
        stackLogger.log(`     \u00bb Skipped: [${prePadNum(finalStats.skipped, 10)}]`);
        stackLogger.log(`     \u2713 Passed:  [${prePadNum(finalStats.passed, 10)}]${finalStats.passed > finalStats.new
            ? ` (new: ${prePadNum(finalStats.new, 10)})`
            : ""}`);
        stackLogger.log(`     \u2715 Failed:  [${prePadNum(finalStats.failed, 10)}]`);
        stackLogger.log(` [\u2022] Output directory: [${BASE_DIRECTORY}]`);
        stackLogger.log(` [\u2022] Cover Art: ${options.cover} (${Config.image.height}x${Config.image.width})`);
        stackLogger.log(` [\u2022] Total Output size: ${(0, xbytes_1.default)(finalStats.outSize)}`);
        stackLogger.log(` [\u2022] Total Network Usage: ${(0, xbytes_1.default)(finalStats.netSize)}`);
        stackLogger.log(`     \u266b Media: ${(0, xbytes_1.default)(finalStats.mediaSize)}`);
        stackLogger.log(`     \u27a4 Album Art: ${(0, xbytes_1.default)(finalStats.imageSize)}`);
        stackLogger.log(` [\u2022] Output bitrate: ${options.bitrate}`);
        stackLogger.log("===============================");
    }
}
exports.init = init;
/*
function prepCli(packageJson) {
  const program = commander
    .addHelpCommand(true)
    .storeOptionsAsProperties(true)
    .name("freyr")
    .description(packageJson.description)
    .option("--no-logo", "hide startup logo")
    .option("--no-header", "hide startup header")
    .version(`v${packageJson.version}`, "-v, --version")
    .helpOption("-h, --help", "show this help information")
    .addHelpCommand(
      "help [command]",
      "show this help information or for any subcommand"
    )
    .on("--help", () => {
      console.log("");
      console.log("Info:");
      console.log("  The `get` subcommand is implicit and default");
      console.log("   $ freyr spotify:artist:6M2wZ9GZgrQXHCFfjv46we");
      console.log("     # is equivalent to");
      console.log("   $ freyr get spotify:artist:6M2wZ9GZgrQXHCFfjv46we");
    });

  program
    .command("get", { isDefault: true })
    .arguments("[query...]")
    .description("Download music tracks from queries")
    .option(
      "-i, --input <FILE>",
      [
        "use URIs found in the specified FILE as queries (file size limit: 1 MiB)",
        "(each query on a new line, use '#' for comments, whitespaces ignored)",
        "(example: `-i queue.txt`)",
      ].join("\n")
    )
    .option(
      "-b, --bitrate <N>",
      [
        "set audio quality / bitrate for audio encoding",
        `(valid: ${VALIDS.bitrates})`,
      ].join("\n"),
      "320k"
    )
    .option(
      "-n, --chunks <N>",
      "number of concurrent chunk streams with which to download",
      7
    )
    .option(
      "-r, --retries <N>",
      "set number of retries for each chunk before giving up (`infinite` for infinite)",
      10
    )
    .option(
      "-t, --meta-retries <N>",
      "set number of retries for collating track feeds (`infinite` for infinite)",
      5
    )
    .option("-d, --directory <DIR>", "save tracks to DIR/..")
    .option("-c, --cover <NAME>", "custom name for the cover art", "cover.png")
    .option(
      "--cover-size <SIZE>",
      [
        "preferred cover art dimensions",
        "(format: <width>x<height> or <size> as <size>x<size>)",
      ].join("\n"),
      "640x640"
    )
    .option("-C, --no-cover", "skip saving a cover art")
    .option(
      "-x, --format <FORMAT>",
      [
        "preferred audio output format (to export) (unimplemented)",
        "(valid: mp3,m4a,flac)",
      ].join("\n"),
      "m4a"
    )
    .option(
      "-D, --downloader <SERVICE>",
      [
        "specify a preferred download source or a `,`-separated preference order",
        `(valid: ${VALIDS.downloaders})`,
      ].join("\n"),
      "yt_music"
    )
    .option(
      "-l, --filter <MATCH>",
      [
        "filter matches off patterns (repeatable and optionally `,`-separated)",
        "(value omission implies `true` if applicable)",
        '(format: <key=value>) (example: title="when we all fall asleep*",type=album)',
        "See `freyr help filter` for more information",
      ].join("\n"),
      (spec, stack) => (stack || []).concat(spec)
    )
    .option(
      "-L, --filter-case",
      "enable case sensitivity for glob matches on the filters"
    )
    .option(
      "-z, --concurrency <SPEC>",
      [
        "key-value concurrency pairs (repeatable and optionally `,`-separated)",
        "(format: <[key=]value>) (key omission implies track concurrency)",
        `(valid(key): ${VALIDS.concurrency})`,
        "(example: `queries=2,downloader=4` processes 2 CLI queries, downloads at most 4 tracks concurrently)",
      ].join("\n"),
      (spec, stack) => (stack || []).concat(spec.split(","))
    )
    .option("--gapless", "set the gapless playback flag for all tracks")
    .option("-f, --force", "force overwrite of existing files")
    .option("-o, --config <FILE>", "specify alternative configuration file")
    .option(
      "-p, --playlist <FILENAME>",
      "create playlist for all successfully collated tracks"
    )
    .option(
      "-P, --no-playlist",
      "skip creating a playlist file for collections"
    )
    .option(
      "--playlist-dir <DIR>",
      "directory to save playlist file to, if any, (default: tracks base directory)"
    )
    .option(
      "--playlist-noappend",
      "do not append to the playlist file, if any exists"
    )
    .option(
      "--playlist-noescape",
      "do not escape invalid characters within playlist entries"
    )
    .option(
      "--playlist-namespace <SPEC>",
      [
        "namespace to prefix on each track entry, relative to tracks base directory",
        "useful for, but not limited to custom (file:// or http://) entries",
        "(example, you can prefix with a HTTP domain path: `http://webpage.com/music`)",
      ].join("\n")
    )
    .option(
      "--playlist-force-append",
      "force append collection tracks to the playlist file"
    )
    .option(
      "-s, --storefront <COUNTRY>",
      "country storefront code (example: us,uk,ru)"
    )
    .option(
      "-T, --no-tree",
      "don't organise tracks in directory structure `[DIR/]<ARTIST>/<ALBUM>/<TRACK>`"
    )
    .option(
      "--tags",
      [
        "tag configuration specification (repeatable and optionally `,`-separated) (unimplemented)",
        "(format: <key=value>) (reserved keys: [exclude, account])",
      ].join("\n"),
      (spec, stack) => (stack || []).concat(spec.split(","))
    )
    .option(
      "--via-tor",
      "tunnel network traffic through the tor network (unimplemented)"
    )
    .option(
      "--cache-dir <DIR>",
      "specify alternative cache directory, `<tmp>` for tempdir"
    )
    .option(
      "-m, --mem-cache <SIZE>",
      "max size of bytes to be cached in-memory for each download chunk"
    )
    .option(
      "--no-mem-cache",
      "disable in-memory chunk caching (restricts to sequential download)"
    )
    .option("--timeout <N>", "network inactivity timeout (ms)", 10000)
    .option("--no-auth", "skip authentication procedure")
    .option("--no-browser", "disable auto-launching of user browser")
    .option("--no-net-check", "disable internet connection check")
    .option("--ffmpeg <PATH>", "explicit path to the ffmpeg binary")
    .option(
      "--atomic-parsley <PATH>",
      "explicit path to the atomic-parsley binary"
    )
    .option("--no-stats", "don't show the stats on completion")
    .option("--pulsate-bar", "show a pulsating bar")
    .option(
      "--single-bar",
      [
        "show a single bar for the download, hide chunk-view",
        "(default when number of chunks/segments exceed printable space)",
      ].join("\n")
    )
    .action((...args) => init(packageJson, ...args))
    .on("--help", () => {
      console.log("");
      console.log("Environment Variables:");
      console.log(
        "  SHOW_DEBUG_STACK             show extended debug information"
      );
      console.log(
        "  FFMPEG_PATH                  custom ffmpeg path, alternatively use `--ffmpeg`"
      );
      console.log(
        "  ATOMIC_PARSLEY_PATH          custom AtomicParsley path, alternatively use `--atomic-parsley`"
      );
      console.log("");
      console.log("Info:");
      console.log(
        "  When downloading playlists, the tracks are downloaded individually into"
      );
      console.log(
        "  their respective folders. However, a m3u8 playlist file is generated in"
      );
      console.log(
        "  the base directory with the name of the playlist that lists the tracks"
      );
    });

  program
    .command("serve", { hidden: true })
    .arguments("[port]")
    .description("Launch freyr server on an HTTP interface (unimplemented)", {
      port: "specify alternative port [default: 3797]",
    })
    .option("-b, --bind <ADDRESS>", "address to bind to")
    .option("-d, --directory <DIR>", "working directory")
    .option("-c, --config <FILE>", "configuration file")
    .option(
      "-t, --tmp <DIR>",
      "temporary directory for unprocessed artifacts",
      "<tmp>"
    )
    .option(
      "-a, --archive <WHEN>",
      "when to pack file(s) in an archive (valid: auto,always,never))",
      "auto"
    )
    .option(
      "-z, --compression [algorithm]",
      "compression algorithm to use (valid: gzip,lz4)",
      "gzip"
    )
    .option("-Z, --no-compression", "disable compression altogether")
    .option("--no-cache", "disable file caching")
    .action(() => {
      throw Error("Unimplemented: [CLI:serve]");
    });

  const program_context = program
    .command("context", { hidden: true })
    .description("Create and manage music contexts (unimplemented)")
    .action(() => {
      throw Error("Unimplemented: [CLI:context]");
    });

  program_context
    .command("new")
    .arguments("<name>")
    .description("create a new music context (unimplemented)")
    .option("-k, --pass <KEY>", "encrypted password for the context, if any")
    .option("--no-pass", "do not ask for a key to encrypt the context")
    .action(() => {
      throw Error("Unimplemented: [CLI:context new]");
    });

  program
    .command("search", { hidden: true })
    .description(
      "Search for and optionally download music interactively (unimplemented)"
    )
    .option(
      "-q, --query <PATTERN>",
      "non-interactive search filter pattern to be matched"
    )
    .option("-n, --max <MAX>", "return a maximum of MAX match results")
    .option(
      "-o, --output <FILE>",
      "save search results in a batch file for later instead of autodownload"
    )
    .option(
      "-p, --pretty",
      "include whitespaces and commented metadata in search result output"
    )
    .option(
      "-l, --filter <PATTERN>",
      "key-value constraints that all search results must match (repeatable and optionally `,`-separated)",
      (spec, stack) => (stack || []).concat(spec)
    )
    .option(
      "-L, --filter-case",
      "enable case sensitivity for glob matches on the filters (unimplemented)"
    )
    .option(
      "--profile <PROFILE>",
      "configuration context with which to process the search and download"
    )
    .action((_args, _cmd) => {
      throw Error("Unimplemented: [CLI:search]");
    })
    .on("--help", () => {
      console.log("");
      console.log("Info:");
      console.log(
        "  See `freyr help filter` for more information on constructing filter PATTERNs"
      );
      console.log("");
      console.log(
        "  Optionally, args and options provided after `--` are passed as options to the freyr download interface"
      );
      console.log(
        "  Options like `--profile` share its value with the downloader"
      );
      console.log("");
      console.log("Examples:");
      console.log(
        "  # search interactively and download afterwards with custom download flags"
      );
      console.log("  $ freyr search -- -d ~/Music");
      console.log("");
      console.log("  # search non-interactively and download afterwards");
      console.log(
        "  $ freyr search --query 'billie eilish @ type=album, title=*was older, duration=3s.., explicit=false'"
      );
      console.log("");
      console.log(
        "  # search interactively, save a maximum of 5 results to file and download later"
      );
      console.log("  $ freyr search -n 5 -o queue.txt");
      console.log("  $ freyr -i queue.txt");
    });

  const program_filter = program
    .command("filter")
    .arguments("[pattern...]")
    .description("Process filter patterns to preview JSON representation")
    .option("-c, --condensed", "condense JSON output", false)
    .action((patterns, args) => {
      if (!patterns.length) return program_filter.outputHelp();
      console.log(
        JSON.stringify(
          patterns.map(parseSearchFilter),
          null,
          args.condensed ? 0 : 2
        )
      );
    })
    .on("--help", () => {
      console.log("");
      console.log("Format:");
      console.log("  [query@]key1=value,key2=value");
      console.log("");
      console.log(
        '  > testquery@key1=value1,key2 = some value2, key3=" some value3 "'
      );
      console.log("  is equivalent to");
      console.log(`  > {
  >   "query": "testquery",
  >   "filters": {
  >     "key1": "value1",
  >     "key2": "some value2",
  >     "key3": " some value3 "
  >   }
  > }`);
      console.log("");
      console.log("  A pattern is a query-filter pair separated by `@`");
      console.log(
        "  Wherever the query is absent, `*` is implied, matching all (although discouraged)"
      );
      console.log(
        "  The filter is a string of key-value constraints separated by `,`"
      );
      console.log(
        "  The key and value constraints themselves are separated by `=`"
      );
      console.log("  Filter values can also be wildcard matches");
      console.log(
        "  Whitespacing is optional as well as using (\" or ') for strings"
      );
      console.log("");
      console.log("  Use {} to escape either of these reserved delimiters");
      console.log(
        '  ({@} for @) ({,} for ,) ({=} for =) ({{}} for {}) ({"} for ") etc.'
      );
      console.log("");
      console.log("Examples:");
      console.log(
        "  # match anything starting with 'Justi' and ending with 'ber'"
      );
      console.log("  $ freyr filter 'Justi*ber'");
      console.log("");
      console.log(
        "  # filter artists matching the name 'Dua Lipa' and any album with 9 or more tracks from 'Billie Eilish'"
      );
      console.log(
        "  $ freyr filter artist=\"Dua Lipa\" 'artist = Billie Eilish, type = album, ntracks = 9..'"
      );
      console.log("");
      console.log(
        "  # filter non-explicit tracks from 'Billie Eilish' ending with 'To Die'"
      );
      console.log("  # whose duration is between 1:30 and 3:00 minutes");
      console.log(
        "  $ freyr filter 'artist = Billie Eilish, title = *To Die, duration = 1:30..3:00, explicit = false'"
      );
    });

  const config = program
    .command("profile", { hidden: true })
    .description(
      "Manage profile configuration contexts storing persistent user configs and auth keys (unimplemented)"
    )
    .on("--help", () => {
      console.log("");
      console.log("Examples:");
      console.log("  $ freyr -q profile new test");
      console.log("    ? Enter an encryption key: **********");
      console.log("  /home/miraclx/.config/FreyrCLI/test.x4p");
      console.log("");
      console.log("  # unless unencrypted, will ask to decrypt profile");
      console.log("  $ freyr -q --profile test deezer:playlist:1963962142");
      console.log("    ? Enter an encryption key: **********");
      console.log("  [...]");
    });
  config
    .command("new")
    .arguments("<name>")
    .description("create a new profile context (unimplemented)")
    .option("-k, --pass <KEY>", "encrypted password for the new profile")
    .option("--no-pass", "do not ask for a key to encrypt the config")
    .action(() => {
      throw Error("Unimplemented: [CLI:profiles new]");
    });
  config
    .command("get")
    .arguments("<name>")
    .description(
      "return the raw configuration content for the profile, decrypts if necessary (unimplemented)"
    )
    .option("-k, --pass <KEY>", "encrypted password for the profile, if any")
    .option(
      "-p, --pretty [SPEC]",
      "pretty print the JSON output. (key omission implies space indentation)\n(format(SPEC): <[key=]value>) (valid(key): space,tab)",
      "space=2"
    )
    .action(() => {
      throw Error("Unimplemented: [CLI:profiles get]");
    });
  config
    .command("remove")
    .alias("rm")
    .arguments("<name>")
    .description(
      "deletes the profile context, decrypts if necessary (unimplemented)"
    )
    .option("-k, --pass <KEY>", "encrypted password for the profile, if any")
    .action(() => {
      throw Error("Unimplemented: [CLI:profiles reset]");
    });
  config
    .command("reset")
    .alias("rs")
    .arguments("<name>")
    .description(
      "resets the profile context, decrypts if necessary (unimplemented)"
    )
    .option("-k, --pass <KEY>", "encrypted password for the profile, if any")
    .action(() => {
      throw Error("Unimplemented: [CLI:profiles reset]");
    });
  config
    .command("unset")
    .alias("un")
    .arguments("<name> <field>")
    .description(
      "unsets a field within the profile context, decrypts if necessary (unimplemented)"
    )
    .option("-k, --pass <KEY>", "encrypted password for the profile, if any")
    .action(() => {
      throw Error("Unimplemented: [CLI:profiles unset]");
    });
  config
    .command("list")
    .alias("ls")
    .description("list all available profiles (unimplemented)")
    .option("--raw", "return raw JSON output")
    .action(() => {
      throw Error("Unimplemented: [CLI:profiles list]");
    });

  program
    .command("urify")
    .arguments("[urls...]")
    .description("Convert service URLs to uniform freyr compatible URIs")
    .option("-u, --url", "unify output in service-specific URL representations")
    .option(
      "-i, --input <FILE>",
      [
        "get URLs from a batch file, comments with `#` are expunged",
        "`-` reads from stdin, if unpiped, drops to interactive (Ctrl+D to exit)",
        "if piped, stdin has preference over FILE",
      ].join("\n")
    )
    .option("-o, --output <FILE>", "write to file as opposed to stdout")
    .option("-t, --no-tag", "skip comments with info or meta for each entry")
    .action(async (urls, args) => {
      const output = args.output
        ? fs.createWriteStream(args.output)
        : process.stdout;
      // eslint-disable-next-line no-shadow
      async function urify(urls) {
        urls.forEach((url) => {
          const parsed = FreyrCore.parseURI(url);
          const uri = parsed && parsed[args.url ? "url" : "uri"];
          if (args.tag)
            !uri
              ? output.write(`# invalid: ${url}\n`)
              : output.write(`# ${url}\n`);
          if (!uri) return;
          output.write(`${uri}\n`);
        });
      }
      if (urls.length === 0 && process.stdin.isTTY && !args.input)
        args.input = "-";
      await urify(urls)
        .then(async () => {
          if (
            (process.stdin.isTTY && args.input !== "-") ||
            !process.stdin.isTTY
          )
            await urify(
              await PROCESS_INPUT_ARG(!process.stdin.isTTY ? "-" : args.input)
            );
          else if (process.stdin.isTTY && args.input === "-") {
            console.log("\x1b[32m[\u2022]\x1b[0m Stdin tty open");
            await new Promise((res, rej) =>
              process.stdin
                .on("data", (data) =>
                  urify(PARSE_INPUT_LINES([data.toString()]))
                )
                .on("error", rej)
                .on("close", res)
            );
          }
        })
        .then(() => {
          console.log("\x1b[32m[+]\x1b[0m Urify complete");
          if (args.output)
            console.log(`Successfully written to [${args.output}]`);
          if (output !== process.stdout) output.end();
        });
    })
    .on("--help", () => {
      console.log("");
      console.log("Examples:");
      console.log(
        "  $ freyr -q urify -t https://open.spotify.com/album/2D23kwwoy2JpZVuJwzE42B"
      );
      console.log("  spotify:album:2D23kwwoy2JpZVuJwzE42B");
      console.log("");
      console.log(
        "  $ freyr -q urify -t https://music.apple.com/us/album/say-so-feat-nicki-minaj/1510821672?i=1510821685"
      );
      console.log("  apple_music:track:1510821685");
      console.log("");
      console.log(
        [
          "  $ echo https://www.deezer.com/en/artist/5340439 \\",
          "         https://music.apple.com/us/playlist/todays-hits/pl.f4d106fed2bd41149aaacabb233eb5eb \\",
          "      | freyr -q urify -t",
        ].join("\n")
      );
      console.log("  deezer:artist:5340439");
      console.log("  apple_music:playlist:pl.f4d106fed2bd41149aaacabb233eb5eb");
    });

  return program;
}

export async function main(argv) {
  let { program } = prepCli(packageJson);

  try {
    await program.parseAsync(argv);
  } catch (err) {
    console.error(
      `\x1b[31m[!] Fatal Error\x1b[0m: ${
        typeof err === "undefined"
          ? "[uncaught]"
          : err
          ? err["SHOW_DEBUG_STACK" in process.env ? "stack" : "message"]
          : err
      }`
    );
  }
} */
