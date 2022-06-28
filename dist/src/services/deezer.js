"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _DeezerCore_validatorData, _DeezerCore_retrySymbol, _DeezerCore_getIfHasError, _DeezerCore_sendRequest, _Deezer_store, _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeezerCore = void 0;
/* eslint-disable camelcase, no-underscore-dangle, class-methods-use-this, max-classes-per-file */
const url_1 = __importDefault(require("url"));
const path_1 = __importDefault(require("path"));
const got_1 = __importDefault(require("got"));
const node_cache_1 = __importDefault(require("node-cache"));
const symbols_js_1 = __importDefault(require("../symbols.js"));
const async_queue_js_1 = __importDefault(require("../async_queue.js"));
const validUriTypes = ['track', 'album', 'artist', 'playlist'];
class WebapiError extends Error {
    constructor(message, statusCode, status) {
        super(message);
        if (status)
            this.status = status;
        if (statusCode)
            this.statusCode = statusCode;
    }
}
const sleep = ms => new Promise(res => setTimeout(res, ms));
class DeezerCore {
    constructor() {
        this.legacyApiUrl = 'https://api.deezer.com';
        this.requestObject = got_1.default.extend({
            responseType: 'json',
            searchParams: { output: 'json' },
        });
        _DeezerCore_validatorData.set(this, { expires: 0, queries: [] });
        _DeezerCore_retrySymbol.set(this, Symbol('DeezerCoreTrialCount'));
        _DeezerCore_getIfHasError.set(this, response => response.body && typeof response.body === 'object' && 'error' in response.body && response.body.error);
        this.validatorQueue = new async_queue_js_1.default('validatorQueue', 1, async (now) => {
            if (__classPrivateFieldGet(this, _DeezerCore_validatorData, "f").queries.length === 50)
                await sleep(__classPrivateFieldGet(this, _DeezerCore_validatorData, "f").expires - Date.now()).then(() => Promise.all(__classPrivateFieldGet(this, _DeezerCore_validatorData, "f").queries));
            if (__classPrivateFieldGet(this, _DeezerCore_validatorData, "f").expires <= (now = Date.now()))
                __classPrivateFieldSet(this, _DeezerCore_validatorData, { expires: now + 5000, queries: [] }, "f");
            return new Promise(res => __classPrivateFieldGet(this, _DeezerCore_validatorData, "f").queries.push(new Promise(res_ => res(res_))));
        });
        _DeezerCore_sendRequest.set(this, async (ref, opts, retries) => {
            retries = typeof retries === 'object' ? retries : { prior: 0, remaining: retries };
            const ticketFree = await this.validatorQueue[retries.prior === 0 ? 'push' : 'unshift']();
            return this.requestObject
                .get(ref, {
                prefixUrl: this.legacyApiUrl,
                searchParams: opts,
            })
                .finally(ticketFree)
                .then((response, error) => {
                if ((error = __classPrivateFieldGet(this, _DeezerCore_getIfHasError, "f").call(this, response)) && error.code === 4 && error.message === 'Quota limit exceeded') {
                    error[__classPrivateFieldGet(this, _DeezerCore_retrySymbol, "f")] = retries.prior + 1;
                    if (retries.remaining > 1)
                        return __classPrivateFieldGet(this, _DeezerCore_sendRequest, "f").call(this, ref, opts, { prior: retries.prior + 1, remaining: retries.remaining - 1 });
                }
                return response;
            });
        });
        this.totalTrials = 5;
        this.getTrack = this.processID(id => `track/${id}`);
        this.getAlbum = this.processID(id => `album/${id}`);
        this.getArtist = this.processID(id => `artist/${id}`);
        this.getPlaylist = this.processID(id => `playlist/${id}`);
        this.getAlbumTracks = this.processList((id, opts) => this.getAlbum(`${id}/tracks`, opts));
        this.getArtistAlbums = this.processList((id, opts) => this.getArtist(`${id}/albums`, opts));
        this.getPlaylistTracks = this.processList((id, opts) => this.getPlaylist(`${id}/tracks`, opts));
    }
    async legacyApiCall(ref, opts) {
        const response = await __classPrivateFieldGet(this, _DeezerCore_sendRequest, "f").call(this, ref, opts, this.totalTrials || 5).catch(err => {
            throw new WebapiError(`${err.syscall ? `${err.syscall} ` : ''}${err.code} ${err.hostname || err.host}`, err.response ? err.response.statusCode : null);
        });
        let error;
        if ((error = __classPrivateFieldGet(this, _DeezerCore_getIfHasError, "f").call(this, response))) {
            const err = new WebapiError(`${error.code} [${error.type}]: ${error.message}`, null, error.code);
            if (error[__classPrivateFieldGet(this, _DeezerCore_retrySymbol, "f")])
                err[__classPrivateFieldGet(this, _DeezerCore_retrySymbol, "f")] = error[__classPrivateFieldGet(this, _DeezerCore_retrySymbol, "f")];
            throw err;
        }
        return response.body;
    }
    processID(gnFn) {
        return (id, opts) => this.legacyApiCall(gnFn(id), opts);
    }
    processList(gnFn) {
        const wrapPagination = (id, wrpFnx, pagedURL, opts) => pagedURL
            ? () => wrpFnx(id, (({ index, limit }) => ({ index, limit: limit || opts.limit }))(url_1.default.parse(pagedURL, true).query))
            : null;
        const decoyProcessor = async (id, opts = {}) => {
            const itemObject = await gnFn(id, { index: opts.index || 0, limit: Math.min(opts.limit, 300) || 300 });
            itemObject.next = wrapPagination(id, decoyProcessor, itemObject.next, opts);
            itemObject.prev = wrapPagination(id, decoyProcessor, itemObject.prev, opts);
            return itemObject;
        };
        return decoyProcessor;
    }
}
exports.DeezerCore = DeezerCore;
_DeezerCore_validatorData = new WeakMap(), _DeezerCore_retrySymbol = new WeakMap(), _DeezerCore_getIfHasError = new WeakMap(), _DeezerCore_sendRequest = new WeakMap();
class Deezer {
    constructor(config) {
        this[_b] = Deezer[symbols_js_1.default.meta];
        _Deezer_store.set(this, {
            core: new DeezerCore(),
            cache: new node_cache_1.default(),
        });
        this.trackQueue = new async_queue_js_1.default('deezer:trackQueue', 4, this.createDataProcessor(async (id) => {
            const track = await __classPrivateFieldGet(this, _Deezer_store, "f").core.getTrack(id);
            return this.wrapTrackMeta(track, await this.getAlbum(`deezer:album:${track.album.id}`));
        }));
        this.albumQueue = new async_queue_js_1.default('deezer:albumQueue', 4, this.createDataProcessor(async (id) => this.wrapAlbumData(await __classPrivateFieldGet(this, _Deezer_store, "f").core.getAlbum(id))));
        this.artistQueue = new async_queue_js_1.default('deezer:artistQueue', 4, this.createDataProcessor(async (id) => this.wrapArtistData(await __classPrivateFieldGet(this, _Deezer_store, "f").core.getArtist(id))));
        this.playlistQueue = new async_queue_js_1.default('deezer:playlistQueue', 4, this.createDataProcessor(async (id) => this.wrapPlaylistData(await __classPrivateFieldGet(this, _Deezer_store, "f").core.getPlaylist(id, { limit: 1 }))));
        if (config && 'retries' in config)
            __classPrivateFieldGet(this, _Deezer_store, "f").core.totalTrials = config.retries + 1;
    }
    loadConfig(_config) { }
    hasOnceAuthed() {
        throw Error('Unimplemented: [Deezer:hasOnceAuthed()]');
    }
    isAuthed() {
        return true;
    }
    newAuth() {
        throw Error('Unimplemented: [Deezer:newAuth()]');
    }
    canTryLogin() {
        return true;
    }
    hasProps() {
        return false;
    }
    getProps() {
        throw Error('Unimplemented: [Deezer:getProps()]');
    }
    async login() {
        throw Error('Unimplemented: [Deezer:login()]');
    }
    validateType(uri) {
        const { type } = this.identifyType(uri);
        return type in validUriTypes;
    }
    identifyType(uri) {
        return this.parseURI(uri).type;
    }
    parseURI(uri) {
        const match = uri.match(Deezer[symbols_js_1.default.meta].VALID_URL);
        if (!match)
            return null;
        const isURI = !!match[3];
        const parsedURL = url_1.default.parse(uri, true);
        const id = isURI ? match[4] : path_1.default.basename(parsedURL.pathname);
        const type = match[isURI ? 3 : 1];
        return { id, type, uri: `deezer:${type}:${id}` };
    }
    wrapTrackMeta(trackInfo, albumInfo = {}) {
        return {
            id: trackInfo.id,
            uri: `deezer:track:${trackInfo.id}`,
            link: trackInfo.link,
            name: trackInfo.title,
            artists: [trackInfo.artist.name],
            album: albumInfo.name,
            album_uri: `deezer:album:${albumInfo.id}`,
            album_type: albumInfo.type,
            images: albumInfo.images,
            duration: trackInfo.duration * 1000,
            album_artist: albumInfo.artists[0],
            track_number: trackInfo.track_position,
            total_tracks: albumInfo.ntracks,
            release_date: new Date(trackInfo.release_date),
            disc_number: trackInfo.disk_number,
            contentRating: !!trackInfo.explicit_lyrics,
            isrc: trackInfo.isrc,
            genres: albumInfo.genres,
            label: albumInfo.label,
            copyrights: albumInfo.copyrights,
            composers: trackInfo.contributors.map(composer => composer.name).join(', '),
            compilation: albumInfo.type === 'compilation',
            getImage: albumInfo.getImage,
        };
    }
    wrapAlbumData(albumObject) {
        const artistObject = albumObject.artist || {};
        return {
            id: albumObject.id,
            uri: albumObject.link,
            name: albumObject.title,
            artists: [artistObject.name],
            type: artistObject.name === 'Various Artists' && artistObject.id === 5080
                ? 'compilation'
                : albumObject.record_type === 'single'
                    ? 'single'
                    : 'album',
            genres: ((albumObject.genres || {}).data || []).map(genre => genre.name),
            copyrights: [{ type: 'P', text: albumObject.copyright }],
            images: [albumObject.cover_small, albumObject.cover_medium, albumObject.cover_big, albumObject.cover_xl],
            label: albumObject.label,
            release_date: new Date(albumObject.release_date),
            ntracks: albumObject.nb_tracks,
            tracks: albumObject.tracks,
            getImage(width, height) {
                const min = (val, max) => Math.min(max, val) || max;
                return this.images
                    .slice()
                    .pop()
                    .replace(/(?<=.+\/)\d+x\d+(?=.+$)/g, `${min(width, 1800)}x${min(height, 1800)}`);
            },
        };
    }
    wrapArtistData(artistObject) {
        return {
            id: artistObject.id,
            uri: artistObject.link,
            name: artistObject.name,
            genres: null,
            nalbum: artistObject.nb_album,
            followers: artistObject.nb_fan,
        };
    }
    wrapPlaylistData(playlistObject) {
        return {
            id: playlistObject.id,
            uri: playlistObject.link,
            name: playlistObject.title,
            followers: playlistObject.fans,
            description: playlistObject.description,
            owner_id: playlistObject.creator.id,
            owner_name: playlistObject.creator.name,
            type: `${playlistObject.public ? 'Public' : 'Private'}${playlistObject.collaborative ? ' (Collaborative)' : ''}`,
            ntracks: playlistObject.nb_tracks,
            tracks: playlistObject.tracks,
        };
    }
    createDataProcessor(coreFn) {
        return async (uri) => {
            const parsed = this.parseURI(uri);
            if (!__classPrivateFieldGet(this, _Deezer_store, "f").cache.has(parsed.uri))
                __classPrivateFieldGet(this, _Deezer_store, "f").cache.set(parsed.uri, await coreFn(parsed.id));
            return __classPrivateFieldGet(this, _Deezer_store, "f").cache.get(parsed.uri);
        };
    }
    async getTrack(uris) {
        return this.trackQueue.push(uris);
    }
    async getAlbum(uris) {
        return this.albumQueue.push(uris);
    }
    async getArtist(uris) {
        return this.artistQueue.push(uris);
    }
    async getPlaylist(uris) {
        return this.playlistQueue.push(uris);
    }
    async getAlbumTracks(uri) {
        const album = await this.getAlbum(uri);
        return this.trackQueue.push(album.tracks.data.map(track => track.link));
    }
    async getArtistAlbums(uris) {
        const artist = await this.getArtist(uris);
        return this.wrapPagination(() => __classPrivateFieldGet(this, _Deezer_store, "f").core.getArtistAlbums(artist.id, { limit: Math.min(artist.nalbum, Math.max(300, artist.nalbum / 4)) }), data => this.albumQueue.push(data.map(album => album.link)));
    }
    async getPlaylistTracks(uri) {
        const playlist = await this.getPlaylist(uri);
        return this.wrapPagination(() => __classPrivateFieldGet(this, _Deezer_store, "f").core.getPlaylistTracks(playlist.id, { limit: Math.min(playlist.ntracks, Math.max(300, playlist.ntracks / 4)) }), data => this.trackQueue.push(data.map(track => track.link)));
    }
    async wrapPagination(genFn, processor) {
        const collateAllPages = async (px) => {
            const page = await px();
            if (page.next)
                page.data.push(...(await collateAllPages(page.next)));
            return page.data;
        };
        const results = await collateAllPages(genFn);
        return processor ? processor(results) : results;
    }
}
exports.default = Deezer;
_Deezer_store = new WeakMap(), _a = symbols_js_1.default.meta, _b = symbols_js_1.default.meta;
Deezer[_a] = {
    ID: 'deezer',
    DESC: 'Deezer',
    PROPS: {
        isQueryable: true,
        isSearchable: false,
        isSourceable: false,
    },
    // https://www.debuggex.com/r/IuFIxSZGFJ07tOkR
    VALID_URL: /(?:(?:(?:https?:\/\/)?(?:www\.)?)deezer.com(?:\/[a-z]{2})?\/(track|album|artist|playlist)\/(.+))|(?:deezer:(track|album|artist|playlist):(.+))/,
    PROP_SCHEMA: {},
};
