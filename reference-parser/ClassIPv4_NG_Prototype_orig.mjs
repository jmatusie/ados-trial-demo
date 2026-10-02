// @ts-check
const isVerbose = false
import { flattenItem, multiplyBy } from "./DataSet_Transformers.mjs"
import { bifurcateArray } from "./Parser_Result_Helpers.mjs"
import { assertEquals, assert } from "https://deno.land/std@0.117.0/testing/asserts.ts";
import { IPv4 } from "./ClassIPv4.mjs";


// if pasting from REPL:
//const {IPv4} = await import("./static/Modules/ClassIPv4.mjs")


// @ts-check

/**
 * Represents an IPv4 address with associated data.
 */
class IPv4_NG {
  /**
   * @param {string} ipStr - The IP address string in the format "x.x.x.x" or "x.x.x.x/y".
   * @param {*} [data=null] - Associated data for this IP address.
   */
  constructor(ipStr, data = null) {
    this.data = data;
    this.error = false;
    let ipPart, maskPart;
    if (ipStr.includes('/')) {
      [ipPart, maskPart] = ipStr.split('/');
    } else {
      ipPart = ipStr;
      maskPart = "32";
    }
    ipPart = ipPart.trim();
    maskPart = maskPart.trim();
    const octets = ipPart.split('.');
    if (octets.length !== 4) {
      this.error = true;
      return;
    }
    let ipNum = 0;
    for (let i = 0; i < 4; i++) {
      const octet = parseInt(octets[i], 10);
      if (isNaN(octet) || octet < 0 || octet > 255) {
        this.error = true;
        return;
      }
      ipNum = (ipNum << 8) | octet;
    }
    ipNum = ipNum >>> 0;
    const maskLen = parseInt(maskPart, 10);
    if (isNaN(maskLen) || maskLen < 0 || maskLen > 32) {
      this.error = true;
      return;
    }
    this.maskLen = maskLen;
    this.mask = maskLen === 0 ? 0 : (0xFFFFFFFF << (32 - maskLen)) >>> 0;
    this.addr = ipNum & this.mask;
  }

  /**
   * @returns {string} The string representation of the IP address.
   */
  toString() {
    return IPv4_NG.intToIp(this.addr) + '/' + this.maskLen;
  }

  /**
   * Converts an integer to an IP address string.
   * @param {number} ip - The IP address as a 32-bit integer.
   * @returns {string} The IP address string.
   */
  static intToIp(ip) {
    return [
      (ip >>> 24) & 0xFF,
      (ip >>> 16) & 0xFF,
      (ip >>> 8) & 0xFF,
      ip & 0xFF
    ].join('.');
  }

  /**
   * Checks if this IP address is a subnet of the given IP address.
   * @param {string} ipStr - The IP address string to compare against.
   * @returns {boolean} True if this IP is a subnet of the given IP.
   */
  isSubnetOf(ipStr) {
    const other = new IPv4(ipStr);
    if (other.error) return false;
    if (this.addr === other.addr && this.maskLen === other.maskLen) return true;
    if (this.maskLen < other.maskLen) return false;
    return (this.addr & other.mask) === other.addr;
  }

  /**
   * Checks if this IP address is a supernet of the given IP address.
   * @param {string} ipStr - The IP address string to compare against.
   * @returns {boolean} True if this IP is a supernet of the given IP.
   */
  isSupernetOf(ipStr) {
    const other = new IPv4(ipStr);
    if (other.error) return false;
    if (this.addr === other.addr && this.maskLen === other.maskLen) return true;
    if (this.maskLen > other.maskLen) return false;
    return (other.addr & this.mask) === this.addr;
  }

  /**
   * Converts an IP address string to a 32-bit integer.
   * @param {string} ipStr - The IP address string.
   * @returns {number|null} The IP address as a 32-bit integer, or null if invalid.
   */
  static ipStrToInt(ipStr) {
    const octets = ipStr.trim().split('.');
    if (octets.length !== 4) return null;
    let num = 0;
    for (let i = 0; i < 4; i++) {
      const octet = parseInt(octets[i], 10);
      if (isNaN(octet) || octet < 0 || octet > 255) return null;
      num = (num << 8) | octet;
    }
    return num >>> 0;
  }

