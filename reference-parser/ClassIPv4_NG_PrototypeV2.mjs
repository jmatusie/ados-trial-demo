// @ts-check
const isVerbose = false
import { flattenItem, multiplyBy } from "./DataSet_Transformers.mjs"
import { is } from "./Pattern_Matching.mjs";
import { bifurcateArray } from "./Parser_Result_Helpers.mjs"
import { assertEquals, assert } from "https://deno.land/std@0.117.0/testing/asserts.ts";
import { IPv4 } from "./ClassIPv4.mjs";


// if pasting from REPL:
//const {IPv4} = await import("./static/Modules/ClassIPv4.mjs")


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

		/** @type Map<number,IPv4> */
    this.hostMap = new Map(); // Map for /32 (host) routes
		/** @type Map<number,Map<IPv4>> */
    this.prefixMap = new Map(); // Map for non-/32 routes
    this.dataMap = new Map();// Map for data lookup
		this.insertionOrderMap = new Map();

    this.orderedTable.forEach((ipv4, idx) => {
			const maskLen = IPv4.maskLen_from_mask(ipv4.mask)
			// every prefix gets referenced in the insertion order (for .getFirstMatch() )
			this.insertionOrderMap.set(ipv4,idx)

			// prefixes are split into a hostMap and a prefixMap, depending on their mask length
			// this is another optimization
      if (maskLen === 32) {
        if (!this.hostMap.has(ipv4.addr)) {
          // converting the new IPv4 instance where data is an array (to handle multiple instances but avoid duplicated IPv4 objects, handle only duplicated data
					const newRoute = new IPv4(ipv4, [ipv4.data])
          this.hostMap.set(ipv4.addr, newRoute);
        } 
				else {
          // Add data to existing route's data array
          this.hostMap.get(ipv4.addr).data.push(ipv4.data);
        }
      } 
			else {
        // Handle non-/32 routes
        if (!this.prefixMap.has(maskLen)) {
          this.prefixMap.set(maskLen, new Map());
        }
        
        const network = (ipv4.addr & ipv4.mask) >>> 0;
        const prefixMapForLen = this.prefixMap.get(maskLen);
        
        if (!prefixMapForLen.has(network)) {
          // Create a new IPv4 instance but with a data array
					const newRoute = new IPv4(ipv4, [ipv4.data])
          prefixMapForLen.set(network, newRoute);
        } 
				else {
          // Add data to existing route's data array
          prefixMapForLen.get(network).data.push(ipv4.data);
        }
      }
      
      // Index by data value for efficient lookups
      if (ipv4.data !== undefined && ipv4.data !== null) {
        const dataValue = ipv4.data; // Store the original data value
        
        // Get the target route where this data is now stored
        const targetRoute = (maskLen === 32) ? this.hostMap.get(ipv4.addr) 
          : this.prefixMap.get(maskLen).get(ipv4.addr >>> 0);
        
        // Create the data mapping
        if (!this.dataMap.has(dataValue)) {
          this.dataMap.set(dataValue, []);
        }
        
        this.dataMap.get(dataValue).push({
          route: targetRoute,
          dataIndex: targetRoute.data.length - 1
        });
      }
    });

		// may not need these in the NG version
		this.longestMatchTable = []					// cache of ordered table for longest-match processing
		this.shortestMatchTable = []				// cache of ordered table for shortest-match processing

		// may not be needed
		this.name = ''
		this.whoisResolver = null
		this.verboseLogging = false
		return this
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
		// check host table first
    if ( queryMaskLen === 32 && this.hostMap.has(query.addr) ) {
      return true;
    }
    // check prefix table
    for (let len = queryMaskLen; len >= 0; len--) {
			const mask = IPv4.mask_fromLength(len)
      const network = (query.addr & mask) >>> 0;
      const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network)) {
				return true;
			}
    }
    return false;
  }


  /**
   * Gets the longest matching prefix for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4|null} The longest matching IPv4 object, or null if not found.
   */
  getLongestMatchPrefix(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return null;

    const queryMaskLen = IPv4.maskLen_from_mask(query.mask)

    if (queryMaskLen === 32 && this.hostMap.has(query.addr)) {
      return this.hostMap.get(query.addr);
    }
    
    for (let len = queryMaskLen; len >= 0; len--) {
      if (len === 32) continue;
      const mask = IPv4.mask_fromLength(len)
      const network = (query.addr & mask) >>> 0;
      const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network)) {
        return subsetMap.get(network);
      }
    }
    return null;
  }


	getFirstMatchPrefix(ipStr) {
		const query = new IPv4(ipStr);
		if (query.error) return null;

		// get all matching routes (by default is not in insertion order), then map in the insertion order 
		const candidatePrefixes = this.getMatchingPrefixes(ipStr).map(ipv4=>({
			ipv4,
			insertionIndex:this.insertionOrderMap.get(ipv4)
		}))
		/** @typedef {typeof candidatePrefixes} CandidatePrefixes */
	
		const orderedPrefixes = candidatePrefixes.toSorted(/**@param {CandidatePrefixes} p1 @param {CandidatePrefixes} p2*/ (p1,p2) => p1.insertionIndex - p2.insertionIndex)
		return orderedPrefixes?.[0]?.ipv4 ?? null
	}


  /**
   * Gets the first matching prefix for the given IP address based on original insertion order.
   * @param {string} ipStr - The IP address string to match.
   * @returns {Object|null} Object containing the route and matched data entry, or null if not found.
   */
  getFirstMatchPrefix_orig_from_GPT(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return null;
    
    const matches = [];
    
    // Check /32 routes
    if (this.hostMap.has(query.addr)) {
      const route = this.hostMap.get(query.addr);
      route.data.forEach(dataEntry => {
        matches.push({ route, dataEntry });
      });
    }
    
    // Check other routes
    for (let len = 32; len >= 0; len--) {
      if (len === 32) continue;
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      const subsetMap = this.prefixMap.get(len);
      
      if (subsetMap && subsetMap.has(network)) {
        const route = subsetMap.get(network);
        route.data.forEach(dataEntry => {
          matches.push({ route, dataEntry });
        });
      }
    }
    
    if (matches.length === 0) return null;
    
    // Sort by insertion index and return the first match
    matches.sort(/**@param {IPv4} a @param {IPv4} b*/ (a, b) => a.dataEntry.insertionIndex - b.dataEntry.insertionIndex);
    return matches[0];
  }


  /**
   * Gets all matching prefixes for the given IP address.
   * @param {string} ipStr - The IP address string to match.
   * @returns {IPv4[]} An array of matching IPv4 objects.
   */
  getMatchingPrefixes(ipStr) {
    const query = new IPv4(ipStr);
    if (query.error) return [];
    const queryMaskLen = IPv4.maskLen_from_mask(query.mask)

    let matches = [];
    if (queryMaskLen === 32 && this.hostMap.has(query.addr)) {
      matches.push(this.hostMap.get(query.addr));
    }
    
    for (const [maskLen, networkMap] of this.prefixMap.entries()) {
			const mask = IPv4.mask_fromLength(len)
			const queryBaseNetwork = (query.addr & mask) >>> 0;		// zeroes out the host portion of the query, just in case the user supplied query was a host instead of a network
      if (networkMap.has(queryBaseNetwork)) {
        matches.push(networkMap.get(queryBaseNetwork));
      }
    }
    return matches;
  }


	getLongestMatchTable() {
		if (this.longestMatchTable.length === 0) {
			this.longestMatchMatchTable = this.orderedTable.toSorted((ip1, ip2) => {
				if (ip1.addr < ip2.addr) return -1;
				if (ip1.addr > ip2.addr) return 1;
				// If names are equal, sort by age in descending order
				return ip2.mask - ip1.mask;
			})
		}
		return this.longestMatchMatchTable
	}


	getShortestMatchTable() {
		if (this.shortestMatchTable.length === 0) {
			this.shortestMatchTable = this.getLongestMatchTable()?.toReversed()
		}
		return this.shortestMatchTable
	}


	/**
   * Looks up IPv4 objects by their associated data.
   * @param {*} dataKey - The data key to look up.
   * @returns {Object[]} An array of objects containing matching routes and data entries.
   */
  lookupData(dataKey) {
    if (!this.dataMap.has(dataKey)) return [];
    
    return this.dataMap.get(dataKey).map(entry => {
      return {
        route: entry.route,
        data: entry.route.data[entry.dataIndex]
      };
    });
  }


  /**
   * Gets the smallest aggregate prefix that covers all routes in the table.
   * @returns {IPv4} The smallest aggregate IPv4 object.
   */
  getSmallestAggregate() {
    const addresses = [];
    
    // Collect all unique network addresses
    for (const route of this.hostMap.values()) {
      addresses.push(route.addr);
    }
    
    for (const [maskLen, networkMap] of this.prefixMap.entries()) {
      for (const route of networkMap.values()) {
        addresses.push(route.addr);
      }
    }
    
    if (addresses.length === 0) return new IPv4("0.0.0.0/0");
    
    // Start with a specific check for a common mask
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
        return new IPv4(IPv4.intToIp(expectedNetwork) + '/' + maskLen);
      }
    }
    
    return new IPv4("0.0.0.0/0");
  }


  /**
   * Filters routes by a given supernet.
   * @param {string} prefixStr - The supernet prefix string.
   * @returns {IPv4[]} An array of IPv4 objects that are subnets of the given prefix.
   */
  filterBySupernet(prefixStr) {
    const supernet = new IPv4(prefixStr);
    if (supernet.error) return [];
    
    const results = [];
    
    // Check /32 routes
    for (const route of this.hostMap.values()) {
      if (route.isSubnetOf(supernet.toString())) {
        results.push(route);
      }
    }
    
    // Check other routes
    for (const [maskLen, networkMap] of this.prefixMap.entries()) {
      for (const route of networkMap.values()) {
        if (route.isSubnetOf(supernet.toString())) {
          results.push(route);
        }
      }
    }
    
    return results;
  }


  /**
   * Consolidates the routing table, aggregating prefixes where possible.
   * @returns {RoutingTableNG} A new RoutingTable with consolidated routes.
   */
  consolidate() {
    // Collect all unique routes
    const allRoutes = [];
    for (const route of this.hostMap.values()) {
      allRoutes.push(route);
    }
    
    for (const [maskLen, networkMap] of this.prefixMap.entries()) {
      for (const route of networkMap.values()) {
        allRoutes.push(route);
      }
    }
    
    // Sort by mask length (ascending) and then by address
    allRoutes.sort((a, b) => {
      if (a.maskLen === b.maskLen) return a.addr - b.addr;
      return a.maskLen - b.maskLen;
    });
    
    const consolidatedRoutes = [];
    while (allRoutes.length > 0) {
      const current = allRoutes.shift();
      let overlapping = [current];
      
      // Find routes that are subnets of the current route
      for (let i = allRoutes.length - 1; i >= 0; i--) {
        const candidate = allRoutes[i];
        if (current.isSupernetOf(candidate.toString())) {
          overlapping.push(candidate);
          allRoutes.splice(i, 1);
        }
      }
      
      // Combine all data entries from overlapping routes
      let combinedData = [];
      overlapping.forEach(route => {
        if (Array.isArray(route.data)) {
          combinedData = combinedData.concat(route.data);
        } else {
          combinedData.push(route.data);
        }
      });
      
      // Create a new route with the combined data
      const aggregated = new IPv4(
        IPv4.intToIp(current.addr) + '/' + current.maskLen, 
        combinedData
      );
      
      consolidatedRoutes.push(aggregated);
    }
    
    return new RoutingTableNG(consolidatedRoutes);
  }


	// brought in from old implementation

	// Create routing table from a simple array of existing IPv4 objects, where an item is any data type accepted by the IPv4 constructor.
	static of = (...prefixes) => new RoutingTableNG([...prefixes.flat()])
	

	// create routing table from a simple array of items, where an item is any data type accepted by the IPv4 constructor.
	// For example:	'10.10.10.10/31', an IPv4 object, a 32-bit unsigned number, etc
	static fromRawList = (...prefixes) => new RoutingTableNG([...prefixes.flat()].map((pfxstr)=>new IPv4(pfxstr)))

	// create routing table from a simple array of items, where an item is any data type accepted by the IPv4 constructor.
	// For example:	'10.10.10.10/31', an IPv4 object, a 32-bit unsigned number, etc
	static fromRawRecords = (prefixPropName) => (...records) => new RoutingTableNG([...records.flat()].map((record)=>new IPv4(record[prefixPropName], record)))
	//static fromRawRecords = (prefixPropName) => (...records) => new RoutingTableNG([...records.flat()].map(({[prefixPropName]:prefix, ...record})=>new IPv4(prefix, record)))

	/**	getUnallocatedBlocksWithin
	 * @params _constrainingBlock - all prefixes are carved out of holes with respect to the provided subnet
	 * @returns a RoutingTableNG object containing all prefixes filling in the gaps in the routing table (within the constraining prefix)
	 * 
	 */
	getUnallocatedBlocksWithin(_constrainingBlock = '0.0.0.0/0') {
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		const workingSet = this.getLongestMatchTable().filter((ip) => ip.isSubnetOf(constrainingBlock))
		const sortedSet = [...workingSet].sort((ip1, ip2) => ip1.addr - ip2.addr || ip1.mask - ip2.mask)

		//this.getShortestMatchTable().filter(ip=>ip.isSubnetOf(constrainingBlock))
		const blockEndAddr = constrainingBlock.getBroadcast().addr + 1
		const accObjInitState = {
			cursor: constrainingBlock.addr,
			results: [],
		}
		const preliminaryReport = sortedSet.reduce((accObj, prefix, index, inputArray) => {
			let { cursor, results } = accObj
			if (cursor < prefix.addr) {				// protect against more specific routes following their summaries in the input, works because we sorted using getShortestMatch() method
				const rangeEnd = prefix.addr
				const holes = IPv4.createPrefixesBetween(cursor, rangeEnd)
				results = [...results, ...holes]
				cursor = prefix.getBroadcast().addr + 1	 // advanced 1 address past our prefix, which is the next potential open spot
				return { cursor, results }
			}
			else {
				cursor = prefix.getBroadcast().addr + 1	 // advanced 1 address past our prefix, which is the next potential open spot
				return { cursor, results }
			}
		}, accObjInitState)
		const { cursor, results } = preliminaryReport
		const finalResults = (cursor <= blockEndAddr)				// if we still have room in the constraininglbock after processing our prefixes
			? [...results, ...IPv4.createPrefixesBetween(cursor, blockEndAddr)].flat()
			: results.flat()
		return new RoutingTableNG(finalResults)
	}

	/** @iterator
	*		@returns: a single IPv4 network object representing the smallest
	*							block that covers the entire routing tables' ranges
	*		@note		 	needs to be tested as a broad match returns 0.0.0.0/32
	*/
	[Symbol.iterator]() {
		const dataSet = this.orderedTable	// a reference to this objects array is held in a closure, because the iterator cannot reference "this" directly
		return function* () {
			let curIndex = 0
			while (curIndex < dataSet.length) {
				yield new IPv4(dataSet[curIndex])
				curIndex++
			}
		}()
	}


	// define some useful lists of prefixes per common conventions & standards
	static multicastRanges = new RoutingTableNG([
		new IPv4('224.0.0.0/24').setData({ scope: "linkLocal", useCasePerIANA: "" }),
		new IPv4('224.0.1.0/24').setData({ scope: "networkControl", useCasePerIANA: "" }),
		new IPv4('224.0.2.0/16').setData({ scope: "adhoc", useCasePerIANA: "" }),
		new IPv4('224.3.0.0/15').setData({ scope: "adhoc", useCasePerIANA: "" }),
		new IPv4('232.0.0.0/8').setData({ scope: "SSM", useCasePerIANA: "" }),
		new IPv4('233.0.0.0/8').setData({ scope: "GLOP", useCasePerIANA: "" }),
		new IPv4('233.252.0.0/14').setData({ scope: "adhoc", useCasePerIANA: "" }),
		new IPv4('234.0.0.0/8').setData({ scope: "unicast_based", useCasePerIANA: "" }),
		new IPv4('239.0.0.0/8').setData({ scope: "private", useCasePerIANA: "" }),
	])

	static specialUseRanges = new RoutingTableNG([
		//new IPv4("0.0.0.0/8")				.setData({scope: "software", 			useCasePerIANA: "Current network (only valid as source address)" }),
		new IPv4("10.0.0.0/8").setData({ scope: "private", useCasePerIANA: "RFC1918 private networks" }),
		new IPv4("100.64.0.0/10").setData({ scope: "private", useCasePerIANA: "Carrier-grade NAT" }),
		new IPv4("127.0.0.0/8").setData({ scope: "host", useCasePerIANA: "Loopback addresses" }),
		new IPv4("169.254.0.0/16").setData({ scope: "linkLocal", useCasePerIANA: "Local link" }),
		new IPv4("172.16.0.0/12").setData({ scope: "private", useCasePerIANA: "RFC1918 private networks" }),
		new IPv4("192.0.0.0/24").setData({ scope: "private", useCasePerIANA: "IETF Protocol Assignments" }),
		new IPv4("192.0.2.0/24").setData({ scope: "documentation", useCasePerIANA: "TEST-NET-1: for documentation and examples" }),
		new IPv4("192.88.99.0/24").setData({ scope: "internet", useCasePerIANA: "Formerly used for IPv6 to IPv4 relay" }),
		new IPv4("192.168.0.0/16").setData({ scope: "private", useCasePerIANA: "RFC1918 private networks" }),
		new IPv4("198.18.0.0/15").setData({ scope: "private", useCasePerIANA: "Used for benchmark testing of inter-network communications between two separate subnets" }),
		new IPv4("198.51.100.0/24").setData({ scope: "documentation", useCasePerIANA: "TEST-NET-2: for documentation and examples" }),
		new IPv4("203.0.113.0/24").setData({ scope: "documentation", useCasePerIANA: "TEST-NET-3: for documentation and examples" }),
		new IPv4("224.0.0.0/4").setData({ scope: "internet", useCasePerIANA: "IP multicast" }),
		new IPv4("240.0.0.0/4").setData({ scope: "internet", useCasePerIANA: "future use (Former Class E network)" }),
	])



}
