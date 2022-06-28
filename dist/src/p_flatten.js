"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bluebird_1 = __importDefault(require("bluebird"));
async function flattener(array) {
    array = await array;
    return (await bluebird_1.default.mapSeries(Array.isArray(array) ? array : [], async (item) => !Array.isArray(item) ? item : flattener(item.flat(Infinity)))).flat(Infinity);
}
exports.default = flattener;
