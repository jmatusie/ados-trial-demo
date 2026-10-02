// Copyright © 2023 Tomoki Miyauchi. All rights reserved. MIT license.
// This module is browser compatible.

/** {@link Map} like API. */
/**
 * @template K, V
 * @typedef {Object} MapLike
 * @property {(key: K) => V | undefined} get - Returns a specified element.
 * @property {(key: K) => boolean} has - Whether an element with the specified key exists or not.
 * @property {(key: K, value: V) => void} set - Adds a new element with a specified key and value.
 */

/** Insertable API. */
/**
 * @template K, V, T
 * @typedef {Object} Insertable
 * @property {InsertCallback<K, V, T>} insert - Add entry.
 */

/**
 * @template K, V, T
 * @callback InsertCallback
 * @param {K} key
 * @param {T} that
 * @returns {V}
 */

/** Updatable API. */
/**
 * @template K, V, T
 * @typedef {Object} Updatable
 * @property {UpdateCallback<K, V, T>} update - Update the value.
 */

/**
 * @template K, V, T
 * @callback UpdateCallback
 * @param {V} existing
 * @param {K} key
 * @param {T} that
 * @returns {V}
 */

/** Handler for emplace. */
/**
 * @template K, V, T
 * @typedef {Insertable<K, V, T> & Updatable<K, V, T>} EmplaceHandler
 */

/**
 * Add a value to a {@link map} if it does not already have something at {@link key}, and will also update an existing value at {@link key}.
 * @template K, V, M
 * @param {Readonly<MapLike<K, V>> & M} map
 * @param {K} key
 * @param {Readonly<EmplaceHandler<K, V, M>>} handler
 * @returns {V}
 */
function emplace(map, key, handler) {
  if (map.has(key)) {
    const value = map.get(key);

    return "update" in handler
      ? _update(value, key, map, handler.update.bind(handler))
      : value;
  }

  if ("insert" in handler) {
    return _insert(map, key, handler.insert.bind(handler));
  }

  return undefined;
}

/**
 * Add the entry if the {@link key} does not exist.
 * @template K, V, M
 * @param {Readonly<MapLike<K, V>> & M} map
 * @param {K} key
 * @param {InsertCallback<K, V, M>} callback
 * @returns {V}
 */
function insert(map, key, callback) {
  if (map.has(key)) return map.get(key);

  return _insert(map, key, callback);
}

/**
 * Update the entry if the {@link key} exists.
 * @template K, V, M
 * @param {Readonly<MapLike<K, V>> & M} map
 * @param {K} key
 * @param {UpdateCallback<K, V, M>} callback
 * @returns {V | undefined}
 */
function update(map, key, callback) {
  if (map.has(key)) return _update(map.get(key), key, map, callback);

  return undefined;
}

/**
 * @template K, V, M
 * @param {Readonly<MapLike<K, V>> & M} map
 * @param {K} key
 * @param {InsertCallback<K, V, M>} callback
 * @returns {V}
 */
const _insert = (map, key, callback) => {
  const inserted = callback(key, map);

  map.set(key, inserted);

  return inserted;
};

/**
 * @template K, V, M
 * @param {V} value
 * @param {K} key
 * @param {Readonly<MapLike<K, V>> & M} map
 * @param {UpdateCallback<K, V, M>} callback
 * @returns {V}
 */
function _update(value, key, map, callback) {
  const updated = callback(value, key, map);

  map.set(key, updated);

  return updated;
}












// Copyright © 2023 Tomoki Miyauchi. All rights reserved. MIT license.
// This module is browser compatible.


const _emplace = emplace


/**
 * @template K, V, M
 * @this {Readonly<MapLike<K, V>> & M}
 * @param {K} key
 * @param {Readonly<EmplaceHandler<K, V, M>>} handler
 * @returns {V}
 */
export function emplace(key, handler) {
  return _emplace(this, key, handler);
}

/**
 * @template K, V, M
 * @this {Readonly<MapLike<K, V>> & M}
 * @param {K} key
 * @param {Readonly<Insertable<K, V, M>>} handler
 * @returns {V}
 */
export function emplace(key, handler) {
  return _emplace(this, key, handler);
}

/**
 * @template K, V, M
 * @this {Readonly<MapLike<K, V>> & M}
 * @param {K} key
 * @param {Readonly<Updatable<K, V, M>>} handler
 * @returns {V | undefined}
 */
export function emplace(key, handler) {
  return _emplace(this, key, handler);
}

/**
 * @template K, V, M
 * @this {Readonly<MapLike<K, V>> & M}
 * @param {K} key
 * @param {Readonly<Insertable<K, V, M> | Updatable<K, V, M>>} handler
 * @returns {V | undefined}
 */
export function emplace(key, handler) {
  return _emplace(this, key, handler);
}

/**
 * Mixin for {@link emplace}.
 * @template T
 * @param {T} ctor
 * @returns {T & { new (...args: any[]): { emplace: typeof emplace } }}
 */
export function emplaceable(ctor) {
  return class extends ctor {
    emplace = emplace;
  };
}

/**
 * Mixin for {@link emplace}.
 * @template T
 * @param {T} ctor
 * @returns {T & { new (...args: any[]): { emplace: typeof emplace } }}
 * @deprecated rename to {@link emplaceable}.
 */
export const Emplaceable = emplaceable;

/**
 * Emplaceable API.
 * @template K, V
 * @typedef {Object} Emplaceable
 * @property {(key: K, handler: EmplaceHandler<K, V, this>) => V} emplace - Add a value to a map if the map does not already have something at {@link key}, and will also update an existing value at {@link key}.
 * @property {(key: K, handler: Insertable<K, V, this>) => V} emplace - Add a value to a map if the map does not already have something at {@link key}, and will also update an existing value at {@link key}.
 * @property {(key: K, handler: Updatable<K, V, this>) => V | undefined} emplace - Add a value to a map if the map does not already have something at {@link key}, and will also update an existing value at {@link key}.
 */





// deno-lint-ignore-file no-explicit-any
// Copyright © 2023 Tomoki Miyauchi. All rights reserved. MIT license.
// This module is browser compatible.

import { Emplaceable } from "./mixin.js";

/**
 * @typedef {new () => Map<any, any> & Emplaceable<any, any>} EmplaceableMapConstructor
 * @typedef {new <K, V>(entries?: readonly (readonly [K, V])[] | null) => Map<K, V> & Emplaceable<K, V>} EmplaceableMapConstructor
 * @property {Map<any, any> & Emplaceable<any, any>} prototype
 */

/** @type {EmplaceableMapConstructor} */
const _EmplaceableMap = /* @__PURE__ */ Emplaceable(Map);


export class EmplaceableMap extends _EmplaceableMap {}

/**
 * @typedef {new <K extends WeakKey = WeakKey, V = any>(entries?: readonly (readonly [K, V])[] | null) => WeakMap<K, V> & Emplaceable<K, V>} EmplaceableWeakMapConstructor
 * @property {WeakMap<WeakKey, any> & Emplaceable<any, any>} prototype
 */

/** @type {EmplaceableWeakMapConstructor} */
const _EmplaceableWeakMap = /* @__PURE__ */ Emplaceable(WeakMap);

/**
 * {@link WeakMap} with {@link Emplaceable} implementation.
 * @template K extends WeakKey, V
 * @extends {WeakMap<K, V>}
 * @implements {Emplaceable<K, V>}
 */
export class EmplaceableWeakMap extends _EmplaceableWeakMap {}



Map.prototype.emplace = emplace
WeakMap.prototype.emplace = emplace


const w = new WeakMap()
