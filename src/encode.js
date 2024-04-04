/**
 * @flow
 */

import util from 'util';
import ParseACL from './ParseACL';
import ParseFile from './ParseFile';
import ParseGeoPoint from './ParseGeoPoint';
import ParsePolygon from './ParsePolygon';
import ParseObject from './ParseObject';
import { Op } from './ParseOp';
import ParseRelation from './ParseRelation';

const MAX_RECURSIVE_CALLS = 999;

function encode(
  value: mixed,
  disallowObjects: boolean,
  forcePointers: boolean,
  seen: Array<mixed>,
  offline: boolean,
  counter: number
): any {
  counter++;

  if (counter > MAX_RECURSIVE_CALLS) {
    const message = 'Encoding object failed due to high number of recursive calls, likely caused by circular reference within object.';
    console.error(message);
    console.error('Value causing potential infinite recursion:', util.inspect(value, { showHidden: false, depth: null }));
    console.error('Disallow objects:', disallowObjects);
    console.error('Force pointers:', forcePointers);
    console.error('Seen:', seen);
    console.error('Offline:', offline);

    throw new Error(message);
  }

  if (value instanceof ParseObject) {
    if (disallowObjects) {
      throw new Error('Parse Objects not allowed here');
    }
    const entryIdentifier = value.id ? value.className + ':' + value.id : value;
    if (
      forcePointers ||
      seen.includes(entryIdentifier) ||
      value.dirty() ||
      Object.keys(value._getServerData()).length === 0
    ) {
      if (offline && value._getId().startsWith('local')) {
        return value.toOfflinePointer();
      }
      return value.toPointer();
    }
    seen.push(entryIdentifier);
    return value._toFullJSON(seen, offline);
  } else if (
    value instanceof Op ||
    value instanceof ParseACL ||
    value instanceof ParseGeoPoint ||
    value instanceof ParsePolygon ||
    value instanceof ParseRelation
  ) {
    return value.toJSON();
  } else if (value instanceof ParseFile) {
    if (!value.url()) {
      throw new Error('Tried to encode an unsaved file.');
    }
    return value.toJSON();
  } else if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value)) {
      throw new Error('Tried to encode an invalid date.');
    }
    return { __type: 'Date', iso: (value: any).toJSON() };
  } else if (
    Object.prototype.toString.call(value) === '[object RegExp]' &&
    typeof value.source === 'string'
  ) {
    return value.source;
  } else if (Array.isArray(value)) {
    return value.map(v => {
      console.log("About to recurse and call `encode` with array value", v);
      return encode(v, disallowObjects, forcePointers, seen, offline, counter);
    });
  } else if (value && typeof value === 'object') {
    console.log("Value in `encode` is an object:", value);
    const output = {};
    for (const k in value) {
      console.log("About to recurse and call `encode` with object value", value[k]);
      output[k] = encode(value[k], disallowObjects, forcePointers, seen, offline, counter);
    }
    return output;
  } else {
    return value;
  }
}

export default function (
  value: mixed,
  disallowObjects?: boolean,
  forcePointers?: boolean,
  seen?: Array<mixed>,
  offline?: boolean,
  counter?: number
): any {
  console.log("Inside initial encode function call with value", value);
  return encode(value, !!disallowObjects, !!forcePointers, seen || [], !!offline, counter || 0);
}
