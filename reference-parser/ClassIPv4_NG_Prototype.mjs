// @ts-check
const isVerbose = false
import { flattenItem, multiplyBy } from "./DataSet_Transformers.mjs"
import { is } from "./Pattern_Matching.mjs";
import { bifurcateArray } from "./Parser_Result_Helpers.mjs"
import { assertEquals, assert } from "https://deno.land/std@0.117.0/testing/asserts.ts";
import { IPv4 } from "./ClassIPv4.mjs";


// if pasting from REPL:
//const {IPv4} = await import("./static/Modules/ClassIPv4.mjs")


// @ts-check

/**
 * Represents an IPv4 address with associated data.
 */

/**
 * Represents a routing table containing IPv4 routes.
 */
class RoutingTableNG {
  /** @param {IPv4[]|string[]} ipv4Array - An array of IPv4 objects to initialize the routing table. */
  constructor(...ipv4Array) {
		const ipv4Prefixes = ipv4Array.flat().map((prefix) => new IPv4(prefix))

		const [erroredPrefixes, cleanPrefixes] = bifurcateArray(/** @param {IPv4} ipv4*/ (ipv4)=>is.notEmpty(ipv4.error)) (ipv4Prefixes)
		this.errorPrefixes = erroredPrefixes
		/** @type {IPv4[]} */
		this.orderedTable = cleanPrefixes

		/** @type Map<number,IPv4[]> */
    this.hostMap = new Map();
		/** @type Map<number,IPv4[]> */
    this.prefixMap = new Map();
    this.dataMap = new Map();
		this.insertionOrderMap = new Map();

    this.orderedTable.forEach( (ipv4, idx) => {
			const maskLen = IPv4.maskLen_from_mask(ipv4.mask)
			// every prefix gets referenced in the insertion order (for .getFirstMatch() )
			this.insertionOrderMap.set(ipv4,idx)

			if (ipv4?.data) {
				this.dataMap.set(ipv4.data, this)
			}

			// prefixes are split into a hostMap and a prefixMap, depending on their mask length
			// this is another optimization
			if (maskLen === 32) {
        if (!this.hostMap.has(ipv4.addr)) {
          this.hostMap.set(ipv4.addr, []);
        }
        this.hostMap.get(ipv4.addr).push(ipv4);
      } 
			else {
				// for non-host masks, each mask length gets its own lookup map (an optimization).	Initialize a new one for such maskLen if not aleady created
        if (!this.prefixMap.has(maskLen)) {
          this.prefixMap.set(maskLen, new Map());
        }
				const network = (ipv4.addr & ipv4.mask) >>> 0;
        const prefixMapForLen = this.prefixMap.get(maskLen);

        if (!prefixMapForLen.has(network)) {
          // Create a new IPv4 instance with data array
          prefixMapForLen.set(network, []);
        }
        prefixMapForLen.get(network).push(ipv4);
      }

			// Index by data value for efficient lookups
      if (ipv4.data !== undefined && ipv4.data !== null) {
        if (!this.dataMap.has(ipv4.data)) {
          this.dataMap.set(ipv4.data, []);
        }
        this.dataMap.get(ipv4.data).push(ipv4);
      }
    })  // end of loop


		// may not need these in the NG version
		this.longestMatchTable = []					// cache of ordered table for longest-match processing
		this.shortestMatchTable = []				// cache of ordered table for shortest-match processing


		this.name = ''
		this.whoisResolver = null
		this.verboseLogging = false

  }

  /**
   * Checks if there's a matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to check.
   * @returns {boolean} True if a matching prefix is found.
   */
	hasRouteFor(ipStr) {
		const query = new IPv4(ipStr);
		if (query.error) return false;
		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)

