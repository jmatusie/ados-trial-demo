const isVerbose = false

const { filename, dirname, url } = import.meta
const path = dirname ?? url.slice?.(0, url.lastIndexOf("/")+1) ?? 'unknown'
const moduleName = filename?.split("\\")?.at(-1) ?? url.slice(url.lastIndexOf("/")+1) ?? 'unknown'
const isWorker = self?.name ? true : false
const logHeader = `${moduleName}` + (isWorker ? `(${self.name})` : ``)
console.log(`[${logHeader}]: Starting, path ${path}..., isVerbose is '${isVerbose? 'enabled' : 'disabled'}`)


import { _do, is } from "./Pattern_Matching.mjs"
import { dedent } from "./dedent.mjs"

/********** MODULE-START: DeepValues.js *******
	 * @module 'DeepValues'
	 * @requires 	js-md5
	 * @requires 	is
	 * @requires 	_do
	 * @version 07JUL2022
	 * 
	 * @description -  changed deserialize implementation - refactored recursion into sep functions in order to
	 * employ a Map for object dereferencing that is outside the scope of recursion
	 * 
	 *
	 * @description Recent major changes:
	 * 
	 * 1. added deepEqual_v2 - just an alternate for testing.  Can't remember if it's faster, more stable, more complete, or ??
	 * 2. added deepEqualFast_v2 - just an alternate for testing.  Can't remember if it's faster, more stable, more complete, or ??
	 * 3. added wip module for improvements to deserialize - still a WIP related to object references
	 * 4. added wip module for improvements to serialize
	 * 5. added _do (was tryThis)
	 * 6. md5 function - added dependency for md5 function (but having trouble converting js-md5.mjs to module form
	 * 
	 * @todo: consider breaking up _do into the following:
	 * 	_do - accepts one argument, no errorFn
	 *  _doElse - accepts two arguments - successFn & errorFn, or call it _try
	 */


const md5 = (inputString) => {
	const hc = '0123456789abcdef'
	const rh = (n) => { let j, s = ''; for (j = 0; j <= 3; j++) s += hc.charAt((n >> (j * 8 + 4)) & 0x0F) + hc.charAt((n >> (j * 8)) & 0x0F); return s }
	const ad = (x, y) => { let l = (x & 0xFFFF) + (y & 0xFFFF); let m = (x >> 16) + (y >> 16) + (l >> 16); return (m << 16) | (l & 0xFFFF) }
	const rl = (n, c) => (n << c) | (n >>> (32 - c))
	const cm = (q, a, b, x, s, t) => ad(rl(ad(ad(a, q), ad(x, t)), s), b)
	const ff = (a, b, c, d, x, s, t) => cm((b & c) | ((~b) & d), a, b, x, s, t)
	const gg = (a, b, c, d, x, s, t) => cm((b & d) | (c & (~d)), a, b, x, s, t)
	const hh = (a, b, c, d, x, s, t) => cm(b ^ c ^ d, a, b, x, s, t)
	const ii = (a, b, c, d, x, s, t) => cm(c ^ (b | (~d)), a, b, x, s, t)
	const sb = (x) => {
		let i; const nblk = ((x.length + 8) >> 6) + 1; const blks = []; for (i = 0; i < nblk * 16; i++) { blks[i] = 0 }
		for (i = 0; i < x.length; i++) { blks[i >> 2] |= x.charCodeAt(i) << ((i % 4) * 8) }
		blks[i >> 2] |= 0x80 << ((i % 4) * 8); blks[nblk * 16 - 2] = x.length * 8; return blks
	}
	let i, x = sb(inputString), a = 1732584193, b = -271733879, c = -1732584194, d = 271733878, olda, oldb, oldc, oldd
	for (i = 0; i < x.length; i += 16) {
		olda = a; oldb = b; oldc = c; oldd = d
		a = ff(a, b, c, d, x[i + 0], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819)
		b = ff(b, c, d, a, x[i + 3], 22, -1044525330); a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426)
		c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983); a = ff(a, b, c, d, x[i + 8], 7, 1770035416)
		d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162)
		a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290)
		b = ff(b, c, d, a, x[i + 15], 22, 1236535329); a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632)
		c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i + 0], 20, -373897302); a = gg(a, b, c, d, x[i + 5], 5, -701558691)
		d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848)
		a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961)
		b = gg(b, c, d, a, x[i + 8], 20, 1163531501); a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784)
		c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734); a = hh(a, b, c, d, x[i + 5], 4, -378558)
		d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556)
		a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632)
		b = hh(b, c, d, a, x[i + 10], 23, -1094730640); a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i + 0], 11, -358537222)
		c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189); a = hh(a, b, c, d, x[i + 9], 4, -640364487)
		d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651)
		a = ii(a, b, c, d, x[i + 0], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905)
		b = ii(b, c, d, a, x[i + 5], 21, -57434055); a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606)
		c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799); a = ii(a, b, c, d, x[i + 8], 6, 1873313359)
		d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649)
		a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259)
		b = ii(b, c, d, a, x[i + 9], 21, -343485551); a = ad(a, olda); b = ad(b, oldb); c = ad(c, oldc); d = ad(d, oldd)
	}
	return rh(a) + rh(b) + rh(c) + rh(d)
}




// used for hashing, but async is a problem unless everything is re-written
	
/** from MDN:  the W3c Crypto Interface for generating digests */
// about 12 times faster than md5 
async function digestMessage(message) {
	const msgUint8 = new TextEncoder().encode(message)                           // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)           // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer))                     // convert buffer to byte array
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
	return hashHex
}



// uses crypto API (thus about 12 times faster than the md5 function above).
// NOTE: uses SHA-256, thus this is not MD5 - so don't compare results to MD5
const strHash_async = async (str) => {
	const msgUint8 = new TextEncoder().encode(str)                         			 // encode as (utf-8) Uint8Array
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)           // hash the message
	const hashArray = Array.from(new Uint8Array(hashBuffer))                     // convert buffer to byte array
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('') // convert bytes to hex string
	return hashHex
}



/** orderedProps :: dsItem => [string]
 * @description Object.entries with deterministic property name ordering
 * Normally, ordering is not a concern, but for some below algorithms,
 * consistent order is assumed when comparing objects, and is thus important.
 */ 
const orderedProps =	(dsItem) 	=>	Object.entries(dsItem).sort()


/** helper functions for calculating/comparing deep values of object and arrays */

//	stringify  :: dsItem	=>	string
const strHash 	= async (str)			=>	await strHash_async(str)
const stringify = (dsItem)	=>	[...Object.keys(dsItem), ...Object.values(dsItem)].join() 	// faster than JSON.stringify() for hash purposes

// hash of object which cares about the prop ordering
const objHash 	= (obj) 		=> 	strHash_async(stringify(obj))


// hash of object which does not care about prop ordering
const hashOf 		= async (dsItem) 	=>	await strHash( stringify( orderedProps(dsItem) ) )

const arrHash = (arr) 		=> strHash_async(arr.join)  // for shallow arrays  (order is important!)
const dsHash  = (dsArray) => strHash_async(dsArray.map(stringify).join())  // for dsArrays (arrays of flat objects)
const dsHash2 = (dsArray) => dsArray.map(objHash).join()  // for dsArrays (arrays of flat objects)

// possibly better performance than hashOf
const hashOf_v2 = async (dsItem)	=>	{
	const keys = Object.keys(dsItem).sort()
	let returnVal = ''
	for (let key of keys) {
		returnVal = returnVal + `${key} + ${dsItem.key}`
	}
	return await strHash(returnVal)
}
	


/** deepEqual
 * @description compare two objects to see if they are equal, recursively.
 * @warning can't assume this works for objects with Symbols, prototype chains, 
 * or non-enumerable properties.  In other words, use only on data objects, not 
 * class-instantiated objects from someone else's API or objects which contain runtime
 * state.  
 * @note does not know nor check that both object copies or their props share the same 
 * references.
 * @todo test on Arrays with non-standard properties
 */
