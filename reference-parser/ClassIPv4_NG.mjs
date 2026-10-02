// @ts-check
const isVerbose = false



class IPv4_NG {
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
		const parsedIntegers = []
    for (let i = 0; i < 4; i++) {
      const octet = parseInt(octets[i], 10);
      if (isNaN(octet) || octet < 0 || octet > 255) {
        this.error = true;
        //return;
      }
      ipNum = (ipNum << 8) | octet;
			parsedIntegers.push(ipNum)
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


	static parseDottedDecimalStr = (ipv4_addrStr='') => {
		const parsedIntegers = ipv4_addrStr.split('.').map((octets) => parseInt(octets))
		if (parsedIntegers.length !== 4 || parsedIntegers.some(Number.isNaN) || parsedIntegers.some((x) => (x >> 8) !== 0)) {
			return {
				addr: 0,
				octets: new Uint8Array(4),
				error: true,
			}
		}
		const octets = Uint8Array.from(parsedIntegers)
		const addr = new DataView(octets.buffer).getUint32(0)
		return {
			addr,
			octets,
			error: false,
		}
	}

  isSubnetOf(ipStr) {
    const other = new IPv4_NG(ipStr);
    if (other.error) return false;
    if (this.addr === other.addr && this.maskLen === other.maskLen) return true;
    if (this.maskLen < other.maskLen) return false;
    return (this.addr & other.mask) === other.addr;
  }
 
  isSupernetOf(ipStr) {
    const other = new IPv4_NG(ipStr);
    if (other.error) return false;
    if (this.addr === other.addr && this.maskLen === other.maskLen) return true;
    if (this.maskLen > other.maskLen) return false;
    return (other.addr & this.mask) === this.addr;
  }
 
  toString() {
    return IPv4_NG.intToIp(this.addr) + '/' + this.maskLen;
  }
 
  static intToIp(ip) {
    return [
      (ip >>> 24) & 0xFF,
      (ip >>> 16) & 0xFF,
      (ip >>> 8) & 0xFF,
      ip & 0xFF
    ].join('.');
  }
 
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
 
  static countTrailingZeros(x) {
    if (x === 0) return 32;
    let count = 0;
    while ((x & 1) === 0) {
      count++;
      x = x >>> 1;
    }
    return count;
  }
 
  static createPrefixesBetween = (fromIPAddrStr, toIPAddrStr, {inclusive=false}={}) => {
    let fromIpAddr = IPv4_NG.ipStrToInt(fromIPAddrStr);
    let toIpAddr = IPv4_NG.ipStrToInt(toIPAddrStr);
    if (fromIpAddr === null || toIpAddr === null) return [];
    if (!inclusive) toIpAddr = toIpAddr - 1;
    if (fromIpAddr > toIpAddr) return [];
    const result = [];
    let current = fromIpAddr;
    while (current <= toIpAddr) {
      let trailingZeros = IPv4_NG.countTrailingZeros(current);
      let step = Math.pow(2, trailingZeros);
      let remaining = toIpAddr - current + 1;
      while (step > remaining) {
        step = step / 2;
      }
      let maskLen = 32 - Math.log2(step) | 0;
      result.push(new IPv4_NG(IPv4_NG.intToIp(current) + "/" + maskLen));
      current += step;
    }
    return result;
  }
}
 
class RoutingTable {
  constructor(ipv4Array) {
    this.hostMap = new Map();
    this.prefixMap = new Map();
    this.dataMap = new Map();
    ipv4Array.forEach((route, idx) => {
			const maskLen = route.maskLen
      if (route.error) return;
      route.insertionIndex = idx;
      if (maskLen === 32) {
        this.hostMap.set(route.addr, route);
      } 
			else {
        if (!this.prefixMap.has(maskLen)) {
          this.prefixMap.set(maskLen, new Map());
        }
        const network = route.addr >>> 0;
        const mapForLen = this.prefixMap.get(maskLen);
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
 
  hasMatchingPrefix(ipStr) {
    const query = new IPv4_NG(ipStr);
    if (query.error) return false;
    if (query.maskLen === 32) {
      if (this.hostMap.has(query.addr)) return true;
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
 
  getLongestMatchPrefix(ipStr) {
    const query = new IPv4_NG(ipStr);
    if (query.error) return null;
    if (query.maskLen === 32) {
      if (this.hostMap.has(query.addr)) return this.hostMap.get(query.addr);
    }
    for (let len = 32; len >= 0; len--) {
      if (len === 32) continue;
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network)) return subsetMap.get(network)[0];
    }
    return null;
  }
 
  getMatchingPrefixes(ipStr) {
    const query = new IPv4_NG(ipStr);
    if (query.error) return [];
    let matches = [];
    if (query.maskLen === 32 && this.hostMap.has(query.addr)) {
      matches.push(this.hostMap.get(query.addr));
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
 
  lookupData(dataKey) {
    return this.dataMap.get(dataKey) || [];
  }
  
  firstMatch(ipStr) {
    const query = new IPv4_NG(ipStr);
    if (query.error) return null;
    let bestRoute = null;
    for (let len = 32; len >= 0; len--) {
      const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
      const network = query.addr & mask;
      if (len === 32) {
        if (this.hostMap.has(query.addr)) {
          const r = this.hostMap.get(query.addr);
          if (!bestRoute || r.insertionIndex < bestRoute.insertionIndex) bestRoute = r;
        }
      } else {
        const subsetMap = this.prefixMap.get(len);
        if (subsetMap && subsetMap.has(network)) {
          const candidates = subsetMap.get(network);
          for (const r of candidates) {
            if (!bestRoute || r.insertionIndex < bestRoute.insertionIndex) bestRoute = r;
          }
        }
      }
    }
    return bestRoute;
  }
}
 


/** done here because I can't figure out how to define this as a class method */ 
// IPv4.prototype[Symbol.iterator] = function* ()  {
	// const itercount = this.getBlockSize()
	// const data = this.data
	// let hostAddr = this.addr
	// for (let c=0; c<itercount; c++) {
		// yield new IPv4_old({
			// addr: hostAddr + c,
			// mask: 0xffffffff,
		// }).setData({...data})
	// }
// }




export {
	IPv4_NG,
	RoutingTable
}
