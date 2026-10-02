// @ts-check
// 

// @ts-check

const isVerbose = false


import { flattenItem, multiplyBy } from "./DataSet_Transformers.mjs"
import { bifurcateArray } from "./Parser_Result_Helpers.mjs"
import { dedent } from "./dedent.mjs"
import { arr, is, match } from "./Pattern_Matching.mjs"
// import { DB } from "./ClassDB.mjs"			// DB is needed for RDAP cache	(UPDATE: Does not appear ot be needed)

/********** MODULE-START: IPv4*******
 * @module IPv4
 * @version 20-Mar-23
 */

/** class IPv4
	* @class IPv4
	* @param 		{ string | IPv4 } _ip		- IP address/network in string format, or another IPv4 oject
	* @property 	{ number | null } addr 	- unsigned 32-bit number
	* @property 	{ number | null } mask 	-	unsigned 32-bit number
	* @property 	{ Uint32Array 	} octets - 4-element array, each containing an octet of the address	
	* @property 	{ string }				error - for troubleshooting after silent bulk processing & this provides for smooth error flow of many instantiations, stores the reason a constructor failed
	* @static @property	{ Map }	rdapCache - hosts a global cache of responses from RDAP servers
	* 
	* @todo	1.	[DONE] Given a set of routes, find possible aggregates upto a specified mask, or upto the smallest mask that contains all the prefixes
	* @todo	2.	set-named operations (most will be aliases of normally-named methods)
	* @todo	3.	[DONE] Given a first and last IP address, create the smallest aggregate (or set of aggregates) that map the IPs w/out going over
	* @todo	4.	[DONE] Given an aggregate network and a subnet length smaller than the aggregate, return an iterator to generate host objects 
	* 						Then each host can be addressed by an array index.	Good for scenarios where you get a subnet, 
	*						and you need to assign the 1st address to x, 2nd address to y, etc.
	* @todo	5.	[DONE] split() operation for networks.	You provide the number of hosts per subnet or the number of subnets, and it will create a set of networks for you.
	* @todo	6.	Even though there is isSubnet() and issuperNet(), there should be overlaps() which checks to see if
	* 						A	overlaps with B, even though one might not be a complete subset of another.
	* @todo	7.	Maybe an intersection operator for two networks?
	* @todo	8.	Additional attributes - Mcast GLOP, mcast private, mcast reserved, mcastEthernetOverlapping, etc.
	* @todo	9.	Improved error handling - instead of setting fields to null, have an error path & user-determined option for exceptions
	* @todo	10.	[DONE] Given an base network (i.e. /16), a subnet mask (or length), return the subnet that a given IP address maps to	(done)
	* @todo 	11.	Calculate GLOP range from ASN
	* @todo 	12.	Calculate ASNs from GLOP
	* @todo 	13.	Add custom data to IPv4s ()
	* @todo 	14.	Investigate any benefit of using [Symbol.match]
	* 	
	* 
	* @typedef IPv4Object
	* @property {number} 		addr - unsigned 32-bit integer
	* @property {number} 		mask - unsigned 32-bit integer, or -1
	* @property {Uint8Array}	octets 
	* @property {string} 		error
	* 
	* @see 		https://www.crutchfield.io/ip-network-address-validation-using-bitwise-operations/
	* 					for this for better examples on IPv4 validation using bitwise
	* /* Example usage:
	 //normal usage:
	 let x = new IPv4('192.168.1.0/24')
	 x.toString					//	'192.168.1.0/24'
 
	 // flags
	 x.isNetwork()				// true
	 x.isHost()					// false
	 x.isValid()					// true
	 x.isInvalid()				// false
	 x.isUnicast()				// true
	 x.isMulticast()			// false
	 x.isInterface()			// false
 
	 // comparisons
	 x.eq('192.168.1.0/24')							// true
	 x.eq('192.168.1.0/255.255.255.0')		// true
	 x.eq('192.168.1.0/25')							// false
	 x.neq('192.168.1.0/25')							// true
	 x.neq('192.168.1.0')								// true
 
	 // generate subnets
	 xgen = x.subnetGenerator(28)					// mask length of 28
	 [...xgen].map(ipnet=>ipnet.toString())	// list of 16 subnets in sequence starting with x as a base
 
	 // flexible methods for input:
	 // if a mask is not supplied, the a host is assumed:
	 let x = new IPv4().parse('192.168.1.0').toString()					//	'192.168.1.0'
 
	 // the format is flexible.	The following produce the same IPv4 object:
	 new IPv4().parse('192.168.1.0/24').toString()								// 	'192.168.1.0/24'
	 new IPv4().parse('192.168.1.0/255.255.255.0').toString()		//	'192.168.1.0/24'
	 new IPv4().parse('192.168.1.0/0.0.0.255').toString()				//	'192.168.1.0/24'
	 // there is also a parseAddress which will only accept a dotted-decimal IP, no mask
	 new IPv4().parseAddress('192.168.1.0').toString() 					//	'192.168.1.0/32'
	 new IPv4().parseAddress('192.168.1.0/24').toString() 				//	invalid
	 // there is also a parseNetwork which requires a mask 
	 new IPv4().parseNetwork('192.168.1.0/24').toString()				//	192.168.1.0/24
	 new IPv4().parseNetwork('192.168.1.0').toString() 					//	invalid
 */


/**
 * @module ipv4
 * @exports IPv4
 * @exports ASN
 * @exports RDAP
 * @exports RoutingTable
 * @version 07-JUL-2022
 * @requires './pattern-matching.mjs'
 * 
 * @description Changes since last version:
 * 	this.constructorArgHistory ??= [] replaced with old pattern due to lack of support on node
 * 
 * @description Changes since last version :
 * 	Added consolidate() method to class RoutingTable()
 * 
 * 
 */

/** class IPv4
 * @class IPv4
 * @param 		{ string | IPv4 } _ip		- IP address/network in string format, or another IPv4 oject
 * @property 	{ number | null } addr 	- unsigned 32-bit number
 * @property 	{ number | null } mask 	-	unsigned 32-bit number
 * @property 	{ Uint32Array 	} octets - 4-element array, each containing an octet of the address	
 * @property 	{ string }				error - for troubleshooting after silent bulk processing & this provides for smooth error flow of many instantiations, stores the reason a constructor failed
 * @static @property	{ Map }	rdapCache - hosts a global cache of responses from RDAP servers
 * 
 * @todo	1.	[DONE] Given a set of routes, find possible aggregates upto a specified mask, or upto the smallest mask that contains all the prefixes
 * @todo	2.	set-named operations (most will be aliases of normally-named methods)
 * @todo	3.	[DONE] Given a first and last IP address, create the smallest aggregate (or set of aggregates) that map the IPs w/out going over
 * @todo	4.	[DONE] Given an aggregate network and a subnet length smaller than the aggregate, return an iterator to generate host objects 
 * 						Then each host can be addressed by an array index.	Good for scenarios where you get a subnet, 
 *						and you need to assign the 1st address to x, 2nd address to y, etc.
 * @todo	5.	[DONE] split() operation for networks.	You provide the number of hosts per subnet or the number of subnets, and it will create a set of networks for you.
 * @todo	6.	Even though there is isSubnet() and issuperNet(), there should be overlaps() which checks to see if
 * 						A	overlaps with B, even though one might not be a complete subset of another.
 * @todo	7.	Maybe an intersection operator for two networks?
 * @todo	8.	Additional attributes - Mcast GLOP, mcast private, mcast reserved, mcastEthernetOverlapping, etc.
 * @todo	9.	Improved error handling - instead of setting fields to null, have an error path & user-determined option for exceptions
 * @todo	10.	[DONE] Given an base network (i.e. /16), a subnet mask (or length), return the subnet that a given IP address maps to	(done)
 * @todo 	11.	Calculate GLOP range from ASN
 * @todo 	12.	Calculate ASNs from GLOP
 * @todo 	13.	Add custom data to IPv4s ()
 * @todo 	14.	Investigate any benefit of using [Symbol.match]
 * 	
 * 
 * 	
 * @see 		https://www.crutchfield.io/ip-network-address-validation-using-bitwise-operations/
 * 					for this for better examples on IPv4 validation using bitwise
 * /* Example usage:
	//normal usage:
	let x = new IPv4('192.168.1.0/24')
	x.toString					//	'192.168.1.0/24'

	// flags
	x.isNetwork()				// true
	x.isHost()					// false
	x.isValid()					// true
	x.isInvalid()				// false
	x.isUnicast()				// true
	x.isMulticast()			// false
	x.isInterface()			// false

	// comparisons
	x.eq('192.168.1.0/24')							// true
	x.eq('192.168.1.0/255.255.255.0')		// true
	x.eq('192.168.1.0/25')							// false
	x.neq('192.168.1.0/25')							// true
	x.neq('192.168.1.0')								// true

	// generate subnets
	xgen = x.subnetGenerator(28)					// mask length of 28
	[...xgen].map(ipnet=>ipnet.toString())	// list of 16 subnets in sequence starting with x as a base

	// flexible methods for input:
	// if a mask is not supplied, the a host is assumed:
	let x = new IPv4().parse('192.168.1.0').toString()					//	'192.168.1.0'

	// the format is flexible.	The following produce the same IPv4 object:
	new IPv4().parse('192.168.1.0/24').toString()								//	'192.168.1.0/24'
	new IPv4().parse('192.168.1.0/255.255.255.0').toString()		//	'192.168.1.0/24'
	new IPv4().parse('192.168.1.0/0.0.0.255').toString()				//	'192.168.1.0/24'
	// there is also a parseAddress which will only accept a dotted-decimal IP, no mask
	new IPv4().parseAddress('192.168.1.0').toString() 					//	'192.168.1.0/32'
	new IPv4().parseAddress('192.168.1.0/24').toString() 				//	invalid
	// there is also a parseNetwork which requires a mask 
	new IPv4().parseNetwork('192.168.1.0/24').toString()				//	192.168.1.0/24
	new IPv4().parseNetwork('192.168.1.0').toString() 					//	invalid
*/

/** @typedef {string | null | undefined | number | IPv4 | {addr:number, mask:number, error:string }} IPConstructorArg */

/**
 * @template T
 * @type {{
 *   pfx: string
 *	 addr: number
 *	 mask: number
 *	 error: string
 *	 octets: Uint8Array
 *   constructorArg: IPConstructorArg | null | undefined
 * 	 data: T | null
 * }}
 */
class IPv4 {
	static options = {
		useConstuctorArgHistory: false,
		isVerbose,
	}
	static rdapCache = new Map()				// a cache of all RDAP queries & responses (to avoid overloading whois/RDAP servers with excessive queriees)
	static dataWeakMap = new WeakMap()	// *experimental* use WeakMap instead of data prop to reference stored data, using the IPv4 object as the key
	static isVerbose = isVerbose
	static errorLog = []
	static log = (msg) => console.log(`[IPv4.log(msg)]: ${msg}`)
	
	/**@ param {IPConstructorArg} _ip */
	constructor(_ip, data=null) {
		IPv4.isVerbose && console.log(`[new IPv4]: _ip is type ${_ip?.constructor?.name ?? typeof(_ip)}, value of '${JSON.stringify(_ip,null,2)}'`)
		IPv4.isVerbose && console.log({_ip, data})

		if (typeof (_ip) === 'string') {														//	parameter is an IP address string, with or without mask
			const parsedIPv4Object = IPv4.parse(_ip)
			this.addr = parsedIPv4Object.addr
			this.octets = parsedIPv4Object.octets
			this.error = parsedIPv4Object.error
			this.mask = parsedIPv4Object.mask
			this.data = data
			this.constructorArg = `${_ip} (string)`
			this.constructorArgHistory = [_ip]
			IPv4.isVerbose && console.log(`[IPv4(${this.constructorArg})`, {_ip, thisObj:this, parsedIPv4Object})
		}
		else if (_ip === null || _ip === undefined) {
			this.addr = 0
			this.octets = new Uint8Array(4)
			this.error = `constructed with null value` // if empty object created - flag as invalid (which can be cleared by a future .parse methods)
			this.mask = 0xffffffff
			this.data = data
			this.constructorArg = (_ip === null) ? 'null' : 'undefined'
			this.constructorArgHistory = [_ip]
			IPv4.isVerbose && console.log(`[IPv4(${this.constructorArg})`, {_ip, thisObj:this})
		}
		else if (_ip?.constructor.name === 'IPv4') { 										// parameter is an existing IPv4 object
			this.addr = _ip.addr
			this.octets = Uint8Array.from(_ip.octets)
			this.error = (_ip?.error) ? `[IPv4:new(${_ip})]: cloned from IPv4 object that was already an error: '${_ip.error}'` : ''
			this.mask = _ip.mask
			// if cloning an IPv4 array, data from constructor overrides local data if supplied.  Otherwise copy original data.
			// Data policy for cloning new IPv4 from existing IP4:  if data in constructor, data overrides exsiting IPv4 data.  If data not in constructor, use data from original IPv4.
			// for data in original constructor, do shallow copy for array and object (spread)

			this.data = (data != null) ? data : (_ip.data == null) ? data : (Array.isArray(_ip.data)) ? [..._ip.data] : (typeof(_ip?.data)=='object') ? { ..._ip.data, copied: true } : _ip.data
			this.constructorArg = `${_ip.toString()} (IPv4${_ip.constructorArg ? `, ${_ip.constructorArg}` : 'unknown'})`
			this.constructorArgHistory = [_ip]
			//this.constructorArgHistory = _ip?.constructorArgHistory ? [..._ip?.constructorArgHistory]  :  []
			//this.data = (typeof(_ip.data)=='object') ? { ..._ip.data, copied: true } : _ip.data
			IPv4.isVerbose && console.log(`[IPv4 instance(${this.constructorArg})`, {_ip, thisObj:this})
		}
		// duck-typing object with {addr} value.  if no {mask}, host mask is used
		else if (typeof(_ip.addr)==='number' && (_ip.addr >= 0) && (_ip.addr <= 2**32)) {
			this.addr = _ip.addr
			this.octets = IPv4.uInt8Array_from_uInt32(this.addr)
			this.error = (_ip?.error) ? `[IPv4:new(${_ip})]: cloned from {addr,mask} object that already had a non-empty error property: '${_ip.error}'` : ''
			this.mask = IPv4.maskStr_from_mask_Map.has(_ip.mask) ? _ip.mask : 0xFFFFFFFF   // host mask if none supplied or input is bad
			// if cloning an IPv4, data from constructor overrides local data if supplied.  Otherwise copy original data.
			this.data = (data !== undefined) ? data : (_ip.data == null) ? data : (Array.isArray(_ip.data)) ? [..._ip.data] : (typeof(_ip?.data)=='object') ? { ..._ip.data, copied: true } : _ip.data
			//this.data =  (_ip.data == null) ? data  : (Array.isArray(_ip.data)) ? [..._ip.data] : (typeof(_ip?.data)=='object') ? {..._ip.data, copied:true} : _ip.data
			//this.mask = (_ip?.mask && typeof(_ip.mask=='number')) ? _ip?.mask : 0xffffffff		// host mask if none supplied
			//this.data = (typeof(_ip?.data)=='object') ? { ..._ip.data, copied: true } : _ip?.data
			this.constructorArg = `${JSON.stringify(_ip)} (duck-typed {addr,mask})`
			this.constructorArgHistory = _ip?.constructorArgHistory ? [..._ip?.constructorArgHistory] : []
			IPv4.isVerbose && console.log(`[IPv4 instance(${this.constructorArg})`, {_ip, thisObj:this})
		}
		// a uInt32 number was passed (i.e. an addr)
		else if ( (typeof (_ip)==='number') && (_ip >= 0) && (_ip <= 2**32)) {	// parameter is a 32-bit unsigned integer (mask is host by default)
			this.addr = _ip
			this.octets = IPv4.uInt8Array_from_uInt32(this.addr)
			this.error = ''
			this.mask = 0xffffffff
			this.data = data
			this.constructorArg = `${Number(_ip).toLocaleString()} (number)`
			this.constructorArgHistory = [_ip]
			IPv4.isVerbose && console.log('mark5 - number', {_ip, thisObj:this})
		}
		else {
			this.addr = 0xFFFFFFFF
			this.octets = new Uint8Array([255,255,255,255])
			this.error = `[IPv4:new(${_ip})]: - parameter '${_ip}' is not acceptable.  Stringified: '${JSON.stringify(_ip,null,2)}'`
			this.mask = 0xFFFFFFFF
			this.data = null
			this.constructorArg = `${JSON.stringify(_ip)}(see error log)`
			this.constructorArgHistory = [_ip]
			console.error(`[IPv4:new(${_ip})]: - parameter '${_ip}' is not acceptable.  Stringified: '${JSON.stringify(_ip,null,2)}'`)
			IPv4.errorLog.push(`[IPv4:new(${_ip})]: - parameter '${_ip}' is not acceptable.  Stringified: '${JSON.stringify(_ip,null,2)}'`)
		}
		if (data !==null || data !==undefined) { IPv4.dataWeakMap.set(this, data) }	 // ** experimental alternative to this.data
		if (this.error) { IPv4.errorLog.push(this.error) }
	}


	[Symbol.toPrimitive] (hint)	{
		switch (hint) {
			case 'number': return this.addr.toString() + ':' + IPv4.maskLen_from_mask(this.mask)	// used for sort functions where > or < are used (may change this)
			case 'string': return `IPv4(${this.toString()})`
			default: return this.toString()
		}
	}


	/** parse - parses a supplied IP address string or network.	If mask not supplied, will default to host mask.
		* @param {string} ipString - accepts strings in the following formats: 
		* 	'10.1.1.0'									- parse IP address only, mask defaults to /32
		* 	'10.1.1.0/255.255.255.0'		- parse IP address and mask
		* 	'10.1.1.0/24' 							- parse IP address and maskLen
		*		'10.1/8', '10.1.1/16', etc 	-	parse IP address	 *** in development ***
		*/
	parse(ipString) {
		const [addrStr, maskStr] = ipString.split('/')
		const parsedAddr = IPv4.parseDottedDecimalStr(addrStr)
		this.addr = parsedAddr.addr
		this.octets = parsedAddr.octets
		this.error = parsedAddr.error
		const parsedMask = IPv4.parseMaskStr(maskStr) ?? 0xFFFFFFFF		 // the mask will default to host mask if not network was provided
		this.mask = parsedMask.mask
		return this
	}

	/** parse_w_invertedMask - behaves identially to parse , but when a mask is supplied, the mask is expected to an IOS-style inverted mask.
		 * 		NOTE: cannot effectively auto-detect inverse masks, because '255.255.255.255' and '0.0.0.0' exist in both schemes but are opposite
		* @param {string} ipString - accepts strings in the following formats: 
		* 	'10.1.1.0'									- parse IP address only, mask defaults to /32
		* 	'10.1.1.0/0.0.0.255'				- parse IP address and mask
		* 	'10.1.1.0/24' 							- parse IP address and maskLen
		*		@todo: '10.1/8', '10.1.1/16', etc 	-	parse IP address	 *** in development ***
		*/
	parse_wInvertedMask(ipString) {
		const [addrStr, maskStr] = ipString.split('/')
		const parsedAddr = IPv4.parseDottedDecimalStr(addrStr)
		this.addr = parsedAddr.addr
		this.octets = parsedAddr.octets
		this.error = parsedAddr.error
		const parsedMask = IPv4.parseInverseMaskStr(maskStr) ?? 0xFFFFFFFF		 // the mask will default to host mask if not network was provided
		this.mask = parsedMask.mask
		return this
	}

	// explicitly set address to a supplied unsigned int32. Mainly used internally 
	setAddr(_uInt32) {
		if (typeof (_uInt32) === 'number' && _uInt32 >= 0 && _uInt32 <= 0xFFFFFFFF) {
			this.addr = _uInt32
			this.octets = IPv4.uInt8Array_from_uInt32(_uInt32)
			this.error = ''
			this.mask = 0xffffffff	 // host mask by default unless (setMask must be called after)
		}
		else {
			this.error = `IPv4::setAddr(): invalid 32-bit unsigned integer "${_uInt32}" supplied`
		}
		return this
	}

	setMask(_uInt32) {
		if (IPv4.validMasks.includes(_uInt32)) {
			this.mask = _uInt32
		}
		else {
			this.error = `[IPv4::setMask]: invalid 32-bit unsigned integer "${_uInt32}" supplied`
		}
		return this
	}

	/** @section Various informational getters 
		**/
	getMaskLength() {
		if (this.isInvalid()) return null
		return IPv4.maskLen_from_mask(this.mask)
	}

	/** @method: getBlockSize()
		*	calculates the number of host IP addresses in the network block, including the network IP and broadcast address
  	*	@example: new IPv4('192.168.1.0/24').getBlockSize()	 // 256
		*/
	getBlockSize() {
		if (this.isInvalid()) return null
		return IPv4.blockSize_fromMask(this.mask)
	}

	/** @typedef {Extract<null | number, number>} NonNullableNumber */

	/**
   * @method: getAddress_fromOffset(@param _offset)
   *	If a network block is thought of an array, this returns the value of the nth IP address (denoted by _offset) into that block.
   *	NOTE: will always retain the mask of the original object.
   *
   *	Generally used in two use cases:
   *		1) For an IPv4 object containing a network block, returns an interface for the 'nth' address in that block, using _offset as the numeric index
   *		@example: new IPv4('192.168.1.0/23').getAddress_fromOffset(258).toString() 		// "192.168.1.2/23"
   *		2) For an IPv4 object containing an interface, using 0 for _offset will return the interface's network block
   *		@example: new IPv4('172.16.2.14/21').getAddress_fromOffset(0).toString() 			// '"172.16.0.0/21" 
   * 
	 * @param {number} _offset
	 * 
   */
	getAddress_fromOffset(_offset) {
		if (this.isInvalid()) throw new Error(`[IPv4::getAddress_fromOffset]: cannot create subnet generator from invalid IPv4 object (invalid reason: ${this.error} ) `)
		const mask = this.mask ?? 0xffffffff					// use host mask if mask is null
		const baseNetwork = (this.addr & mask) >>> 32				// calculates the base network, given the address and mask
		/** @type {NonNullableNumber} */
		const blockSize = this.getBlockSize()							// the size of the network block
		if (_offset > blockSize) throw new Error(`IPv::getAddress_fromOffset(_offset): supplied offset ${_offset} is out of range`)
		return new IPv4().setAddr(baseNetwork + _offset).setMask(this.mask)
	}