const deepEqual = (a,b) => {
	const isArray = Array.isArray
	const keyList = Object.keys
	const hasProp = Object.prototype.hasOwnProperty
	// check all simple types, including null and undefined equality
	if (a === b) return true

	// all object types including array
	//	*** NOTE: need to generalize and test for iterables ***
	if (a && b && typeof a == 'object' && typeof b == 'object') {
		// section 1: array equality
		const arrA = isArray(a)
		const arrB = isArray(b)
		let i, key
		if (arrA && arrB) {
			const length = a.length
			if (length != b.length) return false
			for (i = length; i-- !== 0;)
				if (!deepEqual(a[i], b[i])) return false
			return true
		}
		if (arrA != arrB) return false

		// section 2: Date equality
		const dateA = a instanceof Date
		const dateB = b instanceof Date
		if (dateA != dateB) return false
		if (dateA && dateB) return a.getTime() == b.getTime()
	
		// section 3: RegExp equality
		const regexpA = a instanceof RegExp
		const regexpB = b instanceof RegExp
		if (regexpA != regexpB) return false
		if (regexpA && regexpB) return a.toString() == b.toString()
	
		const keys = keyList(a)
		const length = keys.length
	
		if (length !== keyList(b).length)
			return false
	
		for (i = length; i-- !== 0;)
			if (!hasProp.call(b, keys[i])) return false
	
		for (i = length; i-- !== 0;) {
			key = keys[i]
			if (!deepEqual(a[key], b[key])) return false
		}
		return true
	}
	else if ((a && b && typeof a == 'function' && typeof b == 'function')) {
		return a.toString() === b.toString()
	}
	return a!==a && b!==b
}

const deepEqual_v2 = (a,b) => {
	const hasProp = Object.prototype.hasOwnProperty
	// check all simple types, including null and undefined equality
	if (a === b) return true

	// all object types including array
	//	*** NOTE: need to generalize and test for iterables ***
	if (a && b && typeof a == 'object' && typeof b == 'object') {
		// section 1: array equality
		const arrA = Array.isArray(a)
		const arrB = Array.isArray(b)
		let i, key
		if (arrA && arrB) {
			const length = a.length
			if (length != b.length) return false
			for (i = length; i-- !== 0;)
				if (!deepEqual_v2(a[i], b[i])) return false
			return true
		}
		if (arrA != arrB) return false

		// section 2: Date equality
		const dateA = a instanceof Date
		const dateB = b instanceof Date
		if (dateA != dateB) return false
		if (dateA && dateB) return a.getTime() == b.getTime()
	
		// section 3: RegExp equality
		const regexpA = a instanceof RegExp
		const regexpB = b instanceof RegExp
		if (regexpA != regexpB) return false
		if (regexpA && regexpB) return a.toString() == b.toString()
	
		const keys = Object.keys(a)
		const length = keys.length
	
		if (length !== Object.keys(b).length)
			return false
	
		for (i = length; i-- !== 0;)
			if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false
	
		for (i = length; i-- !== 0;) {
			key = keys[i]
			if (!deepEqual_v2(a[key], b[key])) return false
		}
		return true
	}
	else if ((a && b && typeof a == 'function' && typeof b == 'function')) {
		return a.toString() === b.toString()
	}
	return a!==a && b!==b
}

/** deepEqualFast :: (any) => (any) => Boolean
 * @note slightly faster because it intentionally skips constructed objects & symbols (Date, RegExp, etc.)
 * 
 */
const deepEqualFast = (a, b) => {
	if (a === b) return true
	if (a && b && typeof a == 'object' && typeof b == 'object') {
		let i, key
		if (Array.isArray(a) && Array.isArray(b)) {
			const length = a.length
			if (length !== b.length) return false
			for (i = length; i-- !== 0;)
				if (deepEqualFast(a[i],b[i]) === false) return false
			return true
		}
		const keys = Object.keys(a)
		const length = keys.length
		if (length !== Object.keys(b).length)	return false
		for (i = length; i-- !== 0;)	// the for statement without the 3rd term must be some performance trick
			if (Object.prototype.hasOwnProperty.call(b, keys[i])===false) return false
		for (i = length; i-- !== 0;) {
			key = keys[i]
			if (deepEqualFast(a[key], b[key]) === false) return false
		}
		return true
	}
	return a!==a && b!==b
}

const deepEqualFast_v2 = (a, b) => {
	const hasProp = Object.prototype.hasOwnProperty

	if (a === b) return true

	if (a && b && typeof a == 'object' && typeof b == 'object') {
		let i, key

		if (Array.isArray(a) && Array.isArray(b)) {
			const length = a.length
			if (length !== b.length) return false
			for (let i=0;  i<length; i++) {
				if (deepEqualFast_v2(a[i],b[i]) === false) {
					return false 
				}
			}
			return true
		}
		const keys = Object.keys(a)
		const length = keys.length

		if (length !== Object.keys(b).length)	{ return false }

		for (i=0; i<length; i++)
			if (Object.prototype.hasOwnProperty.call(b, keys[i])===false) { return false }

		for (i=0; i<length; i++) {
			key = keys[i]
			if (deepEqualFast_v2(a[key], b[key]) === false) { return false }
		}
		return true
	}
	return a!==a && b!==b
}
// better than typeof because it differentiates null, and Array away form an object.
const _typeof = (item) => (item === null) ? 'null' 	: Array.isArray(item) ? `Array` :	typeof item



/** propMerge1 - a "mergeFn" plug-in function for objMerge :  propMerge1 :: (value1, value2) -> value1 | value2
 * 
 * This compares two values (assumed to be simple values of the same property of two separate objects,
 * and returns a 'winner'.
 * 
 * Other functions like this can be defined to alter the behavior of objMerge
 */
const propMerge1 = (val1,val2) => {
	// case 1: both values are same
	if (val1 === val2) return val1

	// case 2: first value is null or undefined.  Second value is the winner if it is not itself undefined
	if (val1 === null || typeof(val1)==='undefined') {
		if (val2 !== null && typeof(val2) !== 'undefined') {
			return val2				// because anything wins over null or undefined
		}
		else {							// because null wins over undefined
			if (val2 === undefined) return val1
		}
	}

	// case 3: second value is null or undefined (and we know the first value is neither), so val1 wins 
	if (val2 === null || typeof(val2)==='undefined') return val1

	// case 4: any non-empty value wins over empty string
	if (val1 === '') return val2

	// default case, val2 overwrites val1
	return val2
}


/** objMerge (obj1, obj2, mergeFn)
 *  merge properties of two objects, but with the ability to fine-tune conflict-resolving behavior 
 * 	when objects share some propNames (via the mergeFn function)
 *  If both objects contain the same property, the values of the objects property is compared using a 
 *  user-supplied 'mergeFn' function.
 *  If no mergeFn is supplied, obj2 property will overwrite obj1's value, 
 * 
 * mergeFn  :: (value1, value2) -> value1 | value2
 * 
 */
const objMerge = (obj1, obj2, mergeFn) => {
	// if no property-merging function (mergeFn) is supplied, default to object spread behavior, 
	//	where obj2 properties overwrite obj1
	if (typeof(mergeFn) !== 'function') return { ...obj1, ...obj2 }

	// now that we're here, we know the mergeFn has been supplied, so start with obj1, and then add properties of obj2 to it.
	const mergedObject = structuredClone(obj1)
	for (const key in obj2) {
		if (key in obj1) {    // if property names conflict between obj1 and obj2, use the mergeFn on the values as a tie-breaker
			mergedObject[key] = mergeFn(obj1[key], obj2[key])
		}
		else {								// otherwise, simply add it
			mergedObject[key] = obj2[key]
		}
	}
	return mergedObject
}



/** mergeDeep :: Object => Object => Object
 * Merge two objects recursively, including merging properties which are arrays 
 * 
 * @type {(target:object, source:object) => object}
 *  
*/
const mergeDeep = (target, source) => {
	const isDeep = (prop) => is.nonIterableObj(source[prop]) && is.nonIterableObj(target?.[prop])
	const isArr = (prop) => Array.isArray(source[prop]) && Array.isArray(target?.[prop])
	const mergedObject = Object.keys(source).map( (prop) => ({ 
		[prop]: isArr(prop) ? 											// 	if both props match as an Array...
			[...source[prop], ...target[prop]] 				//		return the merged arrays
			: isDeep(prop) ? 														// 	else if both props are an Object,
				mergeDeep(target[prop], source[prop])			//		recurse (and eventually return merged object)
				: source[prop] 															//	else, return the source
	})).reduce( (a,b) => {
		return { ...a, ...b }												// merge sub-prop objects
	}, {} )

	return {																			// merge both top-level objects
		...target,
		...mergedObject,
	}
}
	
