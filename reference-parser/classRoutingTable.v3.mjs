//import { IPv4 } from "./ClassIPv4.mjs";
//import * as DeepValues from "./DeepValues.mjs"
//import * as PatternMatching from "./Pattern_Matching.mjs"

import { bifurcateArray } from "./ArrayFunctionalUtils.mjs";
import { deepEqualFast_v2 } from "./DeepValues.mjs";

const { IPv4 } = await import("./ClassIPv4.mjs");
const DeepValues = await import("./DeepValues.mjs");
const { is, arr } = await import("./Pattern_Matching.mjs");


class RoutingTable {
	constructor(...ipv4Array) {
		console.log("routing-table instance #2");
		this.erroredPrefixes = [];
		this.interfaceTable = [];
		this.prefixTable = [];
		this.insertionOrderMap = new Map();
		this.maskLengthMap = new Map();

		this.originalPrefixes = ipv4Array.flat(); // kept for troubleshooting purposes along with this.importedPrefixes
		ipv4Array.flat().forEach((existingPrefix) => {
			this.addEntry(existingPrefix);
		})
	}

	addEntry(prefix) {
		const prefixData = prefix?.data
			? Array.isArray(prefix.data)
				? prefix.data
				: [prefix.data]
			: [];
		const newPrefix = new IPv4(prefix, prefixData)
		
		this.insertionOrderMap.set(newPrefix, this.insertionOrderMap.size);

		// keep invalid prefixes around - at least for troubleshooting & awareness of garbage-in
		if (newPrefix.isInvalid()) {
			this.erroredPrefixes.push(newPrefix);
		}
		// prefixes with host bits are excluded from address lookup (assumed to be a type of error in the context of a routing table)
		else if (!newPrefix.isNetwork()) {
			this.interfaceTable.push(newPrefix);
		}
		// valid network prefixes are added to the lookup and ordered table
		else {
			this.prefixTable.push(newPrefix);
			this.addToLookupMap(newPrefix);
		}
	}

	addToLookupMap(newPrefix) {
		const maskLen = IPv4.maskLen_from_mask(newPrefix.mask);

		if (!this.maskLengthMap.has(maskLen)) {
			this.maskLengthMap.set(maskLen, new Map());
		}

		const prefixMapForGivenLength = this.maskLengthMap.get(maskLen);
		const prefixAddr = newPrefix.addr;

		// if this it the first time we see this network/mask, add it
		if (!prefixMapForGivenLength.has(prefixAddr)) {
			prefixMapForGivenLength.set(prefixAddr, newPrefix);
		} else {
			// if this is a duplicate prefix, append the data instead of adding the prefix again
			const existingPrefix = prefixMapForGivenLength.get(prefixAddr);
			existingPrefix.data = existingPrefix?.data.concat(newPrefix.data);
			//console.log(`Duplicate entry found: ${newPrefix.addr}/${newPrefix.mask}.	Appending data element ${newPrefix.data[0]} (now have ${existingPrefix.data.length} entries)`, existingPrefix);
		}

		// const existingEntries = prefixMapForGivenLength.get(prefixAddr);
		// const duplicate = existingEntries.find(entry => entry.data === newPrefix.data);
		// if (!duplicate) {
		// prefixMapForGivenLength.get(prefixAddr).push(newPrefix);
		// } else {
		// IPv4.log('debug', `Duplicate entry found: ${newPrefix.addr}/${newPrefix.mask}`);
		// }
	}

	addToLookupMap_prev(newPrefix) {
		const maskLen = newPrefix.maskLen();
		if (!this.maskLengthMap.has(maskLen)) {
			this.maskLengthMap.set(maskLen, new Map());
		}
		const addrMap = this.maskLengthMap.get(maskLen);
		const addrKey = newPrefix.addr;
		if (!addrMap.has(addrKey)) {
			addrMap.set(addrKey, []);
		}
		const existingEntries = addrMap.get(addrKey);
		const duplicate = existingEntries.find(
			(entry) => entry.data === newPrefix.data
		);
		if (!duplicate) {
			addrMap.get(addrKey).push(newPrefix);
		} else {
			console.log(`Duplicate entry found: ${newPrefix.addr}/${newPrefix.mask}`);
		}
	}

	hasRouteFor(query) {
		const ipv4 = typeof query === "string" ? new IPv4(query) : query;
		if (ipv4.isInvalid()) throw new Error("Invalid query format");
		return this.getLongestMatchPrefix(ipv4) !== null;
	}

	getLongestMatchPrefix(query) {
		const queryIPv4 = typeof query === "string" ? new IPv4(query) : query;
		if (queryIPv4.isInvalid()) return null;
		const queryMaskLen = IPv4.maskLen_from_mask(queryIPv4.mask);

		for (let length = queryMaskLen; length >= 0; length--) {
			if (this.maskLengthMap.has(length)) {
				const addrMap = this.maskLengthMap.get(length);
				const maskedAddr = (queryIPv4.addr & this.prefixToMask(length)) >>> 0;
				if (addrMap.has(maskedAddr)) {
					return addrMap.get(maskedAddr);
				}
			}
		}
		return null;
	}

	getFirstMatchPrefix(query) {
		const ipv4 = typeof query === "string" ? new IPv4(query) : query;
		if (ipv4.isInvalid()) throw new Error("Invalid query format");

		for (const entry of this.prefixTable) {
			if ((ipv4.addr & entry.mask) >>> 0 === entry.addr) {
				return entry;
			}
		}
		return null;
	}

	getExactMatchPrefix(query) {
		const ipv4 = typeof query === "string" ? new IPv4(query) : query;
		if (ipv4.isInvalid()) throw new Error("Invalid query format");

		const prefixLength = ipv4.maskLen();
		if (this.maskLengthMap.has(prefixLength)) {
			const addrMap = this.maskLengthMap.get(prefixLength);
			if (addrMap.has(ipv4.addr)) {
				return (
					addrMap.get(ipv4.addr).find((entry) => entry.mask === ipv4.mask) ||
					null
				);
			}
		}
		return null;
	}

	getMatchingPrefixes(query) {
		const ipv4 = typeof query === "string" ? new IPv4(query) : query;
		if (ipv4.isInvalid()) throw new Error("Invalid query format");

		const matches = [];
		for (const entry of this.prefixTable) {
			if ((ipv4.addr & entry.mask) >>> 0 === entry.addr) {
				matches.push(entry);
			}
		}
		return matches.length > 0 ? matches : null;
	}

	getAllPrefixesWithin(query) {
		const ipv4 = typeof query === "string" ? new IPv4(query) : query;
		if (ipv4.isInvalid()) throw new Error("Invalid query format");

		const matches = [];
		for (const entry of this.prefixTable) {
			if (entry.isSubnetOf(ipv4)) {
				matches.push(entry);
			}
		}
		return matches.length > 0 ? matches : null;
	}

	getAggregate(query) {
		const ipv4 = typeof query === "string" ? new IPv4(query) : query;
		if (ipv4.isInvalid()) throw new Error("Invalid query format");

		const validPrefixes = this.prefixTable.filter(
			(entry) => (ipv4.addr & entry.mask) >>> 0 === entry.addr
		);
		if (validPrefixes.length === 0) return null;

		const aggregateAddr = validPrefixes.reduce(
			(acc, entry) => acc & entry.addr,
			0xffffffff
		);
		const aggregateMask = validPrefixes.reduce(
			(acc, entry) => (acc & entry.mask) >>> 0,
			0xffffffff
		);
		const aggregateData = validPrefixes.flatMap((entry) => entry.data);

		return new IPv4(this.intToIP(aggregateAddr) +	"/" +	this.maskToPrefixLength(aggregateMask),	aggregateData);
	}

	/** 
	 * Answers the question: given a valid prefix and maskLen, starting with maskLen how many additional levels 
	 * can we reduce maskLen while still keeping addr a prefix ?
	 * 0 means we cannot reduce maskLen any further
	 * 1 means we can reduce by one maskLen (possibly fit 2 pfxs starting with addr)
	 * 2 means we can reduce by two maskLen (possibly fit 4 pfxs starting with addr)
	 * 3 means we can reduce by two maskLen (possibly fit 8 pfxs starting with addr)
	 * 4 means we can reduce by two maskLen (possibly fit 16 pfxs starting with addr)
	 * ...etc
	 * 
	 * Summary: starting with the current prefix & subnet mask, shift the subnet mask left (filling zeroes to the right)
	 * until the (addr & mask) no longer equal to the addr.  The iteration count is the potential, but adjusted by 1 so that
	 * -1 means it's a host (invalid), 0 means ipv4Obj is already the highest aggregate, and 1 is the 
	 */
	static aggregatePotential(ipv4Obj) {
		const {addr, mask} = ipv4Obj
		let shiftCount = 0
		for (shiftCount=0; shiftCount<32; shiftCount++) {
			if ((addr & (mask << shiftCount)>>>0) !== addr) break
		}
		return shiftCount - 1
	}