  /**
   * Counts the number of trailing zeros in a 32-bit integer.
   * @param {number} x - The 32-bit integer.
   * @returns {number} The number of trailing zeros.
   */
  static countTrailingZeros(x) {
    if (x === 0) return 32;
    return 31 - Math.clz32(x & -x);
  }

  /**
   * Creates an array of IPv4 objects representing the range between two IP addresses.
   * @param {string} fromIPAddrStr - The starting IP address.
   * @param {string} toIPAddrStr - The ending IP address.
   * @param {boolean} isInclusive - Whether to include the ending IP address.
   * @returns {IPv4_NG[]} An array of IPv4 objects representing the range.
   */
  static createPrefixesBetween(fromIPAddrStr, toIPAddrStr, isInclusive) {
    let start = IPv4_NG.ipStrToInt(fromIPAddrStr);
    let end = IPv4_NG.ipStrToInt(toIPAddrStr);
    if (start === null || end === null) return [];
    if (!isInclusive) end = end - 1;
    if (start > end) return [];
    const result = [];
    let current = start;
    while (current <= end) {
      const trailingZeros = IPv4_NG.countTrailingZeros(current);
      const remaining = end - current + 1;
      const maxBits = 31 - Math.clz32(remaining);
      const blockSizeBits = Math.min(trailingZeros, maxBits);
      const step = 1 << blockSizeBits;
      const maskLen = 32 - blockSizeBits;
      result.push(new IPv4(IPv4_NG.intToIp(current) + '/' + maskLen));
      current += step;
    }
    return result;
  }
}



/**
 * Represents a routing table containing IPv4 routes.
 */

class RoutingTableNG {
  /**
   * @p aram {IPv4_NG[]|IPv4[]|string[]} ipv4Array - An array of IPv4 objects to initialize the routing table.
   */
  constructor(ipv4Array) {
		const ipv4Prefixes = ipv4Array.flat().map((prefix) => new IPv4(prefix))

		const [erroredPrefixes, cleanPrefixes] = bifurcateArray(ipv4=>ipv4.error) (ipv4Prefixes)
		this.errorPrefixes = erroredPrefixes
		this.orderedTable = cleanPrefixes

    this.hostMap = new Map();
    this.prefixMap = new Map();
    this.dataMap = new Map();
    ipv4Array.forEach((route, idx) => {
      if (route.error) return;
      route.insertionIndex = idx;
      if (route.maskLen === 32) {
        if (!this.hostMap.has(route.addr)) {
          this.hostMap.set(route.addr, []);
        }
        this.hostMap.get(route.addr).push(route);
      } else {
        if (!this.prefixMap.has(route.maskLen)) {
          this.prefixMap.set(route.maskLen, new Map());
        }
        const network = route.addr >>> 0;
        const mapForLen = this.prefixMap.get(route.maskLen);
        if (!mapForLen.has(network)) {
          mapForLen.set(network, []);
        }
        mapForLen.get(network).push(route);
      }
      if (route.data !== undefined && route.data !== null) {
        if (!this.dataMap.has(route.data)) {
          this.dataMap.set(route.data, []);
        }
        this.dataMap.get(route.data).push(route);
      }
    });
  }

