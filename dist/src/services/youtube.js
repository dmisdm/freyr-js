"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _YouTubeMusic_store, _YouTubeMusic_request, _YouTubeMusic_getApiKey, _YouTubeMusic_YTM_PATHS, _YouTubeMusic_search, _a, _b, _YouTube_store, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
exports.YouTube = exports.YouTubeMusic = void 0;
/* eslint-disable max-classes-per-file, no-underscore-dangle */
const util_1 = __importDefault(require("util"));
const got_1 = __importDefault(require("got"));
const bluebird_1 = __importDefault(require("bluebird"));
const yt_search_1 = __importDefault(require("yt-search"));
const youtube_dl_exec_1 = __importDefault(require("youtube-dl-exec"));
const walkr_js_1 = __importDefault(require("../walkr.js"));
const symbols_js_1 = __importDefault(require("../symbols.js"));
const text_utils_js_1 = __importDefault(require("../text_utils.js"));
const async_queue_js_1 = __importDefault(require("../async_queue.js"));
class YouTubeSearchError extends Error {
    constructor(message, statusCode, status, body) {
        super(message);
        if (status)
            this.status = status;
        if (statusCode)
            this.statusCode = statusCode;
        if (body)
            this.body = body;
    }
}
function _getSearchArgs(artists, track, duration) {
    if (typeof track === 'number')
        [track, duration] = [, track];
    if (!Array.isArray(artists))
        if (track && artists)
            artists = [artists];
        else
            [artists, track] = [[], artists || track];
    if (typeof track !== 'string')
        throw new Error('<track> must be a valid string');
    if (artists.some(artist => typeof artist !== 'string'))
        throw new Error('<artist>, if defined must be a valid array of strings');
    if (duration && typeof duration !== 'number')
        throw new Error('<duration>, if defined must be a valid number');
    return [artists, track, duration];
}
/**
 * @typedef {(
 *   {
 *     title: string,
 *     type: "Song" | "Video",
 *     artists: string,
 *     album: string,
 *     duration: string,
 *     duration_ms: number,
 *     videoId: string,
 *     playlistId: string,
 *     accuracy: number,
 *     getFeeds: () => Promise<youtubedl.Info>,
 *   }[]
 * )} YouTubeSearchResult
 */