const wip = () => {
	/** serialize / deserialize - 
	 * @description encodes/decodes any primitive or object into a primitive/object 
	 * that can be handled by both the structured cloning algorithm AND JSON.stringify,
	 * so (nearly) any object and its contents can pass across Realm boundary as well as http boundary.

	* Supports encoding of data types such as:
	* 	- functions
	*  - symbols (globally-registered is perfect, unregistered is imperfect)
	*  - Built-in instances of iterables like for Maps, Sets
	*  - Built-in instances of Date, RegExp
	*  - User-defined class instances
	*  
	*  @todo: need testing & possibly support for:
	* 	- BufferedArrays
	*  - async functions
	* 	- generators
	*  - iterator methods (i.e. someobject[Symbol.iterator])
	* 
	* How it works:
	* 	Any primitive perfectly cloneable via JSON.stringify / structured cloning will pass unchanged
	*  unclonable primitives will be encoded directly into a string beginning with a '$',
	*  or encapsulated into an object, whose key name begins with a '$'
	* 	
	* 		Special encodings:
	* 
	* 		Original Type |	Encoded Type 										|	Decoded Type
	*    -------------	|	-----------------------------		|	-------------
	* 		undefined 		| "$undefined"										|	undefined
	* 		symbol				| "$symbol"												|	"symbol(unclonable)"  (limitation of JS)
	* 		symbol (for) 	| "$symbolfor#<name>"							|	symbol (for)
	* 		bigint 			  |	{ $bigint: <encoded number> }		| bigint
	* 		NaN					  |	{ $number: "NaN" }							| NaN
	* 		Infinity		  |	{ $number: "Infinity" }					| Infinity
	* 		bigint 			  |	{ $bigint: number}							| bigint
	* 		function		  |	{ $function: encodedFunction}	| function
	* 		Error					|	{ $error: encodedError }				| Error (lossy)
	* 		RegExp				| { $$RegExp: encodedRegExp }			| RegExp
	* 		<IterableObj>	|	{	$iterable: {encodedIterable}} | <IterableObj>
	* 		<NonIterObj>	| { $$X: encoded class }					|	<class abc>  (imperfect - depends on type)
	* 		self-reference| { $ref: abs location or orig}		| <class abc>  (imperfect - depends on type)
	* 
	* The encoding process keeps track of objects, such that if it encounters the same object in another
	* key (self-referencing), it will store the additional references in a { ${ref: encodedLocation }} object
	* 
	* Note: this is a co-recursive function
	*/
	function deserialize (item, cache=null) {
		if (cache) console.log(`deserialize called with cache`, {item, cache} )
		const resolutionCache = cache ?? new Map() 
		//		if (!resolutionCache) resolutionCache = new Map()
		let debugMode = true
		// deserialize is an entry point, but contains two routines - one for deserializing primitives,
		// and one for objects/arrays. deserializeObject is recursive.

		// from './pattern-matching.mjs' - terse version.  See module for longer version
		const regExp_fromString = (inputString) => new RegExp( // @ts-ignore-error  NOTE: spread must be there to force RegExp constructor to receive 2 parameters instead of a single array 
			...( inputString.slice(1).split(/\/([gmiyusd]*)$/) ).slice(0,2) 
		)   

		const deserializePrimitive = (item) => {
			if (item === null) return null
			if (typeof(item)==='string') {			// the serialization method uses strings starting with $ to encode special data types not handled by JSON.stringify
				if (item==='$undefined') return undefined
				if (item==='$symbol') return 'symbol(unclonable)'
				if (item.startsWith('$symbolfor#')) return Symbol.for(item.replace(/^\$symbolfor#/,''))  // globally registered symbols
				return item // just a normal string 
			}
			if (['number', 'boolean'].includes(typeof(item))) return item
		}


		const deserializeObject = (item) => {
			console.log(`deserializeObject called`, {item})
			if (Array.isArray(item) ) {
				return item.map(deserialize)
			}	 	// Array.isArray

			if (typeof(item) === 'object') {
				const objkeys = Object.keys(item)
				const entries = []
				for (const key of objkeys) {
					if (key === `$bigint`) {	return BigInt(item[key])	}
					if (key === `$number`) {	return Number(item[key])	}
					if (key === `$iterable`) {
						const constructorName = item.$iterable.constructor
						const constructor = eval(`${constructorName}`)
						const values = deserialize(item.$iterable.values)
						return new constructor(values)
						// entries.push([	key, new constructor(values)	])
					}
					if ( key == '$ref' ) {
						resolutionCache.set(item, item[key])   // store the reference to resolve it later.  Item is this object's position, item[key] contains a string-based pointer name to the would-be object
						debugMode && console.log(`mark1 - item[key] is a $ref.  See output to right for stuff `, {item, key, itemKey: item[key],  itemKeyRef:item[key].$ref, entries, objkeys, resolutionCache} )

						return item[key]   //  should be an existing reference 
					}
					if (key=='$error') {
						console.warn(`mark2 - item[key] is $error`)
						return { ...item[key] } 
					}
					if ( key == '$function' ) {
						console.warn(`mark3 - item[key] is $function`)
						return eval(`${item[key].fn}`)
					}
					// special handling for RegExp parsing
					if (key=='$$RegExp') {
						console.warn(`mark4 - item[key] is $$RegExp`)
						return regExp_fromString(item[key])
					}

					// common built-ins - the key is the constructor name
					if (key.startsWith('$$')) {
						console.warn(`mark5 - items's key ${key} starts with $$`, item[key])
						return new globalThis[key.slice(2)](item[key])
					}

					// start looking for well-known key names for the encapsulated data types ($iterator, $function,
					// & (future) constructed objects like RegExp, async, & generators that need special handling...)
					if ( item[key]?.$function ) {
						console.warn(`mark1 - item[key] is $function`)
						debugMode && console.log(`!!!deserialize: case is function: obj[key]:`, item[key] )
						const fnName = item[key].$function.fnName
						const evalStr = `${item[key].$function.fn}`
						/* old block of code replaced by single line below
											const fn = eval(evalStr)
											let altFn
											if (fn===undefined) {   // this would happen if we had a function statement instead of a function expression.  In this case, fn must be evaluated globally and then assigned.
												altFn = eval.call(null,`${fnName} = ${item[key].$function.fn}`)
												// altFn = {[fnName]: eval.call(null,`${fnName} = ${item[key].$function.fn}`)}
											}
											entries.push([	key, fn ?? altFn ])
						*/

						// NOTE: evalStr could be a function expression or function statement.  First eval below would be undefined if it's a statement, thus we need to manually provide a name with second eval
						const fn = eval(evalStr)  ||  eval.call(null,`${fnName} = ${item[key].$function.fn}`)
						entries.push([	key, fn ])

						debugMode && console.log(`!!!deserialize results: fnName: ${fnName}, key:${key}, `, {key,fn, original:item[key].$function} )
					}
					else if ( item[key]?.$number ) {
						console.warn(`mark3 - item[key] is $number`)
						const number = Number(item[key].$number)
						entries.push([ key, number ])
					}

					else if ( item[key]?.$iterable ) {
						console.warn(`mark3 - item[key] is $iterable`)
						const constructorName = item[key].$iterable.constructor
						const constructor = eval(`${constructorName}`)
						const values = deserialize(item[key].$iterable.values)
						entries.push([	key, new constructor (values)	])
					}

					// $ref is for a pointer (borrowed from JSONschema) which was created by serialize for circular dependencies
					// this is a hack and probably won't work as implemented.  We need the original value to be resolved before
					// we can resolve it, but at this point, we're only building entries for object.entries.
					// The solution is to keep track of $refs in the object in a cache, and resolve at end of recursion.

					else if ( item[key]?.$ref ) {
						resolutionCache.set(item, item[key])   // store the reference to resolve it later.  Item is this object's position, item[key] contains a string-based pointer name to the would-be object
						entries.push([key,item[key]])
						debugMode && console.log(`mark4 - item[key] is a {$ ref}.  See output to right for stuff `, {item, key, itemKey: item[key],  itemKeyRef:item[key].$ref, entries, resolutionCache} )
					}
					// else here means that the obj was non-special
					else {
						console.warn(`mark5 - item[key] is not special item[${key}] is ${item[key]}`)
						entries.push([key, deserialize(item[key]) ])
					}
				}
				return Object.fromEntries(entries)
			}	 	// typeof(obj) === 'object'

			throw new Error(`[deserializedObject]: data type not identified.  This is bug.  Investigate`)
		}

		////////////////////////////////////////////////////////////////
		// start of function and base case
		if (item == null || typeof(item) !=='object') return deserializePrimitive(item)

		// if an object, create the reference map (used for circular reference detection - to be implemented)
		const partiallyResolvedObject = deserializeObject(item)

		console.log(`[deserialize]: completed Phase 1`,  {resolutionCache: resolutionCache})

		if (resolutionCache.size === 0) {
			debugMode && console.log(`[deserialize]: item was an object. No circular references found. `, {item: partiallyResolvedObject})
			return partiallyResolvedObject 			// end of deserialize routine if there are not circular references
		} 
		// at this point, the object is 'partially resolved', i.e. it's almost 100% except for $ref pointers, which are circular references

		debugMode && console.warn(`[deserialize]: item was an object with circular references (not yet resolved).  Partially-resolved object looks like:`, {partiallyResolvedObject, resolutionCache:resolutionCache})

		// now do something with the resolutionCache to make the object whole again (ie. get rid of $refs)
		//const parentReferences = [ ...resolutionCache.keys() ]
		const fullyResolvedObject = {...partiallyResolvedObject}  // 

		//throw (`NOTE to future self.  This is where the bug is.  parentReferences above should not be a destructured Array, because it's a map`)
		// NOTE to future self:  

		// this part is obviously wrong for deeply-nested objects since parentKey has a '.' in the name which must be resolved
		for (let [keyName, parentKey] of resolutionCache) {
			fullyResolvedObject[keyName] = partiallyResolvedObject[parentKey]
		}

		debugMode && console.warn(`[deserialize]: Fully resolved object:`, {fullyResolvedObject, partiallyResolvedObject})
		return fullyResolvedObject
	}

	return deserialize
}  // WIP


/** serialize / deserialize - 
 * @description encodes/decodes any primitive or object into a primitive/object 
 * that can be handled by both the structured cloning algorithm AND JSON.stringify,
 * so (nearly) any object and its contents can pass across Realm boundary as well as http boundary.

* Supports encoding of data types such as:
* 	- functions
*  - symbols (globally-registered is perfect, unregistered is imperfect)
*  - Built-in instances of iterables like for Maps, Sets
*  - Built-in instances of Date, RegExp
*  - User-defined class instances
*  
*  @todo: need testing & possibly support for:
* 	- BufferedArrays
*  - async functions
* 	- generators
*  - iterator methods (i.e. someobject[Symbol.iterator])
* 
* How it works:
* 	Any primitive perfectly cloneable via JSON.stringify / structured cloning will pass unchanged
*  unclonable primitives will be encoded directly into a string beginning with a '$',
*  or encapsulated into an object, whose key name begins with a '$'
* 	
* 		Special encodings:
* 
* 		Original Type |	Encoded Type 										|	Decoded Type
*    -------------	|	-----------------------------		|	-------------
* 		undefined 		| "$undefined"										|	undefined
* 		symbol				| "$symbol"												|	"symbol(unclonable)"  (limitation of JS)
* 		symbol (for) 	| "$symbolfor#<name>"							|	symbol (for)
* 		bigint 			  |	{ $bigint: <encoded number> }		| bigint
* 		NaN					  |	{ $number: "NaN" }							| NaN
* 		Infinity		  |	{ $number: "Infinity" }					| Infinity
* 		bigint 			  |	{ $bigint: number}							| bigint
* 		function		  |	{ $function: encodedFunction}	| function
* 		Error					|	{ $error: encodedError }				| Error (lossy)
* 		RegExp				| { $$RegExp: encodedRegExp }			| RegExp
* 		<IterableObj>	|	{	$iterable: {encodedIterable}} | <IterableObj>
* 		<NonIterObj>	| { $$X: encoded class }					|	<class abc>  (imperfect - depends on type)
* 		self-reference| { $ref: abs location or orig}		| <class abc>  (imperfect - depends on type)
* 
* The encoding process keeps track of objects, such that if it encounters the same object in another
* key (self-referencing), it will store the additional references in a { ${ref: encodedLocation }} object
* 
* Note: this is a co-recursive function
*/
function deserialize (item) {
	if (!globalThis.resolutionCache) globalThis.resolutionCache = new Map()
	let debugMode = false
	// deserialize is an entry point, but contains two routines - one for deserializing primitives,
	// and one for objects/arrays. deserializeObject is recursive.

	// from './pattern-matching.mjs' - terse version.  See module for longer version
	const regExp_fromString = (inputString) => new RegExp( // @ts-ignore-error  NOTE: spread must be there to force RegExp constructor to receive 2 parameters instead of a single array 
		...( inputString.slice(1).split(/\/([gmiyusd]*)$/) ).slice(0,2) 
	)   

	const deserializePrimitive = (item) => {
		if (item === null) return null
		if (typeof(item)==='string') {			// the serialization method uses strings starting with $ to encode special data types not handled by JSON.stringify
			if (item==='$undefined') return undefined
			if (item==='$symbol') return 'symbol(unclonable)'
			if (item.startsWith('$symbolfor#')) return Symbol.for(item.replace(/^\$symbolfor#/,''))  // globally registered symbols
			return item // just a normal string 
		}
		if (['number', 'boolean'].includes(typeof(item))) return item
	}


	const deserializeObject = (item, cache) => {
		if (Array.isArray(item) ) {
			return item.map(deserialize)
		}	 	// Array.isArray

		if (typeof(item) === 'object') {
			const objkeys = Object.keys(item)
			const entries = []
			for (const key of objkeys) {
				if (key === `$bigint`) {	return BigInt(item[key])	}
				if (key === `$number`) {	return Number(item[key])	}
				if (key === `$iterable`) {
					const constructorName = item.$iterable.constructor
					const constructor = eval(`${constructorName}`)
					const values = deserialize(item.$iterable.values)
					return new constructor(values)
					// entries.push([	key, new constructor(values)	])
				}
				if ( key == '$ref' ) {
					console.warn(`mark1 - item[key] is $ref`)
					globalThis.resolutionCache.set(item, item[key])   // store the reference to resolve it later.  Item is this object's position, item[key] contains a string-based pointer name to the would-be object
					return item[key]   //  should be an existing reference 
				}
				if (key=='$error') {
					console.warn(`mark2 - item[key] is $error`)
					return { ...item[key] } 
				}
				if ( key == '$function' ) {
					console.warn(`mark3 - item[key] is $function`)
					return eval(`${item[key].fn}`)
				}
				// special handling for RegExp parsing
				if (key=='$$RegExp') {
					console.warn(`mark4 - item[key] is $$RegExp`)
					return regExp_fromString(item[key])
				}

				// common built-ins - the key is the constructor name
				if (key.startsWith('$$')) {
					console.warn(`mark5 - items's key ${key} starts with $$`, item[key])
					return new globalThis[key.slice(2)](item[key])
				}

				// start looking for well-known key names for the encapsulated data types ($iterator, $function,
				// & (future) constructed objects like RegExp, async, & generators that need special handling...)
				if ( item[key]?.$function ) {
					console.warn(`mark1 - item[key] is $function`)
					debugMode && console.log(`!!!deserialize: case is function: obj[key]:`, item[key] )
					const fnName = item[key].$function.fnName
					const evalStr = `${item[key].$function.fn}`
					/* old block of code replaced by single line below
						const fn = eval(evalStr)
						let altFn
						if (fn===undefined) {   // this would happen if we had a function statement instead of a function expression.  In this case, fn must be evaluated globally and then assigned.
							altFn = eval.call(null,`${fnName} = ${item[key].$function.fn}`)
							// altFn = {[fnName]: eval.call(null,`${fnName} = ${item[key].$function.fn}`)}
						}
						entries.push([	key, fn ?? altFn ])
					*/

					// NOTE: evalStr could be a function expression or function statement.  First eval below would be undefined if it's a statement, thus we need to manually provide a name with second eval
					const fn = eval(evalStr)  ||  eval.call(null,`${fnName} = ${item[key].$function.fn}`)
					entries.push([	key, fn ])

					debugMode && console.log(`!!!deserialize results: fnName: ${fnName}, key:${key}, `, {key,fn, original:item[key].$function} )
				}
				else if ( item[key]?.$number ) {
					console.warn(`mark3 - item[key] is $number`)
					const number = Number(item[key].$number)
					entries.push([ key, number ])
				}

				else if ( item[key]?.$iterable ) {
					console.warn(`mark3 - item[key] is $iterable`)
					const constructorName = item[key].$iterable.constructor
					const constructor = eval(`${constructorName}`)
					const values = deserialize(item[key].$iterable.values)
					entries.push([	key, new constructor (values)	])
				}

				// $ref is for a pointer (borrowed from JSONschema) which was created by serialize for circular dependencies
				// this is a hack and probably won't work as implemented.  We need the original value to be resolved before
				// we can resolve it, but at this point, we're only building entries for object.entries.
				// The solution is to keep track of $refs in the object in a cache, and resolve at end of recursion.
				else if ( item[key]?.$ref ) {
					console.warn(`mark4 - item[key] is $ref`)
					debugMode && console.log(`$ref pointer encountered...not yet handled...value is: `, {item, key, itemKey: item[key],  itemKeyRef:item[key].$ref} )
					globalThis.resolutionCache.set(item, item[key])   // store the reference to resolve it later.  Item is this object's position, item[key] contains a string-based pointer name to the would-be object
					entries.push([key,item[key]])
				}
				// else here means that the obj was non-special
				else {
					console.warn(`mark5 - item[key] is not special item[${key}] is ${item[key]}`)
					entries.push([key, deserialize(item[key]) ])
				}
			}
			return Object.fromEntries(entries)
		}	 	// typeof(obj) === 'object'

		throw new Error(`[deserializedObject]: data type not identified.  This is bug.  Investigate`)
	}

	////////////////////////////////////////////////////////////////
	// start of function and base case
	if (item == null || typeof(item) !=='object') return deserializePrimitive(item)

	// if an object, create the reference map (used for circular reference detection - to be implemented)
	const partiallyResolvedObject = deserializeObject(item, globalThis.resolutionCache)

	console.log(`[deserialize]: completed Phase 1`,  {resolutionCache: globalThis.resolutionCache})

	if (globalThis.resolutionCache.size === 0) {
		debugMode && console.log(`[deserialize]: item was an object. No circular references found. `, {item: partiallyResolvedObject})
		return partiallyResolvedObject 			// end of deserialize routine if there are not circular references
	} 
	// at this point, the object is 'partially resolved', i.e. it's almost 100% except for $ref pointers, which are circular references

	debugMode && console.warn(`[deserialize]: item was an object with circular references (not yet resolved).  Partially-resolved object looks like:`, {partiallyResolvedObject, resolutionCache:globalThis.resolutionCache})

	// now do something with the resolutionCache to make the object whole again (ie. get rid of $refs)
	const parentReferences = [...globalThis.resolutionCache]
	const fullyResolvedObject = {...partiallyResolvedObject}  // 

	// this part is obviously wrong for deeply-nested objects since parentKey has a '.' in the name which must be resolved
	for (let [keyName, parentKey] of parentReferences) {
		fullyResolvedObject[keyName] = partiallyResolvedObject[parentKey]
	}

	debugMode && console.warn(`[deserialize]: Fully resolved object:`, {fullyResolvedObject, partiallyResolvedObject})
	return fullyResolvedObject
}


/** serialize - convert object into a form that is able to be used with JSON.stringify() easily
 * @type {(item: object, cache?: WeakMap<any, any> | null, parentKey?: string | undefined, keyPath?: string | undefined) => object }
 */
function serialize(item, cache=undefined, parentKey='', keyPath='') {
//	let debug=false
//	debug && console.log(`("${keyPath}") key:${parentKey} value:`, obj)
	// cache is used to prevent loops by remembering all objects
	const memo = cache || new WeakMap()

	// always start with null check since it short-circuits object check
	if (item === undefined) return `$undefined`
	if (item === null) return null
	if (typeof(item)=='string')  return item
	if (typeof(item)=='boolean') return item
	if (typeof(item)=='bigint')  return {	$bigint: `${item}` }
	if (typeof(item)=='number')  return (Number.isFinite(item)) ? item : {	$number: `${item}` }
	if (typeof(item)=='symbol')  return  (Symbol.keyFor(item) === undefined) ? '$symbol' : `$symbolfor#${Symbol.keyFor(item)}` 

	if (typeof(item) === 'function') return {
		[`$function`]: {
			fnName		: item.name || '',
			fn				: `${item}`,
			encodedFn	: btoa(item),
		}
	}

	if (item instanceof Error) return {
		[`$error`]: {
			type: item.constructor.name,
			stack: item.stack,
			message: item.message,
		}
	}

	// array is treated differently from an iterable object due to how we need to convert iterables to an array as a recursion step
	if (Array.isArray(item) ) {
		if  (memo.has(item)) return {
			['$ref']: `#${memo.get(item)}`   // <-- will store the parentKey of the original item as a reference to 
		}	
		memo.set(item,keyPath)
		const clone = []
		for (let i=0; i<item.length; i++)  clone[i] = serialize(item[i],memo,`${i}`,`${keyPath}/${i}`)
		return clone
	}

	// for non-iterable objects, naively attempt to clone by calling object's constructor + obj.valueOf()  // should work with Date, RegExp, and many user-crated objects
	if (typeof(item)==='object' && typeof item[Symbol.iterator] !== 'function') {
		if  (memo.has(item)) return {	
			['$ref']: `#${memo.get(item)}`
		}	
		memo.set(item, keyPath)

		// common built-in objects - Date, RegExp, etc.
		if([Date,RegExp].includes(item.constructor)) return {
			[`$$${item.constructor.name}`]: `${item}`
		}

		const objkeys = Object.keys(item)
		const entries = []
		for (const key of objkeys) {
			entries.push([key, serialize(item[key], memo, key, `${keyPath}/${key}`)])
		}
		return Object.fromEntries(entries)
	} 	// typeof(obj) === 'object'

	// for other iterables, convert toArray first, we elements can be deep-copied, and then reconstructed
	if (typeof item[Symbol.iterator] == 'function') {
		if (!memo.has(item)) {
			memo.set(item, parentKey)
			return {
				[`$iterable`]: {
					constructor: `${item.constructor.name}`,
					values: serialize([...item],memo)			// convert iterable to array for normal processing
				}
			}
		}
	}
	throw `serialize: Major bug: data not not accounted for, should never see this message`
}


let xyz = serialize({
	name:'me',
	value:4905,
	birthDay: new Date('07/20/1972'),
	isTrue: true,
	petNames: ['mia','clippy','lara','jager','orion','meco'],
	pets: [
		{	name: 'mia'			,age: 10, value: 'dumb' 			,color: 'blue'	},
		{	name: 'clippy'	,age: 10, value: 'handsome'		,color: 'blue' 	},
		{	name: 'lara'		,age: 10, value: 'wick' 			,color: 'blue'	},
		{	name: 'orion'		,age: 10, value: 'cool' 			,color: 'blue'	},
		{	name: 'meco'		,age: 10, value: 'sweet'			,color: 'blue'	 },
		{	name: 'jager'		,age: 10, value: 'fluffy'			,color: 'blue'	 },
	]
})


/** @description deepCopy_fast does not work.  syntax bug - need to find old implementations and see how this ever worked.
 *  @see inline note below - error is by const clone =  new obj.constructor()
 */
/*
// works fast for data, and tries to work on class instances (not reliable)
// does not check for non-standard array properties
function deepCopy_fast  (obj) {
	let clone
	if (obj == null) return obj

	if (obj.prototype.name === 'Date') 
		const clone= new obj.constructor() //  <-- syntax error

	if (Array.isArray(obj)) {
		for (let i=0;i<obj.length;i++)

		if (typeof obj[i] == "object") {
			clone[i] = deepCopy(obj[i]) 
		}
		else {
			clone[i] = obj[i];
		}
		return clone;
	}
	for(let i in obj)
		if (obj[i] == null) { clone[i]=obj[i] }
		else if (typeof obj[i] == "object") {
			clone[i] = deepCopy(obj[i]) 
		}
		else {
			clone[i] = obj[i];
		}
	return clone;
}

*/

// slower than deepCopy becasu- but copies special array properties by treating an array as an object
// still does not handle cloning some class instances (Map, RegExp, etc)
function deepCopy(obj) {
	if (obj == null) return obj
	let clone= new obj.constructor
	for (let i in obj) {
		if (typeof obj[i] == "object") {
			clone[i] = deepCopy(obj[i]) 
		}
		else {
			clone[i] = obj[i]
		}
	}
	return clone
}



// works fast for data, and tries to work on class instances (not reliable)
// does not check for non-standard array properties
/**
 * @deprecated - fails to deepCopy.  DeepCopySafe is a better alternative
 */
function deepCopy_old  (obj) {
	const deepCopy = deepCopy_old
	if (obj == null) return obj

	if (['number','string','boolean','bigint'].includes(typeof(obj))) return obj

	//	if (typeof(obj) === 'symbol') return Symbol.keyFor(obj) ?? obj
	if (typeof(obj) === 'symbol') return obj

	if (typeof(obj) === 'function') return obj

	// assuming we now have an iterable object
	if (Array.isArray(obj)) {
		const clone = []
		for (let i=0; i<obj.length; i++)  clone[i] = deepCopy(obj[i]) 
		return clone
	}

	// for non-iterable objects, naively attempt to clone by calling object's constructor + obj.valueOf()  // should work with Date, RegExp, and many user-crated objects
	if (typeof(obj)==='object' && typeof obj[Symbol.iterator] !== 'function')
		return new obj.constructor(obj.valueOf())

	// for other iterables, convert toArray first, where elements can be deep-copied, and then reconstructed
	return new obj.constructor(deepCopy([...obj]))
}




/** (sync) Structured Cloning Hack
*/
/* doesn't seem to work well... slow & buggy.  more research...
const structuredClone = (obj) => {
	const oldState = history.state;
	history.replaceState(obj,window.title)
	const copy = history.state;
	history.replaceState(oldState, window.title)
	return copy
}
*/


/** (async) class StructuredCloner  :: {obj} -> {obj}     ; clones objects using the structured cloning algorithm
 * @class StructuredCloner
 * @returns {Promise<*>}
 * 
 * Proper structured cloning of JS objects 
 * W3C details a structured-clone algorithm that is (currently) only available to browser internals, but no user-API.
 * Several APIs use this standard algorithm, including the channel messaging API.
 * This implementation uses the channel-messaging API as a low-overhead method of cloning.
 * As such, it's async only.  Currently, no well-performing implementation exists for synchronous 
 * 
 * @local #pendingCloneMap - keeps track of remaining promises for objects left to clone
 * @local #nextKey - the index into the #pendingCloneMap for the next promise to fulfill
 * @local #inPort, outPort
*/
class StructuredCloner {
	static singleton
	#pendingCloneMap; #nextKey; #inPort; #outPort

	constructor() {
		StructuredCloner.singleton = StructuredCloner?.singleton ?? this
		// below is using newer conditional assignment expression, but not as widely supported yet
		// StructuredCloner.singleton ??= this
		/*
		if (StructuredCloner.singleton === null) {
			console.log(`StructuredCloner - no singleton exists, using new instance`)
			StructuredCloner.singleton = this
		} 
		else {
			console.log(`StructuredCloner - already instantiated, returning current instance`)
			return StructuredCloner.singleton
		}
		*/

		this.#pendingCloneMap = new Map()
		this.#nextKey = 0  
		const channel = new MessageChannel()
		this.#inPort = channel.port1
		this.#outPort = channel.port2
		this.#outPort.onmessage = ({data: {key, value}}) => {
			const resolve = this.#pendingCloneMap.get(key)
			resolve(value)
			this.#pendingCloneMap.delete(key)
		}
		this.#outPort.start()
	}
	cloneAsync(value) {
		return new Promise((resolve) => {
			const key = this.#nextKey++
			this.#pendingCloneMap.set(key, resolve)
			this.#inPort.postMessage({key, value})
		})
	}
}

/**
 * @arg {object} obj - any data item suitable for Structured Cloning per W3C structured cloning algorithm
 * @returns {Promise<obj>}
 */
const cloneAsync = async (obj) => await (( new StructuredCloner() ).cloneAsync(obj) )



const	classify = (item) => {
	const primitiveType = typeof(item)
	const isFalsey = (item == false)
	let classifier = ''
	switch (primitiveType) {
		case 'string'		: {	classifier = (item == '')  ? 'string::primitive::falsey' : 'string::primitive';	break 	}
		case 'number'		:	{	classifier = (isNaN(item)) ? 'number::primitive::falsey' : 'number::primitive';	break	}
		case 'bigint'		:	{	classifier = 'bigint::primitive';		break	}
		case 'boolean'	:	{	classifier = 'boolean::primitive';	break	}
		case 'symbol'		:	{	classifier = 'symbol::primitive';		break	}
		case 'undefined': {	classifier = 'undefined::primitive::falsey';	break	}
		case 'function'	:	{
			classifier = `function`
			if (item.constructor.name == 'Function') {
				classifier = `${classifier}:class::${item.name}`
			}
			else {
				classifier = `${classifier}:unknown::${item.name}`
				console.error('[classify]: function object unknown')
			}
			break
		}
		case 'object'		: {
			// classification level 1
			if (item == null)	{
				classifier = 'null::primitive::falsey'
				break
			}
			else if (Array.isArray(item)) {
				classifier = 'object::array::iterator'
				break
			}
			else if (item.constructor.name == 'Object') {
				classifier = 'object::simple'
			}
			else {
				classifier = `object::instance::${item.constructor.name}`
			}

			// classification level 2
			if (typeof item[Symbol.iterator] == 'function') {
				classifier =	`${classifier}::iterator`
			}
			else {
				classifier =	`${classifier}::noniterator`
			}
		}	// case
	}	// switch
	return classifier
}  // end of function


function* travelPrototypes(obj) {
	let protoCursor = obj
	while (protoCursor !== null) {  		// this will happen after we've just gone up the 'Object' constructor
		yield {
			name: 	protoCursor.__proto__?.constructor.name ?? 'Object',
			value:  protoCursor, 
			instanceVars: 		Object.getOwnPropertyNames(protoCursor).map((propName)=>({
				propName,
				// type:	tryThis( ()=>typeof(protoCursor[propName])=='object' ? protoCursor[propName]?.constructor.name ?? 'unknown': typeof(protoCursor[propName]),(e)=>`failed get type on prop ${propName}.  Error is: ${e}`),
				type:	_do( ()=>typeof(protoCursor[propName])=='object' ? protoCursor[propName]?.constructor.name ?? 'unknown': typeof(protoCursor[propName]), (e)=>`failed get type on prop ${propName}.  Error is: ${e}`),
			})),
			classMethods:			Object.getOwnPropertyNames(protoCursor.constructor).map((propName)=>({
				propName,
				type:	_do( ()=>typeof(protoCursor.constructor[propName]),(e)=>`failed get type on prop ${propName}.  Error is: ${e}`),
			})),
			instanceMethods: 	Object.getOwnPropertyNames(protoCursor?.__proto__ ?? {}).map((propName)=>({
				propName,
				type: _do( ()=>typeof(protoCursor.__proto__[propName]),(e)=>`failed get type on prop ${propName}.  Error is: ${e}`),
			})),
		}
		protoCursor = protoCursor?.__proto__?.__proto__ ?? null  // advance to the (possibly) next prototype or else... null
	}
}


const __typeof = (item) => {
	if (item === null) return 'null'
	if (item === "") return 'emptyString'
	if (Array.isArray(item)) return `array`
	if (typeof item === 'function') {
		return ( Object.prototype.hasOwnProperty.call(item, "prototype") && !Object.prototype.hasOwnProperty.call(item, "arguments") ) ? 
			`class`
			: ( Object.prototype.hasOwnProperty.call(item, "prototype") && Object.prototype.hasOwnProperty.call(item, "arguments") ) ?
				'pseudoclass'
				: `function`
	}
	return typeof item
}


const __typeofDeep = (item) => {
	const type = __typeof(item)
	if (type === 'function') return`function::${item.name || item.toString().slice(0,200)}`
	if (type === 'class') return `class::` + item.name

	if (type !== 'object') return type

	if (item.constructor.name === 'Object') {
		return `object::${Object.keys(item).toString()}`
	}
	else {
		return `object::${item.constructor.name}`
	}
}


/**
 * @type  { (item: any) => 
 * 	 "primitive:string" 
 * | "primitive:number" 
 * | "primitive:boolean" 
 * | "primitive:symbol" 
 * | "primitive:null" 
 * | "primitive:undefined" 
 * | "primitive:bigint" 
 * | "iterable:array" 
 * | "function:arrow" 
 * | "function:classical" 
 * | "function:async" 
 * | "function:generator" 
 * | "function:async:generator" 
 * | `object:${string}` }
 */
const $typeof = (item) => {
	const type = typeof(item)
	if (item === null) return `primitive:null`
	// if (['string','number','boolean','symbol','undefined','bigint'].includes(type)) return `primitive:${type}`
	if (type==='string'||type==='number'||type==='boolean'||type==='symbol'||type==='undefined'||type==='bigint') return `primitive:${type}`

	if (Array.isArray(item)) return `iterable:array`
	if (typeof item === `function`) {
		if (item.prototype === undefined) {
			return 'function:arrow'
		}
		switch (item.constructor.name) {
			case 'Function': 							return 'function:classical'
			case 'AsyncFunction': 				return 'function:async'
			case 'GeneratorFunction': 		return 'function:generator'
			case 'AsyncGeneratorFunction':return 'function:async:generator'
		}
	}
	if (typeof item === 'object') {
		const type = item.constructor?.name ?? 'ObjectFromNull'
		return `object:${type}`
	}
	throw `$typeof:: bug:  type of item is not accounted for...`
}


/**
 * obj: any object or 
 */
// usage:  [...protoIterator(objA)]
function* protoIterator (obj) {
	if (obj===null || obj===undefined) {
		return null
	}

	let curClass
	if (obj !== null && typeof(obj) ==='object' && obj.constructor.name) { // if obj is a class instance
		yield(`instanceOf:${obj.constructor.name}`)
		curClass = obj.__proto__.constructor
	}
	else {
		curClass = obj
	}
	while (curClass.name) {
		yield curClass.name
		curClass = curClass.__proto__ 
	}
}

/**
 * const typeof2 = (item) => {
 *  	const type = typeof(item)
 *  	if (item === null) return `primitive:null`;
 *  	if (['string','number','boolean','symbol','undefined','bigint'].includes(type)) return `primitive:${type}`
 *  	if (Array.isArray(item)) return `iterable:array`
 *  	if (typeof item === `function`) {
 *  		if (item.prototype === undefined) {
 *  			return 'function:arrow'
 *  		}
 *  		switch (item.constructor.name) {
 *  			case 'Function': 							return 'function:classical'
 *  			case 'AsyncFunction': 				return 'function:async'
 *  			case 'GeneratorFunction': 		return 'function:generator'
 *  			case 'AsyncGeneratorFunction':return 'function:async:generator'
 *  		}
 *  	}
 *  	if (typeof item === 'object') {
 *  		const type = item.constructor?.name ?? 'ObjectFromNull'
 *  		return `object:${type}`
 *  	}
 *  	throw `$typeof:: bug:  type of item is not accounted for...`;
 *  }
 */

const whatis = (item) => {
	const type = __typeof(item)
	if (type === 'symbol') return `symbol::${item.toString()}.  Symbol for: ${ Symbol.keyFor(item) || '(unnamed symbol)' }`
	if (! ['object', 'class', 'pseudoclass', 'function'].includes(type)) return type
	if (type === 'function' ) return`function::(arity:${item.length}) ${item.name || item.toString().slice(0,200)}`
	if (type === 'class' || type === 'pseudoclass') return `${type}::(arity:${item.length}) (protochain:${[...protoIterator(item)].reverse().join(' -> ')})` + item.name
	return `object::(protochain:${[...protoIterator(item)].reverse().join(' -> ')})`
}



/** ValueType - A system of describing data by summarizing its value and its type into an object.
 * functions:
 * 	-	fnName(fn)		- helper - returns function name
 * 	- objType(obj)	- helper - returns object's type based on constructor name
 * 	- fnType(fn)		- helper - returns function type based on constructor name
 * 	-	valueType			- main function - returns a ValueType structure for any piece of data in JS
 *  -	displayValueTypeOf (valueType) - returns a formatted string version of a valueType object
 *  -	displayValueOf (valueType) - returns a string version of the value of an valueType object
 *  -	displayTypeOf (valueType) - returns a string version of the type of a valueType object
 * 
 * @typedef {{
 * 	value: string,
 * 	type: string,
 * }} ValueType
 * 
 */

// display helpers

// utility to determine of item is an ADT.  just classic duck-typing the existence of a method called 'getTypeRep' just because it's an uncommon
const isADT = (item) => typeof(item?.getTypeRep?.()) == 'function'
// utility to determine of item is an ADT.  just classic duck-typing the existence of a method called 'getTypeRep' just because it's an uncommon
const isInspectable = (item) => typeof(item?.inspect) == 'function'


/**@type { (item:any)=>ValueType } */
function valueType(item) {
	const type = typeof (item)
	if (item === null)
		return { value: 'null', type: '' }
	if (item === undefined)
		return { value: 'undefined', type: '' }
	if (type === 'symbol')
		return {
			value: (Symbol.keyFor(item)) ? `Symbol.for(${Symbol.keyFor(item)})` : `Symbol(nokey)`,
			type: 'symbol'
		}
	if (type === 'string') {
		const sizeAdjust = 20
		return {
			value: (item.length > sizeAdjust) ? `${item.slice(0, sizeAdjust / 2)}...${item.slice(-sizeAdjust / 2)}` : `${item}`,
			type: `string(${item.length})`
		}
	}
	if (['number', 'boolean', 'bigint'].includes(type))
		return {
			value: item,
			type
		}
	if (Array.isArray(item))
		return {
			value: arrShape(item),
			type: arrType(item),
			// value: ( item.length == 0 ) ? `[]` : `[${valueType(item[0]).type}]`,
			// type:`Array(${item.length})`
		}
	if (type == 'function')
		return {
			value: fnName(item),
			type: fnType(item),
		}
	//	if (isADT(item)) {
	//	}
	if (type == 'object') {
		if (isADT(item))
			return {
				value: item.valueOf(),
				type: objType(item.value) == 'Object' ? objShape(item) : objType(item),
			}
		return {
			value: item.valueOf(),
			type: objType(item) == 'Object' ? objShape(item) : objType(item),
		}
	}
	return { type: 'unknown', value: 'unknown' }
}


/**@type { (item:any)=>ValueType } */
function valueTypePlain(item) {
	console.log('valueTypePlain')
	const type = typeof (item)
	if (item === null)
		return { value: 'null', type: '' }
	if (item === undefined)
		return { value: 'undefined', type: '' }
	if (type === 'symbol')
		return {
			value: (Symbol.keyFor(item)) ? `Symbol.for(${Symbol.keyFor(item)})` : `Symbol(nokey)`,
			type: 'symbol'
		}
	if (type === 'string') {
		const sizeAdjust = 20
		return {
			value: (item.length > sizeAdjust) ? `"${item.slice(0, sizeAdjust / 2)}...${item.slice(-sizeAdjust / 2)}"` : `"${item}"`,
			type: `string`
		}
	}
	if (['number', 'boolean', 'bigint'].includes(type))
		return { value: item, type }
	if (Array.isArray(item))
		return {
			value: (item.length == 0) ? `[empty]` : `[${valueTypePlain(item[0]).type}]`,
			type: `Array`
		}
	if (type == 'function')
		return {
			value: fnName(item),
			type: fnType(item),
		}
	if (type == 'object') {
		console.log(`item=='object'`)
		const returnVal = {
			value: item.valueOf(),
			type: objType(item) == 'Object' ? objShape(item) : objType(item),
		}
		console.log(`returnVal:`, returnVal)
		return returnVal
	}
	return { type: 'unknown', value: 'unknown' }
}

/**@type {(fn:function)=>string } */
const fnName = (fn) => fn.name || `anonymous:${fn.toString()}`

/**@type {(obj:object)=>string } */
const objType = (obj) => obj.constructor?.name ?? 'unnamed'

/**@type {(obj:object)=>string } */
const objShape = (obj) => `{\n` + Object.entries(obj).map( ([key,val]) => `  ${key}: ${typeof(val)}` ).join(',\n') + '\n}'

/**@type {(fn:function)=>string } */
const fnType = (fn) => (typeof(fn)!=='function') ? `not a function` : ( `${fn?.constructor?.name}` ?? `[fnType: unknown] (${fn})` ) + `(arity:${fn.length})`

/**@type {(arr:Array<any>)=>string } */
const arrType = (arr) => ( arr.length == 0 ) ? `Array(empty)` : `Array(${arr.length})`

/**@type {(arr:Array<any>)=>string } */
const arrShape = (arr) => ( arr.length == 0 ) ? `[]` : `[${valueType(arr[0]).type}]`


/**@type { (valueType:ValueType) => string} */
const displayValueTypeOf = (valueType) => `${valueType.value} <${valueType.type}>`

/**@type { (valueType:ValueType) => string} */
const displayValueOf = (valueType) => `${valueType.value}`

/**@type { (valueType:ValueType) => string} */
const displayTypeOf = (valueType) => `<${valueType.type}>`

/**@type { (value:any) => string} */
const tv = (value) => {
	const vt = valueType(value)
	return `${vt.value} <${vt.type}>`
}


// inspect :: a -> String
// adapted from Mostly adequate guide...
// NOTE: in this file 'iptools_v11.05.html' inspect interferes with the parser's inspect method.  Renamed here.
const inspectItem = (item) => {
	if (typeof(item?.inspect) == 'function') return item.inspect() // delegate to item's 'inspect()' method if it exists...
	if (typeof(item) == 'function') return `${item?.name ?? item}`
	if (Array.isArray(item)) return `[${item.map(inspectItem).join(',')}]`
	if (typeof(item)==='string') return `'${item}'`
	if (item === null) return 'null'
	if (typeof(item)==='object') {
		// at this point, an object can be a user data object (many keys with values), or an instance
		// Each case uses very different code
		const keys = Object.keys(item)

		// if not data object
		if (keys.length==0) return `${item.constructor.name}(${item})`
		// assume data object now
		const ts = keys.map((k) => [k, inspectItem(item[k])])
		return dedent`
		{
			${ts.map((kv) => kv.join(': ')).join(',\n\t')}
		}
		`
	}
	return `${item} !`
//	return String(item)			// default...
}

// move this to DeepValues...

/** inspectDeep  - ADT-aware displaying of data structures
 * 
 *  @type { (item:any, levelLimit:number)=>string } 
 */
const inspectDeep = (item, levelLimit=1) => {
	// ** recursive case ** - recursive case is when underlying value is *NOT* an ADT, is a **non-null** object, and levelLimit > 0 
	if ( levelLimit > 0 && item !== null && typeof item==='object' && !isADT(item) ) {
		// console.log(`pre-recursive case, levelLimit ${levelLimit}, item: ${item}`, {item, valueType:valueType(item), vtp:valueTypePlain(item), } )
		const entries = Object.entries(item)
		const newEntries = entries.map( ([key,val]) => ([ key, `${inspectDeep(val,levelLimit-1)}` ])  )
		const returnVal = Object.fromEntries(newEntries)
		console.log(`post-recursive case, levelLimit: ${levelLimit}, item: ${item}`, {item,  objType:objType(item), objShape:objShape(item), valueType:valueType(item), } )
		return returnVal
	}
	// ** base case #1- any ADT
	if (isADT(item)) {
		// console.log(`base case, ADT:(${item.getTypeRep().name}), levelLimit ${levelLimit}, item: ${item}`, {item,  valueType:valueType(item), vtp:valueTypePlain(item),} )
		return `${item.constructor.name}.of(${tv(item.value)})`
		//return `${item.getTypeRep().name}.of(${inspectDeep(item.value, 1)})`
	}
	if (typeof item == 'function') {
		// console.log(`base case, function (${item.name}), levelLimit ${levelLimit}, item: ${fnType(item)}`, {item, valueType:valueType(item), vtp:valueTypePlain(item),} )
		return `${item.name}`
	}
	// ** base case #2 - any primitive or function
	// console.log(`base case (primitive:${typeof(item)}), levelLimit ${levelLimit}, item: ${item}}`, {item, valueType:valueType(item), vtp:valueTypePlain(item),} )
	return `${item}`
}

////////////////////////////////////////////////////////////////////////////////////////////


const kindOf = (item) => {
	const type = typeof(item)
	if (item === null) return `null`
	if (type === 'symbol') return (Symbol.keyFor(item)) ? `Symbol.for('${Symbol.keyFor(item)}')` : `Symbol`
	if (['string','number','boolean','symbol','undefined','bigint'].includes(type)) return `${type}`
	if (Array.isArray(item)) return `Array`
	if (type === `function`) {
		if (item.prototype === undefined) {
			return 'function'
		}
		switch (item.constructor.name) {
			case 'Function': 							return 'function'
			case 'AsyncFunction': 				return 'function:async'
			case 'GeneratorFunction': 		return 'function:generator'
			case 'AsyncGeneratorFunction':return 'function:async:generator'
		}
		throw `[kindOf]: Bad function classification for ${item}.  Constructor: ${item?.constructor?.name ?? 'no constructor'}`
	}
	if (type === 'object') {
		const objType = item.constructor?.name ?? 'ObjectFromNull'
		return `object:${objType}`
	}
	throw `$typeof:: bug:  type of item is not accounted for...`
}

const kindOf$ = (item) => {
	const type = __typeof(item)
	if (type === 'symbol') return `symbol::${item.toString()} ${ Symbol.keyFor(item) || '(unnamed)' }`
	if (! ['object', 'class', 'pseudoclass', 'function'].includes(type)) return type
	if (type === 'function' ) return`function::(arity:${item.length}) ${item.name || item.toString().slice(0,200)}`
	if (type === 'class' || type === 'pseudoclass') return `${type}::(arity:${item.length}) (protochain:${[...protoIterator(item)].reverse().join(' -> ')})` + item.name
	return `object::(protochain:${[...protoIterator(item)].reverse().join(' -> ')})`
}


const describeShape = (item) => {
	const type = __typeof(item)
	if (! ['object', 'class', 'pseudoclass', 'function'].includes(type)) 
		return console.log( whatis(item) )

	if (type === 'pseudoclass') {
		return console.log(dedent`
			${whatis(item)} 
			Properties (may not be enumerable):
			${Object.getOwnPropertyNames(item)
				.map((key)=> `\t${key}: ${whatis(item[key])}`)
				.join('\n')
			}
			${Object.getOwnPropertySymbols(item)
				.map((symb)=> `\t${symb.toString()}: ${whatis(item[symb])}`)
				.join('\n')
			}
			`
		)
	}

	return console.log(dedent`
		${whatis(item)}
		Properties (the enumerable ones):
		${Object.getOwnPropertyNames(item)
				.map((key)=> `\t${key}: ${whatis(item[key])}`)
				.join('\n')
		}
		${Object.getOwnPropertySymbols(item)
				.map((symb)=> `\t${symb.toString()}: ${whatis(symb)}`)
				.join('\n')
		}
		`
	)
}



const describe = (item) => {
	const type = __typeof(item)
	if (! ['object', 'class', 'pseudoclass', 'function'].includes(type)) 
		return console.log( whatis(item) )

	if (type === 'pseudoclass') {
		return console.log(dedent`
			${whatis(item)} 
			Properties (may not be enumerable):
			${Object.getOwnPropertyNames(item)
				.map((key)=> `\t${key}: ${whatis(item[key])}`)
				.join('\n')
			}
			${Object.getOwnPropertySymbols(item)
				.map((symb)=> `\t${symb.toString()}: ${whatis(item[symb])}`)
				.join('\n')
			}
			`
		)
	}

	return console.log(dedent`
		${whatis(item)}
		Properties (the enumerable ones):
		${Object.getOwnPropertyNames(item)
				.map((key)=> `\t${key}: ${whatis(item[key])}`)
				.join('\n')
		}
		${Object.getOwnPropertySymbols(item)
				.map((symb)=> `\t${symb.toString()}: ${whatis(symb)}`)
				.join('\n')
		}
		`
	)
}


/** **WIP** Outputs typescript */
const describeAsTs = (item) => {
	console.error(`[describeAsTs]: this is a work in progress.  Right now it's just a clone of 'describe'`)
	const type = __typeof(item)
	if (! ['object', 'class', 'pseudoclass', 'function'].includes(type)) 
		return console.log( whatis(item) )

	if (type === 'pseudoclass') {
		return console.log(dedent`
			${whatis(item)} 
			Properties (may not be enumerable):
			${Object.getOwnPropertyNames(item)
				.map((key)=> `\t${key}: ${whatis(item[key])}`)
				.join('\n')
			}
			${Object.getOwnPropertySymbols(item)
				.map((symb)=> `\t${symb.toString()}: ${whatis(item[symb])}`)
				.join('\n')
			}
			`
		)
	}

	return console.log(dedent`
		${whatis(item)}
		Properties (the enumerable ones):
		${Object.getOwnPropertyNames(item)
				.map((key)=> `\t${key}: ${whatis(item[key])}`)
				.join('\n')
		}
		${Object.getOwnPropertySymbols(item)
				.map((symb)=> `\t${symb.toString()}: ${whatis(symb)}`)
				.join('\n')
		}
		`
	)
}


/** pretty 
 * - used for logging.console of object values to output that can be copy/pasted 
 * into a text file without control characters.
 * 
 * @usage (from console):
 * 
 * pretty.log({var1, var2, var3...})  // prints a serialized JSON.stringified output that can be copied/pasted
 * 
 * then, at a later time, from the console:
 * 	
 *   const newvar = pretty.load(`text string of object that was previously copied`)
 * 	 // 'newvar' now contains the object properly preserved, including undefined values
 * 
 *   unpackInto(globalThis)(newvar) - unpacks keys into global variable names ba
*    // unpacks each key into globalThis to be used as independent variables names from console
*/

const pretty = {
	log: (anyval) => console.dir(pretty.string(anyval)),
	string: (anyVal) => JSON.stringify(serialize(anyVal), null, 2),
	load: (stringifiedJsonStr) => deserialize(JSON.parse(stringifiedJsonStr)),
}




const randomIntegers = (count, digits) => {
	const returnVal = []
	for (let c=0;c<count;c++) returnVal.push(Math.floor(Math.random()*10**digits))
	return new Uint32Array(returnVal)
}


function* generateRandomStrings(length=100, count=10) {
	function randomString(length=10) {
		const chars = [
			`abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*(){}`,
			`\n`,
			`\n`,
			`\n`,
			`\t`,
		].join('')
	
		const charLength = chars.length
		let result = ''
		for ( var i = 0; i < length; i++ ) {
			result += chars[Math.floor(Math.random() * charLength)]
		}
		return result
	}
	
	
	for (let c=0; c<count; c++) {
		yield randomString(length)
	}
}



export {
	strHash,
	stringify,
	orderedProps,
	deepCopy,
	deepCopy as deepCopy_safe,
	deepEqual,
	deepEqual_v2,
	deepEqualFast,
	deepEqualFast_v2,
	mergeDeep,

	serialize,
	deserialize,

	
	kindOf,
	kindOf$,
	classify,
	inspectItem,
	inspectDeep,
	__typeof,
	__typeofDeep,
	_typeof,
	describe,
	describeShape,
	describeAsTs,
	objMerge,
	cloneAsync,
	pretty,

	$typeof,
	arrHash,
	arrShape,
	arrType,
	displayTypeOf,
	displayValueOf,
	displayValueTypeOf,
	hashOf,
	dsHash,
	dsHash2,
	digestMessage,
	fnType,
	fnName as functionName,
	tv
}