  /**
   * Checks if there's a matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to check.
   * @returns {boolean} True if a matching prefix is found.
   */
  hasMatchingPrefix(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return false;
    if (query.maskLen === 32 && this.hostMap.has(query.addr)) {
      return true;
    }
    for (let len = 32; len >= 0; len--) {
      if (len === 32) continue;
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network)) return true;
    }
    return false;
  }

  /**
   * Gets the longest matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG|null} The longest matching IPv4 object, or null if not found.
   */
  getLongestMatchPrefix(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return null;
    if (query.maskLen === 32 && this.hostMap.has(query.addr))
      return this.hostMap.get(query.addr)[0];
    for (let len = 32; len >= 0; len--) {
      if (len === 32) continue;
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network))
        return subsetMap.get(network)[0];
    }
    return null;
  }

  /**
   * Gets all matching prefixes for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG[]} An array of matching IPv4 objects.
   */
  getMatchingPrefixes(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return [];
    let matches = [];
    if (query.maskLen === 32 && this.hostMap.has(query.addr)) {
      matches.push(...this.hostMap.get(query.addr));
    }
    for (const [maskLen, networkMap] of this.prefixMap.entries()) {
      const mask = maskLen === 0 ? 0 : (0xFFFFFFFF << (32 - maskLen)) >>> 0;
      const network = query.addr & mask;
      if (networkMap.has(network)) {
        matches = matches.concat(networkMap.get(network));
      }
    }
    return matches;
  }

  /**
   * Looks up IPv4 objects by their associated data.
   * @param {*} dataKey - The data key to look up.
   * @returns {IPv4_NG[]} An array of IPv4 objects with matching data.
   */
  lookupData(dataKey) {
    return this.dataMap.get(dataKey) || [];
  }

  /**
   * Gets the first matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG|null} The first matching IPv4 object, or null if not found.
   */
  firstMatch(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return null;
    let bestRoute = null;
    for (let len = 32; len >= 0; len--) {
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      if (len === 32) {
        if (this.hostMap.has(query.addr)) {
          const r = this.hostMap.get(query.addr)[0];
          if (!bestRoute || r.insertionIndex < bestRoute.insertionIndex)
            bestRoute = r;
        }
      } else {
        const subsetMap = this.prefixMap.get(len);
        if (subsetMap && subsetMap.has(network)) {
          for (const r of subsetMap.get(network)) {
            if (!bestRoute || r.insertionIndex < bestRoute.insertionIndex)
              bestRoute = r;
          }
        }
      }
    }
    return bestRoute;
  }

  /**
   * Gets the smallest aggregate prefix that covers all routes in the table.
   * @returns {IPv4_NG} The smallest aggregate IPv4 object.
   */
  getSmallestAggregate() {
    const addresses = [];
    for (const routes of this.hostMap.values()) {
      addresses.push(...routes.map(r => r.addr));
    }
    for (const networks of this.prefixMap.values()) {
      for (const routes of networks.values()) {
        addresses.push(...routes.map(r => r.addr));
      }
    }
    if (addresses.length === 0) return new IPv4("0.0.0.0/0");
    for (let maskLen = 32; maskLen >= 0; maskLen--) {
      const mask = maskLen === 0 ? 0 : (0xFFFFFFFF << (32 - maskLen)) >>> 0;
      const expectedNetwork = addresses[0] & mask;
      let allMatch = true;
      for (const addr of addresses) {
        if ((addr & mask) !== expectedNetwork) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        return new IPv4(IPv4_NG.intToIp(expectedNetwork) + '/' + maskLen);
      }
    }
    return new IPv4("0.0.0.0/0");
  }

  /**
   * Filters routes by a given supernet.
   * @param {string} prefixStr - The supernet prefix string.
   * @returns {IPv4_NG[]} An array of IPv4 objects that are subnets of the given prefix.
   */
  filterBySupernet(prefixStr) {
    const supernet = new IPv4(prefixStr);
    if (supernet.error) return [];
    const results = [];
    if (supernet.maskLen === 32 && this.hostMap.has(supernet.addr)) {
      results.push(...this.hostMap.get(supernet.addr));
    }
    for (const [maskLen, networks] of this.prefixMap.entries()) {
      for (const routeList of networks.values()) {
        for (const route of routeList) {
          if (route.isSubnetOf(supernet.toString())) results.push(route);
        }
      }
    }
    return results;
  }

  /**
   * Consolidates the routing table, aggregating prefixes where possible.
   * @returns {RoutingTableNG} A new RoutingTableNGv2 with consolidated routes.
   */
  consolidate() {
    const allRoutes = [];
    for (const routes of this.hostMap.values()) {
      allRoutes.push(...routes);
    }
    for (const networks of this.prefixMap.values()) {
      for (const routes of networks.values()) {
        allRoutes.push(...routes);
      }
    }
    allRoutes.sort((a, b) => {
      if (a.maskLen === b.maskLen) return a.addr - b.addr;
      return a.maskLen - b.maskLen;
    });
    const consolidatedRoutes = [];
    while (allRoutes.length > 0) {
      const current = allRoutes.shift();
      let overlapping = [current];
      for (let i = allRoutes.length - 1; i >= 0; i--) {
        const candidate = allRoutes[i];
        if (current.isSupernetOf(candidate.toString())) {
          overlapping.push(candidate);
          allRoutes.splice(i, 1);
        }
      }
      let combinedData = [];
      overlapping.forEach(route => {
        if (Array.isArray(route.data)) {
          combinedData.push(...route.data);
        } else {
          combinedData.push(route.data);
        }
      });
      const aggregated = new IPv4(IPv4_NG.intToIp(current.addr) + '/' + current.maskLen, combinedData);
      consolidatedRoutes.push(aggregated);
    }
    return new RoutingTableNG(consolidatedRoutes);
  }
}