function genAsyncGetFeedsFn(url) {
    return () => (0, youtube_dl_exec_1.default)(null, {
        '--': [url],
        socketTimeout: 20,
        cacheDir: false,
        dumpSingleJson: true,
    });
}
class YouTubeMusic {
    constructor() {
        this[_b] = YouTubeMusic[symbols_js_1.default.meta];
        _YouTubeMusic_store.set(this, {
            gotInstance: got_1.default.extend({
                headers: {
                    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
                },
            }),
            apiKey: null,
        });
        _YouTubeMusic_request.set(this, async function request(url, opts) {
            const response = await __classPrivateFieldGet(this, _YouTubeMusic_store, "f")
                .gotInstance(url, opts)
                .catch(err => bluebird_1.default.reject(new YouTubeSearchError(err.message, err.response && err.response.statusCode, err.code, err.response && err.response.body)));
            if (response.req.res.url === 'https://music.youtube.com/coming-soon/')
                throw new YouTubeSearchError('YouTube Music is not available in your country');
            return response.body;
        });
        _YouTubeMusic_getApiKey.set(this, async function getApiKey(force = false) {
            if (__classPrivateFieldGet(this, _YouTubeMusic_store, "f").apiKey && !force)
                return __classPrivateFieldGet(this, _YouTubeMusic_store, "f").apiKey;
            const body = await __classPrivateFieldGet(this, _YouTubeMusic_request, "f").call(this, 'https://music.youtube.com/', { method: 'get' });
            let match;
            if ((match = (body || '').match(/(?="INNERTUBE_API_KEY":"(.+?)")/)))
                return ([, __classPrivateFieldGet(this, _YouTubeMusic_store, "f").apiKey] = match), __classPrivateFieldGet(this, _YouTubeMusic_store, "f").apiKey;
            throw new YouTubeSearchError('Failed to extract `INNERTUBE_API_KEY`');
        });
        _YouTubeMusic_YTM_PATHS.set(this, {
            PLAY_BUTTON: ['overlay', 'musicItemThumbnailOverlayRenderer', 'content', 'musicPlayButtonRenderer'],
            NAVIGATION_BROWSE_ID: ['navigationEndpoint', 'browseEndpoint', 'browseId'],
            NAVIGATION_VIDEO_ID: ['navigationEndpoint', 'watchEndpoint', 'videoId'],
            NAVIGATION_PLAYLIST_ID: ['navigationEndpoint', 'watchEndpoint', 'playlistId'],
            SECTION_LIST: ['sectionListRenderer', 'contents'],
            TITLE_TEXT: ['title', 'runs', 0, 'text'],
        });
        _YouTubeMusic_search.set(this, async function search(queryObject, params, tag) {
            /**
             * VideoID Types?
             * OMV: Official Music Video
             * ATV:
             * UGC: User-generated content
             */
            if (typeof queryObject !== 'object')
                throw new Error('<queryObject> must be an object');
            if (params && typeof params !== 'object')
                throw new Error('<params>, if defined must be an object');
            const response = await __classPrivateFieldGet(this, _YouTubeMusic_request, "f").call(this, 'https://music.youtube.com/youtubei/v1/search', {
                timeout: { request: 10000 },
                method: 'post',
                searchParams: { alt: 'json', key: await __classPrivateFieldGet(this, _YouTubeMusic_getApiKey, "f").call(this), ...params },
                responseType: 'json',
                json: {
                    context: {
                        client: {
                            clientName: 'WEB_REMIX',
                            clientVersion: '0.1',
                            hl: 'en',
                            gl: 'US',
                        },
                    },
                    ...queryObject,
                },
                headers: {
                    referer: 'https://music.youtube.com/search',
                },
            });
            const YTM_PATHS = __classPrivateFieldGet(this, _YouTubeMusic_YTM_PATHS, "f");
            const shelf = !('continuationContents' in response)
                ? (0, walkr_js_1.default)(response, YTM_PATHS.SECTION_LIST).map(section => section.musicShelfRenderer || section)
                : [
                    (0, walkr_js_1.default)(response, 'continuationContents', 'musicShelfContinuation') ||
                        (0, walkr_js_1.default)(response, 'continuationContents', 'sectionListContinuation'),
                ];
            return Object.fromEntries(shelf.map(layer => {
                const layerName = (0, walkr_js_1.default)(layer, YTM_PATHS.TITLE_TEXT);
                return [
                    layerName === 'Top result'
                        ? 'top'
                        : layerName === 'Songs'
                            ? 'songs'
                            : layerName === 'Videos'
                                ? 'videos'
                                : layerName === 'Albums'
                                    ? 'albums'
                                    : layerName === 'Artists'
                                        ? 'artists'
                                        : layerName === 'Playlists'
                                            ? 'playlists'
                                            : `other${layerName ? `(${layerName})` : ''}`,
                    {
                        contents: (layer.contents || []).map(content => {
                            content = content.musicResponsiveListItemRenderer;
                            function getItemRuns(item, index) {
                                return (0, walkr_js_1.default)(item, 'flexColumns', index, 'musicResponsiveListItemFlexColumnRenderer', 'text', 'runs');
                            }
                            function getItemText(item, index, run_index = 0) {
                                return getItemRuns(item, index)[run_index].text;
                            }
                            const result = {};
                            let type = getItemText(content, 1).toLowerCase();
                            if (type === 'single')
                                type = 'album';
                            if (['song', 'video', 'album', 'artist', 'playlist'].includes(type))
                                result.type = type;
                            const runs = getItemRuns(content, 1).filter(item => item.text !== ' • ');
                            const navigable = runs
                                .filter(item => 'navigationEndpoint' in item)
                                .map(item => ({ name: item.text, id: (0, walkr_js_1.default)(item, YTM_PATHS.NAVIGATION_BROWSE_ID) }));
                            if (['song', 'video', 'album', 'playlist'].includes(type)) {
                                result.title = getItemText(content, 0);
                            }
                            if (['song', 'video', 'album', 'playlist'].includes(type)) {
                                [result.artists, result.album] = navigable.reduce(([artists, album], item) => {
                                    if (item.id.startsWith('UC'))
                                        artists.push(item);
                                    else
                                        album = item;
                                    return [artists, album];
                                }, [[], null]);
                            }
                            if (['song', 'video'].includes(type))
                                result.videoId = (0, walkr_js_1.default)(content, YTM_PATHS.PLAY_BUTTON, 'playNavigationEndpoint', 'watchEndpoint', 'videoId');
                            if (['artist', 'album', 'playlist'].includes(type) &&
                                !(result.browseId = (0, walkr_js_1.default)(content, YTM_PATHS.NAVIGATION_BROWSE_ID))) {
                                return {};
                            }
                            if (type === 'song') {
                                result.duration = runs[runs.length - 1].text;
                            }
                            else if (type === 'video') {
                                delete result.album;
                                [result.views, result.duration] = runs.slice(-2).map(item => item.text);
                                [result.views] = result.views.split(' ');
                            }
                            else if (type === 'album') {
                                result.type = runs[0].text.toLowerCase();
                                delete result.album;
                                result.title = getItemText(content, 0);
                                result.year = runs[runs.length - 1].text;
                            }
                            else if (type === 'artist') {
                                result.artist = getItemText(content, 0);
                                [result.subscribers] = runs[runs.length - 1].text.split(' ');
                            }
                            else if (type === 'playlist') {
                                result.author = result.artists;
                                delete result.artists;
                                delete result.album;
                                result.itemCount = parseInt(runs[runs.length - 1].text.split(' ')[0], 10);
                            }
                            return result;
                        }),
                        ...(layerName === 'Top result'
                            ? null
                            : {
                                loadMore: !layer.continuations
                                    ? undefined
                                    : async () => {
                                        const continuationObject = layer.continuations[0].nextContinuationData;
                                        return (await __classPrivateFieldGet(this, _YouTubeMusic_search, "f").call(this, {}, {
                                            icit: continuationObject.clickTrackingParams,
                                            continuation: continuationObject.continuation,
                                        }, tag || layerName.slice(0, -1))).other;
                                    },
                                expand: !layer.bottomEndpoint
                                    ? undefined
                                    : async () => (await __classPrivateFieldGet(this, _YouTubeMusic_search, "f").call(this, layer.bottomEndpoint.searchEndpoint, {}, tag || layerName.slice(0, -1))).other,
                            }),
                    },
                ];
            }));
        });
    }
    /**
     * Search the YouTube Music service for matches
     * @param {string|string[]} [artists] An artist or list of artists
     * @param {string} [track] Track name
     * @param {number} [duration] Duration in milliseconds
     *
     * If `track` is a number, it becomes duration, leaving `track` undefined.
     * If `artists` is a string and `track` is undefined, it becomes `track`, leaving artists empty.
     * If `artists` is non-array but `track` is defined, artists becomes an item in the artists array.
     *
     * @returns {YouTubeSearchResult} YouTubeMusicSearchResults
     */
    async search(artists, track, duration) {
        [artists, track, duration] = _getSearchArgs(artists, track, duration);
        const results = await __classPrivateFieldGet(this, _YouTubeMusic_search, "f").call(this, { query: [track, ...artists].join(' ') });
        const strippedMeta = text_utils_js_1.default.stripText([...track.split(' '), ...artists]);
        const validSections = [
            ...((results.top || {}).contents || []),
            ...((results.songs || {}).contents || []),
            ...((results.videos || {}).contents || []), // videos section
        ].filter(item => item &&
            'title' in item &&
            ['song', 'video'].includes(item.type) &&
            text_utils_js_1.default.getWeight(strippedMeta, text_utils_js_1.default.stripText([...item.title.split(' '), ...item.artists.map(artist => artist.name)])) > 70);
        function calculateAccuracyFor(item) {
            let accuracy = 0;
            // get weighted delta from expected duration
            accuracy += 100 - (duration ? Math.abs(duration - item.duration_ms) / duration : 0.5) * 100;
            // if item is a song, bump remaining by 80%, if video, bump up by 70%, anything else, not so much
            accuracy += (cur => ((item.type === 'song' ? 80 : item.type === 'video' ? 70 : 10) / 100) * cur)(100 - accuracy);
            // TODO: CALCULATE ACCURACY BY AUTHOR
            return accuracy;
        }
        const classified = Object.values(validSections.reduce((final, item) => {
            // prune duplicates
            if (item && 'videoId' in item && !(item.videoId in final)) {
                final[item.videoId] = {
                    title: item.title,
                    type: item.type,
                    author: item.artists,
                    duration: item.duration,
                    duration_ms: item.duration.split(':').reduce((acc, time) => 60 * acc + +time) * 1000,
                    videoId: item.videoId,
                    getFeeds: genAsyncGetFeedsFn(item.videoId),
                };
                final[item.videoId].accuracy = calculateAccuracyFor(final[item.videoId]);
            }
            return final;
        }, {})).sort((a, b) => (a.accuracy > b.accuracy ? -1 : 1));
        return classified;
    }
}
exports.YouTubeMusic = YouTubeMusic;
_YouTubeMusic_store = new WeakMap(), _YouTubeMusic_request = new WeakMap(), _YouTubeMusic_getApiKey = new WeakMap(), _YouTubeMusic_YTM_PATHS = new WeakMap(), _YouTubeMusic_search = new WeakMap(), _a = symbols_js_1.default.meta, _b = symbols_js_1.default.meta;
YouTubeMusic[_a] = {
    ID: 'yt_music',
    DESC: 'YouTube Music',
    PROPS: {
        isQueryable: false,
        isSearchable: true,
        isSourceable: true,
    },
    BITRATES: [96, 128, 160, 192, 256, 320],
};
class YouTube {
    constructor() {
        this[_d] = YouTube[symbols_js_1.default.meta];
        _YouTube_store.set(this, {
            search: util_1.default.promisify(yt_search_1.default),
            searchQueue: new async_queue_js_1.default('YouTube:netSearchQueue', 4, async (strippedMeta, ...xFilters) => (await __classPrivateFieldGet(this, _YouTube_store, "f").search({
                query: [...strippedMeta, ...xFilters].join(' '),
                pageStart: 1,
                pageEnd: 2,
            })).videos.reduce((final, item) => ({
                ...final,
                ...(text_utils_js_1.default.getWeight(strippedMeta, text_utils_js_1.default.stripText([...item.title.split(' '), item.author.name])) > 70
                    ? (final.results.push(item),
                        {
                            highestViews: Math.max(final.highestViews, (item.views = item.views || 0)),
                        })
                    : {}),
            }), { xFilters, highestViews: 0, results: [] })),
        });
    }
    /**
     * Search YouTube service for matches
     * @param {string|string[]} [artists] An artist or list of artists
     * @param {string} [track] Track name
     * @param {number} [duration] Duration in milliseconds
     *
     * If `track` is a number, it becomes duration, leaving `track` undefined.
     * If `artists` is a string and `track` is undefined, it becomes `track`, leaving artists empty.
     * If `artists` is non-array but `track` is defined, artists becomes an item in the artists array.
     *
     * @returns {YouTubeSearchResult} YouTubeSearchResults
     */
    async search(artists, track, duration) {
        [artists, track, duration] = _getSearchArgs(artists, track, duration);
        const strippedArtists = text_utils_js_1.default.stripText(artists);
        const strippedMeta = [...text_utils_js_1.default.stripText(track.split(' ')), ...strippedArtists];
        let searchResults = await bluebird_1.default.all((await __classPrivateFieldGet(this, _YouTube_store, "f").searchQueue.push([
            [strippedMeta, ['Official Audio']],
            [strippedMeta, ['Audio']],
            [strippedMeta, ['Lyrics']],
            [strippedMeta, []],
        ])).map(result => bluebird_1.default.resolve(result).reflect()));
        if (searchResults.every(result => result.isRejected())) {
            const err = searchResults[searchResults.length - 1].reason();
            throw new YouTubeSearchError(err.message, null, err.code);
        }
        searchResults = searchResults.map(ret => (ret.isFulfilled() ? ret.value() : {}));
        const highestViews = Math.max(...searchResults.map(sources => sources.highestViews));
        function calculateAccuracyFor(item) {
            let accuracy = 0;
            // get weighted delta from expected duration
            accuracy += 100 - (duration ? Math.abs(duration - item.duration.seconds * 1000) / duration : 0.5) * 100;
            // bump accuracy by max of 80% on the basis of highest views
            accuracy += (cur => cur * (80 / 100) * (item.views / highestViews))(100 - accuracy);
            // bump accuracy by 60% if video author matches track author
            accuracy += (cur => text_utils_js_1.default.getWeight(strippedArtists, text_utils_js_1.default.stripText([item.author.name])) >= 80 ? (60 / 100) * cur : 0)(100 - accuracy);
            return accuracy;
        }
        const final = {};
        searchResults.forEach(source => {
            if (Array.isArray(source.results))
                source.results.forEach(item => {
                    // prune duplicates
                    if (item && 'videoId' in item && !(item.videoId in final))
                        final[item.videoId] = {
                            title: item.title,
                            type: item.type,
                            author: item.author.name,
                            duration: item.duration.timestamp,
                            duration_ms: item.duration.seconds * 1000,
                            videoId: item.videoId,
                            xFilters: source.xFilters,
                            accuracy: calculateAccuracyFor(item),
                            getFeeds: genAsyncGetFeedsFn(item.videoId),
                        };
                });
        });
        return Object.values(final).sort((a, b) => (a.accuracy > b.accuracy ? -1 : 1));
    }
}
exports.YouTube = YouTube;
_YouTube_store = new WeakMap(), _c = symbols_js_1.default.meta, _d = symbols_js_1.default.meta;
YouTube[_c] = {
    ID: 'youtube',
    DESC: 'YouTube',
    PROPS: {
        isQueryable: false,
        isSearchable: true,
        isSourceable: true,
    },
    BITRATES: [96, 128, 160, 192, 256, 320],
};
