"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable consistent-return */
const lodash_1 = __importDefault(require("lodash"));
const symbols_js_1 = __importDefault(require("./symbols.js"));
const youtube_js_1 = require("./services/youtube.js");
const deezer_js_1 = __importDefault(require("./services/deezer.js"));
const spotify_js_1 = __importDefault(require("./services/spotify.js"));
const apple_music_js_1 = __importDefault(require("./services/apple_music.js"));
class FreyrCore {
    constructor(ServiceConfig, AuthServer, serverOpts) {
        this.identifyService = FreyrCore.identifyService;
        this.collateSources = FreyrCore.collateSources;
        this.sortSources = FreyrCore.sortSources;
        ServiceConfig = ServiceConfig || {};
        this.ENGINES = FreyrCore.ENGINES.map(Engine => new Engine(ServiceConfig[Engine[symbols_js_1.default.meta].ID], AuthServer, serverOpts));
    }
    static getBitrates() {
        return Array.from(new Set(this.ENGINES.reduce((stack, engine) => stack.concat(engine[symbols_js_1.default.meta].BITRATES || []), []))).sort((a, b) => (typeof a === 'string' || a > b ? 1 : -1));
    }
    static getEngineMetas(ops) {
        return this.ENGINES.map(engine => (ops || (v => v))(engine[symbols_js_1.default.meta]));
    }
    static identifyService(content) {
        return this.ENGINES.find(engine => engine[symbols_js_1.default.meta].PROPS.isQueryable ? content.match(engine[symbols_js_1.default.meta].VALID_URL) : undefined);
    }
    static collateSources() {
        return this.ENGINES.filter(engine => engine[symbols_js_1.default.meta].PROPS.isSourceable);
    }
    static sortSources(order) {
        order = order ? (Array.isArray(order) ? order : [order]) : [];
        return lodash_1.default.sortBy(this.collateSources(), source => (index => (index < 0 ? Infinity : index))(order.indexOf(source[symbols_js_1.default.meta].ID)));
    }
    static parseURI(url) {
        const service = this.identifyService(url);
        if (!service)
            return null;
        return service.prototype.parseURI.call(service.prototype, url);
    }
}
exports.default = FreyrCore;
FreyrCore.ENGINES = [deezer_js_1.default, spotify_js_1.default, apple_music_js_1.default, youtube_js_1.YouTube, youtube_js_1.YouTubeMusic];
