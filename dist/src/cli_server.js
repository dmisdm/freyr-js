"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _AuthServer_store;
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const events_1 = __importDefault(require("events"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const stringd_1 = __importDefault(require("stringd"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
function wrapHTML(opts) {
    return (0, stringd_1.default)(`<style>
    .box {
      border: none;
      box-shadow: 0px 0px 60px 10px grey;
      height: 200px;
      width: 40vh;
      padding: 10px;
      background-color: rgba(94, 91, 121, 0.8);
      border-radius: 14px;
      text-align: center;
    }

    .center-v {
      margin: 0;
      position: absolute;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  </style>

  <div class="box center-v center-h">
    <h1>FreyrCLI</h1>
    <hr width="45%" />
    <b>:{service}</b>
    <hr width="80%" />
    <h3 style="color::{color};">:{msg}</h3>
    You can close this tab
  </div>`, opts);
}
class AuthServer extends events_1.default.EventEmitter {
    constructor(opts) {
        super();
        _AuthServer_store.set(this, {
            port: null,
            hostname: null,
            serviceName: null,
            baseUrl: null,
            callbackRoute: null,
            express: null,
        });
        __classPrivateFieldGet(this, _AuthServer_store, "f").port = opts.port || 36346;
        __classPrivateFieldGet(this, _AuthServer_store, "f").hostname = opts.hostname || 'localhost';
        __classPrivateFieldGet(this, _AuthServer_store, "f").serviceName = opts.serviceName;
        __classPrivateFieldGet(this, _AuthServer_store, "f").stateKey = 'auth_state';
        __classPrivateFieldGet(this, _AuthServer_store, "f").baseUrl = `http${opts.useHttps ? 's' : ''}://${__classPrivateFieldGet(this, _AuthServer_store, "f").hostname}:${__classPrivateFieldGet(this, _AuthServer_store, "f").port}`;
        __classPrivateFieldGet(this, _AuthServer_store, "f").callbackRoute = '/callback';
        __classPrivateFieldGet(this, _AuthServer_store, "f").express = (0, express_1.default)().use((0, cors_1.default)()).use((0, cookie_parser_1.default)());
    }
    getRedirectURL() {
        return `${__classPrivateFieldGet(this, _AuthServer_store, "f").baseUrl}${__classPrivateFieldGet(this, _AuthServer_store, "f").callbackRoute}`;
    }
    async init(gFn) {
        return new Promise(resolve => {
            const server = __classPrivateFieldGet(this, _AuthServer_store, "f").express
                .get('/', (_req, res) => {
                const state = crypto_1.default.randomBytes(8).toString('hex');
                res.cookie(__classPrivateFieldGet(this, _AuthServer_store, "f").stateKey, state);
                res.redirect(gFn(state));
            })
                .get(__classPrivateFieldGet(this, _AuthServer_store, "f").callbackRoute, (req, res) => {
                const code = req.query.code || null;
                const state = req.query.state || null;
                const storedState = req.cookies ? req.cookies[__classPrivateFieldGet(this, _AuthServer_store, "f").stateKey] : null;
                res.clearCookie(__classPrivateFieldGet(this, _AuthServer_store, "f").stateKey);
                if (code == null || state === null || state !== storedState) {
                    res.end(wrapHTML({ service: __classPrivateFieldGet(this, _AuthServer_store, "f").serviceName, color: '#d0190c', msg: 'Authentication Failed' }));
                    return;
                }
                res.end(wrapHTML({ service: __classPrivateFieldGet(this, _AuthServer_store, "f").serviceName, color: '#1ae822;', msg: 'Successfully Authenticated' }));
                server.close();
                this.emit('code', code);
            })
                .listen(__classPrivateFieldGet(this, _AuthServer_store, "f").port, __classPrivateFieldGet(this, _AuthServer_store, "f").hostname, () => resolve(__classPrivateFieldGet(this, _AuthServer_store, "f").baseUrl));
        });
    }
    async getCode() {
        const [code] = await events_1.default.once(this, 'code');
        return code;
    }
}
exports.default = AuthServer;
_AuthServer_store = new WeakMap();