	getOffset_fromNetwork() {
		return this.addr & ~this.mask;
	}


	/** @method: getNetwork() 
		*	Assuming the IPv4 object is an interface object, this will return the network object that the interface is contained in
		*	Basicaly a semantic shortcut for getAddress_fromOffset(0)
		*	As such, it will always keep the same mask as the original object
		*	@returns new IPv4 object 
		*	@example: new IPv4('192.168.1.0/16').getNetwork().toString()	 // "192.168.0.0/16"
		*/
	getNetwork() {
		if (this.isInvalid()) return null
		return this.getAddress_fromOffset(0)
	}

	/*** @method: getNaturalNetwork()
		 * Returns an IPv4 object containing the same address, but with a mask that is guaranteed to make the address aligned to a network.
		 * 
		 * @params none
		 * @returns new IPv4 object 
		*
		*	Generally used in two use cases:
		*		1) For an IPv4 object containing a network block, returns an interface for the 'nth' address in that block, using _offset as the numeric index
		*		@example: new IPv4('192.168.1.0/23').getAddress_fromOffset(258).toString() 		// "192.168.1.2/23"
		*		2) For an IPv4 object containing an interface, using 0 for _offset will return the interface's network block
		*		@example: new IPv4('172.16.2.14/21').getAddress_fromOffset(0).toString() 			// '"172.16.0.0/21" 
		*		@returns 		*	@returns new IPv4 object 
		*/
	getNaturalNetwork() {
		if (this.isInvalid()) return null
		return new IPv4({
			addr: this.addr,
			mask: IPv4.naturalMask_fromAddr(this.addr)
		})
	}

  getOffset() {
		
	}


	/** @method: getBroadcast()
		*	Returns the network object that the interface is contained in
		*	Basicaly a semantic shortcut for getAddress_fromOffset(0)
		*	As such, it will always keep the same mask as the original object
		*	@returns new IPv4 object 
		*	@example: new IPv4('192.168.1.0/16').getNetwork().toString()	 // "192.168.0.0/16"
		*/
	getBroadcast() {
		if (this.isInvalid()) return null
		const inverseMask = ~this.mask >>> 0;
		// Zero out any host bits to ensure it's a network address
		const thisNetworkAddr = this.addr & this.mask;
		// Add the inverse mask to the address to get the next network address
		const nextNetworkAddr = (thisNetworkAddr + inverseMask) >>> 0;
		return new IPv4({addr:nextNetworkAddr, mask:this.mask})
	}

	getBroadcast_old() {
		if (this.isInvalid()) return null
		return this.getAddress_fromOffset(this.getBlockSize() - 1)
	}

	/** @method: getStartOfNext()
		* Very much like getBroadcast, but adds 1 to the broadcast.	Useful as a utility
		* to find the next unallocated range, given a prefix.
		*	Returns a /32 IPv4 object that the interface 
		*	@returns new IPv4 object (/32)
		*	@example: new IPv4('192.168.1.0/24').getStartOfNext().toString()	 // "192.168.2.0/32"
		*/
	getStartOfNext() {
		if (this.isInvalid()) return null
		const inverseMask = ~this.mask >>> 0;
		// Zero out any host bits to ensure it's a network address
		const thisNetworkAddr = this.addr & this.mask;
		// Add the inverse mask to the address to get the next network address (plus 1)
		const nextNetworkAddr = (thisNetworkAddr + inverseMask + 1) >>> 0;
		return new IPv4({addr:nextNetworkAddr, mask:this.mask})
	}

	getStartOfNext_old() {
		if (this.isInvalid()) return null
		if (this.addr === 0 && this.mask === 0) return null
		return this.getAddress_fromOffset(this.getBlockSize())
	}


	/** @section generator Functions */

	// starting from the base subnet of this IP address, return a generator function that will 
	//	emit next-subnets for each call to the generator's .next() method
	subnetGenerator(_subMaskLen) {
		const subnetMaskLen = parseInt(_subMaskLen)
		if (this.isInvalid()) throw `[IPv4::subnetGenerator]: cannot create subnet generator from invalid IPv4 object (invalid reason: ${this.error} ) `
		if (subnetMaskLen < this.getMaskLength()) throw `[IPv4::subnetGenerator]: cannot create subnet generator - length (${subnetMaskLen} must be longer than this address's length (${this.getMaskLength()}`

		const numSubnets = 2 ** (subnetMaskLen - this.maskLen())		// difference between parent subnet & child subnet is the exponent used to calcuate how many blocks
		const blockSize = 2 ** (32 - subnetMaskLen)										// hosts per block is 2^32-subnet
		const baseNetwork = this.getNetwork().addr

		return function* subnetGenerator() {
			for (let index = 0; index < numSubnets; index++) {
				let nextSubnet = new IPv4({
					addr: baseNetwork + (index) * blockSize,
					mask: IPv4.mask_fromLength(subnetMaskLen),
				})
				yield nextSubnet
			}
		}()
	}

	/** @section Predicates 
		**	Assumed usage will be in Array.filter, all these routines will return null (falsy) values if the contain an error, such
		*	as when the IPv4 object was instantiated with an empty string.
		**/
	/** @method isMulticast
		*		@returns true/false if IPv4 object is valid, null if invalid
		*		@methodology 	performs binary AND of this.addr with a /4 mask, then check if it's equal to uInt32 of 224.0.0.0
		*/
	isMulticast() {
		if (this.isInvalid()) return false
		if (this.addr === null) return false
		return ((this.addr & 4026531840) >>> 0) === 3758096384
	}

	isInvalid() {
		return this.error !== '' && this.error !== null
	}

	isValid() {
		return this.error === '' || this.error === null
	}

	isNull() {
		return (this.addr === null || typeof (this.addr) === 'undefined')
	}

	/** @method isUnicast()
		*		@returns true/false if isValid and IPv4 object is NOT multicast, null if invalid
		*		@methodology 	performs binary AND of this.addr with a /4 mask, then check if it's equal to uInt32 of 224.0.0.0
		*		@note this is not yet complete - since not being multicast does not means it's unicast
		*		@todo ensure it's not other invalid forms of IPv4 such as loopback
		*/
	isUnicast() {
		if (this.isInvalid()) return null
		return ((this.addr & 4026531840) >>> 0) !== 3758096384
	}

	/** @method isHost()
		*		@returns true/false if isValid and object represents a /32 route, null if not valid
		*		@note not to be confused with interface Ipv4 objects, 
		*/
	isHost() {
		if (this.isInvalid()) return null
		return ((this.addr !== null) && (this.mask === 0xffffffff))
	}

	/** @method isNetwork()
		*		@returns true/false if isValid and object represents a nettwork, null if not valid
		*		@note the opposite of isInterface().	
		*		@note not to be confused with isHost(), which is for host-specific routes, and will also
		*		pass as isNetwork() objects as well
		*/
	isNetwork() {
		if (this.isInvalid() || this.mask === null) return null
    return (this.addr & ~this.mask) === 0;		
	}
	isNetwork_prev() {
		if (this.isInvalid() || this.mask === null) return null
		const result = this.getAddress_fromOffset(0).addr
		return this.addr === result
	}

	isBroadcast() {
		if (this.isInvalid()) return null
		if (this.mask === 0xffffffff) return false // loopbacks are considered network addresses
		const invertedMask = ~this.mask						// bit-flip the subnet mask, so you get all 1's for the subnet mask
		if ((this.addr & invertedMask) === invertedMask) return true		 // bitwise-and the address to the inverted mask.	If you get the inverted mask again, you have a broadcast address,
		return false
	}

	/** isInterface() 
		*	@returns: true if object has a mask, but address does not line up with mask (i.e. 192.168.1.99/24 )
		*						false if object has a mask, and address lines up with the network value (i.e. 192.168.1.0/24)
		*						null if object is invalid or does not have a mask
		*
		*	@note 1: /32's are assumed to be routes, not interfaces.	Thus, will return false for loopbacks, but that's it.
		* @note 2: all valid IP objects can be classified into networks, broadcasts, and interfaces. This method
		*					 is calculated by ruling out the other two.
		*/
	isInterface() {
		if (this.isInvalid() || this.mask === null) return null
		return !this.isNetwork() && !this.isBroadcast()
	}

	eq(_ipv4) {
		const ipv4 = (_ipv4 instanceof IPv4) ? _ipv4 : new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::eq(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::eq(): invalid right-side IP address. Reason: ${ipv4.error}`
		return ((this.addr === ipv4.addr) && (this.mask === ipv4.mask))
	}

	neq(_ipv4) {
		const ipv4 = (_ipv4 instanceof IPv4) ? _ipv4 : new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::neq(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::neq(): invalid right-side IP address. Reason: ${ipv4.error}`
		return (this.addr !== ipv4.addr) || (this.mask !== ipv4.mask)
	}

	lt(_ipv4) {
		const ipv4 = (_ipv4 instanceof IPv4) ? _ipv4 : new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.error) throw `IPv4::lt(): invalid left-side IP address`
		if (ipv4.error) throw `IPv4::lt(): invalid right-side IP address`
		return this.addr < ipv4.addr
	}