	consolidate_v2(_dataReducerFn) {
		// first, set up the data handling callbac.	Below is the default implementation
		const combineData =
			_dataReducerFn !== undefined
				? _dataReducerFn
				: (dataFromPrefix1, dataFromPrefix2) => {
						if (Array.isArray(dataFromPrefix2)) {
							return Array.isArray(dataFromPrefix1)
								? [...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
								: [dataFromPrefix1, ...dataFromPrefix2];   //	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread
						} 
						else {
							return Array.isArray(dataFromPrefix1)
								? [...dataFromPrefix1, dataFromPrefix2] // only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
								: [dataFromPrefix1, dataFromPrefix2];   // neither are arrays - return an array with two elements
						}
					};

		// calculates a subnet from a prefix.	Will always return a netowrk address (host bits dropped)
		const superNetFrom = (pfx) => {
			const shiftedMask = ((pfx.mask >>> 0) << 1) >>> 0;
			const network = (pfx.addr & shiftedMask) >>> 0;
			return new IPv4(
				{
					addr: network,
					mask: shiftedMask, // shift the subnet mask left by one bit
				},
				pfx.data
			);
		};
		const shiftMaskLeft = (pfx) => {
			const shiftedMask = ((pfx.mask >>> 0) << 1) >>> 0;
			const addr = pfx.addr;
			return new IPv4({
				addr,
				mask: shiftedMask, // shift the subnet mask left by one bit
			});
		};
		const isAligned = (pfx1, pfx2) =>
			pfx1.isNetwork() &&
			pfx2.isNetwork() &&
			superNetFrom(pfx1).isSupernetOf(pfx2);

		// essential for the consolidation algoritm - prefix table must be sorted from lowest to highest address, and for same address, shortest to longest prefix
		/**@type {ReturnType<typeof IPv4.of>[]} */
		const ipAddrSetToAggregate = this.prefixTable.toSorted((ip1, ip2) => {
			if (ip1.addr < ip2.addr) return -1;
			if (ip1.addr > ip2.addr) return 1;
			// If names are equal, sort by subnet mask length from longest to shortest
			return ip1.mask - ip2.mask;
		});

		const prefixIterator = ipAddrSetToAggregate.values();

		// this will contain the aggregate IPv4 entries
		const aggregatePrefixes = [];

		// The algorithm works tables of two prefixes or larger, so handle special cases for zero or single-member routing table
		const prefixCount = ipAddrSetToAggregate.length;
		if (prefixCount === 0) return new RoutingTable_v3();
		if (prefixCount === 1) return RoutingTable.of(this.prefixTable);

		/**	the algoritm:
		 * Host bits are ignored for any routing table entries.	Only the prefix is used & evaluated
		 *
		 * With a properly sorted source table, assume the first entry is a candidate aggregate - pop it off
		 *
		 * An address space range is maintained to track the start & end addresses covered by the candidate.
		 * Calculate it for the candidate aggregate (startOfRange, startOfNextRange)
		 *
		 * With the remaining entries of the source table, iterate one by one, checking if each entry falls within
		 * the range.
		 *
		 * Due to the sorting of the source table, we know that for each iteration, only 4 conditions occur:
		 *	1. If the currentPrefix.addr < candidateAggregate.startOfNextRange(), currentPrefix is a subnet (or the same):
		 *		 Then combine data & hold on to candidate for next prefixes:
		 *			 candidateAggregate.data = combineData(candidateAggregate.data, currentPrefix.data)
		 *
		 *	2. If the currentPrefix.addr === candidateAggregate startOfNextRange, check if they share the same supernet:
		 *		 Then create a candidateSupernet from the candidateAggregate
		 *			 2a. if the currentPrefix is a subnet of the candidateSupernet, they are aligned:
		 *					 - new aggregate becomes the new candidateAggregate
		 *					 - candidateAggregate.data = combineData(candidateAggregate.data, currentPrefix.data)
		 *			 2b. if they are not aligned, we've reached a boundary:
		 *					 - add the candidateAggregate to the aggregatePrefixes
		 *					 - the currentPrefix becomes the new candidateAggregate
		 *
		 *	3. If the currentPrefix.addr > candidateAggregate.startOfNextRange, we've reached a boundary:
		 *			 - add the candidateAddregate to the aggregatePrefixes
		 *			 - the currentPrefix becomes the next candidateAggregate
		 *
		 */

		// remove annoying errors from TS about "possibly undefined..."
		/** @type { <T>(val: T) => NonNullable<T>} */
		const happyTS = (val) => {
			if (val == null)
				throw new Error(`Make Typescript Happy - should never happen!!`);
			return val;
		};

		let candidateAggregate = happyTS(prefixIterator.next()?.value);
		let startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
		let currentPrefix = happyTS(prefixIterator.next().value);

		while (currentPrefix) {
			// case 1: currenttPrefix is a subnet of candidate
			if (currentPrefix.addr < startOfNextRange.addr) {
				candidateAggregate.data = combineData(
					candidateAggregate.data,
					currentPrefix.data
				);
			}
			// case 2: the currentPrefix is juxtaposed with the end of candidateAggregates's range AND the share the same mask
			// at which point we have two subcases:  
			//   a. two blocks of equal size aligned (i.e. 192.168.0.0/24 & 192.168.1.0/24), or 
			//   b. two blocks of equal size are not aligned (192.168.1.0/24 & 192.168.2.0/24)
			// 2a vs 2b can be tested based on creating a supernet of the candidatePrefix, and testing both for membership
			else if ((currentPrefix.addr === startOfNextRange.addr) && (currentPrefix.mask === candidateAggregate.mask)) {
				const nextCandidateAggregate = superNetFrom(candidateAggregate);
				// case 2a: currentPrefix is aligned with candidate aggregate's supernet, so upgrade the candidate aggregate tothe supernet, combine data
				if (nextCandidateAggregate.isSupernetOf(currentPrefix)) {
					nextCandidateAggregate.data = combineData(
						candidateAggregate.data,
						currentPrefix.data
					);
					candidateAggregate = nextCandidateAggregate;
					startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
				}
				// case 2b: currentPrefix not aligned with with superNet, so we're done with aggregating - so we formally commit the aggregate, advance & recalculate
				else {
					aggregatePrefixes.push(candidateAggregate);
					candidateAggregate = currentPrefix;
					startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
				}
			}
			// case 3: currentPrefix.addr lines up with startOfNextRange address, but current prefix & the candidate prefixes have different masks
			//   this is a bit of a mess, but it may be the same action as case 4 - we'll have to see
			else if ((currentPrefix.addr === startOfNextRange.addr) && (currentPrefix.mask !== candidateAggregate.mask)) {
				aggregatePrefixes.push(candidateAggregate);
				candidateAggregate = currentPrefix;
				startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
			}
			// case 4: currentPrefix is not adjancent, so we're done with aggregating.
			else if (currentPrefix.addr > startOfNextRange.addr) {
				aggregatePrefixes.push(candidateAggregate);
				candidateAggregate = currentPrefix;
				startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
			} else {
				throw new Error("how do this happen?? RoutingTable_v3.consolidate()");
			}
			currentPrefix = prefixIterator.next().value;
		}

		// get the final aggregate in there...
		aggregatePrefixes.push(candidateAggregate);

		const consolidatedTable = new RoutingTable(aggregatePrefixes);
		return consolidatedTable;
	}


	consolidate(_dataReducerFn) {
		// first, set up the data handling callbac.	Below is the default implementation
		const combineData =
			_dataReducerFn !== undefined
				? _dataReducerFn
				: (dataFromPrefix1, dataFromPrefix2) => {
						if (Array.isArray(dataFromPrefix2)) {
							return Array.isArray(dataFromPrefix1)
								? [...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
								: [dataFromPrefix1, ...dataFromPrefix2];   //	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread
						} 
						else {
							return Array.isArray(dataFromPrefix1)
								? [...dataFromPrefix1, dataFromPrefix2] // only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
								: [dataFromPrefix1, dataFromPrefix2];   // neither are arrays - return an array with two elements
						}
					};

		// calculates a subnet from a prefix.	Will always return a netowrk address (host bits dropped)
		const superNetFrom = (pfx) => {
			const shiftedMask = ((pfx.mask >>> 0) << 1) >>> 0;
			const network = (pfx.addr & shiftedMask) >>> 0;
			return new IPv4(
				{
					addr: network,
					mask: shiftedMask, // shift the subnet mask left by one bit
				},
				pfx.data
			);
		};
		const shiftMaskLeft = (pfx) => {
			const shiftedMask = ((pfx.mask >>> 0) << 1) >>> 0;
			const addr = pfx.addr;
			return new IPv4({
				addr,
				mask: shiftedMask, // shift the subnet mask left by one bit
			});
		};
		const isAligned = (pfx1, pfx2) =>
			pfx1.isNetwork() &&
			pfx2.isNetwork() &&
			superNetFrom(pfx1).isSupernetOf(pfx2);

		// essential for the consolidation algoritm - prefix table must be sorted from lowest to highest address, and for same address, shortest to longest prefix
		/**@type {ReturnType<typeof IPv4.of>[]} */
		const ipAddrSetToAggregate = this.prefixTable.toSorted((ip1, ip2) => {
			if (ip1.addr < ip2.addr) return -1;
			if (ip1.addr > ip2.addr) return 1;
			// If names are equal, sort by subnet mask length from longest to shortest
			return ip1.mask - ip2.mask;
		});

		const prefixIterator = ipAddrSetToAggregate.values();

		// this will contain the aggregate IPv4 entries
		const aggregatePrefixes = [];

		// The algorithm works tables of two prefixes or larger, so handle special cases for zero or single-member routing table
		const prefixCount = ipAddrSetToAggregate.length;
		if (prefixCount === 0) return new RoutingTable_v3();
		if (prefixCount === 1) return RoutingTable.of(this.prefixTable);

		/**	the algoritm:
		 * Host bits are ignored for any routing table entries.	Only the prefix is used & evaluated
		 *
		 * With a properly sorted source table, assume the first entry is a candidate aggregate - pop it off
		 *
		 * An address space range is maintained to track the start & end addresses covered by the candidate.
		 * Calculate it for the candidate aggregate (startOfRange, startOfNextRange)
		 *
		 * With the remaining entries of the source table, iterate one by one, checking if each entry falls within
		 * the range.
		 *
		 * Due to the sorting of the source table, we know that for each iteration, only 4 conditions occur:
		 *	1. If the currentPrefix.addr < candidateAggregate.startOfNextRange(), currentPrefix is a subnet (or the same):
		 *		 Then combine data & hold on to candidate for next prefixes:
		 *			 candidateAggregate.data = combineData(candidateAggregate.data, currentPrefix.data)
		 *
		 *	2. If the currentPrefix.addr === candidateAggregate startOfNextRange, check if they share the same supernet:
		 *		 Then create a candidateSupernet from the candidateAggregate
		 *			 2a. if the currentPrefix is a subnet of the candidateSupernet, they are aligned:
		 *					 - new aggregate becomes the new candidateAggregate
		 *					 - candidateAggregate.data = combineData(candidateAggregate.data, currentPrefix.data)
		 *			 2b. if they are not aligned, we've reached a boundary:
		 *					 - add the candidateAggregate to the aggregatePrefixes
		 *					 - the currentPrefix becomes the new candidateAggregate
		 *
		 *	3. If the currentPrefix.addr > candidateAggregate.startOfNextRange, we've reached a boundary:
		 *			 - add the candidateAddregate to the aggregatePrefixes
		 *			 - the currentPrefix becomes the next candidateAggregate
		 *
		 */

		// remove annoying errors from TS about "possibly undefined..."
		/** @type { <T>(val: T) => NonNullable<T>} */
		const happyTS = (val) => {
			if (val == null)
				throw new Error(`Make Typescript Happy - should never happen!!`);
			return val;
		};

		let candidateAggregate = happyTS(prefixIterator.next()?.value);
		let startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
		let currentPrefix = happyTS(prefixIterator.next().value);

		while (currentPrefix) {
			// case 1: currenttPrefix is a subnet of candidate
			if (currentPrefix.addr < startOfNextRange.addr) {
				candidateAggregate.data = combineData(
					candidateAggregate.data,
					currentPrefix.data
				);
			}
			// case 2: the currentPrefix is juxtaposed with the end of candidateAggregates's range AND the share the same mask
			// at which point we have two subcases:  
			//   a. two blocks of equal size aligned (i.e. 192.168.0.0/24 & 192.168.1.0/24), or 
			//   b. two blocks of equal size are not aligned (192.168.1.0/24 & 192.168.2.0/24)
			// 2a vs 2b can be tested based on creating a supernet of the candidatePrefix, and testing both for membership
			else if ((currentPrefix.addr === startOfNextRange.addr) && (currentPrefix.mask === candidateAggregate.mask)) {
				const nextCandidateAggregate = superNetFrom(candidateAggregate);
				// case 2a: currentPrefix is aligned with candidate aggregate's supernet, so upgrade the candidate aggregate tothe supernet, combine data
				if (nextCandidateAggregate.isSupernetOf(currentPrefix)) {
					nextCandidateAggregate.data = combineData(
						candidateAggregate.data,
						currentPrefix.data
					);
					candidateAggregate = nextCandidateAggregate;
					startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
				}
				// case 2b: currentPrefix not aligned with with superNet, so we're done with aggregating - so we formally commit the aggregate, advance & recalculate
				else {
					aggregatePrefixes.push(candidateAggregate);
					candidateAggregate = currentPrefix;
					startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
				}
			}
			// case 3: currentPrefix.addr lines up with startOfNextRange address, but current prefix & the candidate prefixes have different masks
			//   this is a bit of a mess, but it may be the same action as case 4 - we'll have to see
			else if ((currentPrefix.addr === startOfNextRange.addr) && (currentPrefix.mask !== candidateAggregate.mask)) {
				aggregatePrefixes.push(candidateAggregate);
				candidateAggregate = currentPrefix;
				startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
			}
			// case 4: currentPrefix is not adjancent, so we're done with aggregating.
			else if (currentPrefix.addr > startOfNextRange.addr) {
				aggregatePrefixes.push(candidateAggregate);
				candidateAggregate = currentPrefix;
				startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
			} else {
				throw new Error("how do this happen?? RoutingTable_v3.consolidate()");
			}
			currentPrefix = prefixIterator.next().value;
		}

		// get the final aggregate in there...
		aggregatePrefixes.push(candidateAggregate);

		const consolidatedTable = new RoutingTable(aggregatePrefixes);
		return consolidatedTable;
	}

	consolidateSubnets(_dataReducerFn) {
		// first, set up the data handling callbac.	Below is the default implementation
		const combineData =
			_dataReducerFn !== undefined
				? _dataReducerFn
				: (dataFromPrefix1, dataFromPrefix2) => {
						if (Array.isArray(dataFromPrefix2)) {
							return Array.isArray(dataFromPrefix1)
								? [...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
								: [dataFromPrefix1, ...dataFromPrefix2];   //	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread
						} 
						else {
							return Array.isArray(dataFromPrefix1)
								? [...dataFromPrefix1, dataFromPrefix2] // only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
								: [dataFromPrefix1, dataFromPrefix2];   // neither are arrays - return an array with two elements
						}
					};


		// essential for the consolidation algoritm - prefix table must be sorted from lowest to highest address, and for same address, shortest to longest prefix
		/**@type {ReturnType<typeof IPv4.of>[]} */
		const ipAddrSetToAggregate = this.prefixTable.toSorted((ip1, ip2) => {
			if (ip1.addr < ip2.addr) return -1;
			if (ip1.addr > ip2.addr) return 1;
			// If names are equal, sort by subnet mask length from longest to shortest
			return ip1.mask - ip2.mask;
		});

		const prefixIterator = ipAddrSetToAggregate.values();

		// this will contain the aggregate IPv4 entries
		const aggregatePrefixes = [];
		const leftBehind = []

		// The algorithm works tables of two prefixes or larger, so handle special cases for zero or single-member routing table
		const prefixCount = ipAddrSetToAggregate.length;
		if (prefixCount === 0) return new RoutingTable_v3();
		if (prefixCount === 1) return RoutingTable.of(this.prefixTable);

		/**	the algoritm:
		 * Host bits are ignored for any routing table entries.	Only the prefix is used & evaluated
		 *
		 * With a properly sorted source table, assume the first entry is a candidate aggregate - pop it off
		 *
		 * An address space range is maintained to track the start & end addresses covered by the candidate.
		 * Calculate it for the candidate aggregate (startOfRange, startOfNextRange)
		 *
		 * With the remaining entries of the source table, iterate one by one, checking if each entry falls within
		 * the range.
		 *
		 * Due to the sorting of the source table, we know that for each iteration, only 4 conditions occur:
		 *	1. If the currentPrefix.addr < candidateAggregate.startOfNextRange(), currentPrefix is a subnet (or the same):
		 *		 Then combine data & hold on to candidate for next prefixes:
		 *			 candidateAggregate.data = combineData(candidateAggregate.data, currentPrefix.data)
		 *
		 *	2. If the currentPrefix.addr === candidateAggregate startOfNextRange, check if they share the same supernet:
		 *		 Then create a candidateSupernet from the candidateAggregate
		 *			 2a. if the currentPrefix is a subnet of the candidateSupernet, they are aligned:
		 *					 - new aggregate becomes the new candidateAggregate
		 *					 - candidateAggregate.data = combineData(candidateAggregate.data, currentPrefix.data)
		 *			 2b. if they are not aligned, we've reached a boundary:
		 *					 - add the candidateAggregate to the aggregatePrefixes
		 *					 - the currentPrefix becomes the new candidateAggregate
		 *
		 *	3. If the currentPrefix.addr > candidateAggregate.startOfNextRange, we've reached a boundary:
		 *			 - add the candidateAddregate to the aggregatePrefixes
		 *			 - the currentPrefix becomes the next candidateAggregate
		 *
		 */

		// remove annoying errors from TS about "possibly undefined..."
		/** @type { <T>(val: T) => NonNullable<T>} */
		const happyTS = (val) => {
			if (val == null)
				throw new Error(`Make Typescript Happy - should never happen!!`);
			return val;
		};

		let candidateAggregate = happyTS(prefixIterator.next()?.value);
		let startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
		let currentPrefix = happyTS(prefixIterator.next().value);

		while (currentPrefix) {
			// case 1: currenttPrefix is a subnet of candidate
			if (currentPrefix.addr < startOfNextRange.addr) {
				candidateAggregate.data = combineData(
					candidateAggregate.data,
					currentPrefix.data
				);
			}
			else {
				aggregatePrefixes.push(candidateAggregate);
				candidateAggregate = currentPrefix;
				startOfNextRange = happyTS(candidateAggregate.getStartOfNext());
			}
			currentPrefix = prefixIterator.next().value;
		}

		// get the final aggregate in there...
		leftBehind.push(candidateAggregate);

		return {
			aggregatePrefixes,
			leftBehind,
		}
	}

	consolidateAdjacent(_dataReducerFn) {
		// first, set up the data handling callbac.	Below is the default implementation
		const combineData =	(_dataReducerFn !== undefined)
			? _dataReducerFn
			: (dataFromPrefix1, dataFromPrefix2) => {
				if (Array.isArray(dataFromPrefix2)) {
					return Array.isArray(dataFromPrefix1)
						? [...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
						: [dataFromPrefix1, ...dataFromPrefix2];   //	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread
				} 
				else {
					return Array.isArray(dataFromPrefix1)
						? [...dataFromPrefix1, dataFromPrefix2] // only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
						: [dataFromPrefix1, dataFromPrefix2];   // neither are arrays - return an array with two elements
				}
		};

		const ipAddrSetToAggregate = this.prefixTable.toSorted((ip1, ip2) => {
			if (ip1.addr < ip2.addr) return -1;
			if (ip1.addr > ip2.addr) return 1;
			// If names are equal, sort by subnet mask length from longest to shortest
			return ip1.mask - ip2.mask;
		});

		const summarizedPrefixes = RoutingTable.summarizePrefixes(ipAddrSetToAggregate, combineData)
		return new RoutingTable(summarizedPrefixes)
	}


	// Recursive function to summarize prefixes
	static summarizePrefixes(prefixes, _dataReducerFn) {
		const combineData =	(_dataReducerFn !== undefined)
			? _dataReducerFn
			: (dataFromPrefix1, dataFromPrefix2) => {
				if (Array.isArray(dataFromPrefix2)) {
					return Array.isArray(dataFromPrefix1)
						? [...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
						: [dataFromPrefix1, ...dataFromPrefix2];   //	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread
				} 
				else {
					return Array.isArray(dataFromPrefix1)
						? [...dataFromPrefix1, dataFromPrefix2] // only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
						: [dataFromPrefix1, dataFromPrefix2];   // neither are arrays - return an array with two elements
				}
		};

		const summarized = [];
		let i = 0;

		while (i < prefixes.length) {
				let currentPrefix = prefixes[i];
				let j = i + 1;

				// Try to aggregate adjacent prefixes
				while (j < prefixes.length && RoutingTable.#canAggregate(currentPrefix, prefixes[j])) {
					currentPrefix = RoutingTable.#createAggregate(currentPrefix);
					currentPrefix.data = combineData(currentPrefix.data,	prefixes[j].data);
					j++;
				}

				// Add the aggregated prefix to the result
				summarized.push(currentPrefix);
				i = j;
		}

		// Check if further aggregation is possible (recursion)
		if (summarized.length < prefixes.length) {
				return RoutingTable.summarizePrefixes(summarized);
		}

		return summarized;
	}	


	// Helper function to calculate the mask from the mask length
	static #calculateMask(maskLen) {
		return maskLen === 0 ? 0 : ~((1 << (32 - maskLen)) - 1) >>> 0;
	}

	// Helper function to check if two prefixes can be aggregated
	static #canAggregate(prefix1, prefix2) {
		// Check if the mask lengths are the same
		if (prefix1.mask !== prefix2.mask) return false;

		// Check if the addresses are adjacent
		const combinedMask = RoutingTable.#calculateMask(prefix1.maskLen - 1);
		return (prefix1.addr & combinedMask) === (prefix2.addr & combinedMask);
	}


	static canAggregate(prefix, level=1) {
		const mask = prefix.mask
		const newMask = (mask << level) >>> 0
		if ((prefix.addr & newMask) === prefix.addr) return true
		return false
	}

	// Helper function to create an aggregate one-level higher than the current mask
	static #createAggregate(prefix) {
		const newMaskLen = prefix.maskLen - 1;
		const newMask = RoutingTable.#calculateMask(newMaskLen);
		const newAddr = prefix.addr & newMask;
		return new IPv4({ addr: newAddr, mask: newMask });
	}


	getUnallocatedBlocksWithin(_constrainingBlock = "0.0.0.0/0") {
		const newRoutingTable = new RoutingTable();
		let currentAddr = 0;

		const constrainingBlock =	_constrainingBlock instanceof IPv4 ? _constrainingBlock	: new IPv4(_constrainingBlock);

		const workingSet = this.getAllPrefixesWithin(constrainingBlock);

		if (workingSet == null) {
			return null;
		}

		for (const entry of workingSet) {
			if (currentAddr < entry.addr) {
				const unallocatedBlock = new IPv4(
					this.intToIP(currentAddr) +
						"/" +
						this.maskToPrefixLength(~entry.mask),
					[]
				);
				newRoutingTable.addEntry(unallocatedBlock);
			}
			currentAddr = entry.addr + (1 << (32 - entry.maskLen()));
		}

		if (currentAddr < 0xffffffff) {
			const unallocatedBlock = new IPv4(this.intToIP(currentAddr) + "/0", []);
			newRoutingTable.addEntry(unallocatedBlock);
		}

		return newRoutingTable;
	}

	getUnallocatedBlocksWithin_from_NG(_constrainingBlock = '0.0.0.0/0') {
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

	getUnallocatedBlocksWithin_alt(constrainingPrefix) {
		
		// 1. Filter prefixes that are fully contained within the constraining prefix
		const containedPrefixes = this.prefixTable.filter( (ipv4) => ipv4.isSubnetOf(constrainingPrefix));
		
		// 2. Remove redundant prefixes (those that are subnets of others)
		const minimalPrefixes = containedPrefixes.filter(p =>
			!containedPrefixes.some(q => p !== q && p.isSubnetOf(q))
		);
	
		// 3. Sort remaining prefixes by their start address
		const sorted = minimalPrefixes.slice().sort((a, b) => a.addr - b.addr);
	
		// 4. Calculate constraining prefix's address range
		const cStart = constrainingPrefix.addr;
		const cEnd = RoutingTable.getPrefixEnd(cStart, constrainingPrefix.maskLen);
	
		// 5. Find gaps between existing prefixes
		const gaps = [];
		let current = cStart;
	
		for (const prefix of sorted) {
			const pStart = prefix.addr;
			const pEnd = RoutingTable.getPrefixEnd(pStart, prefix.maskLen);
	
			if (pStart > current) {
				gaps.push({ start: current, end: pStart - 1 });
			}
			
			current = pEnd + 1 >>> 0;  // Update current position with overflow protection
			
			if (current > cEnd) break; // Exit early if we've passed the constraining range
		}
	
		// Add final gap if remaining
		if (current <= cEnd) {
			gaps.push({ start: current, end: cEnd });
		}
	
		// 6. Convert gaps to minimal CIDR prefixes
		return gaps.flatMap(gap => RoutingTable.rangeToPrefixes(gap.start, gap.end));
	}


		
	static tryMerge(a, b) {
		// Can only merge prefixes with the same mask length
		if (a.maskLen !== b.maskLen) return null;
		
		const parentMaskLen = a.maskLen - 1;
		if (parentMaskLen < 0) return null;
	
		// Calculate parent network
		const parentMask = (0xFFFFFFFF << (32 - parentMaskLen)) >>> 0;
		const aParent = a.addr & parentMask;
		const bParent = b.addr & parentMask;
	
		// Must share the same parent network and be consecutive blocks
		if (aParent === bParent) {
			const blockSize = 1 << (32 - a.maskLen);
			if (b.addr === (a.addr + blockSize) >>> 0) {
				return new IPv4({
					addr: aParent,
					maskLen: parentMaskLen,
					mask: parentMask
				});
			}
		}
		
		return null;
	}


	// Helper: Calculate the last address in a prefix
	static getPrefixEnd(addr, maskLen) {
		const hostBits = 32 - maskLen;
		return (addr + (1 << hostBits) - 1) >>> 0;
	}
	
	// Helper: Convert IP range to minimal CIDR list
	static rangeToPrefixes(start, end) {
		const prefixes = [];
		let current = start;
		
		while (current <= end) {
			// Find maximum possible mask length for current position
			let maskLen = 32;
			let bestEnd = current;
			
			while (maskLen > 0) {
				const mask = (0xFFFFFFFF << (32 - maskLen)) >>> 0;
				const network = current & mask;
				const blockEnd = network + (1 << (32 - maskLen)) - 1;
				
				if (network === current && blockEnd <= end) {
					bestEnd = blockEnd;
					break;
				}
				maskLen--;
			}
	
			// Create and add the prefix
			prefixes.push(new IPv4({
				addr: current,
				maskLen: maskLen,
				mask: (0xFFFFFFFF << (32 - maskLen)) >>> 0
			}));
	
			// Move to next potential start address
			current = bestEnd + 1 >>> 0;
		}
	
		return prefixes;
	}
	

	prefixToMask(length) {
		return IPv4.mask_from_maskLen(length);
		//return length >= 0 && length <= 32 ? (0xFFFFFFFF << (32 - length)) >>> 0 : 0xFFFFFFFF;
	}

	intToIP(int) {
		return `${(int >>> 24) & 0xff}.${(int >>> 16) & 0xff}.${
			(int >>> 8) & 0xff
		}.${int & 0xff}`;
	}

	maskToPrefixLength(mask) {
		return IPv4.maskLen_from_mask(mask) || 0;
	}

	/** 
	 * @todo - WIP
	 * Returns an Array of unique prefixes, and for each prefix, any interface entries continained therewithin are added
	 * as a property of the prefix.
	 * Property is added to the most specfic prefix
	 */
	get structuredTable() {
		const internalStructuredTable = new Map()

		const longestMatchPrefixesIterator = this.longestMatchPrefixes.values()
		const interfaceIPs = this.longestMatchInterfaces.values()
		const structuredTableMap = new Map()

		for (const interfaceIP of interfaceIPs) {
			const longestMatchPrefix = this.getLongestMatchPrefix(interfaceIP)
			if (!structuredTableMap.has(longestMatchPrefix)) {
				structuredTableMap.set(longestMatchPrefix, [interfaceIP])
			}
			else {
				structuredTableMap.get(longestMatchPrefix).push(interfaceIP)
			}
		}
		return structuredTableMap

		
	}

	get longestMatchInterfaces() {
		return this.interfaceTable.toSorted( (ip1,ip2)=>ip2.addr-ip1.addr || ip1.mask-ip2.mask )
	}

	get longestMatchPrefixes() {
		return this.prefixTable.toSorted( (ip1,ip2)=>ip2.addr-ip1.addr || ip1.mask-ip2.mask )
	}

	get orderedTable() {
		return this.prefixTable
	}

	toString({ showData = false } = {}) {
		if (showData) {
			return this.prefixTable
				.map((entry) => `${entry}, data:${JSON.stringify(entry.data)}`)
				.join("\n");
		} else {
			return this.prefixTable.map((ip) => ip.toString()).join("\n");
		}
	}

	show({ asBinary=true, asHex=false, asRange=false, showData=false, logFn=console.log } = {}) {
		const outputString = this.prefixTable
			.map((ipv4) => ipv4.format({asBinary, asHex, asRange, showData}))
			.join("\n\n");
		logFn(outputString);
		return this
	}

	
}

//// Example usage:
//const rt = new RoutingTable(['192.168.1.0/24', '192.168.1.1/32', '10.0.0.0/8']);
//console.log(rt.getLongestMatchPrefix('192.168.1.1')); // IPv4 { addr: 3232235777, mask: 4294967295, ... }
//console.log(rt.getFirstMatchPrefix('192.168.1.1')); // IPv4 { addr: 3232235776, mask: 4294967040, ... }
//console.log(rt.getExactMatchPrefix('192.168.1.1/32')); // IPv4 { addr: 3232235777, mask: 4294967295, ... }



const abc = () => {
	class IPv4_alt {
    constructor({ addr, mask }) {
        this.addr = addr; // 32-bit unsigned integer representing the address
        this.mask = mask; // 32-bit unsigned integer representing the mask
        this.maskLen = IPv4_alt.maskLen_fromMask(mask); // Calculate maskLen from mask
    }

    // Static method to calculate mask length from mask
    static maskLen_fromMask(mask) {
        let maskLen = 0;
        while (mask & (1 << (31 - maskLen))) {
            maskLen++;
        }
        return maskLen;
    }
	}

	// Helper function to calculate the mask from the mask length
	function calculateMask(maskLen) {
	    return maskLen === 0 ? 0 : ~((1 << (32 - maskLen)) - 1) >>> 0;
	}

	// Helper function to check if two prefixes can be aggregated
	function canAggregate(prefix1, prefix2) {
	    // Check if the mask lengths are the same
	    if (prefix1.maskLen !== prefix2.maskLen) return false;

	    // Check if the addresses are adjacent
	    const combinedMask = calculateMask(prefix1.maskLen - 1);
	    return (prefix1.addr & combinedMask) === (prefix2.addr & combinedMask);
	}

	// Helper function to aggregate two prefixes
	function aggregate(prefix1, prefix2) {
	    const newMaskLen = prefix1.maskLen - 1;
	    const newMask = calculateMask(newMaskLen);
	    const newAddr = prefix1.addr & newMask;
	    return new IPv4_alt({ addr: newAddr, mask: newMask });
	}

	// Recursive function to summarize prefixes
	function summarizePrefixes(prefixes) {
	    const summarized = [];
	    let i = 0;

	    while (i < prefixes.length) {
	        let currentPrefix = prefixes[i];
	        let j = i + 1;

	        // Try to aggregate adjacent prefixes
	        while (j < prefixes.length && canAggregate(currentPrefix, prefixes[j])) {
	            currentPrefix = aggregate(currentPrefix, prefixes[j]);
	            j++;
	        }

	        // Add the aggregated prefix to the result
	        summarized.push(currentPrefix);
	        i = j;
	    }

	    // Check if further aggregation is possible
	    if (summarized.length < prefixes.length) {
	        return summarizePrefixes(summarized);
	    }

	    return summarized;
	}

	// Example usage
	const prefixes = [
	    new IPv4_alt({ addr: 0x0A000000, mask: calculateMask(23) }), // 10.0.0.0/23
	    new IPv4_alt({ addr: 0x0A000200, mask: calculateMask(23) }), // 10.0.2.0/23
	    new IPv4_alt({ addr: 0x0A000400, mask: calculateMask(23) }), // 10.0.4.0/23
	    new IPv4_alt({ addr: 0x0A000600, mask: calculateMask(24) }), // 10.0.6.0/24
	    new IPv4_alt({ addr: 0x0A000700, mask: calculateMask(24) })  // 10.0.7.0/24
	];

	const summarizedPrefixes = summarizePrefixes(prefixes);
	console.log(summarizedPrefixes);	


	// List of test cases:
	const testCases = [
		{
		name: "Duplicates Test",
		input: [
		new IPv4_alt("192.168.1.0/24"),
		new IPv4_alt("192.168.1.0/24"),
		new IPv4_alt("192.168.1.0/24")
		],
		expected: [ new IPv4_alt("192.168.1.0/24") ]
		},
		{
		name: "Subnet Inclusion Test",
		input: [
		new IPv4_alt("10.0.0.0/16"),
		new IPv4_alt("10.0.0.0/24"),
		new IPv4_alt("10.0.1.0/24")
		],
		expected: [ new IPv4_alt("10.0.0.0/16") ]
		},
		{
		name: "Adjacent /25 to /24 Consolidation",
		input: [
		new IPv4_alt("192.168.0.0/25"),
		new IPv4_alt("192.168.0.128/25")
		],
		expected: [ new IPv4_alt("192.168.0.0/24") ]
		},
		{
		name: "Mixed Masks to /22 Summary",
		input: [
		new IPv4_alt("10.0.0.0/23"),
		new IPv4_alt("10.0.2.0/25"),
		new IPv4_alt("10.0.2.128/25"),
		new IPv4_alt("10.0.3.0/24")
		],
		expected: [ new IPv4_alt("10.0.0.0/22") ]
		},
		{
		name: "Multiple Consolidation Groups",
		input: [
		new IPv4_alt("10.0.0.0/24"),
		new IPv4_alt("10.0.1.0/24"),
		new IPv4_alt("10.0.2.0/24"),
		new IPv4_alt("10.0.3.0/24")
		],
		expected: [
		new IPv4_alt("10.0.0.0/23"),
		new IPv4_alt("10.0.2.0/23")
		]
		},
		{
		name: "Non-Aggregable Prefixes",
		input: [
		new IPv4_alt("172.16.0.0/12"),
		new IPv4_alt("192.168.0.0/16")
		],
		expected: [
		new IPv4_alt("172.16.0.0/12"),
		new IPv4_alt("192.168.0.0/16")
		]
		},
		{
		name: "Consecutive /32 Aggregation A",
		input: [
		new IPv4_alt("192.168.1.0/32"),
		new IPv4_alt("192.168.1.1/32")
		],
		expected: [ new IPv4_alt("192.168.1.0/31") ]
		},
		{
		name: "Consecutive /32 Aggregation B",
		input: [
		new IPv4_alt("192.168.1.0/32"),
		new IPv4_alt("192.168.1.1/32"),
		new IPv4_alt("192.168.1.2/32"),
		new IPv4_alt("192.168.1.3/32")
		],
		expected: [ new IPv4_alt("192.168.1.0/30") ]
		}
		];
		
		// Run tests
		testCases.forEach(test => {
		const result = consolidatePrefixes(test.input);
		const resultStr = result.map(prefix => prefix.toString());
		const expectedStr = test.expected.map(prefix => prefix.toString());
		console.log(`${test.name}:`);
		console.log(" Result: ", resultStr);
		console.log(" Expected:", expectedStr);
		console.log(" Pass:", deepEqualFast_v2(resultStr, expectedStr))
		console.log("---------------");
		});
	
	

}







const abc2 = () => {
	class RoutingTable {
    constructor({ addr, mask }) {
        this.addr = addr; // 32-bit unsigned integer representing the address
        this.mask = mask; // 32-bit unsigned integer representing the mask
	  }


	// Helper function to check if two prefixes can be aggregated
	static canAggregate(prefix1, prefix2) {
			// Check if the mask lengths are the same
			if (prefix1.maskLen !== prefix2.maskLen) return false;

			// Check if the addresses are adjacent
			const combinedMask = IPv4.mask_from_maskLen(prefix1.maskLen - 1);
			return (prefix1.addr & combinedMask) === (prefix2.addr & combinedMask);
	}

	// Helper function to aggregate two prefixes
	static superNetFrom(prefix1, prefix2) {
			const newMaskLen = prefix1.maskLen - 1;
			const newMask = IPv4.mask_from_maskLen(newMaskLen);
			const newAddr = prefix1.addr & newMask;
			return new RoutingTable({ addr: newAddr, mask: newMask });
	}

	// Recursive function to summarize prefixes
	static summarizePrefixes(prefixes) {
			const summarized = [];
			let i = 0;

			while (i < prefixes.length) {
					let currentPrefix = prefixes[i];
					let j = i + 1;
			
					// Try to aggregate adjacent prefixes
					while (j < prefixes.length && RoutingTable.canAggregate(currentPrefix, prefixes[j])) {
							currentPrefix = RoutingTable.superNetFrom(currentPrefix, prefixes[j]);
							j++;
					}
				
					// Add the aggregated prefix to the result
					summarized.push(currentPrefix);
					i = j;
			}
		
			// Check if further aggregation is possible
			if (summarized.length < prefixes.length) {
					return RoutingTable.summarizePrefixes(summarized);
			}
		
			return summarized;
	}

}

	
	// Example usage
	const prefixes = [
	    new RoutingTable({ addr: 0x0A000000, mask: IPv4.mask_from_maskLen(23) }), // 10.0.0.0/23
	    new RoutingTable({ addr: 0x0A000200, mask: IPv4.mask_from_maskLen(23) }), // 10.0.2.0/23
	    new RoutingTable({ addr: 0x0A000400, mask: IPv4.mask_from_maskLen(23) }), // 10.0.4.0/23
	    new RoutingTable({ addr: 0x0A000600, mask: IPv4.mask_from_maskLen(24) }), // 10.0.6.0/24
	    new RoutingTable({ addr: 0x0A000700, mask: IPv4.mask_from_maskLen(24) })  // 10.0.7.0/24
	];

	const summarizedPrefixes = RoutingTable.summarizePrefixes(prefixes);
	console.log(summarizedPrefixes);	
}



const abc3 = () => {

	function consolidatePrefixes(prefixes) {
		const result = [];
		let i = 0;
	
		while (i < prefixes.length) {
			let current = prefixes[i];
			
			// Skip if already covered by previous consolidated prefix
			if (result.length > 0 && isSubnet(current, result[result.length - 1])) {
				i++;
				continue;
			}
	
			let j = i + 1;
			let best = current;
			let currentStart = current.addr;
			let currentEnd = getBroadcast(current);
	
			// Try to merge with subsequent prefixes
			while (j < prefixes.length) {
				const next = prefixes[j];
				
				// Check if next is covered by current best
				if (isSubnet(next, best)) {
					j++;
					continue;
				}
	
				const nextEnd = getBroadcast(next);
				const combinedEnd = Math.max(currentEnd, nextEnd);
				const cidr = findCidr(currentStart, combinedEnd);
	
				if (cidr === null) break;
	
				const mask = IPv4_alt.mask_from_maskLen(cidr);
				const network = currentStart & mask;
				const broadcast = network | (~mask >>> 0);
	
				if (broadcast !== combinedEnd) break; // Not exact match
	
				best = new IPv4_alt({ addr: network, mask });
				currentEnd = broadcast;
				j++;
			}
	
			result.push(best);
			i = j;
		}
	
		return result;
	}
	
	// Helper functions
	function isSubnet(child, parent) {
		const parentMask = parent.mask;
		return (child.addr & parentMask) === (parent.addr & parentMask) &&
					 IPv4_alt.maskLen_from_mask(child.mask) >= IPv4_alt.maskLen_from_mask(parentMask);
	}
	
	function getBroadcast(prefix) {
		return prefix.addr | (~prefix.mask >>> 0);
	}
	
	function findCidr(start, end) {
		const xor = start ^ end;
		if (xor === 0) return 32;
	
		const bits = 32 - Math.clz32(xor);
		let cidr = 32 - bits;
		let mask = IPv4_alt.mask_from_maskLen(cidr);
		let network = start & mask;
		let broadcast = network | (~mask >>> 0);
	
		// Find largest CIDR that exactly covers the range
		while (cidr > 0 && broadcast !== end) {
			cidr--;
			mask = IPv4_alt.mask_from_maskLen(cidr);
			network = start & mask;
			broadcast = network | (~mask >>> 0);
		}
	
		return broadcast === end ? cidr : null;
	}
	


// Example stub for your IPv4 class (if needed for testing)
class IPv4_alt {
	constructor(input) {
	if (typeof input === "string") {
	// Parse a string like "10.0.0.0/23"
	const [addr, maskLen] = input.split("/");
	this.addr = IPv4_alt.ipToInt(addr);
	this.mask = IPv4_alt.mask_from_maskLen(parseInt(maskLen, 10));
	} else if (typeof input === "object") {
	// Copy from another IPv4 or plain data object
	this.addr = input.addr;
	this.mask = input.mask;
	}
	}
	
	toString() {
	return IPv4_alt.intToIp(this.addr) + "/" + IPv4_alt.maskLen_from_mask(this.mask);
	}
	
	// Helper methods for conversion
	static ipToInt(ip) {
	return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
	}
	
	static intToIp(int) {
	return [(int >>> 24), (int >> 16 & 255), (int >> 8 & 255), (int & 255)].join('.');
	}
	
	// Stub implementations (you should replace these with your own)
	static mask_from_maskLen(maskLen) {
	return maskLen === 0 ? 0 : (~0 << (32 - maskLen)) >>> 0;
	}
	
	static maskLen_from_mask(mask) {
	for (let len = 0; len <= 32; len++) {
	if (mask === IPv4_alt.mask_from_maskLen(len)) return len;
	}
	return null;
	}
	}
	
	// Assume you have the function consolidatePrefixes implemented
	function consolidatePrefixes(prefixes) {
	// ... implementation goes here ...
	// For testing, we leave it as a stub.
	return prefixes; // Replace this with the proper consolidated output
	}
	
	// List of test cases:
	const testCases = [
	{
	name: "Duplicates Test",
	input: [
	new IPv4_alt("192.168.1.0/24"),
	new IPv4_alt("192.168.1.0/24"),
	new IPv4_alt("192.168.1.0/24")
	],
	expected: [ new IPv4_alt("192.168.1.0/24") ]
	},
	{
	name: "Subnet Inclusion Test",
	input: [
	new IPv4_alt("10.0.0.0/16"),
	new IPv4_alt("10.0.0.0/24"),
	new IPv4_alt("10.0.1.0/24")
	],
	expected: [ new IPv4_alt("10.0.0.0/16") ]
	},
	{
	name: "Adjacent /25 to /24 Consolidation",
	input: [
	new IPv4_alt("192.168.0.0/25"),
	new IPv4_alt("192.168.0.128/25")
	],
	expected: [ new IPv4_alt("192.168.0.0/24") ]
	},
	{
	name: "Mixed Masks to /22 Summary",
	input: [
	new IPv4_alt("10.0.0.0/23"),
	new IPv4_alt("10.0.2.0/25"),
	new IPv4_alt("10.0.2.128/25"),
	new IPv4_alt("10.0.3.0/24")
	],
	expected: [ new IPv4_alt("10.0.0.0/22") ]
	},
	{
	name: "Multiple Consolidation Groups",
	input: [
	new IPv4_alt("10.0.0.0/24"),
	new IPv4_alt("10.0.1.0/24"),
	new IPv4_alt("10.0.2.0/24"),
	new IPv4_alt("10.0.3.0/24")
	],
	expected: [
	new IPv4_alt("10.0.0.0/23"),
	new IPv4_alt("10.0.2.0/23")
	]
	},
	{
	name: "Non-Aggregable Prefixes",
	input: [
	new IPv4_alt("172.16.0.0/12"),
	new IPv4_alt("192.168.0.0/16")
	],
	expected: [
	new IPv4_alt("172.16.0.0/12"),
	new IPv4_alt("192.168.0.0/16")
	]
	},
	{
	name: "Consecutive /32 Aggregation A",
	input: [
	new IPv4_alt("192.168.1.0/32"),
	new IPv4_alt("192.168.1.1/32")
	],
	expected: [ new IPv4_alt("192.168.1.0/31") ]
	},
	{
	name: "Consecutive /32 Aggregation B",
	input: [
	new IPv4_alt("192.168.1.0/32"),
	new IPv4_alt("192.168.1.1/32"),
	new IPv4_alt("192.168.1.2/32"),
	new IPv4_alt("192.168.1.3/32")
	],
	expected: [ new IPv4_alt("192.168.1.0/30") ]
	}
	];
	
	// Run tests
	testCases.forEach(test => {
	const result = consolidatePrefixes(test.input);
	const resultStr = result.map(prefix => prefix.toString());
	const expectedStr = test.expected.map(prefix => prefix.toString());
	console.log(`${test.name}:`);
	console.log(" Result: ", resultStr);
	console.log(" Expected:", expectedStr);
	console.log(" Pass:", JSON.stringify(resultStr) === JSON.stringify(expectedStr));
	console.log("---------------");
	});

}


const abc4 = () => {
	class IPv4_alt {
		constructor(input) {
		if (typeof input === "string") {
		// Parse a string like "10.0.0.0/23"
		const [addr, maskLen] = input.split("/");
		this.addr = IPv4_alt.ipToInt(addr);
		this.mask = IPv4_alt.mask_from_maskLen(parseInt(maskLen, 10));
		} else if (typeof input === "object") {
		// Copy from another IPv4 or plain data object
		this.addr = input.addr;
		this.mask = input.mask;
		}
		}
		
		toString() {
		return IPv4_alt.intToIp(this.addr) + "/" + IPv4_alt.maskLen_from_mask(this.mask);
		}
		
		// Helper methods for conversion
		static ipToInt(ip) {
		return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
		}
		
		static intToIp(int) {
		return [(int >>> 24), (int >> 16 & 255), (int >> 8 & 255), (int & 255)].join('.');
		}
		
		// Stub implementations (you should replace these with your own)
		static mask_from_maskLen(maskLen) {
		return maskLen === 0 ? 0 : (~0 << (32 - maskLen)) >>> 0;
		}
		
		static maskLen_from_mask(mask) {
		for (let len = 0; len <= 32; len++) {
		if (mask === IPv4_alt.mask_from_maskLen(len)) return len;
		}
		return null;
		}
		}
		

		
	function consolidatePrefixes(prefixes) {
		const result = [];
	
		for (let i = 0; i < prefixes.length; i++) {
			let current = prefixes[i];
	
			// Skip if already covered by previous consolidated prefix
			if (result.length > 0 && isSubnet(current, result[result.length - 1])) {
				continue;
			}
	
			let j = i + 1;
			let best = current;
	
			// Try to merge with subsequent prefixes
			while (j < prefixes.length) {
				const next = prefixes[j];
	
				// Check if next is covered by current best
				if (isSubnet(next, best)) {
					j++;
					continue;
				}
	
				// Check if next can be merged with best
				if (canMerge(best, next)) {
					best = mergePrefixes(best, next);
					j++;
				} else {
					break;
				}
			}
	
			result.push(best);
			i = j - 1; // Adjust index since we've processed some prefixes ahead
		}
	
		// Handle non-aggregable prefixes by checking if any prefix in result can be merged further
		for (let i = 0; i < result.length; i++) {
			for (let j = i + 1; j < result.length; j++) {
				if (canMerge(result[i], result[j])) {
					const merged = mergePrefixes(result[i], result[j]);
					result.splice(i, 2, merged);
					i--; // Adjust index after merging
					break;
				}
			}
		}
	
		return result;
	}
	
	// Helper functions
	function isSubnet(child, parent) {
		const parentMask = parent.mask;
		return (child.addr & parentMask) === (parent.addr & parentMask) &&
					 IPv4_alt.maskLen_from_mask(child.mask) >= IPv4_alt.maskLen_from_mask(parentMask);
	}
	
	function canMerge(prefix1, prefix2) {
		const start1 = prefix1.addr;
		const end1 = getBroadcast(prefix1);
		const start2 = prefix2.addr;
		const end2 = getBroadcast(prefix2);
	
		return end1 + 1 === start2 || start1 === end2 + 1;
	}
	
	function mergePrefixes(prefix1, prefix2) {
		const start = Math.min(prefix1.addr, prefix2.addr);
		const end = Math.max(getBroadcast(prefix1), getBroadcast(prefix2));
		const cidr = findCidr(start, end);
	
		const mask = IPv4_alt.mask_from_maskLen(cidr);
		const network = start & mask;
		const broadcast = network | (~mask >>> 0);
	
		if (broadcast !== end) throw new Error("Merge failed to cover range exactly");
	
		return new IPv4_alt({ addr: network, mask });
	}
	
	function getBroadcast(prefix) {
		return prefix.addr | (~prefix.mask >>> 0);
	}
	
	function findCidr(start, end) {
		const xor = start ^ end;
		if (xor === 0) return 32;
	
		const bits = 32 - Math.clz32(xor);
		let cidr = 32 - bits;
		let mask = IPv4_alt.mask_from_maskLen(cidr);
		let network = start & mask;
		let broadcast = network | (~mask >>> 0);
	
		// Find largest CIDR that exactly covers the range
		while (cidr > 0 && broadcast !== end) {
			cidr--;
			mask = IPv4_alt.mask_from_maskLen(cidr);
			network = start & mask;
			broadcast = network | (~mask >>> 0);
		}
	
		return broadcast === end ? cidr : null;
	}


		// List of test cases:
		const testCases = [
			{
			name: "Duplicates Test",
			input: [
			new IPv4_alt("192.168.1.0/24"),
			new IPv4_alt("192.168.1.0/24"),
			new IPv4_alt("192.168.1.0/24")
			],
			expected: [ new IPv4_alt("192.168.1.0/24") ]
			},
			{
			name: "Subnet Inclusion Test",
			input: [
			new IPv4_alt("10.0.0.0/16"),
			new IPv4_alt("10.0.0.0/24"),
			new IPv4_alt("10.0.1.0/24")
			],
			expected: [ new IPv4_alt("10.0.0.0/16") ]
			},
			{
			name: "Adjacent /25 to /24 Consolidation",
			input: [
			new IPv4_alt("192.168.0.0/25"),
			new IPv4_alt("192.168.0.128/25")
			],
			expected: [ new IPv4_alt("192.168.0.0/24") ]
			},
			{
			name: "Non-Aggregable Prefixes",
			input: [
			new IPv4_alt("172.16.0.0/12"),
			new IPv4_alt("192.168.0.0/16")
			],
			expected: [
			new IPv4_alt("172.16.0.0/12"),
			new IPv4_alt("192.168.0.0/16")
			]
			},
			{
			name: "Consecutive /32 Aggregation A",
			input: [
			new IPv4_alt("192.168.1.0/32"),
			new IPv4_alt("192.168.1.1/32")
			],
			expected: [ new IPv4_alt("192.168.1.0/31") ]
			},
			{
			name: "Consecutive /32 Aggregation B",
			input: [
			new IPv4_alt("192.168.1.0/32"),
			new IPv4_alt("192.168.1.1/32"),
			new IPv4_alt("192.168.1.2/32"),
			new IPv4_alt("192.168.1.3/32")
			],
			expected: [ new IPv4_alt("192.168.1.0/30") ]
			},
		//	{
		//		name: "Mixed Masks to /22 Summary",
		//		input: [
		//		new IPv4_alt("10.0.0.0/23"),
		//		new IPv4_alt("10.0.2.0/25"),
		//		new IPv4_alt("10.0.2.128/25"),
		//		new IPv4_alt("10.0.3.0/24")
		//		],
		//		expected: [ new IPv4_alt("10.0.0.0/22") ]
		//		},
		//	{
		//		name: "Multiple Consolidation Groups",
		//		input: [
		//		new IPv4_alt("10.0.0.0/24"),
		//		new IPv4_alt("10.0.1.0/24"),
		//		new IPv4_alt("10.0.2.0/24"),
		//		new IPv4_alt("10.0.3.0/24")
		//		],
		//		expected: [
		//		new IPv4_alt("10.0.0.0/23"),
		//		new IPv4_alt("10.0.2.0/23")
		//		]
		//		},
	
			];


			const testResults = testCases.map( (test,idx) => {
				const name = test.name
				const input = test.input
				const result = consolidatePrefixes(test.input);
				const resultStr = result.map(prefix => prefix.toString());
				const expectedStr = test.expected.map(prefix => prefix.toString());
				return {
					name,
					input,
					result,
					resultStr,
					expectedStr,
				}
			})
			
			// Run tests
			testCases.forEach(test => {
			const result = consolidatePrefixes(test.input);

			const resultStr = result.map(prefix => prefix.toString());
			const expectedStr = test.expected.map(prefix => prefix.toString());

			//console.log(`${test.name}:`);
			//console.log(" Result: ", resultStr);
			//console.log(" Expected:", expectedStr);
			//console.log(" Pass:", JSON.stringify(resultStr) === JSON.stringify(expectedStr));
			//console.log("---------------");

				return testResults
			});
			
			return testResults
	
}



const abc5 = () => {

	class IPv4_alt {
		constructor(input) {
		if (typeof input === "string") {
		// Parse a string like "10.0.0.0/23"
		const [addr, maskLen] = input.split("/");
		this.addr = IPv4_alt.ipToInt(addr);
		this.mask = IPv4_alt.mask_from_maskLen(parseInt(maskLen, 10));
		} else if (typeof input === "object") {
		// Copy from another IPv4 or plain data object
		this.addr = input.addr;
		this.mask = input.mask;
		}
		}
		
		toString() {
		return IPv4_alt.intToIp(this.addr) + "/" + IPv4_alt.maskLen_from_mask(this.mask);
		}
		
		// Helper methods for conversion
		static ipToInt(ip) {
		return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
		}
		
		static intToIp(int) {
		return [(int >>> 24), (int >> 16 & 255), (int >> 8 & 255), (int & 255)].join('.');
		}
		
		// Stub implementations (you should replace these with your own)
		static mask_from_maskLen(maskLen) {
		return maskLen === 0 ? 0 : (~0 << (32 - maskLen)) >>> 0;
		}
		
		static maskLen_from_mask(mask) {
		for (let len = 0; len <= 32; len++) {
		if (mask === IPv4_alt.mask_from_maskLen(len)) return len;
		}
		return null;
		}
		}
		


	function consolidatePrefixes(prefixes) {
		const result = [];
	
		for (let i = 0; i < prefixes.length; i++) {
			let current = prefixes[i];
	
			// Skip if already covered by previous consolidated prefix
			if (result.length > 0 && isSubnet(current, result[result.length - 1])) {
				continue;
			}
	
			let j = i + 1;
			let best = current;
	
			// Try to merge with subsequent prefixes
			while (j < prefixes.length) {
				const next = prefixes[j];
	
				// Check if next is covered by current best
				if (isSubnet(next, best)) {
					j++;
					continue;
				}
	
				// Check if next can be merged with best
				if (canMerge(best, next)) {
					best = mergePrefixes(best, next);
					j++;
				} else {
					break;
				}
			}
	
			result.push(best);
			i = j - 1; // Adjust index since we've processed some prefixes ahead
		}
	
		// Handle non-aggregable prefixes by checking if any prefix in result can be merged further
		for (let i = 0; i < result.length; i++) {
			for (let j = i + 1; j < result.length; j++) {
				if (canMerge(result[i], result[j])) {
					const merged = mergePrefixes(result[i], result[j]);
					result.splice(i, 2, merged);
					i--; // Adjust index after merging
					break;
				}
			}
		}
	
		return result;
	}
	
	// Helper functions
	function isSubnet(child, parent) {
		const parentMask = parent.mask;
		return (child.addr & parentMask) === (parent.addr & parentMask) &&
					 IPv4.maskLen_from_mask(child.mask) >= IPv4.maskLen_from_mask(parentMask);
	}
	
	function canMerge(prefix1, prefix2) {
		const start1 = prefix1.addr;
		const end1 = getBroadcast(prefix1);
		const start2 = prefix2.addr;
		const end2 = getBroadcast(prefix2);
	
		// Check if prefix2 is adjacent or covered by prefix1
		return end1 + 1 === start2 || start1 === end2 + 1 || isSubnet(prefix2, prefix1);
	}
	
	function mergePrefixes(prefix1, prefix2) {
		const start = Math.min(prefix1.addr, prefix2.addr);
		const end = Math.max(getBroadcast(prefix1), getBroadcast(prefix2));
		const cidr = findCidr(start, end);
	
		const mask = IPv4_alt.mask_from_maskLen(cidr);
		const network = start & mask;
		const broadcast = network | (~mask >>> 0);
	
		if (broadcast !== end) throw new Error("Merge failed to cover range exactly");
	
		return new IPv4_alt({ addr: network, mask });
	}
	
	function getBroadcast(prefix) {
		return prefix.addr | (~prefix.mask >>> 0);
	}
	
	function findCidr(start, end) {
		const xor = start ^ end;
		if (xor === 0) return 32;
	
		const bits = 32 - Math.clz32(xor);
		let cidr = 32 - bits;
		let mask = IPv4_alt.mask_from_maskLen(cidr);
		let network = start & mask;
		let broadcast = network | (~mask >>> 0);
	
		// Find largest CIDR that exactly covers the range
		while (cidr > 0 && broadcast !== end) {
			cidr--;
			mask = IPv4_alt.mask_from_maskLen(cidr);
			network = start & mask;
			broadcast = network | (~mask >>> 0);
		}
	
		return broadcast === end ? cidr : null;
	}



		// List of test cases:
		const testCases = [
			{
			name: "Duplicates Test",
			input: [
			new IPv4_alt("192.168.1.0/24"),
			new IPv4_alt("192.168.1.0/24"),
			new IPv4_alt("192.168.1.0/24")
			],
			expected: [ new IPv4_alt("192.168.1.0/24") ]
			},
			{
			name: "Subnet Inclusion Test",
			input: [
			new IPv4_alt("10.0.0.0/16"),
			new IPv4_alt("10.0.0.0/24"),
			new IPv4_alt("10.0.1.0/24")
			],
			expected: [ new IPv4_alt("10.0.0.0/16") ]
			},
			{
			name: "Adjacent /25 to /24 Consolidation",
			input: [
			new IPv4_alt("192.168.0.0/25"),
			new IPv4_alt("192.168.0.128/25")
			],
			expected: [ new IPv4_alt("192.168.0.0/24") ]
			},
			{
			name: "Non-Aggregable Prefixes",
			input: [
			new IPv4_alt("172.16.0.0/12"),
			new IPv4_alt("192.168.0.0/16")
			],
			expected: [
			new IPv4_alt("172.16.0.0/12"),
			new IPv4_alt("192.168.0.0/16")
			]
			},
			{
			name: "Consecutive /32 Aggregation A",
			input: [
			new IPv4_alt("192.168.1.0/32"),
			new IPv4_alt("192.168.1.1/32")
			],
			expected: [ new IPv4_alt("192.168.1.0/31") ]
			},
			{
			name: "Consecutive /32 Aggregation B",
			input: [
			new IPv4_alt("192.168.1.0/32"),
			new IPv4_alt("192.168.1.1/32"),
			new IPv4_alt("192.168.1.2/32"),
			new IPv4_alt("192.168.1.3/32")
			],
			expected: [ new IPv4_alt("192.168.1.0/30") ]
			},
		//	{
		//		name: "Mixed Masks to /22 Summary",
		//		input: [
		//		new IPv4_alt("10.0.0.0/23"),
		//		new IPv4_alt("10.0.2.0/25"),
		//		new IPv4_alt("10.0.2.128/25"),
		//		new IPv4_alt("10.0.3.0/24")
		//		],
		//		expected: [ new IPv4_alt("10.0.0.0/22") ]
		//		},
		//	{
		//		name: "Multiple Consolidation Groups",
		//		input: [
		//		new IPv4_alt("10.0.0.0/24"),
		//		new IPv4_alt("10.0.1.0/24"),
		//		new IPv4_alt("10.0.2.0/24"),
		//		new IPv4_alt("10.0.3.0/24")
		//		],
		//		expected: [
		//		new IPv4_alt("10.0.0.0/23"),
		//		new IPv4_alt("10.0.2.0/23")
		//		]
		//		},
	
			];


			const testResults = testCases.map( (test,idx) => {
				const name = test.name
				const input = test.input
				const result = consolidatePrefixes(test.input);
				const resultStr = result.map(prefix => prefix.toString());
				const expectedStr = test.expected.map(prefix => prefix.toString());
				return {
					name,
					input,
					result,
					resultStr,
					expectedStr,
				}
			})
			
			// Run tests
			testCases.forEach(test => {
			const result = consolidatePrefixes(test.input);

			const resultStr = result.map(prefix => prefix.toString());
			const expectedStr = test.expected.map(prefix => prefix.toString());

			//console.log(`${test.name}:`);
			//console.log(" Result: ", resultStr);
			//console.log(" Expected:", expectedStr);
			//console.log(" Pass:", JSON.stringify(resultStr) === JSON.stringify(expectedStr));
			//console.log("---------------");

				return testResults
			});
			
			return testResults
	


}



const abc6 = () => {
	function consolidateIPv4Prefixes(prefixes) {
    // Create a new array of IPv4 instances to avoid modifying the input
    let newPrefixes = prefixes.map(p => new IPv4(p));
    
    // First, remove duplicates and subnets
    newPrefixes = removeDuplicatesAndSubnets(newPrefixes);
    
    // Recursive consolidation
    return consolidateRecursive(newPrefixes);
}

function removeDuplicatesAndSubnets(prefixes) {
	let result = [];
	for (let i = 0; i < prefixes.length; i++) {
			let isDuplicateOrSubset = false;
			for (let j = 0; j < result.length; j++) {
					if (isSamePrefix(prefixes[i], result[j]) || isSubnetOf(prefixes[i], result[j])) {
							isDuplicateOrSubset = true;
							break;
					}
			}
			if (!isDuplicateOrSubset) {
					result.push(new IPv4(prefixes[i]));
			}
	}
	return result;
}

function isSamePrefix(a, b) {
	return a.addr === b.addr && a.mask === b.mask;
}


	function removeDuplicatesAndSubnets_old(prefixes) {
	    let result = [];
	    for (let i = 0; i < prefixes.length; i++) {
	        let isSubset = false;
	        for (let j = 0; j < result.length; j++) {
	            if (isSubnetOf(prefixes[i], result[j])) {
	                isSubset = true;
	                break;
	            }
	        }
	        if (!isSubset) {
	            result.push(new IPv4(prefixes[i]));
	        }
	    }
	    return result;
	}

	function consolidateRecursive(prefixes) {
	    let changed = false;
	    let result = [];
	
	    // Iterate through the list and try to combine adjacent prefixes of the same mask length
	    for (let i = 0; i < prefixes.length; i++) {
	        if (i < prefixes.length - 1 && canBeCombined(prefixes[i], prefixes[i + 1])) {
	            result.push(combine(prefixes[i], prefixes[i + 1]));
	            i++; // Skip the next prefix as it's been combined
	            changed = true;
	        } else {
	            result.push(new IPv4(prefixes[i]));
	        }
	    }
		
	    // If prefixes were combined, sort and try again
	    if (changed) {
	        // Sort the prefixes by address and then by mask
	        result.sort((a, b) => {
	            if (a.addr === b.addr) return IPv4.maskLen_from_mask(a.mask) - IPv4.maskLen_from_mask(b.mask);
	            return a.addr - b.addr;
	        });
				
	        // Remove any subnets that might have been created
	        result = removeDuplicatesAndSubnets(result);
				
	        return consolidateRecursive(result);
	    }
		
	    return result;
	}

	function isSubnetOf(a, b) {
	    let maskLenA = IPv4.maskLen_from_mask(a.mask);
	    let maskLenB = IPv4.maskLen_from_mask(b.mask);
	
	    if (maskLenA < maskLenB) return false;
	
	    return (a.addr & b.mask) === b.addr;
	}

	function isSamePrefix(a, b) {
    return a.addr === b.addr && a.mask === b.mask;
	}


	function canBeCombined(a, b) {
	    if (a.mask !== b.mask) return false;
	
	    let maskLen = IPv4.maskLen_from_mask(a.mask);
	    let shift = 32 - maskLen;
	    let distance = 1 << shift;
	
	    return b.addr - a.addr === distance && (a.addr & distance) === 0;
	}

	function combine(a, b) {
	    let maskLen = IPv4.maskLen_from_mask(a.mask) - 1;
	    let mask = IPv4.mask_from_maskLen(maskLen);
	    let addr = a.addr & mask;
	    return new IPv4({ addr, mask });
	}




	const testCase1 = [
		new IPv4("10.0.0.0/23"),
		new IPv4("10.0.2.0/25"),
		new IPv4("10.0.2.128/25"),
		new IPv4("10.0.3.0/24")
	];
	// Expected result: [new IPv4("10.0.0.0/22")]
	
	const testCase2 = [
		new IPv4("192.168.1.0/24"),
		new IPv4("192.168.1.0/24")
	];
	// Expected result: [new IPv4("192.168.1.0/24")]
	
	const testCase3 = [
		new IPv4("172.16.0.0/16"),
		new IPv4("172.16.1.0/24"),
		new IPv4("172.16.2.0/24")
	];
	// Expected result: [new IPv4("172.16.0.0/16")]
	
	const testCase4 = [
		new IPv4("10.0.0.1/32"),
		new IPv4("10.0.0.2/32"),
		new IPv4("10.0.0.3/32"),
		new IPv4("10.0.0.4/32")
	];
	// Expected result: [new IPv4("10.0.0.1/32"), new IPv4("10.0.0.2/31"), new IPv4("10.0.0.4/32")]
	
	const testCase5 = [
		new IPv4("192.168.1.0/24"),
		new IPv4("192.168.3.0/24"),
		new IPv4("192.168.5.0/24")
	];


	const testCases = [
		testCase1,
		testCase2,
		testCase3,
		testCase4,
		testCase5,
	]

	
	return testCases.map(consolidateIPv4Prefixes)



}

/** getNaturalPrefix
 * For a given prefix/mask, will return the largest subnet that the supplied prefix address can begin with.
 * For example: 10.0.0.0/24 can include a 10.0.0.0/7, but not 10.0.0.0/6.
 * If no shift is possible (odd addr with host mask), same prefix is returned
 * @param {IPv4} prefix 
 * @returns {IPv4}
 */
function getNaturalPrefix(prefix) {
		let shiftedMask = prefix.mask;
		let naturalMask = 0xFFFFFFFF;
		while((prefix.addr & shiftedMask) === prefix.addr) {
			naturalMask = shiftedMask
			shiftedMask = (shiftedMask << 1) >>> 0
		}
		return new IPv4({ 
			addr: prefix.addr, 
			mask: naturalMask
		})
}


/** generateMasksFor(prefix)
 *  Creates an iterator which, for the provided prefix, will create masks that is one mask length shorter each time
 * @param {*} ipv4pfx 
 */
function* generateMasksFor(ipv4pfx) {
	const fnName = `generateMasksFor`
	const prefix = (ipv4pfx?.mask && ipv4pfx?.addr) ? ipv4pfx : new IPv4(ipv4pfx)
	if (!prefix.isNetwork()) {
		console.log(`[${fnName}]: The supplied prefix ${prefix} is not a network`)
		return;
	}
	let shiftedMask = prefix.mask;
	let itercount = 0
	while((shiftedMask > 0) && (prefix.addr & shiftedMask) === prefix.addr) {
		yield shiftedMask
		shiftedMask = (shiftedMask << 1) >>> 0
		itercount++
	}
	if (shiftedMask === 0) {
		yield 0
	}
}

/** generateSupernetsFor(prefix)
 *  Creates an iterator which, for the provided prefix, will create supernets that that is one mask length shorter each time
 * @param {*} ipv4pfx 
 */
function* generateSupernetsFor(ipv4pfx) {
	const fnName = `generateSupernetsFor`
	const prefix = (ipv4pfx?.mask && ipv4pfx?.addr) ? ipv4pfx : new IPv4(ipv4pfx)
	if (!prefix.isNetwork()) {
		console.log(`[${fnName}]: The supplied prefix ${prefix} is not a network`)
		return;
	}
	let shiftedMask = prefix.mask;
	let itercount = 0
	while((shiftedMask > 0) && (prefix.addr & shiftedMask) === prefix.addr) {
		yield new IPv4 ({
			addr: prefix.addr,
			mask: shiftedMask
		})
		shiftedMask = (shiftedMask << 1) >>> 0
		itercount++
	}
	if (shiftedMask === 0) {
		yield new IPv4({
			addr: prefix.addr,
			mask: 0
		})
	}
}



/** @type {<T>(arr: Array<T>, index: number) => T[][]} */
const splitArray = (arr, index) => {
	const returnVal = [
		arr.slice(0, index), 
		arr.slice(index)
	];
	return returnVal
}



function sortPrefixes(ipv4pfxs){
	return ipv4pfxs.map( pfx => new IPv4(pfx)).toSorted( (pfx1, pfx2) => pfx1.addr - pfx2.addr || pfx1.mask - pfx2.mask)
}



/** scanContiguousPrefixes(prefixes)
 * @description Given a list of prefixes sorted by sortedPrefixes(prefixes), this will return the count of prefixes that are contiguous. 
 * @param {IPv4[]} sortedPrefixes
 */
function scanContiguousPrefixes(prefixes) {
	const fnName = `scanContiguousPrefixes`

	// the prefixes have to be sorted, and have to be IPv4 objects (which sortPrefixes takes care of)
	const sortedPrefixes = sortPrefixes(prefixes)

	// the list of prefixes cannot be zero, or we can't do anything with it.  Return null in that case.
	if (sortedPrefixes.length === 0) {
		return null
	}

	// At this point, we have one or more prefixes to work with.  Set up the cursors based on the first prefix
	let currentPrefix = sortedPrefixes[0]
	const startOfRange = currentPrefix.addr
	let endOfContiguousRange = currentPrefix.getBroadcast().addr
	let startOfNextRange = endOfContiguousRange + 1	 /** @todo: need to account for case when endOfCurrentRange being 0xFFFFFFFF */
	let contiguousPrefixCount = 1
	let contiguousPrefixes = []
	contiguousPrefixes.push(currentPrefix)
	let atAggregateBoundary = false

	// If all we have is a single prefix, we're done.	Return the results.	
	if (sortedPrefixes.length === 1) {
		return {
			contiguousPrefixCount,
			startOfRange,
			endOfRange: endOfContiguousRange,
			startOfNextRange: endOfContiguousRange + 1,
			prefixes,
			sortedPrefixes,
			contiguousPrefixes,
			startOfRangeStr: Number(startOfRange).toLocaleString(),
			endOfRangeStr: Number(endOfContiguousRange).toLocaleString(),
			startOfNextRangeStr: Number(endOfContiguousRange + 1).toLocaleString(),
			contiguousPrefixStrs: contiguousPrefixes.map(pfx => pfx.toString()),
			sortedPrefixStrs: sortedPrefixes.map(pfx => pfx.toString()),
			relativeRange: startOfNextRange - startOfRange,
			relativeBitOffset: 31-Math.clz32(startOfNextRange - startOfRange),   // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
			nearestAggregateMask: 0xFFFFFFFF, // since there is only one prefix, the nearest aggregate is the entire IPv4 space
			nearestAggregateMaskStr: IPv4.string_fromAddr(0xFFFFFFFF), // since there is only one prefix, the nearest aggregate is the entire IPv4 space
			nearestAggregate: new IPv4({addr: 0, mask: 0xFFFFFFFF}), // since there is only one prefix, the nearest aggregate is the entire IPv4 space
		}
	}

	// If we got here, we have two or more prefixes to work with in sortedPrefixes, so let's with nextPrefix )
	// This is the main loop that will scan through the sortedPrefixes array and find the largest contiguous range of prefixes.  
	// It will return the count of prefixes that are contiguous, the start and end of the contiguous range, and the start of the next range.  
	// It will also return the list of contiguous prefixes and the list of sorted prefixes.  
	// It will also return the nearest aggregate prefix for the contiguous range.
	for (let c=1; c<sortedPrefixes.length; c++) {
		let nextPrefix = sortedPrefixes[c]

		// handle the case where we have a subnet within the current range.  This is not contiguous, so we skip it   @todo We can do data consolidation here
		if (nextPrefix.addr < startOfNextRange) {
			continue
		}

		// if we found a contiguous prefix, add it to the contiguousPrefixes array and increment the contiguousPrefixCount.  Then continue to the next prefix.
		if (nextPrefix.addr === startOfNextRange) {
			contiguousPrefixes.push(nextPrefix)
			endOfContiguousRange = nextPrefix.getBroadcast().addr
			startOfNextRange = endOfContiguousRange + 1	 /** @todo: need to account for case when endOfCurrentRange being 0xFFFFFFFF */
			currentPrefix = nextPrefix
			contiguousPrefixCount++
			continue
		} 
		else { 
			break 
		}
	}

	const relativeRange = startOfNextRange - startOfRange	/** @todo: need to account for case when endOfCurrentRange being 0xFFFFFFFF */
	const relativeBitOffset = 31-Math.clz32(relativeRange)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
	const nearestAggregateMask = (0XFFFFFFFF << relativeBitOffset) >>> 0  // bit shift the 0xFFFFFFFF subnet mask to the left by the relativeBitOffset to get the nearest aggregate mask.  This is the largest subnet that can contain the contiguous range.
	const nearestAggregate = new IPv4({addr: startOfRange, mask: nearestAggregateMask})

	return {
		contiguousPrefixCount,
		startOfRange,
		endOfRange: endOfContiguousRange,
		startOfNextRange: endOfContiguousRange + 1,
		prefixes,
		sortedPrefixes,
		contiguousPrefixes,
		startOfRangeStr: Number(startOfRange).toLocaleString(),
		endOfRangeStr: Number(endOfContiguousRange).toLocaleString(),
		startOfNextRangeStr: Number(endOfContiguousRange + 1).toLocaleString(),
		contiguousPrefixStrs: contiguousPrefixes.map(pfx => pfx.toString()),
		sortedPrefixStrs: sortedPrefixes.map(pfx => pfx.toString()),
		relativeRange: startOfNextRange - startOfRange,
		relativeBitOffset,
		nearestAggregateMask,
		nearestAggregateMaskStr: IPv4.string_fromAddr(nearestAggregateMask),
		nearestAggregate,
		nearestAggregateStr: nearestAggregate.toString(),
	}
}

/** scanContiguousPrefixes_x(prefixes)  ** experimental - for instrumentation **
 * @description Given a list of prefixes sorted by sortedPrefixes(prefixes), this will return the count of prefixes that are contiguous. 
 * @param {IPv4[]} sortedPrefixes
 */
function scanContiguousPrefixes_x(prefixes) {
	const fnName = `scanContiguousPrefixes_x`

	// the prefixes have to be sorted, and have to be IPv4 objects (which sortPrefixes takes care of)
	const sortedPrefixes = sortPrefixes(prefixes)

	// the list of prefixes cannot be zero, or we can't do anything with it.  Return null in that case.
	if (sortedPrefixes.length === 0) {
		return null
	}

	// At this point, we have one or more prefixes to work with.  Set up the cursors based on the first prefix
	let currentPrefix = sortedPrefixes[0]
	const startOfRange = currentPrefix.addr
	let endOfContiguousRange = currentPrefix.getBroadcast().addr
	let startOfNextRange = endOfContiguousRange + 1	 /** @todo: need to account for case when endOfCurrentRange being 0xFFFFFFFF */
	let contiguousPrefixCount = 1
	let contiguousPrefixes = []
	contiguousPrefixes.push(currentPrefix)
	let atAggregateBoundary = false

	// If all we have is a single prefix, we're done.	Return the results.	
	if (sortedPrefixes.length === 1) {
		return {
			contiguousPrefixCount,
			startOfRange,
			endOfRange: endOfContiguousRange,
			startOfNextRange: endOfContiguousRange + 1,
			prefixes,
			sortedPrefixes,
			contiguousPrefixes,
			startOfRangeStr: Number(startOfRange).toLocaleString(),
			endOfRangeStr: Number(endOfContiguousRange).toLocaleString(),
			startOfNextRangeStr: Number(endOfContiguousRange + 1).toLocaleString(),
			contiguousPrefixStrs: contiguousPrefixes.map(pfx => pfx.toString()),
			sortedPrefixStrs: sortedPrefixes.map(pfx => pfx.toString()),
			relativeRange: startOfNextRange - startOfRange,
			relativeBitOffset: 31-Math.clz32(startOfNextRange - startOfRange),   // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
			nearestAggregateMask: 0xFFFFFFFF, // since there is only one prefix, the nearest aggregate is the entire IPv4 space
			nearestAggregateMaskStr: IPv4.string_fromAddr(0xFFFFFFFF), // since there is only one prefix, the nearest aggregate is the entire IPv4 space
			nearestAggregate: new IPv4({addr: 0, mask: 0xFFFFFFFF}), // since there is only one prefix, the nearest aggregate is the entire IPv4 space
		}
	}

	// If we got here, we have two or more prefixes to work with in sortedPrefixes, so let's with nextPrefix )
	// This is the main loop that will scan through the sortedPrefixes array and find the largest contiguous range of prefixes.  
	// It will return the count of prefixes that are contiguous, the start and end of the contiguous range, and the start of the next range.  
	// It will also return the list of contiguous prefixes and the list of sorted prefixes.  
	// It will also return the nearest aggregate prefix for the contiguous range.
	for (let c=1; c<sortedPrefixes.length; c++) {
		let nextPrefix = sortedPrefixes[c]

		// handle the case where we have a subnet within the current range.  This is not contiguous, so we skip it   @todo We can do data consolidation here
		if (nextPrefix.addr < startOfNextRange) {
			continue
		}

		// if we found a contiguous prefix, add it to the contiguousPrefixes array and increment the contiguousPrefixCount.  Then continue to the next prefix.
		if (nextPrefix.addr === startOfNextRange) {
			contiguousPrefixes.push(nextPrefix)
			endOfContiguousRange = nextPrefix.getBroadcast().addr
			startOfNextRange = endOfContiguousRange + 1	 /** @todo: need to account for case when endOfCurrentRange being 0xFFFFFFFF */
			currentPrefix = nextPrefix
			contiguousPrefixCount++


		/** experimental instrumentation here  */


		let x_relativeRange = startOfNextRange - startOfRange	/** @todo: need to account for case when endOfCurrentRange being 0xFFFFFFFF */
		let x_relativeBitOffset = 31-Math.clz32(x_relativeRange)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
		let x_nearestAggregateMask = (0XFFFFFFFF << x_relativeBitOffset) >>> 0  // bit shift the 0xFFFFFFFF subnet mask to the left by the relativeBitOffset to get the nearest aggregate mask.  This is the largest subnet that can contain the contiguous range.
		let x_nearestAggregate = new IPv4({addr: startOfRange, mask: x_nearestAggregateMask})

			continue
		} 
		else { 
			break 
		}
	}

	const relativeRange = startOfNextRange - startOfRange	/** @todo: need to account for case when endOfCurrentRange being 0xFFFFFFFF */
	const relativeBitOffset = 31-Math.clz32(relativeRange)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
	const nearestAggregateMask = (0XFFFFFFFF << relativeBitOffset) >>> 0  // bit shift the 0xFFFFFFFF subnet mask to the left by the relativeBitOffset to get the nearest aggregate mask.  This is the largest subnet that can contain the contiguous range.
	const nearestAggregate = new IPv4({addr: startOfRange, mask: nearestAggregateMask})

	return {
		contiguousPrefixCount,
		startOfRange,
		endOfRange: endOfContiguousRange,
		startOfNextRange: endOfContiguousRange + 1,
		prefixes,
		sortedPrefixes,
		contiguousPrefixes,
		startOfRangeStr: Number(startOfRange).toLocaleString(),
		endOfRangeStr: Number(endOfContiguousRange).toLocaleString(),
		startOfNextRangeStr: Number(endOfContiguousRange + 1).toLocaleString(),
		contiguousPrefixStrs: contiguousPrefixes.map(pfx => pfx.toString()),
		sortedPrefixStrs: sortedPrefixes.map(pfx => pfx.toString()),
		relativeRange: startOfNextRange - startOfRange,
		relativeBitOffset,
		nearestAggregateMask,
		nearestAggregateMaskStr: IPv4.string_fromAddr(nearestAggregateMask),
		nearestAggregate,
		nearestAggregateStr: nearestAggregate.toString(),
	}
}


function subnetBoundary(_fromIP, _toIP, inclusive=true) {
	const fromIP = new IPv4(_fromIP)
	const toIP = new IPv4(_toIP)
	if (fromIP.isInvalid() || toIP.isInvalid()) { 
		console.log(`[subnetBoundary]: Invalid IP address`)
		return null 
	}
	const fromAddr = fromIP.addr
	const toAddr = toIP.addr
	const diffInclusive = (toAddr - fromAddr + 1) 
	const diffExclusive = (toAddr - fromAddr)
	const diff = inclusive ? diffInclusive : diffExclusive
	const bitOffset = 31 - Math.clz32(diff)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
	const bitOffsetBefore = 31 - Math.clz32(toAddr - fromAddr-1)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
	const bitOffsetAfter = 31 - Math.clz32(toAddr - fromAddr+1)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
	const offsetChanged_onNext = (bitOffsetAfter !== bitOffset) ? true : false
	const offsetChanged_onPrev = (bitOffsetBefore !== bitOffset) ? true : false   // false if the 
	//const offsetChangedAB = (bitOffsetAfter === bitOffsetBefore) ? true : false

	const isPotentialSubnetBoundary_inclusive = offsetChanged_onNext
	const isPotentialSubnetBoundary_exclusive = offsetChanged_onPrev
	const nearestAggregateMask = (0XFFFFFFFF << bitOffset) >>> 0  
	const nearestAggregateMaskStr = IPv4.string_fromAddr(nearestAggregateMask)
	const nearestAggregateMaskLength = IPv4.maskLen_from_mask(nearestAggregateMask)
	const potentialAggregate = new IPv4({addr:fromAddr, mask:nearestAggregateMask})

	const isActualSubnetBoundary_inclusive = isPotentialSubnetBoundary_inclusive && (((fromAddr & nearestAggregateMask<<0)>>>0) === fromAddr)
	const isActualSubnetBoundary_exclusive = isPotentialSubnetBoundary_exclusive && (((fromAddr & nearestAggregateMask<<0)>>>0) === fromAddr)

	//if (inclusive) return isSubnetBoundary_inclusive
	//return isSubnetBoundary_exclusive
	
	console.log({
		mode: inclusive ? 'inclusive' : 'exclusive',
		diff,
		//isPotentialSubnetBoundary_inclusive,
		//isActualSubnetBoundary_inclusive,
		isPotentialSubnetBoundary_exclusive,
		isActualSubnetBoundary_exclusive,
		potentialAggregate: potentialAggregate.toString(),
		//isSubnetBoundary_exclusive: bitOffsetBefore !== bitOffset,
		nearestAggregateMask,
		nearestAggregateMaskStr,
		nearestAggregateMaskLength,
		fromIP, toIP, fromAddr, toAddr, diffInclusive, diffExclusive, bitOffset, bitOffsetAfter, bitOffsetBefore, offsetChanged_onNext, offsetChanged_onPrev
	})

	if (isActualSubnetBoundary_exclusive) return potentialAggregate.toString()
	else return null
}


/** describeRange
 * Given two 32-bit unsigned integers, this will return a descriptor containing useful properties for aligning the range into aggregate prefixe blocks.  
 * @param {number} startAddr 
 * @param {number} endAddr 
 * 
 */
function describeRange(startAddr, endAddr) {
	const fnName = `describeRange`
	if (endAddr === 0xFFFFFF) {
		console.log(`[${fnName}]: endAddr is 0xFFFFFF, which requires special handling.  Returning insufficient information for now`)
		return {
			startAddr,
			endAddr,
		}
	}
	
	const startOfNextRange = endAddr + 1   /** @todo: need to account for case when endAddr is 0xFFFFFFFF */

	const relativeRange = startOfNextRange - startAddr
	const relativeRange_x = endAddr - startAddr + 1
	const relativeBitOffset = 31-Math.clz32(relativeRange)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
	const nearestAggregateMask = (0XFFFFFFFF << relativeBitOffset) >>> 0  // bit shift the 0xFFFFFFFF subnet mask to the left by the relativeBitOffset to get the nearest aggregate mask.  This is the largest subnet that can contain the contiguous range.
	const nearestAggregate = new IPv4({addr: startAddr, mask: nearestAggregateMask})

	return {
		startAddr,
		endAddr,
		startOfNextRange: endAddr + 1,

		startOfRangeStr: Number(startAddr).toLocaleString(),
		endOfRangeStr: Number(endAddr).toLocaleString(),
		startOfNextRangeStr: Number(endAddr + 1).toLocaleString(),

		relativeRange,
		relativeBitOffset,

		nearestAggregate,
		nearestAggregateMask,
		nearestAggregateStr: nearestAggregate.toString(),
		nearestAggregateMaskStr: IPv4.string_fromAddr(nearestAggregateMask),
	}

}


/**
 * The line in question:
 * 
 * ```javascript
 * relativeBitOffset = 31 - Math.clz32(relativeRange)
 * ```
 * 
 * ### Explanation:
 * 1. **`Math.clz32(relativeRange)`**:
 *    - `Math.clz32()` is a JavaScript function that stands for "Count Leading Zeros in a 32-bit integer."
 *    - It takes a 32-bit unsigned integer (`relativeRange` in this case) and returns the number of leading zeros in its binary representation.
 *    - For example:
 *      - `Math.clz32(1)` → `31` (binary: `00000000000000000000000000000001`)
 *      - `Math.clz32(8)` → `28` (binary: `00000000000000000000000000001000`)
 * 
 * 2. **`31 - Math.clz32(relativeRange)`**:
 *    - This calculates the position of the **most significant bit (MSB)** that is set to `1` in the binary representation of `relativeRange`.
 *    - Subtracting the number of leading zeros from `31` gives the zero-based index of the first `1` bit from the left.
 *    - For example:
 *      - If `relativeRange = 8` (binary: `00000000000000000000000000001000`), `Math.clz32(8)` is `28`, so `31 - 28 = 3`. The MSB is at position `3`.
 * 
 * 3. **Purpose in Context**:
 *    - The `relativeBitOffset` represents the position of the most significant bit in `relativeRange`. This is useful for determining the "size" of the range in terms of powers of 2.
 *    - For example, if `relativeRange` is `8`, the MSB at position `3` indicates that the range spans `2^3 = 8` addresses.
 * 
 * ### Why is this useful?
 * In the context of your code:
 * - `relativeBitOffset` is used to calculate the **nearest aggregate mask**:
 *   ```javascript
 *   nearestAggregateMask = (0XFFFFFFFF << relativeBitOffset) >>> 0
 *   ```
 *   This mask helps determine the largest subnet that can contain the given range of IP addresses.
 * 
 * ### Summary:
 * The line calculates the position of the most significant bit in `relativeRange`, which is a key step in determining the size of the range and constructing the appropriate subnet mask.
 */


/** describeRelativeRange
 * Like describeRange, but inputs only the difference between the start and end addresses.  For research only at this point
 * @param {number} offset
 * @param {number} startAddr - optional, defaults to 167772160 (representing 10.0.0.0 for testing purposes) 
 * 
 * Note: The line in question: relativeBitOffset = 31 - Math.clz32(relativeRange):
 *   `Math.clz32()` is a JavaScript function that stands for "Count Leading Zeros in a 32-bit integer."
 * 
 * ### Explanation:
 * 1. **`Math.clz32(relativeRange)`**:
 *    - `Math.clz32()` is a JavaScript function that stands for "Count Leading Zeros in a 32-bit integer."
 *    - It takes a 32-bit unsigned integer (`relativeRange` in this case) and returns the number of leading zeros in its binary representation.
 *    - For example:
 *      - `Math.clz32(1)` → `31` (binary: `00000000000000000000000000000001`)
 *      - `Math.clz32(8)` → `28` (binary: `00000000000000000000000000001000`)
 * 
 * 2. **`31 - Math.clz32(relativeRange)`**:
 *    - This calculates the position of the **most significant bit (MSB)** that is set to `1` in the binary representation of `relativeRange`.
 *    - Subtracting the number of leading zeros from `31` gives the zero-based index of the first `1` bit from the left.
 *    - For example:
 *      - If `relativeRange = 8` (binary: `00000000000000000000000000001000`), `Math.clz32(8)` is `28`, so `31 - 28 = 3`. The MSB is at position `3`.
 * 
 * 3. **Purpose in Context**:
 *    - The `relativeBitOffset` represents the position of the most significant bit in `relativeRange`. This is useful for determining the "size" of the range in terms of powers of 2.
 *    - For example, if `relativeRange` is `8`, the MSB at position `3` indicates that the range spans `2^3 = 8` addresses.
 * 
 * ### Why is this useful?
 * In the context of your code:
 * - `relativeBitOffset` is used to calculate the **nearest aggregate mask**:
 *   ```javascript
 *   nearestAggregateMask = (0XFFFFFFFF << relativeBitOffset) >>> 0
 *   ```
 *   This mask helps determine the largest subnet that can contain the given range of IP addresses.
 * 
 * ### Summary:
 * The line calculates the position of the most significant bit in `relativeRange`, which is a key step in determining the size of the range and constructing the appropriate subnet mask.
 */
function describeRelativeRange(_startPrefix, offset) {
	const startPrefix = _startPrefix?.constructor.name == 'IPv4' ? _startPrefix : new IPv4(_startPrefix)
	const startAddr = startPrefix.addr
	if (startPrefix + offset >= 2**32) {
		console.log(`[describeRelativeRange]: startAddr + relativeRange exceeds 0xFFFFFFFF`)
		return null
	}
	const relativeBitOffset = 31-Math.clz32(offset)  // maps any 32-bit unsigned integer into one of the 32 possible bit positions in the integer.  This is the bit position of the first bit that is set to 1.
	const nearestAggregateMask = (0XFFFFFFFF << relativeBitOffset) >>> 0  // bit shift the 0xFFFFFFFF subnet mask to the left by the relativeBitOffset to get the nearest aggregate mask.  This is the largest subnet that can contain the contiguous range.
	const nearestAggregate = new IPv4({addr: startAddr, mask: nearestAggregateMask})

	const returnVal = {
		startAddr,
		offset,
		relativeBitOffset,
		nearestAggregate,
		nearestAggregateMask,
		nearestAggregateStr_: nearestAggregate.toString(),
		nearestAggregateStrB: IPv4.toBinaryString(nearestAggregate.addr),
		nearestAggregateMaskStr_: IPv4.string_fromAddr(nearestAggregateMask),
		nearestAggregateMaskStrB: IPv4.toBinaryString(nearestAggregateMask),
	}

	console.log(`${nearestAggregate.toString_binary('_')}`)

	return returnVal
}


/** consolidateAdjances(prefixes: Array<IPv4>)
 * @description Scans through the list of prefixes for opportunities to consolidate adjancent prefixes that can be combined into a single prefix.  
 * The adjacent prefixes will be replaced by the single prefix, while all other prefixes will be retured as is.  The returned prefixes will
 * consume the same IP address space as the original table.
 * @param {IPv4[]} prefixes 
 */
function consolidateAdjacent(prefixes) {
	if (prefixes.length === 0) return [];
	if (prefixes.length === 1) return prefixes;

	const sortedPrefixes = prefixes.toSorted( (pfx1, pfx2) => pfx1.addr - pfx2.addr || pfx1.mask - pfx2.mask)
	let remainingPrefixes = sortedPrefixes;
	const consolidatedPrefixes = [];

	let scanResults
	while(remainingPrefixes.length > 0) {
		scanResults = scanContiguousPrefixes(sortedPrefixes)
		if (scanResults === null) break;
		const numPrefixes = scanResults.contiguousPrefixCount
		const workingSet = sortedPrefixes.slice(0, numPrefixes)
		remainingPrefixes = sortedPrefixes.slice(numPrefixes)
		
		if (workingSet.length === 1) {
			consolidatedPrefixes.push(workingSet[0])
			sortedPrefixes.shift() // remove the first prefix from the working set.  It's already been added to the consolidatedPrefixes array.
		} 
		else {
			const largestAggregate = scanResults.nearestAggregate // get the nearest aggregate prefix for the contiguous prefixes in the working set.  This will replace the contiguous prefixes in the working set.
			const [aggregatedPrefixes, remainingPrefixes] = bifurcateArray( (prefix) => prefix.isSubnetOf(largestAggregate)) (sortedPrefixes) // remove the contiguous prefixes from the working set.  They have been replaced by the nearest aggregate prefix.
			consolidatedPrefixes.push(largestAggregate) // add the nearest aggregate prefix to the consolidatedPrefixes array.  This will replace the contiguous prefixes in the working set.  This will replace the contiguous prefixes in the working set.
			console.log(`remaining prefixes in contiguous set`, {remainingPrefixes, aggregatedPrefixes})
			
			// recursively consolidate the remaining prefixes.  This will replace the contiguous prefixes in the working set.  This will replace the contiguous prefixes in the working set.
			const consolidatedRemainingPrefixes = consolidateAdjacent(remainingPrefixes) // recursively consolidate the remaining prefixes.  This will replace the contiguous prefixes in the working set.
			consolidatedPrefixes.push(consolidatedRemainingPrefixes) // add the consolidated remaining prefixes to the consolidatedPrefixes array.  This will replace the contiguous prefixes in the working set.
		}
		
	}

	


	
}


export { 
	RoutingTable as RoutingTable_v3, 
	IPv4,
	scanContiguousPrefixes,
	sortPrefixes,
	generateMasksFor,
	generateSupernetsFor,
	consolidateAdjacent
};