class RoutingTableNG_orig {
  /**
   * @param {IPv4_NG[]|IPv4[]} ipv4Array - An array of IPv4 objects to initialize the routing table.
   */
  constructor(ipv4Array) {
    this.hostMap = new Map();
    this.prefixMap = new Map();
    this.dataMap = new Map();
    ipv4Array.forEach((route, idx) => {
      if (route.error) return;
      route.insertionIndex = idx;
      if (route.maskLen === 32) {
        if (!this.hostMap.has(route.addr)) {
          this.hostMap.set(route.addr, []);
        }
        this.hostMap.get(route.addr).push(route);
      } else {
        if (!this.prefixMap.has(route.maskLen)) {
          this.prefixMap.set(route.maskLen, new Map());
        }
        const network = route.addr >>> 0;
        const mapForLen = this.prefixMap.get(route.maskLen);
        if (!mapForLen.has(network)) {
          mapForLen.set(network, []);
        }
        mapForLen.get(network).push(route);
      }
      if (route.data !== undefined && route.data !== null) {
        if (!this.dataMap.has(route.data)) {
          this.dataMap.set(route.data, []);
        }
        this.dataMap.get(route.data).push(route);
      }
    });
  }

  /**
   * Checks if there's a matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to check.
   * @returns {boolean} True if a matching prefix is found.
   */
  hasMatchingPrefix(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return false;
    if (query.maskLen === 32 && this.hostMap.has(query.addr)) {
      return true;
    }
    for (let len = 32; len >= 0; len--) {
      if (len === 32) continue;
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network)) return true;
    }
    return false;
  }

  /**
   * Gets the longest matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG|null} The longest matching IPv4 object, or null if not found.
   */
  getLongestMatchPrefix(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return null;
    if (query.maskLen === 32 && this.hostMap.has(query.addr))
      return this.hostMap.get(query.addr)[0];
    for (let len = 32; len >= 0; len--) {
      if (len === 32) continue;
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network))
        return subsetMap.get(network)[0];
    }
    return null;
  }

  /**
   * Gets all matching prefixes for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG[]} An array of matching IPv4 objects.
   */
  getMatchingPrefixes(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return [];
    let matches = [];
    if (query.maskLen === 32 && this.hostMap.has(query.addr)) {
      matches.push(...this.hostMap.get(query.addr));
    }
    for (const [maskLen, networkMap] of this.prefixMap.entries()) {
      const mask = maskLen === 0 ? 0 : (0xFFFFFFFF << (32 - maskLen)) >>> 0;
      const network = query.addr & mask;
      if (networkMap.has(network)) {
        matches = matches.concat(networkMap.get(network));
      }
    }
    return matches;
  }

  /**
   * Looks up IPv4 objects by their associated data.
   * @param {*} dataKey - The data key to look up.
   * @returns {IPv4_NG[]} An array of IPv4 objects with matching data.
   */
  lookupData(dataKey) {
    return this.dataMap.get(dataKey) || [];
  }

  /**
   * Gets the first matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG|null} The first matching IPv4 object, or null if not found.
   */
  firstMatch(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return null;
    let bestRoute = null;
    for (let len = 32; len >= 0; len--) {
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      if (len === 32) {
        if (this.hostMap.has(query.addr)) {
          const r = this.hostMap.get(query.addr)[0];
          if (!bestRoute || r.insertionIndex < bestRoute.insertionIndex)
            bestRoute = r;
        }
      } else {
        const subsetMap = this.prefixMap.get(len);
        if (subsetMap && subsetMap.has(network)) {
          for (const r of subsetMap.get(network)) {
            if (!bestRoute || r.insertionIndex < bestRoute.insertionIndex)
              bestRoute = r;
          }
        }
      }
    }
    return bestRoute;
  }

  /**
   * Gets the smallest aggregate prefix that covers all routes in the table.
   * @returns {IPv4_NG} The smallest aggregate IPv4 object.
   */
  getSmallestAggregate() {
    const addresses = [];
    for (const routes of this.hostMap.values()) {
      addresses.push(...routes.map(r => r.addr));
    }
    for (const networks of this.prefixMap.values()) {
      for (const routes of networks.values()) {
        addresses.push(...routes.map(r => r.addr));
      }
    }
    if (addresses.length === 0) return new IPv4("0.0.0.0/0");
    for (let maskLen = 32; maskLen >= 0; maskLen--) {
      const mask = maskLen === 0 ? 0 : (0xFFFFFFFF << (32 - maskLen)) >>> 0;
      const expectedNetwork = addresses[0] & mask;
      let allMatch = true;
      for (const addr of addresses) {
        if ((addr & mask) !== expectedNetwork) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        return new IPv4(IPv4_NG.intToIp(expectedNetwork) + '/' + maskLen);
      }
    }
    return new IPv4("0.0.0.0/0");
  }

  /**
   * Filters routes by a given supernet.
   * @param {string} prefixStr - The supernet prefix string.
   * @returns {IPv4_NG[]} An array of IPv4 objects that are subnets of the given prefix.
   */
  filterBySupernet(prefixStr) {
    const supernet = new IPv4(prefixStr);
    if (supernet.error) return [];
    const results = [];
    if (supernet.maskLen === 32 && this.hostMap.has(supernet.addr)) {
      results.push(...this.hostMap.get(supernet.addr));
    }
    for (const [maskLen, networks] of this.prefixMap.entries()) {
      for (const routeList of networks.values()) {
        for (const route of routeList) {
          if (route.isSubnetOf(supernet.toString())) results.push(route);
        }
      }
    }
    return results;
  }

  /**
   * Consolidates the routing table, aggregating prefixes where possible.
   * @returns {RoutingTableNG} A new RoutingTableNGv2 with consolidated routes.
   */
  consolidate() {
    const allRoutes = [];
    for (const routes of this.hostMap.values()) {
      allRoutes.push(...routes);
    }
    for (const networks of this.prefixMap.values()) {
      for (const routes of networks.values()) {
        allRoutes.push(...routes);
      }
    }
    allRoutes.sort((a, b) => {
      if (a.maskLen === b.maskLen) return a.addr - b.addr;
      return a.maskLen - b.maskLen;
    });
    const consolidatedRoutes = [];
    while (allRoutes.length > 0) {
      const current = allRoutes.shift();
      let overlapping = [current];
      for (let i = allRoutes.length - 1; i >= 0; i--) {
        const candidate = allRoutes[i];
        if (current.isSupernetOf(candidate.toString())) {
          overlapping.push(candidate);
          allRoutes.splice(i, 1);
        }
      }
      let combinedData = [];
      overlapping.forEach(route => {
        if (Array.isArray(route.data)) {
          combinedData.push(...route.data);
        } else {
          combinedData.push(route.data);
        }
      });
      const aggregated = new IPv4(IPv4_NG.intToIp(current.addr) + '/' + current.maskLen, combinedData);
      consolidatedRoutes.push(aggregated);
    }
    return new RoutingTableNGv2(consolidatedRoutes);
  }
}