	gt(_ipv4) {
		const ipv4 = (_ipv4 instanceof IPv4) ? _ipv4 : new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::gt(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::gt(): invalid right-side IP address. Reason: ${ipv4.error}`
		return this.addr > ipv4.addr
	}

	lte(_ipv4) {
		const ipv4 = (_ipv4 instanceof IPv4) ? _ipv4 : new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::lte(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::lte(): invalid right-side IP address. Reason: ${ipv4.error}`
		return this.addr <= ipv4.addr
	}

	gte(_ipv4) {
		const ipv4 = (_ipv4 instanceof IPv4) ? _ipv4 : new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::gte(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::gte(): invalid right-side IP address. Reason: ${ipv4.error}`
		return this.addr >= ipv4.addr
	}

	maskLen_eq(length) {
		if (this.isInvalid()) return false
		const result = (this.maskLen() === parseInt(length))
		return result
	}

	maskLen_neq(length) {
		if (this.isInvalid()) return false
		const result = (this.maskLen() !== parseInt(length))
		return result
	}

	maskLen_lte(length) {
		if (this.isInvalid()) return false
		const result = (this.maskLen() <= parseInt(length))
		return result
	}

	maskLen_lt(length) {
		if (this.isInvalid()) return false
		const result = (this.maskLen() < parseInt(length))
		return result
	}

	maskLen_gte(length) {
		if (this.isInvalid()) return false
		const result = (this.maskLen() >= parseInt(length))
		return result
	}

	maskLen_gt(length) {
		if (this.isInvalid()) return false
		const result = (this.maskLen() > parseInt(length))
		return result
	}

	/** @method compare (_ipv4)
		*		@returns negative number if this.addr (or mask if addr equal) is less than supplied _ipv4 address
		*		@returns postive number if this.addr (or mask if addr equal) greater than supplied _ipv4 address
		*		@returns zeor if this.addr and this.mask are equal
		*		
		*/
	compare(_ipv4) {
		const ipv4 = new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::compare(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::compare(): invalid right-side IP address. Reason: ${ipv4.error}`
		if (this.addr === ipv4.addr) return this.mask - ipv4.mask
		return this.addr - ipv4.addr
	}

	isSubnetOf(_ipv4) {
		const ipv4 = new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::isSubnetOf(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::isSubnetOf(): invalid right-side IP address. Reason: ${ipv4.error}`
		return (this.addr & ipv4.mask) >>> 0 === ipv4.addr
	}

	isSupernetOf(_ipv4) {
		const ipv4 = new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) throw `IPv4::isSupernetOf(): invalid left-side IP address. Reason: ${this.error}`
		if (ipv4.isInvalid()) throw `IPv4::isSupernetOf(): invalid right-side IP address. Reason: ${ipv4.error}`
		return (ipv4.addr & this.mask) >>> 0 === this.addr
	}

	// silent versions of methods that don't throw upon error - return false.	Must have IPv4.isVerbose set to true
	isSupernetOf_silent(_ipv4) {
		const ipv4 = new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) { IPv4.isVerbose && console.log(`IPv4::isSupernetOf(): invalid left-side IP address. Reason: ${this.error}`, { _ipv4, thisIP: this.toString(), thisObj: this }); return false }
		if (ipv4.isInvalid()) { IPv4.isVerbose && console.log(`IPv4::isSupernetOf(): invalid right-side IP address. Reason: ${ipv4.error}`, { _ipv4, thisIP: this.toString(), thisObj: this }); return false }
		return (ipv4.addr & this.mask) >>> 0 === this.addr
	}

	isSubnetOf_silent(_ipv4) {
		const ipv4 = new IPv4(_ipv4)		// normalize input to handle strings or objects
		if (this.isInvalid()) { IPv4.isVerbose && console.log(`IPv4::isSubnetOf(): invalid left-side IP address. Reason: ${this.error}`, { _ipv4, thisIP: this.toString(), thisObj: this }); return false }
		if (ipv4.isInvalid()) { IPv4.isVerbose && console.log(`IPv4::isSubnetOf(): invalid right-side IP address. Reason: ${ipv4.error}`, { _ipv4, thisIP: this.toString(), thisObj: this }); return false }
		return (this.addr & ipv4.mask) >>> 0 === ipv4.addr
	}

	maskLen() {
		if (this.error) throw `IPv4::maskLen(): invalid IPv4 object.	reason ${this.error}`
		return IPv4.maskLen_from_mask(this.mask) ?? null
	}

	toString() {
		if (this.isInvalid()) return `invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		return `${this.toString_addr()}/${this.toString_maskLen()}`
	}

	toString_addr() {
		if (this.isInvalid()) return `invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		return `${this.octets[0]}.${this.octets[1]}.${this.octets[2]}.${this.octets[3]}`
	}

	toString_maskLen() {
		if (this.isInvalid()) return null
		if (this.isHost()) return '32'
		const maskLen = IPv4.maskLen_from_mask(this.mask) ?? 'no_mask'
		return `${maskLen}`
	}

	toString_mask() {
		if (this.isInvalid()) return `[IPv4::toString_mask()]:invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		//			if (this.isHost()) return '255.255.255.255'
		//			return IPv4.maskStr_from_mask_Map.get(this.mask)
		return IPv4.maskStr_from_mask_Map.get(this.mask)
	}

	toString_inverseMask() {
		if (this.isInvalid()) return `[IPv4::toString_inverseMask()]: invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		//			if (this.isHost()) return '0.0.0.0'
		return IPv4.invertedMaskStr_from_mask_Map.get(this.mask)
	}

	toString_binary_addr(sepChar = '.') {
		if (this.isInvalid()) return `invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		return '0b' + [...this.octets].map((octet) => octet.toString(2).padStart(8, '0')).join(sepChar)
	}

	toString_binary_mask(sepChar = '.') {
		if (this.isInvalid()) return `invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		const maskOctets = IPv4.uInt8Array_from_uInt32(this.mask)
		return '0b' + [...maskOctets].map((octet) => octet.toString(2).padStart(8, '0')).join(sepChar)
	}

	toString_binary(sepChar = '') {
		const splicePoint = (pfxLen) => pfxLen <=8 ? pfxLen+2 : pfxLen <=16? pfxLen+3 : pfxLen <=24? pfxLen+4 : pfxLen+5
		if (this.isInvalid()) return `invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		const prefixLength = this.maskLen()
		const startOfNextRange = this.getStartOfNext()
		const addrStr = this.toString_binary_addr(sepChar)
		const maskStr = this.toString_binary_mask(sepChar)
		const sonrStr = startOfNextRange?.toString_binary_addr?.(sepChar) ?? `toString_binary: cannot calculate start of next range string...`
		
		const addrStr1 = addrStr.slice(0,splicePoint(prefixLength))
		const addrStr2 = addrStr.slice(splicePoint(prefixLength), maskStr.length)
		const maskStr1 = maskStr.slice(0,splicePoint(prefixLength))
		const maskStr2 = maskStr.slice(splicePoint(prefixLength), maskStr.length)
		const sonrStr1 = sonrStr.slice(0,splicePoint(prefixLength))
		const sonrStr2 = sonrStr.slice(splicePoint(prefixLength), maskStr.length)

		return dedent`
        addr: ${addrStr1}<${prefixLength}>  host:${addrStr2} (${this.addr.toLocaleString('en-US').replace(/,/g, '_')})
        mask: ${maskStr1}<${prefixLength}>  host:${maskStr2}
        sonr: ${sonrStr1}<${prefixLength}>  host:${sonrStr2} (${startOfNextRange?.toString()})
    `
		//return dedent`
		//	${this.toString_binary_addr(sepChar)}
		//	${this.toString_binary_mask(sepChar)}
		//`
	}

	toString_hex_addr(sepChar = '') {
		if (this.isInvalid()) return `invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		return '0x' + [...this.octets].map((octet) => octet.toString(16).padStart(2, '0')).join(sepChar)
	}

	toString_hex_mask(sepChar = '') {
		if (this.isInvalid()) return `invalid IPv4 object. Reason: ${this.error} Constructor input: ${this.constructorArgHistory}`
		const maskOctets = IPv4.uInt8Array_from_uInt32(this.mask)
		return '0x' + [...maskOctets].map((octet) => octet.toString(16).padStart(2, '0')).join(sepChar)
	}


	format({asBinary=false, asHex=false, asRange=false, showData=false} = {} ) {
		let prefixStr = `${this.toString()}`

		if (asRange) {
			prefixStr += ` (${this.toString_addr()}-${this.getBroadcast().toString_addr()}) `
		}
		if (showData) {
			prefixStr += `, Data:${JSON.stringify(this.data, null, 2)}`
		}
		if (asBinary) {
			prefixStr += `\n${this.toString_binary("_")}`
		}
		if (asHex) {
			prefixStr += `\n${this.toString_hex_addr()}/\n${this.toString_hex_mask()}`
		}
		return prefixStr
	}

	show({asBinary=true, asHex=false, asRange=false, showData=false, logFn=console.log } = {} ) {
		logFn(this.format({asBinary, asHex, asRange, showData}))
	}

	/** IPv4::setData(_dataObj) - used to replace the existing data object.	Not used to merely add data, use addTag for such purpose */
	setData(_dataObj) {
		//if (this.isInvalid()) throw `[IPv4::setData]: cannot set data property on invalid IPv4 object (invalid reason: ${this.error} ) `
		//if (typeof (_dataObj) !== 'object') throw `[IPv4::setData]: data must be an object (invalid reason: ${this.error} )`
		this.data = _dataObj
		IPv4.dataWeakMap.set(this, _dataObj)	 // ** experimental alternative to this.data
		return this
	}


	/** IPv4::clearData(_dataObj) - restores object's data state to default of empty object. */
	clearData(_dataObj) {
		this.data = null
		IPv4.dataWeakMap.delete(this)	 // ** experimental alternative to this.data
		return this
	}

	/** @deprecated Data Management methods
	 * need to determine usefulness vs complexity for data management functions within this class
	 * Perhaps .setData(), .clearData(), and map() are the only ones needed.	The rest are perhaps overengineered and/or not useful.
	 * may need to make all these functional - i.e. cloning each object for every call, or else may not work right in some other scripts/functions
	*/ 


	/** @deprecated */
	map(mapFn = (ip) => new IPv4(ip)) {
		if (typeof (mapFn) !== 'function') {
			this.addTag('map_error:', `${mapFn} is not a valid function`)
			console.error(`IPv4::map(mapFn): user-supplied value is not a valid function`)
			return this
		}
		try {
			const results = new IPv4(mapFn(this))
			this.data = results
			return this
		}
		catch (e) {
			this.addTag('mapData_err', e)
			console.error(`IPv4::mapData(mapFn): user-supplied function threw error`, { error: e })
			return this
		}
	}

	// add new data to an IPv4 object. Works if newdata is an array or now, and works if this.data is an array or not.
	// in any case, the result will be an array in the data field after this call.
	/** @deprecated */
	addData(newData) {
		if (Array.isArray(newData)) {
			this.data = Array.isArray(this.data) ? [...this.data, ...newData] : [this.data, ...newData]
		}
		else {
			this.data = Array.isArray(this.data) ? [...this.data, newData] : [this.data, newData]
		}
	}

	// set (and/or replace) an arbitrary key/value to the this.data object
	/** @deprecated */
	mapData(mapFn = (x) => x, _tagName) {
		if (typeof (mapFn) !== 'function') {
			this.addTag('mapData_error', `${mapFn} is not a valid function`)
			console.error(`IPv4::map(mapFn): user-supplied value is not a valid function`)
			return this
		}
		try {
			const results = mapFn(this.data)
			if (_tagName) {
				this.data[_tagName] = results
			}
			else {
				this.data = results
			}
			return this
		}
		catch (e) {
			this.addTag('IPv4::mapData()_err', e)
			console.error(`IPv4::mapData(mapFn): user-supplied function threw error`, { error: e })
			return this
		}
	}

	/** @section Data Management methods - may need to make all these functional - i.e. cloning each object for every call, or else may not work right in some other scripts/functions
		*/
	// set (and/or replace) an arbitrary key/value to the this.data object
	/** @deprecated */
	addTag(_tagName, _value) {
		this.data[_tagName] = _value
		return this
	}

	/** @deprecated */
	getTag(_tagName) {
		return this.data?.[_tagName] ?? null
	}


	

	/********************************************************* 
		 * Static Methods
		 *********************************************************/
	// static constructor 
	/** @param {IPConstructorArg} _ip	*/
	static of(_ip) {
		return new IPv4(_ip)
	}

	/** @param {number} uInt32 */
	static uInt8Array_from_uInt32(uInt32) {
		const buffer = new Uint32Array([uInt32]).buffer
		return new Uint8Array(buffer).reverse()			// reversed due to proper endian arrangement
	}

	// octets_fromAddr :: uInt32 => [uint8]
	/** @type {(uint32:number) => Uint8Array } */
	static octets_fromAddr(uInt32) {
		const buffer = new Uint32Array([uInt32]).buffer
		return new Uint8Array(buffer).reverse()
	}

	/**
	 * @param 	{string} ipv4_addrStr - string in the form of: '10.1.1.0', '10.1.1.1/24', or '10.1.1.1/255.255.255.0'
	 */
	static parse = (ipv4_str='') => {
	const [addrStr, maskStr] = ipv4_str.split('/')

		// first parse IP portion & early exit if errors
		const parsedIntegers = addrStr.split('.').map((octets) => parseInt(octets))
		if (parsedIntegers.length !== 4 || parsedIntegers.some(Number.isNaN) || parsedIntegers.some((x) => (x >> 8) !== 0)) {
			return {
				addr: 0xFFFFFFFF,
				octets: new Uint8Array(4),
				mask: 0xFFFFFFFF, 
				error: `Invalid IP address string supplied: '${ipv4_str}'`,
			}
		}

		// next parse marsk portion & early exit if errors
		const detectedMaskFormat = (maskStr === undefined) ? "nomask" 
			: (maskStr.length > 0 && maskStr.length < 3) ? 'masklength'
			: (maskStr.includes('.')) ? 'dotteddecimal'
			: 'unknown'

		const mask = (detectedMaskFormat === 'nomask') ? 0xFFFFFFFF 
		: (detectedMaskFormat === "masklength") ? IPv4.mask_from_maskLen(parseInt(maskStr))
		: (detectedMaskFormat === "dotteddecimal") ? IPv4.mask_from_maskStr_Map.get(maskStr)
		: -1

		// const mask = IPv4.mask_from_maskStr_Map.get(maskStr) ?? IPv4.mask_from_maskLen(parseInt(maskStr)) ?? -1					// error condition
		if (mask === -1 || mask === undefined) {
			return {
				addr: 0xFFFFFFFF,
				octets: new Uint8Array(4),
				mask: 0xFFFFFFFF,
				error: `Invalid subnet mask supplied: '${ipv4_str}'`
			}
		}
		// assumed to be valid from this point forward
		const octets = Uint8Array.from(parsedIntegers)
		const addr = new DataView(octets.buffer).getUint32(0)
		return {
			addr,
			octets,
			mask,
			error: ``
		}
	}


	/** static parseDottedDecimalStr 
	 * @param 	{string} ipv4_addrStr - string in the form of: '10.1.1.0', '10.1.1.1/24', or '10.1.1.1/255.255.255.0'
	 */
	static parseDottedDecimalStr = (ipv4_addrStr='') => {
		const fnName = `IPv4.parseDottedDecimalStr`
		const parsedIntegers = ipv4_addrStr.split('.').map((octets) => parseInt(octets))

		if (parsedIntegers.length !== 4 || parsedIntegers.some(Number.isNaN) || parsedIntegers.some((x) => (x >> 8) !== 0)) {
			const error = `Invalid IP string supplied '${ipv4_addrStr}'`
			isVerbose && console.trace(error)
			return {
				addr: 0,
				octets: new Uint8Array(4),
				error,
			}
		}
		const octets = Uint8Array.from(parsedIntegers)
		const addr = new DataView(octets.buffer).getUint32(0)
		return {
			addr,
			octets,
			error: ``,
		}
	}

	/** static parseMaskStr 
	 * @param {string} ipv4_maskStr - string in the form of '255.255.255.0' or '/24'
	 */
	static parseMaskStr(ipv4_maskStr='') {
		const fnName = `IPv4.parseMaskStr`
		const mask = IPv4.mask_from_maskStr_Map.get(ipv4_maskStr)
			?? IPv4.mask_from_maskLen(parseInt(ipv4_maskStr))
			?? -1					// error condition
		if (ipv4_maskStr == '' || mask === -1) {
			isVerbose && console.trace(error)
			return {
				mask: 0xFFFFFFFF,
				error: `[${fnName}]: Invalid subnet mask '${ipv4_maskStr}' supplied`
			}
		}
		return {
			mask,
			error: ``,
		}
	}

	/** static parseInverseMaskStr 
	 * @param {string} ipv4_maskStr - string in the form of '255.255.255.0' or '/24'
	 */
	static parseInverseMaskStr(ipv4_maskStr = '') {
		const fnName = `IPv4.parseInverseMaskStr`
		const mask = IPv4.mask_from_invertedMaskStr_Map.get(ipv4_maskStr)
			?? IPv4.mask_from_maskLen(parseInt(ipv4_maskStr))
			?? -1					// error condition
		if (ipv4_maskStr == '' || mask === -1) {
			isVerbose && console.trace(error)
			return {
				mask: 0x00000000,
				error: `[${fnName}]: Invalid inverse mask '${ipv4_maskStr}' supplied`
			}
		}
		return {
			mask,
			error: ``,
		}
	}

	/** ipRangeStr looks like one of these format:
	 * 		single IP: '10.0.0.64'
	 * 		ip range terse:	'10.0.0.64-95'
	 * 		ip range sloppy terse: '10.0.0.64 - 95'
	 * 		ip range full : '10.0.0.64-10.0.0.95'
	 * 		ip range sloppy full : '10.0.0.64 - 10.0.0.95'
	 * Returns:	 and array if IPv4 objects
 	*/
	/** @param { string } ipRangeStr */
	static parseRange = (ipRangeStr) => {
		const [_firstIP_string, _endStr] = ipRangeStr.split('-')
		const firstIP_string = _firstIP_string.trim()
		const endStr = _endStr.trim()

		if ( !IPv4.isWellFormedAddress(firstIP_string)) {
				console.error(`[parseRange]: invalid input: ${ipRangeStr} is not a valid IP address...returning null`, {firstIP_string, endStr})
				return null
		}
		// if there is no dash...return the first UO
		if (typeof(endStr) == 'undefined') {
			console.error(`[parseRange]: no range for ${ipRangeStr} - returning array of single IP`, {firstIP_string, endStr})
			return [new IPv4(firstIP_string)]
		}

		// if there's a full IP address instead of a digit on the right of the dash, use the address
		if (IPv4.isWellFormedAddress(endStr)) {
			const firstIP = new IPv4(firstIP_string)
			const lastIP = new IPv4(endStr)
			const range = IPv4.createPrefixesBetween(firstIP, lastIP, {inclusive:true})
			isVerbose && console.log(`[parseRange]:`, {
				firstIP: `${firstIP}`, 
				lastIP: `${lastIP}`, 
				range: `${range}`, 
				endStr,
			})
			return range	
		}

		// if the there's just a number after the dash, use it
		const endOfRange = parseInt(endStr)	
		if (Number.isNaN(endOfRange) || endOfRange < 0 || endOfRange > 255) {
			console.error(`[parseRange]: invalid input for range for ${ipRangeStr} - returning array of single IP`, {firstIP_string, endStr})
			return [new IPv4(firstIP_string)]
		}

		const [o1, o2, o3, o4] = firstIP_string.split('.').map( (str)=>str.trim() )
		const lastIP_string = `${o1}.${o2}.${o3}.${endOfRange}`
		const firstIP = new IPv4(firstIP_string)
		const lastIP = new IPv4(lastIP_string)
		const range = IPv4.createPrefixesBetween(firstIP, lastIP, {inclusive:true})
		isVerbose && console.log(`[parseRange]:`, {
			o1,
			o2,
			o3,
			o4,
			firstIP_string,
			lastIP_string,
			firstIP: `${firstIP}`, 
			lastIP: `${lastIP}`, 
			range: `${range}`, 
			endStr,
		})
		return range	
	}

	static isWellFormedAddress = (dottedDecimalAddrString) => {
		// first pass to see if it forms to a rough dotted decimal		
		const regexDottedDecimal = /^\d{1,3}\.\d{1,3}\.\d{1,3}.\d{1,3}$/
		if (regexDottedDecimal.test(dottedDecimalAddrString)) {
			// 2nd pass for exact check.  Need both checks because w/out regex, this would pass w/out error: "10.0.0.10/s32"
			if (IPv4.parseDottedDecimalStr(dottedDecimalAddrString).error === '') {
				return true
			}
			else {
				return false
			}
		}
		else return false
	}

	static isWellFormedPrefix = (dottedDecimalAddrString) => {
		// first pass to see if it forms to a rough dotted decimal
		const regexDottedDecimalPfx = /^\d{1,3}\.\d{1,3}\.\d{1,3}.\d{1,3}\/\d{1,2}$/
		if (regexDottedDecimalPfx.test(dottedDecimalAddrString) && new IPv4(dottedDecimalAddrString).isValid()) {
			return true
		}
		return false
	}

	static isWellFormedAddressOrPrefix = (dottedDecimalAddrOrPfxString) => {
		// first pass to see if it forms to a rough dotted decimal
		const regexDottedDecimalAddrOrPfx = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\/\d{1,2})?$/
		if (regexDottedDecimalAddrOrPfx.test(dottedDecimalAddrOrPfxString)) {
					const result = new IPv4(dottedDecimalAddrOrPfxString)
			if (result.isValid()) {
				return true
			}
			else {
				return false
			}
		}
		else return false
	}

	// string_fromAddr :: uInt32 => string
	/** @param {number} _uInt32 */
	static string_fromAddr(_uInt32) {
		const bytearray = IPv4.uInt8Array_from_uInt32(_uInt32)
		return `${bytearray[0]}.${bytearray[1]}.${bytearray[2]}.${bytearray[3]}`
	}


	/**
	 * @description prints dotted decimal, but depending on the size of the number, will not fill in any preceding zeroes.
	 * @param {number} _uInt32 
	 * @returns string
	 */
	static dottedDecimal(_uInt32) {
    if (_uInt32 < 256) {
    	return _uInt32.toString();
    } 
		else if (_uInt32 < 65536) {
    	const part1 = (_uInt32 >>> 8) & 0xFF;
    	const part2 = _uInt32 & 0xFF;
    	return `${part1}.${part2}`;
    } 
		else if (_uInt32 < 16777216) {
    	const part1 = (_uInt32 >>> 16) & 0xFF;
    	const part2 = (_uInt32 >>> 8) & 0xFF;
    	const part3 = _uInt32 & 0xFF;
    	return `${part1}.${part2}.${part3}`;
    } 
		else {
    	const part1 = (_uInt32 >>> 24) & 0xFF;
    	const part2 = (_uInt32 >>> 16) & 0xFF;
    	const part3 = (_uInt32 >>> 8) & 0xFF;
    	const part4 = _uInt32 & 0xFF;
    	return `${part1}.${part2}.${part3}.${part4}`;
    }
}


	// possibly a duplicate of string_fromAddr, used in ROutingTable->consolidate(), verify & simplify if this is the case
	/** @param {number} addr */
	static printAddr(addr) {
		return new IPv4({ addr, mask: 4294967295 }).toString_addr()
	}


	/** @method: getNetwork() 
	*	Assuming the IPv4 object is an interface object, this will return the network object that the interface is contained in
	*	Basicaly a semantic shortcut for getAddress_fromOffset(0)
	*	As such, it will always keep the same mask as the original object
	*	@returns new IPv4 object 
	*	@example: new IPv4('192.168.1.0/16').getNetwork().toString()	 // "192.168.0.0/16"
	*/
	/** @param {string} _ipStr */
	static getNetwork = (_ipStr) => new IPv4(_ipStr).getNetwork()



	/** @static @method isMulticast(_ipStr)
		*		@returns true/false if IPv4 object is valid, null if invalid
		*		@methodology 	performs binary AND of this.addr with a /4 mask, then check if it's equal to uInt32 of 224.0.0.0
		*/
	
	/** @param {string} _ipStr */
	static isMulticast(_ipStr) {
		return ((IPv4.addr_fromString(_ipStr) & 4026531840) >>> 0) === 3758096384
	}

	/** @static @method isUnicast(_ipStr)
		*		@returns true/false - IF NOT MULTICAST
		*		@note this is not yet complete - since not being multicast does not means it's unicast
		*		@todo ensure it's not other invalid forms of IPv4 such as loopback
		*/
	static isUnicast(_ipStr) {
		const result = (
			((IPv4.addr_fromString(_ipStr) & 4026531840) >>> 0) !== 3758096384
		)
		return result
	}

	/** IPv4.sort()			(for Array.sort() callback - when sorting arrays of IP objs or strings)
		 * 	@method		highest to lowest address; if addresses are equal, longest to shortest mask
		 * 	@params 	a pair of IPv4 objects or strings, or a combination
		 * 	@returns	positive number if ip1's address is higher than ip2.	if
		 * 	@type_signature	compare :: (IPv4, IPv4) => integer
		*/
	// descending sortFn: (n1,n2)=>n2-n1
	// ascending sortFn:	(n1,n2)=>n1-n2
	// sort high IP to low IP.	If a tie by addr, longest match wins (thus not the reverse of sortLH)
	static lowHigh(_ip1, _ip2) {
		const ip1 = (_ip1 instanceof IPv4) ? _ip1 : new IPv4(_ip1)
		const ip2 = (_ip2 instanceof IPv4) ? _ip2 : new IPv4(_ip2)
		return (ip1.addr - ip2.addr || ip2.mask - ip1.mask)
	}

	// sort low IP to high IP.	If a tie by addr, longest match wins	(thus not the reverse of sortHL)
	static highLow(_ip1, _ip2) {
		const ip1 = (_ip1 instanceof IPv4) ? _ip1 : new IPv4(_ip1)
		const ip2 = (_ip2 instanceof IPv4) ? _ip2 : new IPv4(_ip2)
		return (ip2.addr - ip1.addr || ip2.mask - ip1.mask)
	}

	/** IPv4.network_fromRange()
		 * 	@param:	_list_of_IPs:	a list of addresses or networks, expressed as strings or IPv4 objects
		 * 	@returns:	an IPv4 object representing the smallest single IPv4 network block that covers the range
		 * Useful for calculating summaries
		 *	If a summary is needed from a set of IPs, use RoutingTable.aggregateAddress(ipAddrs)
		 * 
		*/
	// returns IPv4 object
	static network_fromRange(..._list_of_ips) {
		const list_of_ips = _list_of_ips.flat().map((ip) => new IPv4(ip))
		const ipAddrSet = list_of_ips.flatMap((ip) => ([ip.getNetwork().addr, ip.getBroadcast().addr])).sort()
		const lowAddress = ipAddrSet[0]

		const maskLen = IPv4.length_fromRange(list_of_ips)
		const mask = IPv4.mask_fromLength(maskLen)								// using clever bit arithmetic to calculate the mask from the mask length
		const baseAddress = (lowAddress & mask) >>> 32						// using more clever bit arithmetic, calculate a new base network, given the lowAddress and newly calculated mask
		return new IPv4({
			addr: baseAddress,
			mask,
		})
	}

	// 	takes a low and high IP address, and returns an optimal set of prefixes that completely fill
	//	the hole, without going over.
	// 	differs from [network_fromRange], which returns a single network that covers all IPs in list, but might go over
	/** @returns {IPv4[]} */
	static createPrefixesBetween = (ip1, ip2, {inclusive=false}={}) => {
		const fromIP = ip1 instanceof IPv4 ? ip1 : new IPv4(ip1)
		const toIP = (inclusive===true) 
		? (ip2 instanceof IPv4) ? new IPv4(ip2.addr+1) : new IPv4(new IPv4(ip2).addr + 1) 
		: (ip2 instanceof IPv4) ? ip2 : new IPv4(ip2)
		const [lowIP, highIP] = (fromIP.addr <= toIP.addr) ? [fromIP, toIP] : [toIP, fromIP]
		const results = []			// collects our results from our recursive function 'getHole' below

		const getHole = (lowAddr, highAddr) => { 																// watch out - recursion here...
			const difference = highAddr - lowAddr
			if (difference !== 0) {																								// if true, we're still mining prefixes from this hole
				const newMaskLen = Math.clz32(difference) + 1 											// just clever binary math used here...
				const newMask = IPv4.mask_fromLength(newMaskLen)

				/*	*** Implementation Note	for potentialPrefix1 & 2 below:
						The block of the prefixes generated by this function for a range depends not just on how far apard fromIP and toIP are,
						the numbers, but also the addresses themselves.	And binary boundaries matter.	For example:
							*	potentialPrefix1 solves the problem of getting a prefix betweeen 192.168.1.0 and 192.168.1.128
							*	potentialPrefix2 solves the problem of getting a prefix betweeen 192.168.1.1 and 192.168.1.129		
				*/
				const potentialPrefix1 = new IPv4({ addr: lowAddr, mask: newMask })
				const potentialPrefix2 = new IPv4(lowAddr).getNaturalNetwork()			// see implementation note above for why...
				const nextPrefix = (potentialPrefix2.getBlockSize() < difference)
					? potentialPrefix2
					: potentialPrefix1
				results.push(nextPrefix)

				const addressCursor = nextPrefix.getBroadcast().addr + 1			// we might have more space, so recurse through 
				getHole(addressCursor, highAddr)
			}
		}
		getHole(lowIP.addr, highIP.addr)
		return results
	}

	/** IPv4.length_fromRange()
		 * 	@params 	_list_of_ips:	and array or parameter list of IPv4 objects or strings, or combination
		 * 	@returns	an integer (0 thru 32) representing the mask length of the smallest 
		 * 						aggregate address that would encompass the entire range
		 * 	@type_signature	length_fromRange :: [(IPV4|string)] => integer
		*/
	static length_fromRange(..._list_of_ips) {
		const list_of_ips = _list_of_ips.flat().map((ip) => (ip instanceof IPv4) ? ip : new IPv4(ip))
		// replace all IPs in the list with two IPs - the highest and lowest range of each
		const ipAddrSet = list_of_ips.flatMap((ip) => ([ip.getNetwork().addr, ip.getBroadcast().addr]))
		const lowAddress = ipAddrSet.sort().shift() 			// sort the array & get first item
		const highAddress = ipAddrSet.pop()								// get the last item
		return Math.clz32(highAddress ^ lowAddress)				// XOR the high and low IPs, and then count the leading zeros
	}

	/*************************************************
		 ***	Utility methods (mainly for internal use) **
		 NOTE: will generally return -1 where an integer is expected, instead of null
		 *************************************************/
	// integer[0-32] -> uInt32
	static mask_from_maskLen(len) {
		if (len > 32 || len < 0 || !Number.isInteger(len)) return -1
		return this.validMasks[len] ?? -1
	}
	// integer[0-32] -> uInt32
	static mask_fromLength(maskLen) {
		if (maskLen === 0) return 0	// special case
		// shift ones from the right using 'ones'-fill << operator
		return (0xffffffff << (32 - maskLen)) >>> 0
	}

	// uInt32 -> integer[0-32] 
	static maskLen_from_mask(mask) {
		return this.validMasks.indexOf(mask)
	}

	// string -> integer[0-32] 
	static maskLen_fromString(_ipMaskStr) {
		const mask = IPv4.mask_from_maskStr_Map.get(_ipMaskStr)
		return this.validMasks.indexOf(mask) ?? null
	}

	// integer[0-32] => ^uInt32
	static invMask_fromLength(maskLen) {
		if (maskLen === 32) return 0	// special case
		// shift all 1's to the right using zero-fill >>> operator
		return 0xffffffff >>> maskLen
	}

	/** naturalMaskLen_fromAddr
		 * 
		 * 	given an address without a mask, returns the largest feasible mask length which would make this addr a network address
		 *	in other words - returns the length of all consecutive zeros to the right of the number.
		 *	examples:	
		 * 		given an address of 3232261152 (192.168.100.32), this function returns 27.
		 * 		given an address of 3232261154 (192.168.100.34), this function returns 31.
		 * 		given an address of 3232261155 (192.168.100.35), this function returns 32.
		 * 	
		 * NOTE: needs testing - especially w/bounds checking
		 */
	static naturalMaskLen_fromAddr(_uInt32) {
		return Math.clz32((_uInt32 ^ (_uInt32 - 1)) >> 1)
	}

	/** naturalMaskLen_fromAddr
		 * 
		 * nearly identical to naturalMaskLen_fromAddr, this returns the mask as a uInt32 number
		 * 
		 *	NOTE: needs testing - especially w/bounds checking
		 */
	static naturalMask_fromAddr(_uInt32) {
		return IPv4.mask_fromLength(IPv4.naturalMaskLen_fromAddr(_uInt32))
	}

	// Lookup tables for conversions for masks of differetn forms (string -> number -> length -> string)
	static mask_from_maskStr_Map = new Map([
		["0.0.0.0", 0],
		["128.0.0.0", 2147483648],
		["192.0.0.0", 3221225472],
		["224.0.0.0", 3758096384],
		["240.0.0.0", 4026531840],
		["248.0.0.0", 4160749568],
		["252.0.0.0", 4227858432],
		["254.0.0.0", 4261412864],
		["255.0.0.0", 4278190080],
		["255.128.0.0", 4286578688],
		["255.192.0.0", 4290772992],
		["255.224.0.0", 4292870144],
		["255.240.0.0", 4293918720],
		["255.248.0.0", 4294443008],
		["255.252.0.0", 4294705152],
		["255.254.0.0", 4294836224],
		["255.255.0.0", 4294901760],
		["255.255.128.0", 4294934528],
		["255.255.192.0", 4294950912],
		["255.255.224.0", 4294959104],
		["255.255.240.0", 4294963200],
		["255.255.248.0", 4294965248],
		["255.255.252.0", 4294966272],
		["255.255.254.0", 4294966784],
		["255.255.255.0", 4294967040],
		["255.255.255.128", 4294967168],
		["255.255.255.192", 4294967232],
		["255.255.255.224", 4294967264],
		["255.255.255.240", 4294967280],
		["255.255.255.248", 4294967288],
		["255.255.255.252", 4294967292],
		["255.255.255.254", 4294967294],
		["255.255.255.255", 4294967295],
	])

	static maskStr_from_mask_Map = new Map([...IPv4.mask_from_maskStr_Map].map(([key, val]) => [val, key]))

	static mask_from_invertedMaskStr_Map = new Map([
		["255.255.255.255", 0],
		["127.255.255.255", 2147483648],
		["63.255.255.255", 3221225472],
		["31.255.255.255", 3758096384],
		["15.255.255.255", 4026531840],
		["7.255.255.255", 4160749568],
		["3.255.255.255", 4227858432],
		["1.255.255.255", 4261412864],
		["0.255.255.255", 4278190080],
		["0.127.255.255", 4286578688],
		["0.63.255.255", 4290772992],
		["0.31.255.255", 4292870144],
		["0.15.255.255", 4293918720],
		["0.7.255.255", 4294443008],
		["0.3.255.255", 4294705152],
		["0.1.255.255", 4294836224],
		["0.0.255.255", 4294901760],
		["0.0.127.255", 4294934528],
		["0.0.63.255", 4294950912],
		["0.0.31.255", 4294959104],
		["0.0.15.255", 4294963200],
		["0.0.7.255", 4294965248],
		["0.0.3.255", 4294966272],
		["0.0.1.255", 4294966784],
		["0.0.0.255", 4294967040],
		["0.0.0.127", 4294967168],
		["0.0.0.63", 4294967232],
		["0.0.0.31", 4294967264],
		["0.0.0.15", 4294967280],
		["0.0.0.7", 4294967288],
		["0.0.0.3", 4294967292],
		["0.0.0.1", 4294967294],
		["0.0.0.0", 4294967295],
	])

	static invertedMaskStr_from_mask_Map = new Map([...IPv4.mask_from_invertedMaskStr_Map].map(([key, val]) => [val, key]))

	static validMasks = [
		0,
		2147483648,
		3221225472,
		3758096384,
		4026531840,
		4160749568,
		4227858432,
		4261412864,
		4278190080,
		4286578688,
		4290772992,
		4292870144,
		4293918720,
		4294443008,
		4294705152,
		4294836224,
		4294901760,
		4294934528,
		4294950912,
		4294959104,
		4294963200,
		4294965248,
		4294966272,
		4294966784,
		4294967040,
		4294967168,
		4294967232,
		4294967264,
		4294967280,
		4294967288,
		4294967292,
		4294967294,
		4294967295,
	]

	static createRandomIPStrings(
		configObj = {											// funny-looking construct, but these are just default parameters
			oct1: [10, 20],
			oct2: [192, 192],
			oct3: [0, 255],
			oct4: [0, 255],
			mask: [20, 28],
		}) {
		const { oct1 = [10, 20], oct2 = [192, 192], oct3 = [0, 255], oct4 = [0, 255], mask = [20, 28] } = configObj

		const randomIntBetween = (...minmax) => {
			const [min, max = min] = minmax.flat()
			return Math.floor(Math.random() * (max - min + 1) + min)
		}

		return function* generateRandomIP(count = 10) {
			let remaining = count

			while (remaining > 0) {
				const oct1str = randomIntBetween(oct1)
				const oct2str = randomIntBetween(oct2)
				const oct3str = randomIntBetween(oct3)
				const oct4str = randomIntBetween(oct4)
				const maskstr = randomIntBetween(mask)
				yield `${oct1str}.${oct2str}.${oct3str}.${oct4str}/${maskstr}`
				remaining--
			}
		}
	}
	/** createRandomIPStrings(configObj)
		 * 
		 * usage:
		 * 	x = createRandomIPStrings()
		 *	const ipAddrValues = [...x(20)]
		 * 
		 */
	/*****************************************************************/
	/**	Whois / RDAP (to be moved sometime) **/
	/******************************************************************/
	static printWhoIs = (netObj) => {
		const subnet = IPv4.network_fromRange(netObj.startAddress, netObj.endAddress).toString()
		return {
			...netObj,
			[`subnet(calculated)`]: subnet
		}
	}

	// whois - performe async fetch of RDAP, but aches result into global object for performance 
	// worker scope
	static whois = async (ipAddrOrNetwork) => {
		const result = await IPv4.fetchRDAP(ipAddrOrNetwork)
		const returnVal = RDAP.validateRdapResponse(result)
		return IPv4.printWhoIs(result)
	}

	// (async) whoisBulk - RDAP-based whois 
	// ***be careful, does not flow control and may cause RDAP server operators to flag you
	static whoisBulk = async (...ipAddrOrNetworks) => await Promise.all(ipAddrOrNetworks.flat().map(IPv4.whois))

	// (async) fetchRDAP - RDAP-based whois 
	static fetchRDAP = async (ipOrNetwork) => {
		// early exit if cached...
		if (IPv4.rdapCache.has(`${ipOrNetwork}`)) return {
			request: ipOrNetwork,
			...(IPv4.rdapCache.get(`${ipOrNetwork}`))
		}
		const response = await fetch(`https://rdap.arin.net/registry/ip/${ipOrNetwork}`)
		const jsonData = await (response.json())

		IPv4.rdapCache.set(`${ipOrNetwork}`, jsonData)
		return {
			request: ipOrNetwork,
			...jsonData
		}
	}

	static fetchRDAP_instrumented = async (ipOrNetwork) => {
		let jsonData
		if (!IPv4.rdapCache.has(`${ipOrNetwork}`)) {
			console.log(`fetchRDAP: no cache for ${ipOrNetwork}, retrieving live record`)
			jsonData = await (
				await fetch(`https://rdap.arin.net/registry/ip/${ipOrNetwork}`)
			).json()
			console.log('fetchRdap raw result:', jsonData)
			IPv4.rdapCache.set(`${ipOrNetwork}`, jsonData)
		}
		else {
			console.log(`fetchRDAP: found in cache for ${ipOrNetwork}`)
			jsonData = IPv4.rdapCache.get(`${ipOrNetwork}`)
		}
		return { request: ipOrNetwork, ...jsonData }
	}

	static describe(ipOrNetwork) {
		const ipv4 = new IPv4(ipOrNetwork)
		const maskLen = IPv4.maskLen_from_mask(ipv4.mask)
		const inverseMask = (~ipv4.mask) >>> 0
		const isPrefix = ((ipv4.addr & ~ipv4.mask) === 0)
		const isInterface = ipv4.mask !== 0xFFFFFFFF && ((ipv4.addr & ~ipv4.mask) !== 0)
		const isHost = ipv4.mask == 0xFFFFFFFF
		const prefixAddr = (ipv4.addr & ipv4.mask) >>> 32
		const broadcastAddr = (ipv4.addr | ~ipv4.mask) >>> 0
		const blockSize = 2 ** (32 - maskLen)
		const blockSize2 = (~ipv4.mask >>> 0) + 1
		const startOfNext = ipv4.addr + blockSize
		
		return {
			addr: ipv4.addr,
			mask: ipv4.mask,
			maskLen,
			prefixAddr,
			broadcastAddr,
			startOfNext,
			blockSize,
			blockSize2,
			inverseMask,
			isPrefix,
			isInterface,
			isHost,
			dottedDecimal: ipv4.toString(),
			asHex: ipv4.toString_hex_addr('_'),
			hexMask: ipv4.toString_hex_mask('_'),
			asRangeString: `${ipv4.toString_addr()} - ${IPv4.dottedDecimal(broadcastAddr)}`,
			asRangeString2: `${ipv4.toString_addr()} - ${IPv4.dottedDecimal(blockSize-1)}`,
			prefixAddrString: `${IPv4.string_fromAddr(prefixAddr)}/${maskLen}`,
			startOfNextString: `${IPv4.dottedDecimal(startOfNext)}`,
			startOfNextString2: `${IPv4.string_fromAddr(startOfNext)}`,
			broadCastAddrString: `${IPv4.string_fromAddr(broadcastAddr)}`,
		}
	}

	static aggregationPotential(ipv4Obj) {
		const input = new IPv4(ipv4Obj)
    const addr = input.addr
    const mask = input.mask
		let shiftCount = 0
    let shiftedMask
    let shiftedMaskLen
		for (shiftCount=0; shiftCount<32; shiftCount++) {
    	shiftedMask = ( mask << shiftCount )>>>0
    	shiftedMaskLen = IPv4.maskLen_from_mask(shiftedMask)
			if ((addr & shiftedMask) !== addr) {
				break
			}
		}
		return {
      shiftCount,
      potential:shiftCount-1,
      mask: (mask<<shiftCount>>>0),
      prefix: new IPv4({addr, mask:shiftedMask}).toString()
    }
	}


	/**
	 * @typedef {{
	*   addr: number
	*   mask: number
	* }} IPv4Obj
	*/

	/**
	 * @description - assuming an uInt32 number, returns the size of the adderss block represented by a mask
	 * @param {number} mask
	 */
	static blockSize_fromMask(mask) {
		return (~mask >>> 0) + 1
	}


 /**
	* @description using boolean math, checks if prefix1 is a supernet of prefix2.
	* @param {IPv4Obj} superNet 
	* @param {IPv4Obj} query 
	* @returns {boolean} - true if _superNet is a supernet of _query, true if they are the same, and false otherwise
	*/
 static isSuperNet = (superNet, query) => {
	 // not a subnet if the superNet mask is longer than the query mask
	 if (superNet.mask > query.mask) return false

	 if ( ((query.addr & superNet.mask)>>>0) === superNet.addr ) return true
	 return false
 }


 /**
	* @description checks if prefix1 and prefix2 are the same prefix.  Intended for prefixes (i.e. host bits not set).
	* @param {IPv4Obj} prefix1 - first prefix, lower addr field that prefix2
	* @param {IPv4Obj} prefix2 - second prefix that can be combined into a single prefix with prefix1 with a one-bit shorter mask
	* @returns {boolean} - true if the prefix1 and prefix2 are adjancent and can be combined into a single prefix, false otherwise
	*/
 static isSamePrefix = (prefix1, prefix2) => {
	 // Check if the prefixes are valid and have the same mask length
	 if (prefix1.mask !== prefix2.mask) return false; // can't be the same prefixes if masks don't match
	 if (prefix1.addr === prefix2.addr) true

	 // if both addresses match - it's the same prefix, so return true
	 const prefix1Network = (prefix1.addr & prefix1.mask)>>>0

	 const prefix2Network = (prefix2.addr & prefix2.mask)>>>0
	 return (prefix1Network === prefix2Network)
 }



 /**
	* @description checks if prefix1 and prefix2 are adjacent, and can be combined into a single prefix.
	* @param {IPv4Obj} prefix1 - first prefix, lower addr field that prefix2
	* @param {IPv4Obj} prefix2 - second prefix that can be combined into a single prefix with prefix1 with a one-bit shorter mask
	* @returns {boolean} - true if the prefix1 and prefix2 are adjancent and can be combined into a single prefix, false otherwise
	*/
 static isAdjacent(prefix1, prefix2) {
	 // Check if the prefixes are valid and have the same mask length
	 if (prefix1.mask !== prefix2.mask) return false; // can't be the same prefixes if masks don't match

	 // now that we know we have the same mask, now let's check if they belong to the same supernet - so bitshift left by a single bit
	 const superNetMask = (prefix1.mask << 1)>>>0
	 // if they share the same supernet, return true
	 return ((prefix1.addr & superNetMask) === (prefix2.addr & superNetMask)) 
 }



 /**
	* @description checks if hostAddress1 and hostAddress2 are in a common subnet. Intended for hosts (i.e. host bits might be set).  Subnet masks must match.
	* @param {IPv4Obj} hostAddr1 - first host address
	* @param {IPv4Obj} hostAddr2 - second host address
	* @returns {boolean} - true if the prefix1 and prefix2 are adjancent and can be combined into a single prefix, false otherwise
	*/
 static inSameNetwork = (hostAddr1, hostAddr2) => {
	 // Check if the prefixes are valid and have the same mask length
	 if (hostAddr1.mask !== hostAddr2.mask) return false; // can't be the same prefixes if masks don't match

	 // if both addresses match - it's the same host, so return true
	 if (hostAddr1.addr === hostAddr2.addr) true

	 // if addresses dont' match, check if same network
	 const prefix1Network = (hostAddr1.addr & hostAddr1.mask)>>>0
	 const prefix2Network = (hostAddr2.addr & hostAddr2.mask)>>>0
	 return (prefix1Network === prefix2Network)
 }


	 /**
	 * Converts a number to a 32-bit binary string with underscores every 8 bits.
	 * @param {number} num - The number to convert.
	 * @returns {string} - The formatted binary string.
	 */
	static toBinaryString(num) {
	  return num.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1_');
	}

	/**
	 * Formats the binary string with a boundary character at the prefix length.
	 * @param {string} binaryStr - The binary string to format.
	 * @param {number} prefixLength - The prefix length.
	 * @param {string} boundaryCharacter - The boundary character.
	 * @returns {string} - The formatted binary string with boundary character.
	 */
	static formatWithBoundary(binaryStr, prefixLength, boundaryCharacter) {
	  const boundaryIndex = Math.floor(prefixLength / 8) * 9 + (prefixLength % 8);
	  return binaryStr.slice(0, boundaryIndex) + boundaryCharacter + binaryStr.slice(boundaryIndex);
	}

	/**
	 * Converts an IPv4 prefix to a formatted binary string.
	 * @param { IPv4 } ipv4Obj - The IPv4 prefix.
	 * @param {{ displayBoundary?: boolean, byteBoundaryCharacter?: string, netBoundaryCharacter?: string }} [options={}] - The options object.
	 * @returns {string} - The formatted string showing the addr and mask in binary format.
	 */
	static formatIPv4Prefix(ipv4Obj, options = {}) {
	  const { addr, mask } = ipv4Obj;
	  const { displayBoundary = false, byteBoundaryCharacter = '_', netBoundaryCharacter = ' ' } = options;

	  const addrBinary = ipv4Obj.toString_binary_addr()
	  const maskBinary = ipv4Obj.toString_binary_mask()

	  const prefixLength = IPv4.maskLen_from_mask(mask)

	  const formattedAddr = displayBoundary ? IPv4.formatWithBoundary(addrBinary, prefixLength, netBoundaryCharacter) : addrBinary;
	  const formattedMask = displayBoundary ? IPv4.formatWithBoundary(maskBinary, prefixLength, netBoundaryCharacter) : maskBinary;

	  return `prefix: ${ipv4Obj.toString()}\naddr: ${formattedAddr}\nmask: ${formattedMask}`;
	}



}		// class IPv4
const _IPv4 = (_ip, data) => new IPv4(_ip, data)


// done here because I can't figure out how to define this as a class method
IPv4.prototype[Symbol.iterator] = function* ()	{
	if (this.isInvalid() || this.addr==null) {
		return
	}
	const itercount = this?.getBlockSize() ?? 0
	const data = this.data
	const hostAddr = this.addr
	for (let c=0; c<itercount; c++) {
		yield new IPv4({
			addr: hostAddr + c,
			mask: 0xffffffff,
		}, data)//.setData({...data})
	}
}

/**
 * Represents a routing table containing IPv4 routes.
 */
class RoutingTableNG {
	/** @param {IPv4[]|string[]} ipv4Array - An array of IPv4 objects to initialize the routing table. */
	constructor(...ipv4Array) {
		/** @type Map<number,IPv4> */
		this.hostMap = new Map(); // Map for /32 (host) routes
		/** @type Map<number,Map<number, IPv4>> */
		this.maskLengthMap = new Map(); // Map for non-/32 routes
		//this.dataMap = new Map();// Map for data lookup
		this.insertionOrderMap = new Map();

		this.originalPrefixes = ipv4Array.flat()  // kept for troubleshooting purposes along with this.importedPrefixes
		const importedPrefixes = ipv4Array.flat().map((existingPrefix, index) => {
			let newPrefix
			if (existingPrefix.constructor.name==='IPv4' && existingPrefix.data !==null && !Array.isArray(existingPrefix.data)) {
				newPrefix = new IPv4(existingPrefix,[existingPrefix.data])
			}
			else {
				newPrefix = new IPv4(existingPrefix,[])
			}
			// every prefix gets referenced in the insertion order (for .getFirstMatch() )
			this.insertionOrderMap.set(newPrefix, index)
			return newPrefix
		})

		const [erroredPrefixes, cleanPrefixes] = bifurcateArray(/** @param {IPv4} ipv4*/ (ipv4)=>is.notEmpty(ipv4.error)) (importedPrefixes)
		this.errorPrefixes = erroredPrefixes
		/** @type {IPv4[]} */
		this.orderedTable = cleanPrefixes

		this.orderedTable.forEach((newPrefix) => {
			const maskLen = IPv4.maskLen_from_mask(newPrefix.mask)

			// NOTE: prefixes are split into a hostMap and a prefixMap, depending on their mask length.  This is another optimization

			// Handle /32 routes:
			if (maskLen === 32) {
				if (!this.hostMap.has(newPrefix.addr)) {
					// converting the new IPv4 instance where data is an array (to handle multiple instances but avoid duplicated IPv4 objects, handle only duplicated data
					//const newRoute = new IPv4(ipv4, [ipv4.data])
					this.hostMap.set(newPrefix.addr, newPrefix);
				} 
				else {
					// Add data to existing route's data array
					const existingPrefix = this.hostMap.get(newPrefix.addr)
					existingPrefix.data = existingPrefix?.data.concat(newPrefix.data)
				}
			} 

			// Handle non-/32 routes:
			else { 
				// if this is the first time we've seen this maskLen, create a lookup for it
				if (!this.maskLengthMap.has(maskLen)) {
					this.maskLengthMap.set(maskLen, new Map());
				}
				// normalize the network if the ipv4 happend to be a prefix like "192.168.1.100/24", we would use '192.168.1.0/24'
				const prefixAddr = (newPrefix.addr & newPrefix.mask) >>> 0;
				const prefixMapForGivenLength = this.maskLengthMap.get(maskLen);
				
				// if this it the first time we see this network/mask,
				if (!prefixMapForGivenLength.has(prefixAddr)) {
					// Create a new IPv4 instance but with a data array
					//const newRoute = new IPv4(ipv4, [ipv4.data])
					prefixMapForGivenLength.set(prefixAddr, newPrefix);
				} 
				else {
					// Add data to existing route's data array
					const existingPrefix = prefixMapForGivenLength.get(prefixAddr)
					existingPrefix.data = existingPrefix?.data.concat(newPrefix.data)
				}
			}

			// Index by data value for efficient lookups
			//	if (ipv4.data !== undefined && ipv4.data !== null) {
			//		const dataValue = ipv4.data; // Store the original data value
			//		
			//		// Get the target route where this data is now stored
			//		const targetRoute = (maskLen === 32) ? this.hostMap.get(ipv4.addr) 
			//			: this.prefixMap.get(maskLen).get(ipv4.addr >>> 0);
			//		
			//		// Create the data mapping
			//		if (!this.dataMap.has(dataValue)) {
			//			this.dataMap.set(dataValue, []);
			//		}
			//		this.dataMap.get(dataValue).push({
			//			route: targetRoute,
			//			dataIndex: targetRoute.data.length - 1
			//		});
			//	}
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


	toString({showData=false}={}) {
		if (showData) {
			return this.orderedTable
			.map( (entry) => `${entry}, data:${JSON.stringify(entry.data)}`)
			.join('\n')
		}
		else {
			return this.orderedTable.map((ip) => ip.toString()).join('\n')
		}
	}


	show({showData=false, logFn=console.log}={}) {
		if (showData) {
			const outputString = this.orderedTable
				.map( (entry) => `${entry}, data:${JSON.stringify(entry.data,null,2)}`)
				.join('\n')
			logFn(outputString)
		}
		else {
			const outputString = this.orderedTable
				.map( (entry) => `${entry}`)
				.join('\n')
			logFn(outputString)
		}
		return this
	}




	/**
	 * Checks if there's a matching prefix for the given IP address.
	 * @param {string} ipStr - The IP address string to check.
	 * @returns {boolean} True if a matching prefix is found.
	 */
	hasRouteFor(ipv4) {
		const query = (ipv4?.constructor.name=='IPv4') ? ipv4 : new IPv4(ipv4);		
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
			const subsetMap = this.maskLengthMap.get(len);
			if (subsetMap && subsetMap.has(network)) {
				return true;
			}
		}
		return false;
	}


	/**
	 * Gets the longest matching prefix for the given IP address.
	 * @param {string|IPv4} query - The IP address string to match.
	 * @returns {IPv4|null} The longest matching IPv4 object, or null if not found.
	 */
	getLongestMatchPrefix(query) {
		const queryIPv4 = (query.constructor.name=='IPv4') ? query : new IPv4(query);
		if (queryIPv4.error) return null;
		const queryMaskLen = IPv4.maskLen_from_mask(queryIPv4.mask)

		if (queryMaskLen === 32 && this.hostMap.has(queryIPv4.addr)) {
			return this.hostMap.get(queryIPv4.addr);
		}
		
		for (let length = queryMaskLen; length >= 0; length--) {
			const mask = IPv4.mask_fromLength(length)
			const addrMap = this.maskLengthMap.get(length);
			const maskedAddr = (queryIPv4.addr & mask) >>> 0;
			if (addrMap && addrMap.has(maskedAddr)) {
				return addrMap.get(maskedAddr);
			}
		}
		return null;
	}


	getFirstMatchPrefix(query) {
		const queryIPv4 = (query?.constructor.name==='IPv4') ? query : new IPv4(query);		
		if (queryIPv4.error) return null;

		// get all matching routes (by default is not in insertion order), then map in the insertion order 
		const candidatePrefixes = this.getMatchingPrefixes(query).map( (ipv4)=>({
			ipv4,
			insertionIndex:this.insertionOrderMap.get(ipv4)
		}))
		/** @typedef {typeof candidatePrefixes} CandidatePrefixes */
	
		const orderedPrefixes = candidatePrefixes.toSorted(/**@param {CandidatePrefixes} p1 @param {CandidatePrefixes} p2*/ (p1,p2) => p1.insertionIndex - p2.insertionIndex)
		return orderedPrefixes?.[0]?.ipv4 ?? null
	}


	/**
	 * Gets all matching prefixes for the given IP address.
	 * @param {string|IPv4} query - The IP address string to match.
	 * @returns {IPv4[]} An array of matching IPv4 objects.
	 */
	getMatchingPrefixes(query) {
		const queryIPv4 = (query.constructor.name==='IPv4') ? query : new IPv4(query);		
		if (queryIPv4.error) return [];
		const queryMaskLen = IPv4.maskLen_from_mask(queryIPv4.mask)

		let matches = [];
		if (queryMaskLen === 32 && this.hostMap.has(queryIPv4.addr)) {
			matches.push(this.hostMap.get(queryIPv4.addr));
		}
		
		for (const [maskLen, networkMap] of this.maskLengthMap.entries()) {
			const mask = IPv4.mask_fromLength(maskLen)
			const queryBaseNetwork = (queryIPv4.addr & mask) >>> 0;		// zeroes out the host portion of the query, just in case the user supplied query was a host instead of a network
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
	//	lookupData(dataKey) {
	//		if (!this.dataMap.has(dataKey)) return [];
	//		
	//		return this.dataMap.get(dataKey).map(entry => {
	//			return {
	//				route: entry.route,
	//				data: entry.route.data[entry.dataIndex]
	//			};
	//		});
	//	}


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
		
		for (const [maskLen, networkMap] of this.maskLengthMap.entries()) {
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
				//return new IPv4(IPv4.intToIp(expectedNetwork) + '/' + maskLen);
				return new IPv4(IPv4.string_fromAddr(expectedNetwork) + '/' + maskLen);
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
		for (const [maskLen, networkMap] of this.maskLengthMap.entries()) {
			for (const route of networkMap.values()) {
				if (route.isSubnetOf(supernet.toString())) {
					results.push(route);
				}
			}
		}
		
		return results;
	}


	/**
	 * @description using boolean math, checks if prefix1 is a supernet of prefix2.
	 * @param {string|IPv4} _superNet 
	 * @param {string|IPv4} _query 
	 * @returns {boolean} - true if _superNet is a supernet of _query, true if they are the same, and false otherwise
	 */
	static isSuperNet = (_superNet, _query) => {
		const superNet = new IPv4(_superNet)
		const query = new IPv4(_query)

		// not a subnet if the superNet mask is longer than the query mask
		if (superNet.mask > query.mask) return false

		if ( ((query.addr & superNet.mask)>>>0) === superNet.addr ) return true
		return false
	}

	/**
	 * @description checks if prefix1 and prefix2 are the same prefix.  Intended for prefixes (i.e. host bits not set).
	 * @param {IPv4} _prefix1 - first prefix, lower addr field that prefix2
	 * @param {IPv4} _prefix2 - second prefix that can be combined into a single prefix with prefix1 with a one-bit shorter mask
	 * @returns {boolean} - true if the prefix1 and prefix2 are adjancent and can be combined into a single prefix, false otherwise
	 */
	static isSamePrefix = (_prefix1, _prefix2) => {
		const prefix1 = new IPv4(_prefix1)
		const prefix2 = new IPv4(_prefix2)

		// Check if the prefixes are valid and have the same mask length
		if (prefix1.mask !== prefix2.mask) return false; // can't be the same prefixes if masks don't match
		if (prefix1.addr === prefix2.addr) true

		// if both addresses match - it's the same prefix, so return true
		const prefix1Network = (prefix1.addr & prefix1.mask)>>>0

		const prefix2Network = (prefix2.addr & prefix2.mask)>>>0
		return (prefix1Network === prefix2Network)
	}


	/**
	 * @description checks if prefix1 and prefix2 are adjacent, and can be combined into a single prefix.
	 * @param {IPv4} prefix1 - first prefix, lower addr field that prefix2
	 * @param {IPv4} prefix2 - second prefix that can be combined into a single prefix with prefix1 with a one-bit shorter mask
	 * @returns {boolean} - true if the prefix1 and prefix2 are adjancent and can be combined into a single prefix, false otherwise
	 */
	static isAdjacent(prefix1, prefix2) {
		// Check if the prefixes are valid and have the same mask length
		if (prefix1.mask !== prefix2.mask) return false; // can't be the same prefixes if masks don't match

		// now that we know we have the same mask, now let's check if they belong to the same supernet - so bitshift left by a single bit
		const superNetMask = (prefix1.mask << 1)>>>0
		// if they share the same supernet, return true
		return ((prefix1.addr & superNetMask) === (prefix2.addr & superNetMask)) 
	}


	/**
	 * @description checks if hostAddress1 and hostAddress2 are in a common subnet. Intended for hosts (i.e. host bits might be set).  Subnet masks must match.
	 * @param {IPv4} _hostAddr1 - first host address
	 * @param {IPv4} _hostAddr2 - second host address
	 * @returns {boolean} - true if the prefix1 and prefix2 are adjancent and can be combined into a single prefix, false otherwise
	 */
	static inSameNetwork = (_hostAddr1, _hostAddr2) => {
		const hostAddr1 = new IPv4(_hostAddr1)
		const hostAddr2 = new IPv4(_hostAddr2)

		// Check if the prefixes are valid and have the same mask length
		if (hostAddr1.mask !== hostAddr2.mask) return false; // can't be the same prefixes if masks don't match

		// if both addresses match - it's the same host, so return true
		if (hostAddr1.addr === hostAddr2.addr) true

		// if addresses dont' match, check if same network
		const prefix1Network = (hostAddr1.addr & hostAddr1.mask)>>>0
		const prefix2Network = (hostAddr2.addr & hostAddr2.mask)>>>0
		return (prefix1Network === prefix2Network)
	}


	static consolidate(prefixes, _dataCallback) {
    // use user-supplied callback, or if not supplieduse default
    const dataCallback = ( _dataCallback!==undefined ) ? _dataCallback 
			: typeof (_dataCallback !== 'function' || _dataCallback.length !== 2) ? (data1, data2) => (['consolidate()`]:invalid callback supplied'])
			: (dataFromPrefix1, dataFromPrefix2) => {
        if (Array.isArray(dataFromPrefix2)) {
          return Array.isArray(dataFromPrefix1) ? 
						[...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
						: [dataFromPrefix1, ...dataFromPrefix2]	//	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread	
        }
        else {
          return Array.isArray(dataFromPrefix1) ? 
						[...dataFromPrefix1, dataFromPrefix2] 	// only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
						: [dataFromPrefix1, dataFromPrefix2]		// neither are arrays - return an array with two elements
        }
    }

    // Step 1: Sort prefixes by address and prefix length
    prefixes.sort((a, b) => (a.addr - b.addr) || (a.mask - b.mask));
	  const aggregates = [];
		let lastPrefix = prefixes[0]

    // Step 2: Iterate over sorted prefixes and attempt aggregation (start with the first two prefixes)
    for (let i = 1; i < prefixes.length; i++) {
				let currentPrefix = prefixes[i];		// currentPrefix starts at 1, lastPrefix at 0

        // Step 3: Attempt to aggregate with the previous result
        if (aggregates.length > 0) {
            const previousPrefix = aggregates[aggregates.length - 1];

						// the same prefix - we aggregate the data
						if (IPv4.isSamePrefix(previousPrefix,currentPrefix)) {
							const aggregate = new IPv4({
								addr: previousPrefix.addr,
								mask: (previousPrefix.mask << 1) >>> 0,     // bit-shifting the prefix to the left by one to create an aggregate
								data: dataCallback(previousPrefix.data,currentPrefix.data)
							})
						}

						if (IPv4.isAdjacent(previousPrefix, currentPrefix)) {

						}
                        
            // Check if the current prefix can be aggregated with the last prefix
            if (
                (previousPrefix.mask === currentPrefix.mask) &&
                (previousPrefix.addr ^ currentPrefix.addr) === (1 << (32 - IPv4.maskLen_from_mask(previousPrefix.mask)))
            ) {
                // Aggregate by creating a new, broader prefix
                const newPrefixLength = IPv4.maskLen_from_mask(previousPrefix.mask) - 1;
                const newAddr = previousPrefix.addr & currentPrefix.addr; // Subnet boundary

                const newData = dataCallback(previousPrefix.data, currentPrefix.data); // Merge data
                const newIPv4 = new IPv4(`${IPv4.string_fromAddr(newAddr)}/${newPrefixLength}`, newData)
                //newIPv4.addData(newData);

                // Replace the last entry with the new aggregate
                aggregates[aggregates.length - 1] = newIPv4;
                aggregated = true;
            }
            else if (currentPrefix.isSubnetOf(previousPrefix)) {
                // If the current prefix is a subnet of the last prefix, merge the data
                previousPrefix.setData(dataCallback(previousPrefix.data, currentPrefix.data));
                aggregated = true;
            }
        }

        // Step 4: If not aggregated, copy the current prefix into the result
        if (!aggregated) {
            const newIPv4 = new IPv4(currentPrefix);
            aggregates.push(newIPv4);
        }
    }

    // Flatten the data arrays in the result
		aggregates.forEach(prefix => {
			if (Array.isArray(prefix.data)) {
					prefix.data = prefix.data.flat();
			}
		});
  	return aggregates;
	}


	static consolidate2(prefixes, _dataCallback) {
		// default dataCallback function - will always 
		const dataCallback = (data1, data2) => {
			if (Array.isArray(data2)) {
				return Array.isArray(data1) ? [...data1, ...data2] : [data1, ...data2]
			}
			else {
				return Array.isArray(data1) ? [...data1, data2] : [data1, data2]
			}
		}

    // Step 1: Sort prefixes by address and prefix length
    prefixes.sort((a, b) => (a.addr - b.addr) || (a.mask - b.mask));
		console.log({sortedPrefixes:prefixes})

    const result = [];

    // Step 2: Iterate over sorted prefixes and attempt aggregation
    for (let i = 0; i < prefixes.length; i++) {
        let current = prefixes[i];
        let aggregated = false;

        // Step 3: Attempt to aggregate with the previous result
        if (result.length > 0) {
            const last = result[result.length - 1];
						
            // Check if the current prefix can be aggregated with the last prefix
            if (
                (last.mask === current.mask) &&
                (last.addr ^ current.addr) === (1 << (32 - IPv4.maskLen_from_mask(last.mask)))
            ) {
                // Aggregate by creating a new, broader prefix
                const newPrefixLength = IPv4.maskLen_from_mask(last.mask) - 1;
                const newAddr = last.addr & current.addr; // Subnet boundary

                const newData = dataCallback(last.data, current.data); // Merge data
                const newIPv4 = new IPv4(`${IPv4.string_fromAddr(newAddr)}/${newPrefixLength}`, newData)
                //newIPv4.addData(newData);

                // Replace the last entry with the new aggregate
                result[result.length - 1] = newIPv4;
                aggregated = true;
            }
						else if (current.isSubnetOf(last)) {
							// If the current prefix is a subnet of the last prefix, merge the data
							last.addData(current.data)
							aggregated = true;
					}
        }

        // Step 4: If not aggregated, copy the current prefix into the result
        if (!aggregated) {
            const newIPv4 = new IPv4(current);
            result.push(newIPv4);
        }
    }

    return result;
	}


	// Helper function to convert a uint32 address to a dotted-decimal string
	static toDottedDecimal(uint32) {
	    return [
	        (uint32 >>> 24) & 0xFF,
	        (uint32 >>> 16) & 0xFF,
	        (uint32 >>> 8) & 0xFF,
	        uint32 & 0xFF
	    ].join('.');
	}



	/**
	 * Consolidates the routing table, aggregating prefixes where possible.
	 * @returns {RoutingTableNG} A new RoutingTable with consolidated routes.
	 */
	consolidate(accumulatorFn=(acc,data)=>acc.push(data), accInit=[]) {
		// Collect all unique routes
		//const allRoutes = [];
		//	for (const route of this.hostMap.values()) {
		//		allRoutes.push(route);
		//	}
		//	
		//	for (const [maskLen, networkMap] of this.prefixMap.entries()) {
		//		for (const route of networkMap.values()) {
		//			allRoutes.push(route);
		//		}
		//	}
		//	
		//	// Sort by mask length (ascending) and then by address
		//	allRoutes.sort((a, b) => {
		//		if (a.maskLen === b.maskLen) return a.addr - b.addr;
		//		return a.maskLen - b.maskLen;
		//	});
		const ipAddrSetToAggregate = this.getLongestMatchTable()
		
		const consolidatedRoutes = [];


		/** Due to the way that this.getLongestMatchTable() is sorted, each pass of the loop will either:
		 *   1. create a new aggregate if a new boundary is found, and add the combined data for the aggregate before pushing ont the result
		 *   2. 
		 */
		while (ipAddrSetToAggregate.length > 0) {
			const current = ipAddrSetToAggregate.shift();
			let overlapping = [current];
			
			// Find routes that are subnets of the current route

			// case 1: currentPrefix is a subnet of the previous prefix - collect the data

			// iterate through the entire set prefixes.  Because of their order (aggregate firsts), the more specifics (if they exist) have to come immediately after the aggregate

			for (let i = ipAddrSetToAggregate.length - 1; i >= 0; i--) {
				const candidate = ipAddrSetToAggregate[i];
				if (current.isSupernetOf(candidate)) {
					overlapping.push(candidate);
					ipAddrSetToAggregate.splice(i, 1);
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
			const aggregated = new IPv4(IPv4.string_fromAddr(current.addr) + '/' + current?.getMaskLength(), combinedData)
				//IPv4.intToIp(current.addr) + '/' + current.maskLen, 
			consolidatedRoutes.push(aggregated);
		}

		return new RoutingTableNG(consolidatedRoutes);
	}

	consolidate2(dataReducerFn=(accumulator,data)=>accumulator.push(data), initial=[]) {
		// Collect all unique routes
		//const allRoutes = [];
		//	for (const route of this.hostMap.values()) {
		//		allRoutes.push(route);
		//	}
		//	
		//	for (const [maskLen, networkMap] of this.prefixMap.entries()) {
		//		for (const route of networkMap.values()) {
		//			allRoutes.push(route);
		//		}
		//	}
		//	
		//	// Sort by mask length (ascending) and then by address
		//	allRoutes.sort((a, b) => {
		//		if (a.maskLen === b.maskLen) return a.addr - b.addr;
		//		return a.maskLen - b.maskLen;
		//	});
		const prefixesToAggregate = this.getLongestMatchTable()
		
		const consolidatedRoutes = [];


		/** Due to the way that this.getLongestMatchTable() is sorted, each pass of the loop will either:
		 *   1. create a new aggregate if a new boundary is found, and add the combined data for the aggregate before pushing ont the result
		 *   2. 
		 */
		while (prefixesToAggregate.length > 0) {
			const currentIPv4 = prefixesToAggregate.shift();
			let overlapping = [currentIPv4];
			
			// Find routes that are subnets of the current route
			// case 1: currentPrefix is a subnet of the previous prefix
			for (let i = prefixesToAggregate.length - 1; i >= 0; i--) {
				const candidate = prefixesToAggregate[i];
				if (currentIPv4.isSupernetOf(candidate.toString())) {
					overlapping.push(candidate);
					prefixesToAggregate.splice(i, 1);
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
			const aggregated = new IPv4(IPv4.string_fromAddr(currentIPv4.addr) + '/' + currentIPv4?.getMaskLength(), combinedData)
				//IPv4.intToIp(current.addr) + '/' + current.maskLen, 
			consolidatedRoutes.push(aggregated);
		}

		return new RoutingTableNG(consolidatedRoutes);
	}

		/** (WIP - constrainingBlock does not work) @method consolidate() - like aggregateAddress, but works on multiple ranges
	 *		@param 		{string | IPv4} _constrainingBlock
	 *		@returns: a RoutinTable object representing all IPv4 addresses in the current RoutingTable,
	 *							but attempting to auto-summarize by finding contiguous ranges within the block.
	 *							Essentially, this removes more specific routes and replaces with summaries.
	 *		@note		This is new and needs to be tested
	 */
	consolidate_orig_2(_dataCallback) {
    const aggregateData = ( _dataCallback!==undefined ) ? _dataCallback 
			: (dataFromPrefix1, dataFromPrefix2) => {
        if (Array.isArray(dataFromPrefix2)) {
          return Array.isArray(dataFromPrefix1) ? 
						[...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
						: [dataFromPrefix1, ...dataFromPrefix2]	//	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread	
        }
        else {
          return Array.isArray(dataFromPrefix1) ? 
						[...dataFromPrefix1, dataFromPrefix2] 	// only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
						: [dataFromPrefix1, dataFromPrefix2]		// neither are arrays - return an array with two elements
        }
    }


//    const aggregateData = ( _dataCallback!==undefined ) ? _dataCallback 
//			: typeof (_dataCallback !== 'function' || _dataCallback.length !== 2) ? (data1, data2) => (['consolidate()`]:invalid callback supplied'])
//			: (dataFromPrefix1, dataFromPrefix2) => {
//        if (Array.isArray(dataFromPrefix2)) {
//          return Array.isArray(dataFromPrefix1) ? 
//						[...dataFromPrefix1, ...dataFromPrefix2] // both are arrays - return combined array
//						: [dataFromPrefix1, ...dataFromPrefix2]	//	only prefix2 is a array - return array with prefix1 data as an element, and prefix2 spread	
//        }
//        else {
//          return Array.isArray(dataFromPrefix1) ? 
//						[...dataFromPrefix1, dataFromPrefix2] 	// only prefix1 is an array - return array with prefix1 data spread, and prefix2 as an element
//						: [dataFromPrefix1, dataFromPrefix2]		// neither are arrays - return an array with two elements
//        }
//    }

		let aggregatePrefixes = []
		// work with this proper subset of the original list, sorted by shortest match
		const ipAddrSetToAggregate = this.getShortestMatchTable() // .filter(ip=>ip.isSubnetOf(constrainingBlock))

		isVerbose && console.log(`[RoutingTable:consolidate]: STEP 1: preparing... ipAddrSetToAggregate is: `, (new RoutingTable(ipAddrSetToAggregate)).printableList())
		const prefixCount = ipAddrSetToAggregate.length

		// special cases for small tables (the for loop requires at least two entries due to comparison logic)
		if (prefixCount === 0) return RoutingTable.of([])
		if (prefixCount === 1) return RoutingTable.of(this.orderedTable)

		// from here, we have at least two entries, which the for() loop requires
		let c
		let startOfRange = ipAddrSetToAggregate[0].addr
		let endOfRange = ipAddrSetToAggregate[0].getStartOfNext().addr
		let accumulatedDataForCurrentAggregate = []

		isVerbose && console.log(`[RoutingTable:consolidate()]: STEP 2.	Now entering loop `, { startOfRange, endOfRange, prefixCount })

		// stop looping at the penultimate entry
		for (c = 1; c <= prefixCount-1; c++) {
			// current IP is a subnet of the previous IP, so get data & add append to aggregate
			if (ipAddrSetToAggregate[c].addr < endOfRange) {		// ipAddrSetToAggregate[c] is a subnet confined within the previous prefix...
				accumulatedDataForCurrentAggregate = aggregateData(accumulatedDataForCurrentAggregate, ipAddrSetToAggregate[c].data)

				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 1: curIP (${ipAddrSetToAggregate[c].toString()}) is a subnet of prevIP (${ipAddrSetToAggregate[c - 1].toString()})...doing nothing `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
			}
			// if ipAddrSetToAggregate[c] is contiguous - move the end of range cursor 
			else if (ipAddrSetToAggregate[c].addr === endOfRange) {	
				accumulatedDataForCurrentAggregate = aggregateData(accumulatedDataForCurrentAggregate, ipAddrSetToAggregate[c].data)
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr

				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 2: curIP (${ipAddrSetToAggregate[c].toString()}) is continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()}) - moving endOfRange cursor forward `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
			}
			// 
			else if (ipAddrSetToAggregate[c].addr > endOfRange) {		// ipAddrSetToAggregate[c] is discontiguous - create a set of summaries with the range we disocvered & reset data & cursors
				const newPrefixes = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
				const newAggregates = IPv4.createPrefixesBetween(startOfRange, endOfRange)
				aggregatePrefixes = [ ...aggregatePrefixes, ...newAggregates ]
				accumulatedDataForCurrentAggregate = []
				startOfRange = ipAddrSetToAggregate[c].addr
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr

				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 3: curIP (${ipAddrSetToAggregate[c].toString()}) is not continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()})- creating a new aggregate set & adjusting startOfRange and endOfRange `, {
					c,
					newPrefixes,
					startOfRange_raw: startOfRange,
					endOfRange_raw: endOfRange,
					startOfRange_prev: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					startOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].addr),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
					aggregatePrefixes,
				})
			}
			else {
				console.error(`[RoutingTable:consolidate()]: INVALID CASE `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
				})
			}
		}	// for

//		const protoAggregate2 = IPv4.createPrefixesBetween(startOfRange, endOfRange)
//		// create aggregate, set the data, and reset our accumulatedData
//		const newAggregate = protoAggregate2[0].setData(accumulatedDataForCurrentAggregate)
//		aggregatePrefixes = [ ...aggregatePrefixes, newAggregate ]
//		accumulatedDataForCurrentAggregate = []
//
//
//		const newPrefixes = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
//		aggregatePrefixes = [...aggregatePrefixes, ...newPrefixes]
//
//		// reducedSet is a routing table of aggregates without data mapped in.  Now we have to add back the data
//
//		const aggregateIterator = aggregatePrefixes.values()
//		const prefixes = this.getLongestMatchTable()
//		const prefixIterator = prefixes.values()
//		
//		let nextAggregate = aggregateIterator.next().value
//		let nextPrefix = prefixIterator.next().value
//		nextAggregate.data = []
//		while(nextAggregate) {
//			while (nextPrefix && nextAggregate.isSupernetOf(nextPrefix)) {
//				nextAggregate.data = aggregateData(nextAggregate.data, nextPrefix.data)
//				nextPrefix = prefixIterator.next().value
//			}
//			nextAggregate = aggregateIterator.next().value
//			if (nextAggregate) {
//				nextAggregate.data = []
//			}
//		}
		return new RoutingTable(aggregatePrefixes)
	}



	/** (WIP - constrainingBlock does not work) @method consolidate() - like aggregateAddress, but works on multiple ranges
	 *		@param 		{string | IPv4} _constrainingBlock
	 *		@returns: a RoutinTable object representing all IPv4 addresses in the current RoutingTable,
	 *							but attempting to auto-summarize by finding contiguous ranges within the block.
	 *							Essentially, this removes more specific routes and replaces with summaries.
	 *		@note		This is new and needs to be tested
	 */
	consolidate_old(_constrainingBlock = '0.0.0.0/0') {
		let reducedSet = []
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		// work with this proper subset of the original list, sorted by shortest match
		const ipAddrSetToAggregate = this.getLongestMatchTable() // .filter(ip=>ip.isSubnetOf(constrainingBlock))

		isVerbose && console.log(`[RoutingTable:consolidate]: STEP 1: preparing... ipAddrSetToAggregate is: `, (new RoutingTable(ipAddrSetToAggregate)).printableList())
		const size = ipAddrSetToAggregate.length

		// special cases for small tables (the for loop requires at least two entries due to comparison logic)
		if (size === 0) return RoutingTable.of([])
		if (size === 1) return RoutingTable.of(this.orderedTable)

		// from here, we have at least two entries...
		let c
		let startOfRange = ipAddrSetToAggregate[0].addr
		let endOfRange = ipAddrSetToAggregate[0].getStartOfNext().addr

		isVerbose && console.log(`[RoutingTable:consolidate()]: STEP 2.	Now entering loop `, { startOfRange, endOfRange, size })

		// stop looping where there are only two left
		for (c = 1; c <= size-1; c++) {
			// current IP is a subnet of the previous IP, so skipping
			if (ipAddrSetToAggregate[c].addr < endOfRange) {		// ipAddrSetToAggregate[c] is a subnet confined within the previous prefix...
				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 1: curIP (${ipAddrSetToAggregate[c].toString()}) is a subnet of prevIP (${ipAddrSetToAggregate[c - 1].toString()})...doing nothing `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
			}
			else if (ipAddrSetToAggregate[c].addr === endOfRange) {	// ipAddrSetToAggregate[c] is contiguous - move the end of range cursor 
				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 2: curIP (${ipAddrSetToAggregate[c].toString()}) is continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()}) - moving endOfRange cursor forward `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr
			}
			else if (ipAddrSetToAggregate[c].addr > endOfRange) {		// ipAddrSetToAggregate[c] is discontiguous - create a set of summaries with what we have & reset
				const newPrefixes = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
				reducedSet = [...reducedSet, ...newPrefixes]
				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 3: curIP (${ipAddrSetToAggregate[c].toString()}) is not continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()})- creating a new aggregate set & adjusting startOfRange and endOfRange `, {
					c,
					newPrefixes,
					startOfRange_raw: startOfRange,
					endOfRange_raw: endOfRange,
					startOfRange_prev: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					startOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].addr),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
					reducedSet,
				})
				startOfRange = ipAddrSetToAggregate[c].addr
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr
			}
			else {
				console.error(`[RoutingTable:consolidate()]: INVALID CASE `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
				})
			}
		}	// for

		const newPrefixes = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
		reducedSet = [...reducedSet, ...newPrefixes]

		// reducedSet is a routing table of aggregates without data mapped in.  Now we have to add back the data

		const aggregateIterator = reducedSet.values()
		const prefixes = this.getLongestMatchTable()
		const prefixIterator = prefixes.values()
		
		let nextAggregate = aggregateIterator.next().value
		let nextPrefix = prefixIterator.next().value
		nextAggregate.data = []

		while(nextAggregate) {
			while (nextPrefix && nextAggregate.isSupernetOf(nextPrefix)) {
				nextAggregate.data.push(nextPrefix.data)
				nextPrefix = prefixIterator.next().value
			}
			nextAggregate = aggregateIterator.next().value
			if (nextAggregate) {
				nextAggregate.data = []
			}
		}
		return new RoutingTable(reducedSet)
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


/**
 * RoutingTable takes a list of IPv4 objects, deepcopies them, then:
 *	1) uses the original order of the table as an 'orderedTable' for 'first match' queries
 *	2) uses sorted table (descending by addr, then by mask) to perform 'longest match' queries
 *
 * 	'first match' is used for things like ACLs, prefix-lists, route-maps, etc.
 * 	'longest match' is used for route-lookup
 * @class RoutingTable
 * 
 * 
 */

 class RoutingTable {
	constructor(...prefixes) {
		this.name = ''
		this.orderedTable = []							// the normal internal data structure
		this.longestMatchTable = []					// cache of ordered table for longest-match processing
		this.shortestMatchTable = []				// cache of ordered table for shortest-match processing
		this.whoisResolver = null
		this.addPrefixes(...prefixes.flat())
		this.verboseLogging = false
		return this
	}

	/** name the routing table as needed when working with multiple ones */
	named(routingTableName='') {
		this.name=routingTableName
	}

	// Create routing table from a simple array of existing IPv4 objects, where an item is any data type accepted by the IPv4 constructor.
	static of = (...prefixes) => new RoutingTable([...prefixes.flat()])
	

	// create routing table from a simple array of items, where an item is any data type accepted by the IPv4 constructor.
	// For example:	'10.10.10.10/31', an IPv4 object, a 32-bit unsigned number, etc
	static fromRawList = (...prefixes) => new RoutingTable([...prefixes.flat()].map((pfxstr)=>new IPv4(pfxstr)))

	// create routing table from a simple array of items, where an item is any data type accepted by the IPv4 constructor.
	// For example:	'10.10.10.10/31', an IPv4 object, a 32-bit unsigned number, etc
	static fromRawRecords = (prefixPropName) => (...records) => new RoutingTable([...records.flat()].map((record)=>new IPv4(record[prefixPropName]).setData(record)))


	// Returns a new RoutingTable instance prefixes are sorted first by address, and in a tie, by longest mask first
	// This is useful when evaluating the most specific match (i.e. route lookups)
	getLongestMatchRoutingTable() {
		if (this.longestMatchTable.length === 0) {
			this.longestMatchTable = this.orderedTable.toSorted( (ip1, ip2) => {
					if (ip1.addr < ip2.addr) return -1;
					if (ip1.addr > ip2.addr) return 1;
					// If names are equal, sort by mask in descending order
					return ip2.mask - ip1.mask;
				}
			)
		}
		return new RoutingTable(this.longestMatchTable)
	}

	// Returns a new RoutingTable instance prefixes are sorted first by address, and in a tie, by shortest mask first
	// this is useful for first-match algorithms (i.e. acl evaluations)
	getFirstMatchRoutingTable() {
		if (this.longestMatchTable.length === 0) {
			this.longestMatchTable = this.orderedTable.toSorted( (ip1, ip2) => {
					if (ip1.addr < ip2.addr) return -1;
					if (ip1.addr > ip2.addr) return 1;
					// If names are equal, sort by age in descending order
					return ip1.mask - ip2.mask;
				}
			)
		}
		return new RoutingTable(this.longestMatchTable)
	}


	// 	returns a copy of the IPv4 array (but does not copy elements), 
	//	sorted by low -> high IP addresses, in a tie, LONGEST prefix first
	getLongestMatchTable() {
		if (this.longestMatchTable.length === 0) {
			this.longestMatchTable = [...this.orderedTable]
				.sort((ip1, ip2) => ip2.mask - ip1.mask)
				.sort((ip1, ip2) => ip1.addr - ip2.addr)
		}
		return this.longestMatchTable
	}


	// 	returns a copy of the IPv4 array (but does not copy elements), 
	//	sorted by low -> high IP addresses, in a tie, SHORTEST prefix first
	getShortestMatchTable() {
		this.shortestMatchTable = [...this.getLongestMatchTable()].reverse()
		return this.shortestMatchTable
	}


	// 	returns a copy of the IPv4 array (but not copies of elements), 
	//	sorted by low -> high IP addresses, in a tie, SHORTEST prefix first
	getShortestMatchTable_old() {
		if (this.shortestMatchTable.length == 0) {
			this.shortestMatchTable = [...this.orderedTable]
				.sort((ip1, ip2) => ip1.mask - ip2.mask)
				.sort((ip1, ip2) => ip1.addr - ip2.addr)
		}
		return this.shortestMatchTable
	}


	// appends a new prefix or array of prefies into RoutingTable
	// mutates this RoutingTable
	addPrefixes(..._prefixes) {
		const prefixes = _prefixes.flat().map((prefix) => new IPv4(prefix))
		this.orderedTable = [...this.orderedTable, ...prefixes]
		this.longestMatchTable = []	 	// invalidate the cache
		this.shortestMatchTable = []		// invalidate the cache
		return this
	}


	/**	getUnallocatedBlocksWithin
	 * @params _constrainingBlock - all prefixes are carved out of holes with respect to the provided subnet
	 * @returns a RoutingTable object containing all prefixes filling in the gaps in the routing table (within the constraining prefix)
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
		return new RoutingTable(finalResults)
	}


	getUnallocatedWithin_old(_constrainingBlock = '0.0.0.0/0') {
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		const sortedRouteTable = this.getShortestMatchTable_old().filter((ip) => ip.isSubnetOf(constrainingBlock))
		const blockEndAddr = constrainingBlock.getBroadcast().addr + 1
		const accObjInitState = {
			cursor: constrainingBlock.addr,
			results: [],
		}
		const preliminaryReport = sortedRouteTable.reduce((accObj, prefix, index, inputArray) => {
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
		return new RoutingTable(finalResults)
	}

	/** @method getCleanedTable
	*		@returns: a new Routing Table with duplicates and data removed
	*							for the purposes of making this routing table appear more like a real routing table
	*	 NOTE: 03-23-2024:	Removed this to eliminate the dependency on deDupByProps module.	Removed the import.
	*/
	// getCleanedTable() {
	// 	const cleanedTable = this.orderedTable.map(({ addr, mask }) => new IPv4({ addr, mask }))			// clone IPv4 objects & reset data
	// 	const dedupedTable = deDupByProps(['addr', 'mask'])(cleanedTable)												// dedup
	// 	return new RoutingTable(dedupedTable)
	// }

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

	//[Symbol.toLocaleString]() {
	//	return this.toString()
	//}

	// applies mapFn to cloned IPv4 objects inside RoutingTable
	// NOTE: mapFn must be of the form mapFn -> IPv4Obj -> IPv4Obj
	map(mapFn) {
		return new RoutingTable([...this.orderedTable.map(mapFn)])
	}

	// applies filterFn to cloned IPv4 objects inside RoutingTable
	// NOTE: mapFn must be of the form mapFn -> IPv4Obj -> boolean
	// would likely use this for data instead of subnet matches - use match functions below for that
	filter(filterFn) {
		return new RoutingTable([...this.orderedTable.filter(filterFn)])
	}

	/** @method aggregateAddress()
	*		@param 		{string | IPv4} _constrainingBlock
	*		@returns: a single IPv4 network object representing the smallest
	*							block that covers the entire routing tables' ranges
	*		@note		 	needs to be tested as a broad match returns 0.0.0.0/32
	*/
	aggregateAddress(_constrainingBlock = '0.0.0.0/0') {
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		const ipAddrSetToAggregate = this.getShortestMatchTable().filter((ip) => ip.isSubnetOf(constrainingBlock))
		return IPv4.network_fromRange(ipAddrSetToAggregate)
	}

	/** @method aggregateWithData(_constrainingBlock)
	*		@param 		{string | IPv4} _constrainingBlock
	*		@returns: as with aggregateAddress(), a single IPv4 network object representing 
	*							the smallest block that covers the routing tables' ranges, but also
	*							carries the aggregate of data 
	*		@note 		needs to be tested given it's use this.aggregateAddress() (see above)
	*/
	aggregateWithData(_constrainingBlock = '0.0.0.0/0') {
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		const ipAddrSetToAggregate = this.getShortestMatchTable().filter((ip) => ip.isSubnetOf(constrainingBlock))
		const aggregateAddress = this.aggregateAddress(_constrainingBlock)
		const aggregatedData = ipAddrSetToAggregate.map((ipv4) => ipv4.data)
		return aggregateAddress.setData({ aggregatedData })
	}


	/** (WIP - constrainingBlock does not work) @method consolidate() - like aggregateAddress, but works on multiple ranges
	 *		@param 		{string | IPv4} _constrainingBlock
	 *		@returns: a RoutinTable object representing all IPv4 addresses in the current RoutingTable,
	 *							but attempting to auto-summarize by finding contiguous ranges within the block.
	 *							Essentially, this removes more specific routes and replaces with summaries.
	 *		@note		This is new and needs to be tested
	 */
	consolidate() {
		let reducedSet = []

		// work with this proper subset of the original list, sorted by shortest match
		const ipAddrSetToAggregate = this.getLongestMatchTable() 

		isVerbose && console.log(`[RoutingTable:consolidate]: STEP 1: preparing... ipAddrSetToAggregate is: `, (new RoutingTable(ipAddrSetToAggregate)).printableList())
		const size = ipAddrSetToAggregate.length

		// special cases for small tables (the for loop requires at least two entries due to comparison logic)
		if (size === 0) return RoutingTable.of([])
		if (size === 1) return RoutingTable.of(this.orderedTable)

		// from here, we have at least two entries...
		let c
		let startOfRange = ipAddrSetToAggregate[0].addr
		let endOfRange = ipAddrSetToAggregate[0].getStartOfNext().addr

		isVerbose && console.log(`[RoutingTable:consolidate()]: STEP 2.	Now entering loop `, { startOfRange, endOfRange, size })

		// stop looping where there are only two left

		for (c = 1; c <= size - 1; c++) {
			let combinedData = []  // holds the combined data for all prefixes within an aggregate

			// case 1: currentPrefix is a subnet of the previous prefix - aggregate data into aggregate's "bag" 
			if (ipAddrSetToAggregate[c].addr < endOfRange) {
				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 1: curIP (${ipAddrSetToAggregate[c].toString()}) is a subnet of prevIP (${ipAddrSetToAggregate[c - 1].toString()})...doing nothing `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
			}
			// case 2; currentPrefix is contiguous with the previous - move the end of range cursor & add data into aggregate's "bag"
			else if (ipAddrSetToAggregate[c].addr === endOfRange) {	
				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 2: curIP (${ipAddrSetToAggregate[c].toString()}) is continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()}) - moving endOfRange cursor forward `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr
			}
			// case 3: we hit a discontiguous prefix, so whatever we did previously should be consolidated
			else if (ipAddrSetToAggregate[c].addr > endOfRange) {		// ipAddrSetToAggregate[c] is discontiguous - create a set of summaries with what we have & reset
				const aggregated = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
				let combinedData = []  // reset 
				reducedSet = [...reducedSet, ...aggregated]
				isVerbose && console.log(`[RoutingTable:consolidate()]: CASE 3: curIP (${ipAddrSetToAggregate[c].toString()}) is not continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()})- creating a new aggregate set & adjusting startOfRange and endOfRange `, {
					c,
					aggregated,
					startOfRange_raw: startOfRange,
					endOfRange_raw: endOfRange,
					startOfRange_prev: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					startOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].addr),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
					reducedSet,
					aggregateDataSoFar: JSON.stringify(combinedData,null,2),
				})
				startOfRange = ipAddrSetToAggregate[c].addr
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr
			}
			else {
				console.error(`[RoutingTable:consolidate()]: INVALID CASE `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
				})
			}
		}	// for

		const newPrefixes = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
		reducedSet = [...reducedSet, ...newPrefixes]


		return new RoutingTable(reducedSet)
	}

	/** @method aggregateWithData(_constrainingBlock)
	*		@param 		{string | IPv4} _ipv4
	*		@returns: a single IPv4 network object representing 
	*/
	longestMatch(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return this.getLongestMatchTable().find((prefix) => prefix.isSupernetOf(ipv4)) || null
	}

	/** @method firstMatch(_ipv4)
	*		@param 	{string | IPv4} _ipv4
	*		@param	{RoutingTable}
	*		@returns: {RoutingTable} object containing prefixes 
	*							which match under the supplied input parameter
	*/
	firstMatch(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return this.orderedTable.find((prefix) => prefix.isSupernetOf(ipv4)) || null
	}

	/** onlyMatching - returns a 
	* 	@method 	onlyMatching(_ipv4)
	*		@param 		{string | IPv4} _ipv4 - ip prefix string or IPv4 object
	*		@returns: {RoutingTable} - containing only subnets of the supplied _ipv4 prefix
	*/
	onlyMatching(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return new RoutingTable([...this.orderedTable].filter((prefix) => !!prefix.isSubnetOf(ipv4) || !!prefix.eq(ipv4)))
	}

	/** @method notMatching(_ipv4)
	*		@param 		{string | IPv4} _ipv4 - ip prefix string or IPv4 object
	*		@returns: {RoutingTable} - new RoutingTable object without the supplied ipv4 prefix and all its subnets
	*/
	notMatching(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return new RoutingTable([...this.orderedTable].filter((prefix) => !prefix.isSubnetOf(ipv4) && !prefix.eq(ipv4)))
	}

	/** @method hasRouteFor(_ipv4)
	*		@param 	_ipv4: ip prefix string or IPv4 object representing network
	*		@returns {boolean}	true =	if the routing table contains a supernet prefix of the supplied route 
	*						
	*/
	hasRouteFor(_ipv4) {
		const ipv4 = new IPv4(_ipv4)		// normalize input to handle strings or objects
		return this.orderedTable.some((prefix) => prefix.isSupernetOf(ipv4))
	}

	valueOf() {
		return this.orderedTable.map((ip) => new IPv4(ip))
	}

	toString() {
		return this.orderedTable.map((ip) => ip.toString()).join('\n')
	}

	printableList() {
		return this.orderedTable.map((ipv4) => `${ipv4}`)
	}

	tap(logFn = console.dir) {
		logFn(this.toString())
		return this
	}


	// Set operations - removing entries not also a member of another routing table
	// getIntersectionWith :: RoutingTable(this) -> RoutingTable(foreign) -> RoutingTable
	getIntersectionWith(foreignRoutingTable) {
		return new RoutingTable(
			this.orderedTable.filter((ip) => foreignRoutingTable.hasRouteFor(ip))
		)
	}

	// Set operations - removing entries not also a member of another routing table
	subtractRoutingTable(foreignRoutingTable) {
		return new RoutingTable(
			this.orderedTable.filter((ip) => !foreignRoutingTable.hasRouteFor(ip))
		)
	}

	// shortcuts
	getNonPublic() {
		return this.getIntersectionWith(RoutingTable.specialUseRanges)
	}

	// shortcuts
	getPublic() {
		return this.subtractRoutingTable(RoutingTable.specialUseRanges)
	}

	// shortcuts
	getSpecialUseRanges() {
		return new RoutingTable(
			this.filter((ip) => RoutingTable.specialUseRanges.hasRouteFor(ip))
		)
	}

	/** @method exportDataSet()
	*		@returns 	dsArray (a flat array of monomorphic objects with string properties) 
	*						
	*/
	exportDataSet() {
		return this.orderedTable.map((ipObj) => ({
			prefix: ipObj.toString(),
			...ipObj?.data,
		})).map(flattenItem)
	}

	resolveRdap = async () => {
		if (this.whoisResolver === null) {
			const rdapCache = new RDAP()
			await rdapCache.useDBCache('rdapCache')
			rdapCache.verboseLogging = this.verboseLogging 				// turn on rdapCache logging if this routing table enables it.
			this.whoisResolver = await rdapCache.updateBootStrap()
		}
		for (const ipObj of this.getLongestMatchTable()) {
			let mark = performance.now().toFixed(3)
			isVerbose && console.log(`[resolveRdap]: before await whoisIP...`, { prefix: ipObj.toString() })
			const rdapResult = await this.whoisResolver.whoisIP(ipObj.toString())
			isVerbose && console.log(`[resolveRdap]: after await whoisIP...`, { prefix: ipObj.toString(), time: (performance.now() - mark).toFixed(3) })
			ipObj.addTag('rdap', rdapResult)
			console.log(`resolveRdap: inside loop,received rdapResult`, { time: performance.now(), rdapResult, ipObj })
		}
		await this.whoisResolver.saveToDBCache()
		return this
	}

	getResolvedRdap_v2() {
		return this.getLongestMatchTable()
			.filter((ipObj) => (ipObj?.data?.rdap?.name ?? false) !== false)
			.map(({ prefix = 'ERROR', cidr0_cidrs = [], name = '', handle = '', ...rest }) => ({
				prefix,
				cidr0_cidrs,
				cidrs: cidr0_cidrs.map(
					({ v4prefix, length, ...rest }) => `${v4prefix}/${length}`
				).join(', '),
				name,
				handle,
				rest
			})
			)
	}

	getResolvedRdap() {
		return this.getLongestMatchTable().map((ipObj) => ({
			prefix: ipObj.toString(),
			cidrs: (ipObj?.data?.rdap?.cidr0_cidrs ?? []).map((entry) => `${entry.v4prefix}/${entry.length}`).join(','),
			assocASNs: ipObj?.data?.rdap?.arin_originas0_originautnums ?? '',
			name: ipObj?.data?.rdap?.name ?? '',
			handle: ipObj?.data?.rdap?.handle ?? '',
			type: ipObj?.data?.rdap?.type ?? '',
			...ipObj?.data?.request,
			...ipObj?.data?.rdap,
		}))
	}


	// define some useful lists of prefixes per common conventions & standards
	static multicastRanges = new RoutingTable([
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


	static specialUseRanges = new RoutingTable([
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
} // class RoutingTable





class RoutingTableNG_prev {
	  /** @param {IPv4[]|string[]} ipv4Array - An array of IPv4 objects to initialize the routing table. */
	constructor(...ipv4Array) {
		const ipv4Prefixes = ipv4Array.flat().map((prefix) => new IPv4(prefix))

		const [erroredPrefixes, cleanPrefixes] = bifurcateArray(ipv4=>ipv4.error) (ipv4Prefixes)
		this.errorPrefixes = erroredPrefixes
		/** @type {IPv4[]} */		
		this.orderedTable = cleanPrefixes

		/** @type Map<number,IPv4> */
    this.hostMap = new Map();
		/** @type Map<number,IPv4> */
    this.prefixMap = new Map();
		this.dataMap = new Map();
		this.insertionOrderMap = new Map();

		this.orderedTable.forEach( (ipv4,idx) => {
			const maskLen = IPv4.maskLen_from_mask(ipv4.mask)

			// every prefix gets referenced in the insertion order (for .getFirstMatch() )
			this.insertionOrderMap.set(ipv4,idx)

			if (ipv4?.data) {
				this.dataMap.set(ipv4.data, this)
			}

			// prefixes are split into a hostMap and a prefixMap, depending on their mask length
			// this is another optimization
			if (maskLen === 32) {
				this.hostMap.set(ipv4.addr, ipv4)
			} 
			else {
				// for non-host masks, each mask length gets its own lookup map (an optimization).	Initialize a new one for such maskLen if not aleady created
				if (!this.prefixMap.has(maskLen)) {
					this.prefixMap.set(maskLen, new Map());
				}
				const network = (ipv4.addr & ipv4.mask) >>> 0;
				const prefixMapForLen = this.prefixMap.get(maskLen);
				if (!prefixMapForLen.has(network)) {
					prefixMapForLen.set(network, []);
				}
				prefixMapForLen.get(network).push(ipv4);
			}
		})

		// may not need these in the NG version
		this.longestMatchTable = []					// cache of ordered table for longest-match processing
		this.shortestMatchTable = []				// cache of ordered table for shortest-match processing


		this.name = ''
		this.whoisResolver = null
		this.verboseLogging = false
		return this
	}

	hasRouteFor(ipv4) {
		const query = (ipv4?.constructor.name==='IPv4') ? ipv4 : new IPv4(ipv4);		
		if (query.error) return false;

		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)
		if ( queryMaskLen === 32 && this.hostMap.has(query.addr) ) {
			return true;
		}
		
		for (let len = queryMaskLen; len >= 0; len--) {
			const mask = IPv4.mask_fromLength(len)
			//const mask = len === 0 ? 0 : (0xFFFFFFFF << (32 - len)) >>> 0;
			const network = (query.addr & mask) >>> 0;

			const subsetMap = this.prefixMap.get(len);
      if (subsetMap && subsetMap.has(network)) {
				return true;
			}
		}
		return false;
	}
 
	getLongestMatchPrefix(ipv4) {
		const query = (ipv4?.constructor.name==='IPv4') ? ipv4 : new IPv4(ipv4);		
		if (query.error) return null;

		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)
		if (queryMaskLen === 32 && this.hostMap.has(query.addr)) {
			return this.hostMap.get(query.addr);
		}

		for (let len = queryMaskLen; len >= 0; len--) {
			const mask = IPv4.mask_fromLength(len)
			const network = (query.addr & mask) >>> 0;
			const subsetMap = this.prefixMap.get(len);
			if (subsetMap && subsetMap.has(network)) return subsetMap.get(network)[0];
		}
		return null;
	}

	getFirstMatchPrefix(ipv4) {
		const query = (ipv4?.constructor.name==='IPv4') ? ipv4 : new IPv4(ipv4);
		if (query.error) return null;

		// get all matching routes (by default is not in insertion order), then map in the insertion order 
		const candidatePrefixes = this.getMatchingPrefixes(query).map(ipv4=>({
			ipv4,
			insertionIndex:this.insertionOrderMap.get(ipv4)
		}))
		/** @typedef {typeof candidatePrefixes} CandidatePrefixes */
	
		const orderedPrefixes = candidatePrefixes.toSorted(/**@param {CandidatePrefixes} p1 @param {CandidatePrefixes} p2*/ (p1,p2) => p1.insertionIndex - p2.insertionIndex)
		return orderedPrefixes?.[0]?.ipv4 ?? null
	}


	// returns matching prefixes, from most-specific to least specific
	getMatchingPrefixes(ipv4) {
		const query = (ipv4?.constructor.name==='IPv4') ? ipv4 : new IPv4(ipv4);
		if (query.error) return [];

		let matches = [];
		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)
		if (queryMaskLen === 32 && this.hostMap.has(query.addr)) {
			matches.push(this.hostMap.get(query.addr));
		}
		// iterate through all the prefixMaps, and for each prefix length's map (which is another map), find the network
		for (let len = queryMaskLen; len >= 0; len--) {
			const mask = IPv4.mask_fromLength(len)
			const queryBaseNetwork = (query.addr & mask) >>> 0;		// zeroes out the host portion of the query, just in case the user supplied query was a host instead of a network
			const networkMap = this.prefixMap.get(len);
			if (networkMap && networkMap.has(queryBaseNetwork)) {
				matches = matches.concat(networkMap.get(queryBaseNetwork));
			}
		}
		return matches;
	}


	getMatchingPrefixes_old(ipv4) {
		const query = (ipv4?.constructor.name==='IPv4') ? ipv4 : new IPv4(ipv4);
		if (query.error) return [];
		const queryMaskLen = IPv4.maskLen_from_mask(query.mask)

		let matches = [];
		if (queryMaskLen === 32 && this.hostMap.has(query.addr)) {
			matches.push(this.hostMap.get(query.addr));
		}
		// iterate through all the prefixMaps, and for each prefix length's map (which is another map), find the network
		for (const [maskLen, networkMap] of this.prefixMap.entries()) {
			const mask = IPv4.mask_from_maskLen(maskLen)
			const queryBaseNetwork = (query.addr & mask) >>> 0;			// zeroes out the host portion of the query, just in case the user supplied query was a host instead of a network
			if (networkMap.has(queryBaseNetwork)) {
				matches = matches.concat(networkMap.get(queryBaseNetwork));
			}
		}
		return matches;
	}


	// initializes the longestMatchTable if it's not already initialized, and returns a sorted version of the IPv4 prefixes.
	// Used for internal processing.  Should be deprecated, but not ready yet
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


	lookupData(dataKey) {
		return this.dataMap.get(dataKey) || [];
	}


	/** LEGACY METHODS BEFOER GPT - investigate if we need these  */
	// appends a new prefix or array of prefies into RoutingTableNG
	// mutates this RoutingTableNG
	addPrefixes(..._prefixes) {
		const prefixes = _prefixes.flat().map((prefix) => new IPv4(prefix))
		this.orderedTable = [...this.orderedTable, ...prefixes]
		this.longestMatchTable = []	 	// invalidate the cache
		this.shortestMatchTable = []		// invalidate the cache
		return this
	}



	/** name the routing table as needed when working with multiple ones */
	named(routingTableName='') {
		this.name=routingTableName
	}

	// Create routing table from a simple array of existing IPv4 objects, where an item is any data type accepted by the IPv4 constructor.
	static of = (...prefixes) => new RoutingTableNG([...prefixes.flat()])
	

	// create routing table from a simple array of items, where an item is any data type accepted by the IPv4 constructor.
	// For example:	'10.10.10.10/31', an IPv4 object, a 32-bit unsigned number, etc
	static fromRawList = (...prefixes) => new RoutingTableNG([...prefixes.flat()].map((pfxstr)=>new IPv4(pfxstr)))

	// create routing table from a simple array of items, where an item is any data type accepted by the IPv4 constructor.
	// For example:	'10.10.10.10/31', an IPv4 object, a 32-bit unsigned number, etc
	static fromRawRecords = (prefixPropName) => (...records) => new RoutingTableNG([...records.flat()].map((record)=>new IPv4(record[prefixPropName], record)))
	//static fromRawRecords = (prefixPropName) => (...records) => new RoutingTableNG([...records.flat()].map(({[prefixPropName]:prefix, ...record})=>new IPv4(prefix, record)))


	
	

	// 	returns a copy of the IPv4 array (but does not copy elements), 
	//	sorted by low -> high IP addresses, in a tie, LONGEST prefix first
	getLongestMatchTable_prev() {
		if (this.longestMatchTable.length === 0) {
			this.longestMatchTable = [...this.orderedTable]
				.sort((ip1, ip2) => ip2.mask - ip1.mask)
				.sort((ip1, ip2) => ip1.addr - ip2.addr)
		}
		return this.longestMatchTable
	}

	// 	returns a copy of the IPv4 array (but does not copy elements), 
	//	sorted by low -> high IP addresses, in a tie, SHORTEST prefix first
	getShortestMatchTable() {
		this.shortestMatchTable = [...this.getLongestMatchTable()].reverse()
		return this.shortestMatchTable
	}


	// 	returns a copy of the IPv4 array (but not copies of elements), 
	//	sorted by low -> high IP addresses, in a tie, SHORTEST prefix first
	getShortestMatchTable_old() {
		if (this.shortestMatchTable.length == 0) {
			this.shortestMatchTable = [...this.orderedTable]
				.sort((ip1, ip2) => ip1.mask - ip2.mask)
				.sort((ip1, ip2) => ip1.addr - ip2.addr)
		}
		return this.shortestMatchTable
	}

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

	getUnallocatedWithin_old(_constrainingBlock = '0.0.0.0/0') {
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		const sortedRouteTable = this.getShortestMatchTable_old().filter((ip) => ip.isSubnetOf(constrainingBlock))
		const blockEndAddr = constrainingBlock.getBroadcast().addr + 1
		const accObjInitState = {
			cursor: constrainingBlock.addr,
			results: [],
		}
		const preliminaryReport = sortedRouteTable.reduce((accObj, prefix, index, inputArray) => {
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

	/** @method getCleanedTable
	*		@returns: a new Routing Table with duplicates and data removed
	*							for the purposes of making this routing table appear more like a real routing table
	*	 NOTE: 03-23-2024:	Removed this to eliminate the dependency on deDupByProps module.	Removed the import.
	*/
	// getCleanedTable() {
	// 	const cleanedTable = this.orderedTable.map(({ addr, mask }) => new IPv4({ addr, mask }))			// clone IPv4 objects & reset data
	// 	const dedupedTable = deDupByProps(['addr', 'mask'])(cleanedTable)												// dedup
	// 	return new RoutingTableNG(dedupedTable)
	// }

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

//	[Symbol.toLocaleString]() {
//		return this.toString()
//	}

	// applies mapFn to cloned IPv4 objects inside RoutingTableNG
	// NOTE: mapFn must be of the form mapFn -> IPv4Obj -> IPv4Obj
	map(mapFn) {
		return new RoutingTableNG([...this.orderedTable.map(mapFn)])
	}

	// applies filterFn to cloned IPv4 objects inside RoutingTableNG
	// NOTE: mapFn must be of the form mapFn -> IPv4Obj -> boolean
	// would likely use this for data instead of subnet matches - use match functions below for that
	filter(filterFn) {
		return new RoutingTableNG([...this.orderedTable.filter(filterFn)])
	}

	/** @method aggregateAddress()
	*		@param 		{string | IPv4} _constrainingBlock
	*		@returns: a single IPv4 network object representing the smallest
	*							block that covers the entire routing tables' ranges
	*		@note		 	needs to be tested as a broad match returns 0.0.0.0/32
	*/
	aggregateAddress(_constrainingBlock = '0.0.0.0/0') {
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		const ipAddrSetToAggregate = this.getShortestMatchTable().filter((ip) => ip.isSubnetOf(constrainingBlock))
		return IPv4.network_fromRange(ipAddrSetToAggregate)
	}

	/** @method aggregateWithData(_constrainingBlock)
	*		@param 		{string | IPv4} _constrainingBlock
	*		@returns: as with aggregateAddress(), a single IPv4 network object representing 
	*							the smallest block that covers the routing tables' ranges, but also
	*							carries the aggregate of data 
	*		@note 		needs to be tested given it's use this.aggregateAddress() (see above)
	*/
	aggregateWithData(_constrainingBlock = '0.0.0.0/0') {
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		const ipAddrSetToAggregate = this.getShortestMatchTable().filter((ip) => ip.isSubnetOf(constrainingBlock))
		const aggregateAddress = this.aggregateAddress(_constrainingBlock)
		const aggregatedData = ipAddrSetToAggregate.map((ipv4) => ipv4.data)
		return aggregateAddress.setData({ aggregatedData })
	}


	/** @method consolidate() - like aggregateAddress, but works on multiple ranges
	 *		@param 		{string | IPv4} _constrainingBlock
	 *		@returns: a RoutinTable object representing all IPv4 addresses in the current RoutingTableNG,
	 *							but attempting to auto-summarize by finding contiguous ranges within the block.
	 *							Essentially, this removes more specific routes and replaces with summaries.
	 *		@note		This is new and needs to be tested
	 */
	consolidate(_constrainingBlock = '0.0.0.0/0') {
		let reducedSet = []
		const constrainingBlock = (_constrainingBlock instanceof IPv4) ? _constrainingBlock : new IPv4(_constrainingBlock)
		// work with this proper subset of the original list, sorted by shortest match
		const ipAddrSetToAggregate = this.getLongestMatchTable() // .filter(ip=>ip.isSubnetOf(constrainingBlock))

		isVerbose && console.log(`[RoutingTableNG:consolidate]: STEP 1: preparing... ipAddrSetToAggregate is: `, (new RoutingTableNG(ipAddrSetToAggregate)).printableList())
		const size = ipAddrSetToAggregate.length

		// special cases for small tables (the for loop requires at least two entries due to comparison logic)
		if (size === 0) return RoutingTableNG.of([])
		if (size === 1) return RoutingTableNG.of(this.orderedTable)

		// from here, we have at least two entries...
		let c
		let startOfRange = ipAddrSetToAggregate[0].addr
		let endOfRange = ipAddrSetToAggregate[0].getStartOfNext().addr

		isVerbose && console.log(`[RoutingTableNG:consolidate()]: STEP 2.	Now entering loop `, { startOfRange, endOfRange, size })

		// stop looping where there are only two left

		for (c = 1; c <= size - 1; c++) {
			// current IP is a subnet of the previous IP, so skipping
			if (ipAddrSetToAggregate[c].addr < endOfRange) {		// ipAddrSetToAggregate[c] is a subnet confined within the previous prefix...
				isVerbose && console.log(`[RoutingTableNG:consolidate()]: CASE 1: curIP (${ipAddrSetToAggregate[c].toString()}) is a subnet of prevIP (${ipAddrSetToAggregate[c - 1].toString()})...doing nothing `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
			}
			else if (ipAddrSetToAggregate[c].addr === endOfRange) {	// ipAddrSetToAggregate[c] is contiguous - move the end of range cursor 
				isVerbose && console.log(`[RoutingTableNG:consolidate()]: CASE 2: curIP (${ipAddrSetToAggregate[c].toString()}) is continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()}) - moving endOfRange cursor forward `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
				})
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr
			}
			else if (ipAddrSetToAggregate[c].addr > endOfRange) {		// ipAddrSetToAggregate[c] is discontiguous - create a set of summaries with what we have & reset
				const newPrefixes = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
				reducedSet = [...reducedSet, ...newPrefixes]
				isVerbose && console.log(`[RoutingTableNG:consolidate()]: CASE 3: curIP (${ipAddrSetToAggregate[c].toString()}) is not continguous with prevIP (${ipAddrSetToAggregate[c - 1].toString()})- creating a new aggregate set & adjusting startOfRange and endOfRange `, {
					c,
					newPrefixes,
					startOfRange_raw: startOfRange,
					endOfRange_raw: endOfRange,
					startOfRange_prev: IPv4.printAddr(startOfRange),
					endOfRange_prev: IPv4.printAddr(endOfRange),
					startOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].addr),
					endOfRange_new: IPv4.printAddr(ipAddrSetToAggregate[c].getStartOfNext().addr),
					curIP: ipAddrSetToAggregate[c].toString(),
					prevIP: ipAddrSetToAggregate[c - 1].toString(),
					reducedSet,
				})
				startOfRange = ipAddrSetToAggregate[c].addr
				endOfRange = ipAddrSetToAggregate[c].getStartOfNext().addr
			}
			else {
				console.error(`[RoutingTableNG:consolidate()]: INVALID CASE `, {
					c,
					startOfRange: IPv4.printAddr(startOfRange),
					endOfRange: IPv4.printAddr(endOfRange),
					curIP: ipAddrSetToAggregate[c].toString(),
				})
			}
		}	// for

		const newPrefixes = IPv4.createPrefixesBetween(new IPv4(startOfRange), new IPv4(endOfRange))
		reducedSet = [...reducedSet, ...newPrefixes]


		return new RoutingTableNG(reducedSet)
	}

	/** @method aggregateWithData(_constrainingBlock)
	*		@param 		{string | IPv4} _ipv4
	*		@returns: a single IPv4 network object representing 
	*/
	longestMatch(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return this.getLongestMatchTable().find((prefix) => prefix.isSupernetOf(ipv4)) || null
	}

	/** @method firstMatch(_ipv4)
	*		@param 	{string | IPv4} _ipv4
	*		@param	{RoutingTableNG}
	*		@returns: {RoutingTableNG} object containing prefixes 
	*							which match under the supplied input parameter
	*/
	firstMatch_old(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return this.orderedTable.find((prefix) => prefix.isSupernetOf(ipv4)) || null
	}

	/** onlyMatching - returns a 
	* 	@method 	onlyMatching(_ipv4)
	*		@param 		{string | IPv4} _ipv4 - ip prefix string or IPv4 object
	*		@returns: {RoutingTableNG} - containing only subnets of the supplied _ipv4 prefix
	*/
	onlyMatching(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return new RoutingTableNG([...this.orderedTable].filter((prefix) => !!prefix.isSubnetOf(ipv4) || !!prefix.eq(ipv4)))
	}

	/** @method notMatching(_ipv4)
	*		@param 		{string | IPv4} _ipv4 - ip prefix string or IPv4 object
	*		@returns: {RoutingTableNG} - new RoutingTableNG object without the supplied ipv4 prefix and all its subnets
	*/
	notMatching(_ipv4) {
		const ipv4 = new IPv4(_ipv4).getNetwork()		// normalize input to handle strings or objects
		return new RoutingTableNG([...this.orderedTable].filter((prefix) => !prefix.isSubnetOf(ipv4) && !prefix.eq(ipv4)))
	}

	/** @method hasRouteFor(_ipv4)
	*		@param 	_ipv4: ip prefix string or IPv4 object representing network
	*		@returns {boolean}	true =	if the routing table contains a supernet prefix of the supplied route 
	*						
	*/
	//hasRouteFor(_ipv4) {
	//	const ipv4 = new IPv4(_ipv4)		// normalize input to handle strings or objects
	//	return this.orderedTable.some((prefix) => prefix.isSupernetOf(ipv4))
	//}

	valueOf() {
		return this.orderedTable.map((ip) => new IPv4(ip))
	}

	toString() {
		return this.orderedTable.map((ip) => ip.toString()).join('\n')
	}

	printableList() {
		return this.orderedTable.map((ipv4) => `${ipv4}`)
	}

	tap(logFn = console.dir) {
		logFn(this.toString())
		return this
	}


	// Set operations - removing entries not also a member of another routing table
	// getIntersectionWith :: RoutingTableNG(this) -> RoutingTableNG(foreign) -> RoutingTableNG
	getIntersectionWith(foreignRoutingTableNG) {
		return new RoutingTableNG(
			this.orderedTable.filter((ip) => foreignRoutingTableNG.hasRouteFor(ip))
		)
	}

	// Set operations - removing entries not also a member of another routing table
	subtractRoutingTableNG(foreignRoutingTableNG) {
		return new RoutingTableNG(
			this.orderedTable.filter((ip) => !foreignRoutingTableNG.hasRouteFor(ip))
		)
	}

	// shortcuts
	getNonPublic() {
		return this.getIntersectionWith(RoutingTableNG.specialUseRanges)
	}

	// shortcuts
	getPublic() {
		return this.subtractRoutingTableNG(RoutingTableNG.specialUseRanges)
	}

	// shortcuts
	getSpecialUseRanges() {
		return new RoutingTableNG(
			this.filter((ip) => RoutingTableNG.specialUseRanges.hasRouteFor(ip))
		)
	}

	/** @method exportDataSet()
	*		@returns 	dsArray (a flat array of monomorphic objects with string properties) 
	*						
	*/
	exportDataSet() {
		return this.orderedTable.map((ipObj) => ({
			prefix: ipObj.toString(),
			...ipObj?.data,
		})).map(flattenItem)
	}

	resolveRdap = async () => {
		if (this.whoisResolver === null) {
			const rdapCache = new RDAP()
			await rdapCache.useDBCache('rdapCache')
			rdapCache.verboseLogging = this.verboseLogging 				// turn on rdapCache logging if this routing table enables it.
			this.whoisResolver = await rdapCache.updateBootStrap()
		}
		for (const ipObj of this.getLongestMatchTable()) {
			let mark = performance.now().toFixed(3)
			isVerbose && console.log(`[resolveRdap]: before await whoisIP...`, { prefix: ipObj.toString() })
			const rdapResult = await this.whoisResolver.whoisIP(ipObj.toString())
			isVerbose && console.log(`[resolveRdap]: after await whoisIP...`, { prefix: ipObj.toString(), time: (performance.now() - mark).toFixed(3) })
			ipObj.addTag('rdap', rdapResult)
			console.log(`resolveRdap: inside loop,received rdapResult`, { time: performance.now(), rdapResult, ipObj })
		}
		await this.whoisResolver.saveToDBCache()
		return this
	}

	getResolvedRdap_v2() {
		return this.getLongestMatchTable()
			.filter((ipObj) => (ipObj?.data?.rdap?.name ?? false) !== false)
			.map(({ prefix = 'ERROR', cidr0_cidrs = [], name = '', handle = '', ...rest }) => ({
				prefix,
				cidr0_cidrs,
				cidrs: cidr0_cidrs.map(
					({ v4prefix, length, ...rest }) => `${v4prefix}/${length}`
				).join(', '),
				name,
				handle,
				rest
			})
			)
	}

	getResolvedRdap() {
		return this.getLongestMatchTable().map((ipObj) => ({
			prefix: ipObj.toString(),
			cidrs: (ipObj?.data?.rdap?.cidr0_cidrs ?? []).map((entry) => `${entry.v4prefix}/${entry.length}`).join(','),
			assocASNs: ipObj?.data?.rdap?.arin_originas0_originautnums ?? '',
			name: ipObj?.data?.rdap?.name ?? '',
			handle: ipObj?.data?.rdap?.handle ?? '',
			type: ipObj?.data?.rdap?.type ?? '',
			...ipObj?.data?.request,
			...ipObj?.data?.rdap,
		}))
	}


	// define some useful lists of prefixes per common conventions & standards
//		static multicastRanges = new RoutingTableNG([
//			new IPv4('224.0.0.0/24').setData({ scope: "linkLocal", useCasePerIANA: "" }),
//			new IPv4('224.0.1.0/24').setData({ scope: "networkControl", useCasePerIANA: "" }),
//			new IPv4('224.0.2.0/16').setData({ scope: "adhoc", useCasePerIANA: "" }),
//			new IPv4('224.3.0.0/15').setData({ scope: "adhoc", useCasePerIANA: "" }),
//			new IPv4('232.0.0.0/8').setData({ scope: "SSM", useCasePerIANA: "" }),
//			new IPv4('233.0.0.0/8').setData({ scope: "GLOP", useCasePerIANA: "" }),
//			new IPv4('233.252.0.0/14').setData({ scope: "adhoc", useCasePerIANA: "" }),
//			new IPv4('234.0.0.0/8').setData({ scope: "unicast_based", useCasePerIANA: "" }),
//			new IPv4('239.0.0.0/8').setData({ scope: "private", useCasePerIANA: "" }),
//		])
//	
//		static specialUseRanges = new RoutingTableNG([
//			//new IPv4("0.0.0.0/8")				.setData({scope: "software", 			useCasePerIANA: "Current network (only valid as source address)" }),
//			new IPv4("10.0.0.0/8").setData({ scope: "private", useCasePerIANA: "RFC1918 private networks" }),
//			new IPv4("100.64.0.0/10").setData({ scope: "private", useCasePerIANA: "Carrier-grade NAT" }),
//			new IPv4("127.0.0.0/8").setData({ scope: "host", useCasePerIANA: "Loopback addresses" }),
//			new IPv4("169.254.0.0/16").setData({ scope: "linkLocal", useCasePerIANA: "Local link" }),
//			new IPv4("172.16.0.0/12").setData({ scope: "private", useCasePerIANA: "RFC1918 private networks" }),
//			new IPv4("192.0.0.0/24").setData({ scope: "private", useCasePerIANA: "IETF Protocol Assignments" }),
//			new IPv4("192.0.2.0/24").setData({ scope: "documentation", useCasePerIANA: "TEST-NET-1: for documentation and examples" }),
//			new IPv4("192.88.99.0/24").setData({ scope: "internet", useCasePerIANA: "Formerly used for IPv6 to IPv4 relay" }),
//			new IPv4("192.168.0.0/16").setData({ scope: "private", useCasePerIANA: "RFC1918 private networks" }),
//			new IPv4("198.18.0.0/15").setData({ scope: "private", useCasePerIANA: "Used for benchmark testing of inter-network communications between two separate subnets" }),
//			new IPv4("198.51.100.0/24").setData({ scope: "documentation", useCasePerIANA: "TEST-NET-2: for documentation and examples" }),
//			new IPv4("203.0.113.0/24").setData({ scope: "documentation", useCasePerIANA: "TEST-NET-3: for documentation and examples" }),
//			new IPv4("224.0.0.0/4").setData({ scope: "internet", useCasePerIANA: "IP multicast" }),
//			new IPv4("240.0.0.0/4").setData({ scope: "internet", useCasePerIANA: "future use (Former Class E network)" }),
//		])



} // class RoutingTableNG

/* 
 * ASN
 * @description: extract information out of ASNs, and/or perform conversions, in both asdot and asplain formats
 * 
 *	 
 * 
 */
class ASN {
	/** 
	 * static constructor - returns a valid ASN object
	 * Accepts:
	 *	 number: 32-bit unsigned integer
	 *	 string: asplain, asdot
	 * 
	 * Output:
	 * 	ASN object with value or error flag
	 * 
	 */

	static regx_asDot =	 /^\d{1,5}\.\d{1,5}$/
	static regx_asPlain = /^\d{1,10}$/
	static of = (asn) => new ASN(asn)

	constructor(asn) {
		this.asn = 0
		this.error = ``

		if ( !asn ) {
			this.error = `[ASN]: supplied value cannot be null`
		}

		else if (asn.constructor.name === 'Number') {
			if (Number.isFinite(asn) && (asn > 0 && asn <= 2 ** 32)) {
				this.asn = asn
			}
			else {
				this.error = `[ASN]: invalid asn value ${asn} supplied in the constructor`
			}
		}	// asn.constructor.name === 'Number'

		else if (asn.constructor.name === 'String') {
			// asplain format
			if (ASN.regx_asPlain.test(asn)) {
				const asnObject = ASN.from_asPlain(asn) 
				this.asn = asnObject.asn
				this.error = asnObject.error
			}
			// asdot format
			else if (ASN.regx_asDot.test(asn)) {
				const asnObject = ASN.from_asDot(asn) 
				this.asn = asnObject.asn
				this.error = asnObject.error
			}

			else	{
				this.error = `[ASN]: wrong type.	The supplied constructor value (${asn}, ${asn?.constructor?.name}) is neigher a number, string, nor ASN object`
			}
		}	// asn.constructor.name === 'String'

		// ASN object supplied
		else if (asn.constructor.name === 'ASN') {
			this.asn = asn.asn
			this.error = asn.error
		}	// asn.constructor.name === 'ASN'

		// duck-typed ASN object
		else if (asn?.value && asn?.error) {
			this.asn = asn.asn
			this.error = asn.error
		}	// duck-typing

		else {
			this.error = `[ASN]: invalid constructor value ${asn}`
		}

		if (this.error) {
			if (ASN.debugMode) {
				throw new Error(`[ASN]: the supplied ASN ${asn} contains an error: '${this.error}'`, { suppliedASN:asn, error: this.error })
			}
			console.error(`[ASN]: the supplied ASN ${asn} contains an error: '${this.error}'`, { suppliedASN:asn, error: this.error })
		}
	}

	isPrivate() {
		return ( ( this.asn >= 64512 && this.asn < 65535 ) || ( this.asn >= 4200000000 && this.asn < 4294967295 ) )
	}

	is32bit() {
		return this.asn >= 2**16 ? true : false
	}

	toString_asDot() {
		if (this.error) return `[ASN::asDot()]: the ASN object was parsed with an error. See console log for details`
		const buffer = new Uint32Array([this.asn]).buffer
		const [leftVal, rightVal] = new Uint16Array(buffer).reverse()
		return `${leftVal}.${rightVal}`
	}

	toString_asPlain() {
		return this.error ? this.error : `${this.asn}`
	}

	toString(useAsPlain=false) {
		return useAsPlain ? this.toString_asPlain() : this.toString_asDot()
	}

	async fetchRDAP() {
		if (this.error) return this.error
		return await ASN.fetchRDAP(this.asn)
	}

	static from_asDot(asDotText) {
		let error = ''
		const [lstr, rstr] = asDotText.split('.')
		const leftVal = parseInt(lstr)
		const rightVal = parseInt(rstr)
		if ((leftVal < 2**16) && (rightVal < 2**16 )) {
			return {
				asn: ((leftVal << 16) >>> 0) + rightVal,
				error: ``,
			}
		}
		return new ASN({
			asn: 0,
			error: `[ASN]: invalid asDot constructor value ${asDotText} (right or left values are out of range)`
		})
	}

	static from_asPlain(asPlainText) {
		const asnValue = parseInt(asPlainText)
		if (asnValue < 2**32) {
			const buffer = new Uint32Array([asnValue]).buffer
			const [leftVal, rightVal] = new Uint16Array(buffer).reverse()
			return {
				asn: ((leftVal << 16) >>> 0) + rightVal,
				error: ``,
			}
		}
		return new ASN({
			asn: 0,
			error: `[ASN]: invalid asPlain constructor value ${asPlainText} (right or left values are out of range)`
		})
	}

	static async fetchRDAP(asn) {
		const normalizedASN = new ASN(asn).toString_asPlain()
		let jsonData
		if (!IPv4.rdapCache.has(`whoIsASN-${normalizedASN}`)) {
			jsonData = await (
				await fetch(`https://rdap.arin.net/registry/autnum/${normalizedASN}`)
			).json()
			IPv4.rdapCache.set(`whoIsASN-${normalizedASN}`, jsonData)
		}
		else {
			jsonData = IPv4.rdapCache.get(`whoIsASN-${normalizedASN}`)
		}
		return { request: normalizedASN, ...jsonData }
	}

}	// class ASN



class RDAP {
	/**
	 * Helper functions and templates for use with the 'match' facility
	 * @see https://datatracker.ietf.org/doc/html/rfc7483#page-14 for valid class names
	 * 
	 */
	static rfc7483_rdapObjectClassNames = [
		'ip network',
		'entity',
		'nameserver',
		'domain',
		'autnum',
	]

	static isValidRdapResponse = {
		objectClassName: is.oneOf(RDAP.rfc7483_rdapObjectClassNames),
		rdapConformance: arr.includes('rdap_level_0')
	}

	static isValidRdapErrorResponse = {
		objectClassName: is.nil,
		errorCode: is.defined,
		title: is.defined,
		description: is.defined,
	}

	static isInvalidRdapResponse = { objectClassName: is.nil }
	static validateRdapResponse = (netObj) => match(netObj)
		.when(is.nil).return({ response: `invalid request: value is ${netObj} null` })
		.when(RDAP.isInvalidRdapResponse).return({ response: `invalid reply from RDAP server: value is ${netObj}` })
		.when(RDAP.isValidRdapErrorResponse).return({ request: netObj, response: `error response:	value is ${netObj} null` })
		.when(RDAP.isValidRdapResponse).then(IPv4.printWhoIs)
		.else((netObj) => {
			console.error(`[RDAP.validateRdapResponse]`, { netObj })
			throw new Error(`[RDAP.validateRdapResponse]: not matching all conditions for ${netObj}`)
		})

	constructor() {
		if (RDAP?.instance) return RDAP.instance		 // class RDAP is a singleton
		RDAP.instance = this
		this.rdapIpCache = new RoutingTable([])		// this implements our cache, since a RoutingTable object stores data about each route
		this.rdapAsnCache = new Map()					 	// not yet implemented
		this.ianaBootFileURL = `https://data.iana.org/rdap/ipv4.json`
		this.ianaBootRecords = []									// a transformed version of IANA bootstrap records, stored in a separate RoutingTable object (later used to locate approprate registry based on class A)
		this.hasIanaBootRecord = false
		this.verboseLogging = true
		this.database = null
	}

	// not finished
	/**
	async useDBCache(dbName) {
		this.database = await DB.named(dbName)
		if (!this.database.allTables().includes('rdapCache')) await this.database.createTable({tableName:'rdapCache'})
		if (!this.database.allTables().includes('rdapBoot')) await this.database.createTable({tableName:'rdapBoot'})
		this.cachedRecs = await this.database.table('RDAPCache').getAll()
		this.cachedBootFile = await this.database.table('rdapBoot').getAll()
		console.log(`::useDBCache:`, {this.cachedRecs, this.cachedBootFile} )
	}

	// not finished
	async saveToDBCache() {
		this.cachedRecs = await this.database.table('RDAPCache').addBulk(this.rdapIpCache)
	}
	*/

	async fetchIANABootFile() {
		let jsonData
		if (!globalThis.dataCache) globalThis.dataCache = new Map()
		if (!globalThis.dataCache.has('rdapBoot')) {
			jsonData = await (await fetch(this.ianaBootFileURL)).json()
			globalThis.dataCache.set('rdapBoot', jsonData)
		}
		else {
			jsonData = globalThis.dataCache.get(this.ianaBootFileURL)
		}
		return jsonData
	}

	updateBootStrap = async () => {
		debugger
		const ianaBootFile = await RDAP.fetchIANABootFile()
		const result = ianaBootFile.services
			.map((registry) => ({ 						// IANA boot file has odd shape, so transform to an array of prefixes that can be imported into a RoutingTable object (aka this.ianaBootRecords)
				url: registry[1][0],
				prefix: registry[0]
			}))
			.flatMap(multiplyBy('prefix'))
			.map((entry) =>
				new IPv4(entry.prefix).setData({ prefix: entry.prefix, isBootStrapRecord: true, rdapURL: entry.url })
			)
		this.hasIanaBootRecord = true
		this.ianaBootRecords = new RoutingTable(result)
		return this
	}

	whoisIP = async (ipOrNetwork) => {
		const ipSearchObj = new IPv4(ipOrNetwork)					// normalize here so we can use IPv4 objects or strings in constructor argument
		return new Promise(async (resolve, reject) => {
			const rdapURL = this.ianaBootRecords.getLongestMatchPrefix(ipSearchObj)?.data?.rdapURL ?? null // look up ipOrNetwork in registry based on longest match rule
			let rdapResponse
			let foundInCache = null
			this.verboseLogging && console.log(`[RDAP::whoisIP]: rdapURL is: ${rdapURL}`)

			// if not in cache, fetch RDAP object from Internet..
			if (!this.rdapIpCache.hasRouteFor(ipSearchObj) && rdapURL !== null) {
				foundInCache = false
				const fetchString = `${rdapURL}ip/${ipOrNetwork}`
				this.verboseLogging && console.log(`[RDAP::whoisIP]: ${ipOrNetwork} not in found cache, fetching from ${fetchString}\n`, { ipOrNetwork, ipSearchObj, rdapURL, fetchString })
				// make the request & await responses
				const urlResponse = await fetch(fetchString)
				if (urlResponse.status !== 200) {								// if HTTP code is anything other than a valid reply...
					this.verboseLogging && console.error(`[RDAP::whoisIP]: fetch error`, { fetchString, urlResponse })
					throw new Error('fetch error', { fetchString, urlResponse })
				}
				rdapResponse = await urlResponse.json()							// rdapResponse contains our JSON data from registry...

				const {
					rdapConformance,																// a manadatory array naming the varoius schemas this response supports 
					cidr0_cidrs = [],																// optional CIDR schema items 
					arin_originas0_networkSearchResults = [],				// optional ASN schema items 
					...rest
				} = rdapResponse

				/*
				if (rdapConformance.includes('cidr0')) {
					const rdapCidrs = cidr0_cidrs.map(cidr=>new IPv4(`${cidr.v4prefix}/${cidr.length}`).setData({rdap:rdapResponse}))
					this.rdapIpCache = new RoutingTable([...this.rdapIpCache, ...rdapCidrs])	 // add cidrs to the cache 
					this.verboseLogging && console.log('[whoisIP]: response received... rdapConformance includes cidr0 records, updated cache to include all cidr0 records...', {cidr0_cidrs, rdapCidrs, rdapIpCache: this.rdapIpCache})
				}
				*/
				let rdapCidr = null
				if (rdapConformance.includes('cidr0')) {
					if (cidr0_cidrs.length > 1) console.table(cidr0_cidrs)
					const mostSpecificCidr = cidr0_cidrs.slice(-1)[0]				// pop off the last item, which is believed to be the most specifc???
					const CIDR = `${mostSpecificCidr.v4prefix}/${mostSpecificCidr.length}`
					const otherCIDRs = cidr0_cidrs.map(({ v4prefix, length }) => ([v4prefix, length]).join('/')).join(', ')
					console.error({ CIDR, otherCIDRs })
					rdapCidr = new IPv4(`${mostSpecificCidr.v4prefix}/${mostSpecificCidr.length}`).setData({
						rdap: { ...rdapResponse, CIDR, otherCIDRs, },
					})
					this.rdapIpCache.addPrefixes(rdapCidr)
					isVerbose && console.log(`[RDAP::whoisIP]: received response with cidr0 schema:	 added prefix ${CIDR} to rdapIpCache`, { rdapCidr, rdapIpCache: this.rdapIpCache })
					this.verboseLogging && console.log(`[RDAP::whoisIP]: response received... rdapConformance includes cidr0 records, updated cache to include all cidr0 records...`, { cidr0_cidrs, rdapCidr, rdapIpCache: this.rdapIpCache })
				}
				else {				// since response doesn't contain CIDR, must calculate summaries (may not fall on subnet boundaries - currently not handled and a possible source of errors!!!)
					rdapCidr = IPv4.network_fromRange(rdapResponse.endAddress, rdapResponse.startAddress).setData({
						rdap: { ...rdapResponse, }
					})
					this.rdapIpCache.addPrefixes(rdapCidr) 			// add cidrs to the cache
					isVerbose && console.log(`[RDAP::whoisIP]: received response without cidr0 schema:	added calculated prefix ${rdapCidr} to rdapIpCache`, { rdapCidr, rdapIpCache: this.rdapIpCache })
					this.verboseLogging && console.log('[whoisIP]: response received... rdapConformance does not include cidr0 records.	Using calculated prefix and updating cache....', { rdapCidr })
				}
			}
			// if found in cache... get IPv4 obj from cache via routing table lookup
			else {
				foundInCache = true
				this.verboseLogging && console.log(`[whoisIP]: found ${ipOrNetwork} in cache:`, { ipOrNetwork, rdapResponse })
				rdapResponse = this.rdapIpCache.longestMatch(ipSearchObj)?.data?.rdap
					?? console.error("[RDAPCache2].whoisIP: no rdap data entry found in cache", { ipSearchObj })
					?? resolve({ request: ipOrNetwork, rdap: 'no data found in registry' })
				this.verboseLogging && console.log(`[whoisIP]: found ${ipOrNetwork} in cache:`, { ipOrNetwork, rdapResponse })
				isVerbose && console.log(`[RDAP::whoisIP]: found rdapResponse in cache for ${ipSearchObj}: `, { rdapResponse, rdapIpCache: this.rdapIpCache })
			}
			resolve({ request: ipOrNetwork, foundInCache, ...rdapResponse })
		})
	}
	// use this on console to product a lookup table for the iana boot records
	//	ianatable = Object.fromEntries(x.ianaBootRecords.orderedTable.map(	ipv4=> ([`${ipv4}`, ipv4?.data ?? 'missing data'])	))

	getCacheResults() {
		return this.rdapIpCache.getLongestMatchTable().map((ipv4) => [`${ipv4}`, { rdap: ipv4?.data?.rdap ?? "getCache(): MISSING DATA" }])
	}

	getCacheResults2() {
		return this.rdapIpCache.getLongestMatchTable().map((ipv4) => ({ [`${ipv4}`]: ipv4?.data?.rdap ?? "getCache(): MISSING DATA" }))
	}

	getIanaBootData() {
		return this.ianaBootRecords.orderedTable.map((ipv4) => ([`${ipv4}`, ipv4?.data ?? 'getCache(): MISSING DATA']))
	}

}	// class RDAPCache




/** colIP (colName_with_ip_networks_or_string)
 *	IPv4-specific version of col(colName) - where colName contains IP addresses
 *	more specific thatn castColAs - references IPv4() directly
 *	@note - check if method is available as a static method in the class function itself
 */
const colIP = (colName) => {
	const valueGetterFn = (dsItem) => dsItem?.[colName] ?? `[colIP]: no column ${colName} found`
	const proxyForValueGetterFn = new Proxy(valueGetterFn, {
		get: (origObj, propKey, receiver) => {
			const trappedMethod = (...args) => (dsItem) => {
				//console.log(`colIP - calling property on real object`, {dsItem, colName, mia: dsItem[colName], args, argsFlat:args.flat() })
				// had to remove the returning of error strings below, since predicate failures won't return falsey values
				if (dsItem?.[colName] === undefined) return `[colIP](${colName}): no column ${colName} found`
				if (!dsItem[colName]) return `[colIP](${colName}):: this record has no data in column ${colName}`
				if ((dsItem?.[colName] === undefined) || (!dsItem[colName])) return null	 // maybe fix this in the future to return an IPv4 object with an embedded error?	May affect predicates & behavior of Array.filter()
				if (!(propKey in IPv4.prototype)) return `[colIP(${colName}).${String(propKey)}(${args[0]})]: method ${String(propKey)} not found on IPv4 object`
				const ipObject = new IPv4(dsItem[colName])
				return ipObject[propKey](args[0])
			}
			return trappedMethod
		}			// get
	})	 // trap obj & Proxy
	return proxyForValueGetterFn
}


export {
	IPv4,
	ASN,
	RDAP,
	RoutingTable,
	RoutingTableNG,
	RoutingTableNG_prev,
	colIP,
}