		if (queryMaskLen === 32) {
			if (this.hostMap.has(query.addr)) return true;
		}
		for (let len = queryMaskLen; len >= 0; len--) {
			const mask = IPv4.mask_fromLength(len)
			//const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
			const network = (query.addr & mask) >>> 0;

			const subsetMap = this.prefixMap.get(len);
			if (subsetMap && subsetMap.has(network)) return true;
		}
		return false;
	}

  /**
   * Gets the longest matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   */
  getLongestMatchPrefix(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return null;
		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)

		if (queryMaskLen === 32) {
			if (this.hostMap.has(query.addr)) { 
				return this.hostMap.get(query.addr)[0] 
			}
		}

	  for (let len = queryMaskLen; len >= 0; len--) {
			const mask = IPv4.mask_fromLength(len)
			const network = (query.addr & mask) >>> 0;
			const subsetMap = this.prefixMap.get(len);
			if (subsetMap && subsetMap.has(network)) {
				return subsetMap.get(network)[0];
			}
    }
    return null;
  }


		/**
   * Gets all matching prefixes for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG[]} An array of matching IPv4 objects.
   */
  /**
   * Gets the first matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4_NG|null} The first matching IPv4 object, or null if not found.
   */
  getFirstMatchPrefix(ipStr) {
    const query = new IPv4(ipStr);
		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)		
    if (query.error) return null;
    let firstRouteSoFar = null;
    for (let len = 32; len >= 0; len--) {
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      if (len === 32) {
        if (this.hostMap.has(query.addr)) {
          const r = this.hostMap.get(query.addr)[0];
          if (!firstRouteSoFar || r.insertionIndex < firstRouteSoFar.insertionIndex)
            firstRouteSoFar = r;
        }
      } else {
        const subsetMap = this.prefixMap.get(len);
        if (subsetMap && subsetMap.has(network)) {
          for (const r of subsetMap.get(network)) {
            if (!firstRouteSoFar || r.insertionIndex < firstRouteSoFar.insertionIndex)
              firstRouteSoFar = r;
          }
        }
      }
    }
    return firstRouteSoFar;
  }

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
    const ipAddrSetToAggregate = [];
    for (const routes of this.hostMap.values()) {
      ipAddrSetToAggregate.push(...routes);
    }
    for (const networks of this.prefixMap.values()) {
      for (const routes of networks.values()) {
        ipAddrSetToAggregate.push(...routes);
      }
    }
    ipAddrSetToAggregate.sort((a, b) => {
      if (a.maskLen === b.maskLen) return a.addr - b.addr;
      return a.maskLen - b.maskLen;
    });
    const consolidatedRoutes = [];
    while (ipAddrSetToAggregate.length > 0) {
      const current = ipAddrSetToAggregate.shift();
      let overlapping = [current];
      for (let i = ipAddrSetToAggregate.length - 1; i >= 0; i--) {
        const candidate = ipAddrSetToAggregate[i];
        if (current.isSupernetOf(candidate.toString())) {
          overlapping.push(candidate);
          ipAddrSetToAggregate.splice(i, 1);
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


	/**getLongestMatchPrefixes(ipStr)  - gets matching prefixes, even  multiple instances of same prefix/length (for data use)
	   * Gets all longest matching prefixes for the given IP address.
		 * Of only a single one exists, will return an array of a single prefix
	   * @param {string} ipStr - The IP address string to match.
	   */
	getLongestMatchPrefixes(ipStr) {
		const query = new IPv4(ipStr);
		if (query.error) return null;
		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)

		if (query.maskLen === 32 && this.hostMap.has(query.addr))
			return this.hostMap.get(query.addr)
		for (let len = queryMaskLen; len >= 0; len--) {
			const mask = IPv4.mask_fromLength(len)
			const network = (query.addr & mask) >>> 0;      const subsetMap = this.prefixMap.get(len);
			if (subsetMap && subsetMap.has(network))
				return subsetMap.get(network)
		}
		return null;
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
  assert(rt.hasRouteFor("192.168.1.130"));
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
  const fm = rt.getFirstMatchPrefix("192.168.1.10");
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