/* ===== Deno Tests ===== */
Deno.test("IPv4: Valid address with mask", () => {
  const ip = new IPv4("192.168.1.0/24");
  assert(!ip.error);
  assertEquals(ip.getMaskLength(), 24);
  assertEquals(ip.toString(), "192.168.1.0/24");
});

Deno.test("IPv4: Default /32 mask", () => {
  const ip = new IPv4("10.0.0.1");
  assert(!ip.error);
  assertEquals(ip.getMaskLength(), 32);
  assertEquals(ip.toString(), "10.0.0.1/32");
});

Deno.test("IPv4: Invalid address", () => {
  const ip = new IPv4("300.300.300.300");
  assert(ip.error);
});

Deno.test("IPv4: Subnet and supernet checks", () => {
  const ip1 = new IPv4("192.168.1.0/24");
  const ip2 = new IPv4("192.168.0.0/16");
  assert(ip1.isSubnetOf(ip2.toString()));
  assert(ip2.isSupernetOf(ip1.toString()));
  // Equal addresses
  assert(ip1.isSubnetOf("192.168.1.0/24"));
  assert(ip1.isSupernetOf("192.168.1.0/24"));
});

Deno.test("IPv4: createPrefixesBetween basic test", () => {
  const prefixes = IPv4_NG.createPrefixesBetween("192.168.1.0", "192.168.1.255", true);
  // Expect one /24 prefix.
  assertEquals(prefixes.length, 1);
  assertEquals(prefixes[0].toString(), "192.168.1.0/24");
});

