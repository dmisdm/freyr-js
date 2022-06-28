"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _Spotify_store, _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-underscore-dangle, class-methods-use-this */
const bluebird_1 = __importDefault(require("bluebird"));
const node_cache_1 = __importDefault(require("node-cache"));
const spotifyUri = __importStar(require("spotify-uri"));
const spotify_web_api_node_1 = __importDefault(require("spotify-web-api-node"));
const symbols_js_1 = __importDefault(require("../symbols.js"));
const validUriTypes = ['track', 'album', 'artist', 'playlist'];
class Spotify {
    constructor(config, authServer, serverOpts) {
        this[_b] = Spotify[symbols_js_1.default.meta];
        _Spotify_store.set(this, {
            core: null,
            AuthServer: null,
            serverOpts: null,
            cache: new node_cache_1.default(),
            expiry: null,
            isAuthenticated: false,
        });
        if (!config)
            throw new Error(`[Spotify] Please define a configuration object`);
        if (typeof config !== 'object')
            throw new Error(`[Spotify] Please define a configuration as an object`);
        if (!config.clientId)
            throw new Error(`[Spotify] Please define [clientId] as a property within the configuration`);
        if (!config.clientSecret)
            throw new Error(`[Spotify] Please define [clientSecret] as a property within the configuration`);
        [__classPrivateFieldGet(this, _Spotify_store, "f").AuthServer, __classPrivateFieldGet(this, _Spotify_store, "f").serverOpts] = [authServer, serverOpts];
        __classPrivateFieldGet(this, _Spotify_store, "f").core = new spotify_web_api_node_1.default({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            refreshToken: config.refreshToken,
        });
    }
    loadConfig(config) {
        if (config.expiry)
            __classPrivateFieldGet(this, _Spotify_store, "f").expiry = config.expiry;
        if (config.access_token)
            __classPrivateFieldGet(this, _Spotify_store, "f").core.setAccessToken(config.access_token);
        if (config.refresh_token)
            __classPrivateFieldGet(this, _Spotify_store, "f").core.setRefreshToken(config.refresh_token);
    }
    hasOnceAuthed() {
        return __classPrivateFieldGet(this, _Spotify_store, "f").isAuthenticated;
    }
    accessTokenIsValid() {
        return Date.now() < __classPrivateFieldGet(this, _Spotify_store, "f").expiry;
    }
    isAuthed() {
        return this.accessTokenIsValid();
    }
    newAuth() {
        const server = new (__classPrivateFieldGet(this, _Spotify_store, "f").AuthServer)({ ...__classPrivateFieldGet(this, _Spotify_store, "f").serverOpts, serviceName: 'Spotify' });
        __classPrivateFieldGet(this, _Spotify_store, "f").core.setRedirectURI(server.getRedirectURL());
        const scope = ['user-read-private', 'user-read-email'];
        const authCode = bluebird_1.default.resolve(server.getCode());
        return {
            getUrl: server.init(state => __classPrivateFieldGet(this, _Spotify_store, "f").core.createAuthorizeURL(scope, state)),
            userToAuth: async () => {
                const code = await authCode;
                const data = await __classPrivateFieldGet(this, _Spotify_store, "f").core.authorizationCodeGrant(code);
                this.setExpiry(data.body.expires_in);
                __classPrivateFieldGet(this, _Spotify_store, "f").core.setRefreshToken(data.body.refresh_token);
                __classPrivateFieldGet(this, _Spotify_store, "f").core.setAccessToken(data.body.access_token);
                __classPrivateFieldGet(this, _Spotify_store, "f").isAuthenticated = true;
                return { refresh_token: data.body.refresh_token, expiry: __classPrivateFieldGet(this, _Spotify_store, "f").expiry };
            },
        };
    }
    setExpiry(expiry) {
        __classPrivateFieldGet(this, _Spotify_store, "f").expiry = Date.now() + expiry * 1000;
    }
    canTryLogin() {
        return !!__classPrivateFieldGet(this, _Spotify_store, "f").core.getRefreshToken();
    }
    hasProps() {
        return __classPrivateFieldGet(this, _Spotify_store, "f").isAuthenticated;
    }
    getProps() {
        return {
            expiry: __classPrivateFieldGet(this, _Spotify_store, "f").expiry,
            access_token: __classPrivateFieldGet(this, _Spotify_store, "f").core.getAccessToken(),
            refresh_token: __classPrivateFieldGet(this, _Spotify_store, "f").core.getRefreshToken(),
        };
    }
    async login(config) {
        if (config)
            this.loadConfig(config);
        if (!this.accessTokenIsValid()) {
            const data = await __classPrivateFieldGet(this, _Spotify_store, "f").core.refreshAccessToken();
            __classPrivateFieldGet(this, _Spotify_store, "f").core.setAccessToken(data.body.access_token);
            this.setExpiry(data.body.expires_in);
        }
        return (__classPrivateFieldGet(this, _Spotify_store, "f").isAuthenticated = true);
    }
    validateType(uri) {
        const { type } = spotifyUri.parse(uri);
        if (!['local', ...validUriTypes].includes(type))
            throw new Error(`Spotify URI type [${type}] is invalid.`);
        return uri;
    }
    identifyType(uri) {
        return this.parseURI(uri).type;
    }
    parseURI(uri) {
        const parsed = spotifyUri.parse(this.validateType(uri));
        parsed.url = spotifyUri.formatOpenURL(parsed);
        return parsed;
    }
    wrapTrackMeta(trackInfo, albumInfo = trackInfo.album) {
        return trackInfo
            ? {
                id: trackInfo.id,
                uri: trackInfo.uri,
                link: trackInfo.external_urls.spotify,
                name: trackInfo.name,
                artists: trackInfo.artists.map(artist => artist.name),
                album: albumInfo.name,
                album_uri: albumInfo.uri,
                album_type: albumInfo.type,
                images: albumInfo.images,
                duration: trackInfo.duration_ms,
                album_artist: albumInfo.artists[0],
                track_number: trackInfo.track_number,
                total_tracks: albumInfo.ntracks,
                release_date: albumInfo.release_date,
                disc_number: trackInfo.disc_number,
                contentRating: trackInfo.explicit === true ? 'explicit' : 'clean',
                isrc: (trackInfo.external_ids || {}).isrc,
                genres: albumInfo.genres,
                label: albumInfo.label,
                copyrights: albumInfo.copyrights,
                composers: null,
                compilation: albumInfo.type === 'compilation',
                getImage: albumInfo.getImage,
            }
            : null;
    }
    wrapAlbumData(albumObject) {
        return albumObject
            ? {
                id: albumObject.id,
                uri: albumObject.uri,
                name: albumObject.name,
                artists: albumObject.artists.map(artist => artist.name),
                type: albumObject.artists[0].id === '0LyfQWJT6nXafLPZqxe9Of' ? 'compilation' : albumObject.album_type,
                genres: albumObject.genres,
                copyrights: albumObject.copyrights,
                images: albumObject.images,
                label: albumObject.label,
                release_date: new Date(albumObject.release_date),
                ntracks: albumObject.total_tracks,
                tracks: albumObject.tracks.items,
                getImage(width, height) {
                    const { images } = albumObject;
                    return images
                        .sort((a, b) => (a.width > b.width && a.height > b.height ? 1 : -1))
                        .find((image, index) => index === images.length - 1 || (image.height >= height && image.width >= width)).url;
                },
            }
            : null;
    }
    wrapArtistData(artistObject) {
        return artistObject
            ? {
                id: artistObject.id,
                uri: artistObject.uri,
                name: artistObject.name,
                genres: artistObject.genres,
                nalbum: null,
                followers: artistObject.followers.total,
            }
            : null;
    }
    wrapPlaylistData(playlistObject) {
        return playlistObject
            ? {
                id: playlistObject.id,
                uri: playlistObject.uri,
                name: playlistObject.name,
                followers: playlistObject.followers.total,
                description: playlistObject.description,
                owner_id: playlistObject.owner.id,
                owner_name: playlistObject.owner.display_name,
                type: `${playlistObject.public ? 'Public' : 'Private'}${playlistObject.collaborative ? ' (Collaborative)' : ''}`,
                ntracks: playlistObject.tracks.total,
                tracks: playlistObject.tracks.items.map(item => item.track),
            }
            : null;
    }
    async processData(uris, max, coreFn) {
        const wasArr = Array.isArray(uris);
        uris = (wasArr ? uris : [uris]).map(uri => {
            const parsedURI = this.parseURI(uri);
            uri = spotifyUri.formatURI(parsedURI);
            if (parsedURI.type === 'local')
                return [, { [symbols_js_1.default.errorStack]: { code: 1, uri } }];
            return [parsedURI.id, __classPrivateFieldGet(this, _Spotify_store, "f").cache.get(uri)];
        });
        const ids = uris.filter(([, value]) => !value).map(([id]) => id);
        uris = Object.fromEntries(uris);
        if (ids.length)
            (await bluebird_1.default.mapSeries(((f, c) => ((c = Math.min(c, f.length)), [...Array(Math.ceil(f.length / c))].map((_, i) => f.slice(i * c, i * c + c))))(ids, max || Infinity), coreFn))
                .flat(1)
                .forEach(item => (!item ? null : (__classPrivateFieldGet(this, _Spotify_store, "f").cache.set(item.uri, item), (uris[item.id] = item))));
        const ret = Object.values(uris);
        return !wasArr ? ret[0] : ret;
    }
    async getTrack(uris, country) {
        return this.processData(uris, 50, async (ids) => {
            const tracks = (await __classPrivateFieldGet(this, _Spotify_store, "f").core.getTracks(ids, { market: country })).body.tracks.filter(Boolean);
            await this.getAlbum(tracks.map(track => track.album.uri), country);
            return bluebird_1.default.mapSeries(tracks, async (track) => this.wrapTrackMeta(track, await this.getAlbum(track.album.uri, country)));
        });
    }
    async getAlbum(uris, country) {
        return this.processData(uris, 20, async (ids) => bluebird_1.default.mapSeries((await __classPrivateFieldGet(this, _Spotify_store, "f").core.getAlbums(ids, { market: country })).body.albums, async (album) => this.wrapAlbumData(album)));
    }
    async getAlbumTracks(uri, country) {
        return this.getTrack((await this.getAlbum(uri, country)).tracks.map(item => item.uri));
    }
    async getArtist(uris) {
        return this.processData(uris, 50, async (ids) => bluebird_1.default.mapSeries((await __classPrivateFieldGet(this, _Spotify_store, "f").core.getArtists(ids)).body.artists, async (artist) => this.wrapArtistData(artist)));
    }
    async getPlaylist(uri, country) {
        const parsedURI = this.parseURI(uri);
        uri = spotifyUri.formatURI(parsedURI);
        if (!__classPrivateFieldGet(this, _Spotify_store, "f").cache.has(uri))
            __classPrivateFieldGet(this, _Spotify_store, "f").cache.set(uri, this.wrapPlaylistData((await __classPrivateFieldGet(this, _Spotify_store, "f").core.getPlaylist(parsedURI.id, { market: country })).body));
        return __classPrivateFieldGet(this, _Spotify_store, "f").cache.get(uri);
    }
    async getPlaylistTracks(uri, country) {
        const { id } = this.parseURI(uri);
        return this.getTrack((await this._gatherCompletely((offset, limit) => __classPrivateFieldGet(this, _Spotify_store, "f").core.getPlaylistTracks(id, { offset, limit, market: country }), { offset: 0, limit: 50, sel: 'items' }))
            .filter(item => !!(item.track && item.track.name))
            .map(item => item.track.uri), country);
    }
    async getArtistAlbums(uri, country) {
        const { id } = this.parseURI(uri);
        uri = `spotify:artist_albums:${id}`;
        if (!__classPrivateFieldGet(this, _Spotify_store, "f").cache.has(uri))
            __classPrivateFieldGet(this, _Spotify_store, "f").cache.set(uri, await this.getAlbum((await this._gatherCompletely((offset, limit) => __classPrivateFieldGet(this, _Spotify_store, "f").core.getArtistAlbums(id, { offset, limit, country, include_groups: 'album,single,compilation' }), { offset: 0, limit: 50, sel: 'items' }))
                .filter(item => item.name)
                .map(album => album.uri), country));
        return __classPrivateFieldGet(this, _Spotify_store, "f").cache.get(uri);
    }
    async checkIsActivelyListening() {
        return (await __classPrivateFieldGet(this, _Spotify_store, "f").core.getMyCurrentPlaybackState()).statusCode !== '204';
    }
    async getActiveTrack() {
        return __classPrivateFieldGet(this, _Spotify_store, "f").core.getMyCurrentPlayingTrack();
    }
    async _gatherCompletely(fn, { offset, limit, sel } = {}) {
        const { body } = await fn(offset, limit);
        if (body.next)
            body[sel].push(...(await this._gatherCompletely(fn, { offset: offset + body.limit, limit, sel })));
        return body[sel];
    }
}
exports.default = Spotify;
_Spotify_store = new WeakMap(), _a = symbols_js_1.default.meta, _b = symbols_js_1.default.meta;
Spotify[_a] = {
    ID: 'spotify',
    DESC: 'Spotify',
    PROPS: {
        isQueryable: true,
        isSearchable: false,
        isSourceable: false,
    },
    // https://www.debuggex.com/r/DgqrkwF-9XXceZ1x
    VALID_URL: /(?:(?:(?:https?:\/\/)?(?:www\.)?)(?:(?:(?:open|play|embed)\.)spotify.com)\/(?:artist|track|album|playlist)\/(?:[0-9A-Za-z]{22}))|(?:spotify:(?:artist|track|album|playlist):(?:[0-9A-Za-z]{22}))/,
    PROP_SCHEMA: {
        expiry: { type: 'integer' },
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
    },
};