Deno.test("RoutingTable: hasMatchingPrefix and getLongestMatchPrefix", () => {
  const routes = [
    new IPv4("192.168.1.0/24", "Net A"),
    new IPv4("192.168.1.128/25", "Net B"),
    new IPv4("10.0.0.1", "Host 1"),
    new IPv4("10.0.0.2", "Host 2"),
  ];
  const rt = new RoutingTableNG(routes);
  assert(rt.hasMatchingPrefix("192.168.1.130"));
  const longest = rt.getLongestMatchPrefix("192.168.1.130");
  assert(longest !== null);
  // Since 192.168.1.128/25 is more specific than /24:
  assertEquals(longest.toString(), "192.168.1.128/25");
});

Deno.test("RoutingTable: getMatchingPrefixes and lookupData", () => {
  const routes = [
    new IPv4("10.0.0.1/32", "Host 1"),
    new IPv4("10.0.0.1/32", "Duplicate Host 1"),
  ];
  const rt = new RoutingTableNG(routes);
  const matches = rt.getMatchingPrefixes("10.0.0.1");
  assertEquals(matches.length, 2);
  const dataValues = rt.lookupData("Host 1");
  // Since one route has "Host 1" and the other "Duplicate Host 1"
  assert(dataValues.length > 0);
});

Deno.test("RoutingTable: firstMatch returns earliest route", () => {
  const routes = [
    new IPv4("192.168.1.0/24", "First"),
    new IPv4("192.168.1.0/24", "Second"),
  ];
  const rt = new RoutingTableNG(routes);
  const fm = rt.firstMatch("192.168.1.10");
  assert(fm !== null);
  assertEquals(fm.data, "First");
});

Deno.test("RoutingTable: getSmallestAggregate", () => {
  const routes = [
    new IPv4("192.168.1.0/24", "Net"),
    new IPv4("192.168.2.0/24", "Net2"),
  ];
  const rt = new RoutingTableNG(routes);
  const agg = rt.getSmallestAggregate();
  // Since the two /24s are not contiguous, the aggregate likely remains separate.
  // For this test, we simply check that a valid IPv4 is returned.
  assert(!agg.error);
  // Aggregated prefix should cover both addresses; its network must be <= each one's network.
  const aggMask = agg.mask;
  const net1 = routes[0].addr & aggMask;
  const net2 = routes[1].addr & aggMask;
  assertEquals(net1, net2);
});

Deno.test("RoutingTable: filterBySupernet", () => {
  const routes = [
    new IPv4("192.168.1.0/24", "Net A"),
    new IPv4("192.168.1.128/25", "Net B"),
    new IPv4("10.0.0.1", "Host"),
  ];
  const rt = new RoutingTableNG(routes);
  const filtered = rt.filterBySupernet("192.168.1.0/23");
  // Both of the 192.168.1.x prefixes are within 192.168.1.0/23
  assert(filtered.length >= 2);
});

Deno.test("RoutingTable: consolidate aggregates adjacent prefixes", () => {
  // Two adjacent /25s should aggregate into one /24.
  const rt = new RoutingTableNG([
    new IPv4("192.168.1.0/25", "Part A"),
    new IPv4("192.168.1.128/25", "Part B"),
  ]);
  const consolidatedRT = rt.consolidate();
  const cons = consolidatedRT.getMatchingPrefixes("192.168.1.0");
  // Expect one aggregated prefix covering the full /24.
  assertEquals(cons.length, 1);
  assertEquals(cons[0].toString(), "192.168.1.0/24");
  // Confirm that both original data elements are present as an array.
  assert(Array.isArray(cons[0].data));
  assertEquals(cons[0].data.sort(), ["Part A", "Part B"].sort());
});



export {}