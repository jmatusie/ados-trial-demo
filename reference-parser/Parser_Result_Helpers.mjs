// @ts-check
/** Parser_Result_Helpers - mashup for the purpose of conslidating various utilities related to processing
 *  the results of parsers.  This really needs a lot of cleanup, as there are a number of functions that should not be
 *  limited to Parser results, but any type of data processing.
 */

import { groupBy, groupByPropName, col} from "./Column_And_Array_Predicates.mjs"
import { deDupShallow } from "./DataSet_Dedup_and_Sets.mjs"
import { fail, succeedWith } from "./Parser_Core.mjs"
import { arr, is, not, obj, match } from "./Pattern_Matching.mjs"
import { CSV } from "./ClassCSV.mjs"
import {
	// older object flattening routines
	flattenObjByPropName_replace_curried,
	flattenObjByPropName_replace,
	flattenAll_replace,

	flattenObjByPropName_retain_curried,
	flattenObjByPropName_retain,
	flattenAll_retain,

	flattenObjByPropName_retainAll,
	flattenAll_retainAll,

	// older array multplication routines
	expandObjFromSubArray,
	multiplyItemByArrayProp2,
	multiplyObjByArraySubPropName,
	multiplyObjByArraySubPropName_curried,

	// newer object flattening routines
	// newer object flattening routines
	flattenItemOnProps,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,

	// newer array multiplication routines
	multiplyBy,
	multiplyByZ,
	multiplyBy_v2,
	multiplyBy_v2_lossy,
	multiplyByND,
} from "./Object_Flattening.mjs"


import { 
	innerJoin,
	innerJoin2,
	innerJoin3,
	leftJoin,
	leftJoin2,
	leftJoin3,
	leftJoin4,
	leftJoin5,
	equiJoin2,
	outerJoin,
	outerJoin2,
} from "./Functional_Database.mjs"

/////////////////////////////////////////////////////////////////////////////////////////////////
/** Borrowed from module "ArrayFunctionalUtils" **/
/////////////////////////////////////////////////////////////////////////////////////////////////


// convert common array methods to pure (and curried) functions
const mapArray = (mapFn) => (array) => Array.isArray(array) ? array.map(mapFn) : (console.warn(`[mapArray]: value not array`), array)
const flatMapArray = (tlFn) => (array) => Array.isArray(array) ? array.flatMap(tlFn) : (console.warn(`[flatMapArray]: value not array`), array)
const filterArray = (predicateFn) => (array) => Array.isArray(array) ? array.filter(predicateFn) : (console.warn(`[filterArray]: value not array`), array)
const flattenArray = (array) => Array.isArray(array) ? array.flat() : (console.warn(`[flattenArray]: value not array`), array)
const flattenArrayN = (N_levels) => (array) => Array.isArray(array) ? array.flat(N_levels) : (console.warn(`[flattenArrayN(${N_levels})]: value not array`), array)
const joinWith = (delimiter) => (array) => Array.isArray(array) ? array.join(delimiter) : (console.warn(`[joinWith]: value not array`), array) 
const sortArray = (sortFn) => (array) => Array.isArray(array) ? [...array].sort(sortFn): (console.warn(`[joinWith]: value not array`), array) 
const reverseArray = (array) => (array) => Array.isArray(array) ?  [...array].reverse() : (console.warn(`[joinWith]: value not array`), array)
const arrayLength = (array) => array.length

/** pipe & compoose
			 * 	Usage:
			 * 		const runstuff = (x, y) = compose ( fn1(x), fn2(y), fn3, etc )
			 * 		const runstuff = (x, y) = pipe( fn1(x), fn2(y), fn3, etc )
			 */
const compose = (...fns) => (...args) => fns.reduceRight((res, fn) => [fn.call(null, ...res)], args)[0]
const pipe = (...fns) => (x) => fns.reduce( (y, f) => f(y), x )		
	

/** 
 * @template T
 * @typedef { <T>(param0:T)=>Boolean } PredicateFn<T> 
 */


/** zip
 * take two arrays of same length (or first is one larger),
 * and return a merged array like a zipper, starting with first element of arr1 
 * 
 * 	zip ::	[items1] => [items2] => [items]
 */
const zip = (arr1) => (arr2) => arr1.flatMap((item, idx) => [item, arr2[idx]])


/** bifurcateArray -runs a predicate over the entire array and return a two-element array, each its own array 
 *	- result[0] contains all array items that passed the filter
 *  - result[1] contains all failures
 *
 * bifurcateArray  :: (predicateFn: item->boolean) -> [items] -> [ [passedItems], [failedItems] ]
 */

/** 
 * @template T
 * @param {(param0:T)=>boolean} predicateFn
 * @returns {(array: Array<T>) => [Array<T>, Array<T>]}
 */
const bifurcateArray = (predicateFn) => /**@param {Array<T>} array */ (array) => array.reduce( 
	/**@param { [T[],T[]] } resultArray */
	(resultArray, item) => {
		resultArray[Number(!predicateFn(item))].push(item)    // using Number turns boolean into 0 or 1 for array index
		return resultArray
	}, [[], []]
)


/** 
 * @template T
 * @param {(param0:T)=>boolean} predicateFn
 * @param {T[]} array
 * @returns {[Array<T>,Array<T>]}
 */
const bifurcateArray_noncurried = (predicateFn, array) => array.reduce(
	/** @param { [T[], T[]] } resultArray */(resultArray, item) => {
			resultArray[Number(!predicateFn(item))].push(item); // using Number turns boolean into 0 or 1 for array index
			return resultArray;
	}, [[], []]
);



/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////


/** consolidate :: string, string -> dsArray -> dsArray
 * 
 * consolidate is a deduplication operation on a dsArray, but can be considered almost the opposite of multiplyBy
 * 
 * Sometimes when deduplicating a dsArray based on a prop, or group of props, you might lose information because the 'duplicates'
 * might contain a property (or multiple properties) whose values you might to conserved in some way.
 *
 * Fun facts:
 * 	- Similar in implementation to groupBy
 * 	- Similar in behavior to deDupBy
 *	- Inverse operation to multiplyBy (approximately)
 * 
 */

const consolidate = (dedupByPropName, conservedPropName) => (dsArray) => {
	const results = dsArray.reduce((accObj, dsItem) => {
		const bucketName = dsItem[dedupByPropName]
		const { [conservedPropName]: conservedValue, ...consolidatedRecord } = dsItem

		if (accObj[bucketName] == null) {
			accObj[bucketName] = consolidatedRecord
		}
		if (accObj[bucketName][conservedPropName] == null) {
			accObj[bucketName][conservedPropName] = []
		}

		// accObj[bucketName] ??= consolidatedRecord
		// accObj[bucketName][conservedPropName] ??= []
		accObj[bucketName][conservedPropName].push(conservedValue)
		return accObj
	}, {})
	return results
}


// like consolidate, but with an item classifierFn
// itemClassifierFn :: dsItem -> string     // e.g - value of a :  fn = propName => item=> item[propName]



/** 
 * @template T
 * @param {(param0:T)=>keyof T} itemClassifierFn
 * @param {keyof T} conservedPropName
 * @returns { (array: Array<T>) => Record<keyof T, T> }
 */

/**
 * @template T
 * @param {(item: T, index: number) => string} itemClassifierFn - Function to classify items.
 * @param {keyof T} conservedPropName - Property name to be conserved and collected.
 * @returns {(dsArray: T[]) => Array<Omit<T, keyof T> & { [K in keyof T]: T[K][] }>}
 */
const consolidateBy = (itemClassifierFn, conservedPropName) => (dsArray) => {
	const results = dsArray.reduce((accObj, dsItem, index) => {
		const bucketName = itemClassifierFn(dsItem, index)    																// like function 'groupBy'
		const { [conservedPropName]: conservedValue, ...consolidatedRecord } = dsItem 				// remove prop named 'conservedPropName'
		
		// accObj[bucketName] ??= consolidatedRecord
		if (accObj[bucketName] == null) accObj[bucketName] = consolidatedRecord
		// accObj[bucketName][conservedPropName] ??= []
		if (accObj[bucketName][conservedPropName] == null) accObj[bucketName][conservedPropName] = []
	
		accObj[bucketName][conservedPropName].push(conservedValue)
		return accObj
	}, {})
	return Object.values(results)
}


// alternative to 'multiplyBy(propName)' - instead of expanding the number of items in the array due to a prop that's an array,
// this function does a string join on the contents of the array.  
const joinBy = (propName, delim = ',') => (dsItem) => ({ ...dsItem, [propName]: (dsItem?.[propName] ?? []).join(delim) })


// for point-free use in map functions which return a dsArray
// Signature:  [dataItem] -> flattenDataSet -> [flattenedDataItem]
const flattenDataSet = (dsArray) => dsArray.map(flattenAll_replace)


// for use in "possibly" parsers to normalize output
// Signature:  null or string -> nullToStr -> '' or string
const nullToStr = (result) => (result === null) ? "" : result

// for use in "possibly" parsers to assign a default if the result is empty
const nullToValue = (result) => (value) => (result === null) ? value : result

const toBoolean = (result) => (result === null) ? false : true

// Signature:  null or [nonemptyArray A] -> nullToArray -> [] or [nonemptyArray A]
const nullToArray = (result) => (result === null) ? [] : result

const nullToObject = (result) => (result === null) ? {} : result

/** ifNotFound (mapFn used with possibly & similar parsers)
 * 
 * A mapFn used with parsers that might never fail, but might return null or a result (i.e. 'possibly')
 * 
 * Usage examples: 
 * 
 * Form 1 (single argument)
 *   // if possibly(lookAhead(interfaceDesc)) returns null (i.e. not found), set the value to empty string
 *   // otherwise, use the result of 
 *   possibly(lookAhead(interfaceDesc)).map(ifNotFound('')).tag('intDesc')
 * 
 *  Form 2: two arguments:
 *   // if possibly(find(/\n\s+shutdown/)) returns null (i.e. not found), set the result to 'no',
 *   //  otherwise, set the result to 'yes'
 *   possibly(find(/\n\s+shutdown/)).map(ifNotFound('no', 'yes')).tag('isShut')
 * 
 * @type { <T>(valueIfNull:T, valueIfResult?:T|null) => (result:T|null) => T }
 */ 
const ifNotFound = (valueIfNull, valueIfResult=null) => (result) => result==null  ? valueIfNull : (valueIfResult ?? result)



// for use in "possibly" parsers to normalize output
 /**
  * @template T
	* @typedef {  (result:T|null) => T } NullResultConverters<T> 
  */

/**
 * * @typedef {  (<T>result:T|null) => T } NullResultConvertersB<T> 
 */

/** @type {NullResultConvertersB<string>} */
const asString = (result) => (result == null) 	? "" 		: `${result}`
/** @type {NullResultConvertersB<string>} */
const asNumber = (result) => (result == null) 	? "0" 	: `${result}`
/** @type {NullResultConvertersB<boolean>} */
const asBoolean = (result) => (result == null) 	? false : true
/** @type {NullResultConvertersB<Array>} */
const asArray = (result) => (result == null) 		? [] 		: [result].flat()



/**** Schema Normalization  ****/


// discovers every first-level property name in an array of objects returns a the union of all property names
// discoverSchema :: [object] -> [string]
const discoverSchema = (objArray=[]) => {
	const allKeys = objArray.map((item) => Object.keys(item)).flat()
	return [...new Set(allKeys)]				// dedup any identically-schema'd records
}


// creates a blank object with all properties in the supplied list of names
// createObjectTemplateFrom :: [string] => dsItem
const createObjectTemplateFrom = (...propList) => Object.fromEntries(propList.flat().map((dsItem) => [dsItem, '']))


// adds new prop names (blank values) to an existing object for the purposes of data normalization
// applyTemplateObj :: dsItem => dsItem => dsItem 
const applyTemplateObject = (template) => (dsItem) => ({ ...template, ...dsItem })


// applySchema :: [string] => dsArray
const applySchema = (...columnNames) => (objectArray) => objectArray.map((dataItem) => ({ ...createObjectTemplateFrom(columnNames.flat()), ...dataItem }))


// 	previously called "normalizedDataSet" & "setSchemaAuto"
//	setSchemaAuto :: [Object] => dsArray
const applySchemaAuto = (objectArray) => {
	const templateObject = createObjectTemplateFrom(discoverSchema(objectArray))
	return objectArray.map((item) => ({ ...templateObject, ...item, }))
}

const normalizedDataSet = applySchemaAuto

//	setSchemaAuto :: [Object] => dataTableObject
const normalizedDataTable = (objectArray) => {
	const header = discoverSchema(objectArray)
	const template = createObjectTemplateFrom(header)
	const normalizedData = objectArray.map(applyTemplateObject(template))
	// const rows = objectArray.map(normalizedData).map((dsItem) => Object.values(dsItem))
	const rows = objectArray.map((dsItem) => Object.values(dsItem))
	return {
		header,
		rows
	}
}

// takes an array of similar objects, finds all common keys, returns a structure containing two properties:
//		1) header: an array of all the discovered collective key names in the dataset
//		2) dataSet: a normalized dataSet where all items have the same common keys, filling all missing
// 				keys with a ''
// tableFromDataSet :: dsArray -> DataTable
const tableFromDataSet = (dsArray) => {
	const headerArray = discoverSchema(dsArray)
	const templateObj = createObjectTemplateFrom(headerArray)
	const normalized = dsArray.map((dsItem) => Object.assign({ ...templateObj }, dsItem))
	const table = {
		header: headerArray,
		rows: normalized.map((dsItem) => Object.values(dsItem))
	}
	return table
}


// promoteTableHeader :: DataTable -> DataTable
const promoteTableHeader = (dataTable) => {
	return (dataTable.header && dataTable.rows && dataTable.rows.length > 0) ?
		{
			header: dataTable.rows[0],
			rows: dataTable.rows.slice(1)
		}
		: dataTable
}



/** Output Mapping helpers  **********************
*		used as helpers inside of .map() methods to transport/reshape the output of results
*/
/** wrapInStrings:   parser output mapping helper
*		@param lstr: string to prepend to a result
*		@param rstr: string to append  to a result
*		@param parserResult: any result from a parser (can be a string, array, or null)
*		@return: if parseResult is not an array, returns a string value of the parseResult (wrapped empty string if parseResult is null).
						 if parseResult is an array, returns a array of wrapped values
*/
const wrapInStrings = (lstr, rstr) => (parserResult) => {
	if (is.array(parserResult)) return parserResult.map((x) => `${lstr}${x ? x : ''}${rstr}`)
	else return `${lstr}${parserResult ? parserResult : ''}${rstr}`
}


/** dataSetToCSV:   parser output mapping helper
*		parameter: parseResult
*		returns: depending on the type of 'item': a wrapped string, an array of wrapped results, or null	
*/
const dataSetToCSV = (parserResult) => {
	if (!parserResult) return '[dataSetToCSV] ERROR: invalid dataset supplied'
	if (is.array(parserResult)) {
		if (parserResult.length === 0) return '[dataSetToCSV] ERROR: dataset was empty'
		else return new CSV().import_dsArray(parserResult).stringify()
	}
	return `[dataSetToCSV] ERROR: invalid dataset supplied...value: ${parserResult}`
}



/** createDataSet - like 'multiplyBy' but for objects with multiple datasets attached
 * 									or - an alternate to multiplyBy (albeit less efficient)
 * @param {string} propName - the name of the property of obj (expected to be an array)
 * @param {object} obj - the object which will be multiplied by the array to create the data dataSet
 * @return {Array<object>} - an array of homogenous objects (i.e. dsArray) or DataSet
 * 
 * 'createDataSet' is used for post-processing of parser results, where you end up with a single primary object, 
 * and one or more orthogonal arrays underneath it.  This function selects the array chosen (by 'prop'), and
 * throws away all other arrays.  For example, in parsing BGP output, in addition to a single object representing 
 * the main BGP parameters, you also have: 
 * 		1) a list of neighbors
 * 		2) a list of networks
 * 		3) a list of aggregate addresses
 * Each of these are sub-arrays independent of the others, so it's not practical to multiply the entire thing into
 * an enormous dataSet.  So you have to choose one, and then do a multiplyBy on the selected dataSet.
 * 
 */
const createDataSet = (propName) => (dsItem) => {
	// early exit if selected tag is not an array, or if the array is empty - return the object in an array
	if (not(is.array(dsItem?.[propName])) ?? arr.notEmpty([propName])) return [dsItem]
	const intermediateResult = Object.fromEntries(Object.entries(dsItem).filter(([key, val]) => (key === propName) || is.nonIterableObj(val)))
	return multiplyBy(propName)(intermediateResult)
}

// more domain-specific functions to extract customer name from various ACLs
// these need to be more thoroughly tested
//extractCustName_fromNatAcl = aclName => aclName.match(/(FILTER-\w\w-|FILTER-)([A-Z]+)-*(.*)(-A|-B|-MULTICAST)/)?.[2] ?? ''
const extractCustName_fromMcAcl = (aclName) => aclName?.match(/(FILTER-\w\w-|FILTER-)([A-Z]+)-*(.*)(-A|-B|-MULTICAST)/)?.[2] ?? aclName ?? ''
const extractCustDesc_fromMcAcl = (aclName) => aclName.match(/(FILTER-\w\w-|FILTER-)([A-Z]+)-*(.*)(-A|-B|-MULTICAST)/)?.[3] ?? ''
const extractCustName_fromSecAcl = (aclName) => aclName.match(/(SECURITY-\w\w-|SECURITY-)([A-Z]+)-*(.*)(-IN)/)?.[2] ?? aclName ?? ''
const extractCustName_fromSecurityAcl = (aclName) => aclName?.split('-')[1] ?? aclName ?? ''
const extractCustDesc_fromSecurityAcl = (aclName) => aclName?.match(/(SECURITY-\w\w-)([A-Z]+)-*(.*)(-A|-B|-MULTICAST)/)?.[3] ?? aclName ?? ''
const extractCustName_fromTransitIntf = (intfDesc) => intfDesc.match(/TRANSIT-TO-(\w+)/)?.[1] ?? intfDesc.match(/TRANSIT-(\w+)/)?.[1] ?? ''


// to be used with Array.reduce(...)
const arrayToCSV = (result = "", item) => `${result},${item}`


const json_fromValue = (value) => JSON.stringify(value, null, 2)



/** parseError :: {Error} -> {object}    ; parse JS Error objects for details (Chrome/Chromium only)
 * @param {Error} error - a JS error Object to parse
 * @returns {object} 	- contains original error, error type, error message, and parsed stack entries with error locations, 
 */
function parseError(error) {
	const [header, ...lines] = error.stack.split('\n')
	const { type = 'N/A', message = 'N/A' } = header.match(/(?<type>.*):(?<message>.*)/)?.groups ?? 'error'
	const stackEntries = lines.map((entry) => entry.match(/\s*at\s*(?<fn>[A-Za-z_$]+|<anonymous>).*:(?<row>\d+):(?<col>\d+)/)?.groups ?? 'error')
	return { err: error, type, message, stackEntries }
}

function printErrorStack(error) {
	const [header, ...lines] = error?.stack?.split('\n') ?? [null, null]
	if (!header) return '[printErrorStack] error'
	const { type = 'N/A', message = 'N/A' } = header.match(/(?<type>.*):(?<message>.*)/)?.groups ?? 'error'
	const stackEntries = lines.map((entry) => entry.match(/\s*at\s*(?<fn>[A-Za-z_$]+|<anonymous>).*:(?<row>\d+):(?<col>\d+)/)?.groups ?? 'error')
	return stackEntries.map(
		(entry) => match(entry)
			.when(is.string).return(entry)
			.when(is.object).return(`fn:${entry?.fn ?? '?'}, row:${entry?.row ?? '?'}, col:${entry?.col ?? '?'}`)
			.else('cannot print stack entry - check console instead')
	).join('\n')
}









/** mapFn_resolvePeers
 *
 *	This is a very domain-specific function, used in a very specific context.  It belongs in the module called
 *    arista_cfg_bgpAllPeers_v11, but so much work & debugging went into it, I wanted to save it here.  The
 *		function is a mapFn, so it's called after the parsing of bgpPeers is completed, when there are peer groups.
 *
 *  Takes a list of real peers (with IPs) that reference peer-groups, and adds the peer-group parameters to it.  
 * 	When both peer IP and peer-groups have the same parameter, the peer IP assumes priority.
 * 
 *  The complexity of this function stems from the flexibility of the CLI w/regards to peer-groups & peers, which this 
 *  parser has to match the intention.
 *  
 *  This function expects an object with two lists: peerTemplates and bgpPeers.  
 *    peerTemplates contains all BGP neighbor attributes for a peer group (peerIP is the peer group name)
 *    bgpPeers contains all BGP neighbor attriburtes for an actual peer (peerIP is an IP address string)
 *    bgpPeers can be broken into two sub-types: 
 *			1) those peers that do not belong to a peer-group (i.e. no template resolution needed)
 *			2) those peers that belong to a peer-group, and need to be further resolved by the supplied template
 *    Note that depending on the text, the parser may find a peer with an IP address that is both resolved and unresolved, 
 *    This would not happen if the parser were context-based (i.e. for each IP address, parse the rest of the record for that IP
 *    address with a sub-parser, until the next line no longer contains that IP address.  However, currently, the bgpPeer parser
 *    treats each line independently, so it cannot tell if a neighbor x.x.x.x peer group TEST and the following neighbor x.x.x.y remote-as 
 *    is the same neighbor or a different neighbor, so it collects the first as an 'unresolved' and the second (incorrectly) as 'resolved'
 *    because it didnn't realize the line above it was part of the same neighbor.
 *    
 *    Hence, for now, we need to look for duplicates between resolved and unresolved, and merge them.  Because of this,
 *    function objMerge was written, and to handle a custom handling of duplicate properties, so the better value does not get
 *    overwritten by a null, a plug-in for objMerge is written (propMerge1)
 *   
 *	Really, the bgpPeer parser may be better written as a monadic context-based parser.
 */
const mapFn_resolvePeers = ({ peerTemplates, bgpPeers }) => {

	// create a lookup table for peers that reference peer-group templates
	const [resolved, unresolved] = bifurcateArray((peer) => peer.peerType == 'resolved')(bgpPeers)

	// create caches to deal with the 3 different types of bgpPeer records
	const templateCache = new Map()
	const resolvedPeerCache = new Map()

	// build the templateCache from the supplied 'peerTemplates' list.  Note that in peerTemplates, each object's key is the 
	// peer-group name (tagged as 'peerIP' due to the fact that we're not using a context-based parser for bgpPeer)
	peerTemplates.map((peer) => { templateCache.set(peer.peerIP, peer) })

	// using the templateCache, resolve each bgpPeer in the unresolved list, by looking up the peer's peerGroup, and applying template attributes to them
	const newResolved = unresolved.map((unresolvedPeer) => ({
		...templateCache.get(unresolvedPeer.peerGroup), 				// template data
		...unresolvedPeer, 																			// merge with unresolved data (these props replaced template props)
		peerType: 'resolved_via_peerGroup'												// change peerType for informational purposes  
	}))

	// builds a resolved neighbor cache, where the key is the neighbor IP address (peer is an IP address string)
	// yes - .map is used and it should be for, but should be OK
	newResolved.map((peer) => {
		resolvedPeerCache.set(peer.peerIP, peer)
	})

	// This is the part of the code that is messy, to handle for duplicate peer IPs between 'resolved', and 'unresolved'
	// add 'resolved' to the newResolved map.  There could be duplicates (which is why we're bothering with a Map data structure in the first place for ).
	resolved.map((peer) => {
		if (resolvedPeerCache.has(peer.peerIP)) {
			const duplicatePeer = resolvedPeerCache.get(peer.peerIP)
			const fullyResolvedPeer = { ...duplicatePeer, ...peer }
			// const fullyResolvedPeer = objMerge(duplicatePeer, peer, propMerge1)
			resolvedPeerCache.set(peer.peerIP, fullyResolvedPeer)
		}
		else {
			resolvedPeerCache.set(peer.peerIP, peer)
		}
	})

	return [...resolvedPeerCache.values()]
}



/** interface classification utilities
 *	A set of mapFns to classify the output of the raw interface parser into use-case
 *	specific formats (i.e. l3, l2, l1, ptp, etc)
 *  
 *  The classifers are based on the interface classification system as defined in teh standards page per the link below:
 *  Links to standards:
 *    https://tnsius.sharepoint.com/sites/TEAM-IPE-FSD/_layouts/OneNote.aspx?id=%2Fsites%2FTEAM-IPE-FSD%2FShared%20Documents%2FDesign%2FStandards%2Fdraft%20standards%2FXpress%20Network%20Standards&wd=target%282%20-%20Configuration%20Standards%2F2.2%20-%20Interfaces%20and%20Handoffs.one%7C4A9CF673-EDB5-44C9-ADC7-647028FBF560%2F2.2.0%20-%20Interface%20Type%20Classification%7C0BE1C2C2-7FA5-4078-B6A2-C3F4A66557F0%2F%29
 *    onenote:https://tnsius.sharepoint.com/sites/TEAM-IPE-FSD/Shared%20Documents/Design/Standards/draft%20standards/Xpress%20Network%20Standards/2%20-%20Configuration%20Standards/2.2%20-%20Interfaces%20and%20Handoffs.one#2.2.0%20-%20Interface%20Type%20Classification&section-id={4A9CF673-EDB5-44C9-ADC7-647028FBF560}&page-id={0BE1C2C2-7FA5-4078-B6A2-C3F4A66557F0}&object-id={354B8807-5256-44C3-B4CD-D1EAF248F35D}&C1
 *
 *	The classifiers implemented here are:
 *		1 - intf_hwType
 *  	2 - intf_portMode
 *		3 - intf_ipType
 *		4 - intf_cfgState
 */
const intf_classifyBy = {
	// Note: reports 'admin-up' as default (for Arista) if no explicit 'shutdown' or 'no shutdown' command is parsed
	// cfgState: ({ name, explicit_noshutdown, explicit_shutdown, ...rest }) => ({
	// 	name,
	// 	cfgState:
	// 		(explicit_noshutdown) ? 'admin-up'
	// 		: (explicit_shutdown) ? 'admin-down'
	// 		: 'admin-up',
	// 	...rest
	// }), 		// end of function classifyBy.operState

	cfgState: ({ name, explicit_noshutdown, explicit_shutdown, ...rest }) => {
		const returnVal = {
			name,
			cfgState:
			(explicit_noshutdown) ? 'admin-up'
			: (explicit_shutdown) ? 'admin-down'
			: 'admin-up',
			...rest
		}
		return returnVal
	},
	// end of function classifyBy.operState

	hwType: ({ name, ...rest }) => {
		const returnVal = {
			name,
			type:
			name.split('.').length > 1 ? 'subint'
			: /management/i.test(name) ? 'management'
			: /channel/i.test(name) ? 'ethernet-channel'
			: /ethernet/i.test(name) ? 'ethernet'
			: /loopback/i.test(name) ? 'loopback'
			: /vlan/i.test(name) ? 'svi'
			: /vxlan/i.test(name) ? 'vxlan'
			: /tunnel/i.test(name) ? 'tunnel'
			: 'unclassified',
			...rest,
		}
		return returnVal
	}, 		// end of function classifyBy.hwType

	portMode: ({ name, type, explicit_noswitchPort, ...rest }) => ({
		name,
		type,
		portMode:
			(type == 'loopback') ? ''
			: explicit_noswitchPort ? 'L3'
			: type == 'subint' ? 'L3'
			: type == 'svi' ? 'L3'
			: 'L2',
		...rest,
	}), 		// end of function classifyBy.portMode
	
	ipType: ({ name, ip_addr, ip_masklen, ...rest }) => {
		// early return if no ip address field is present
		if (is.empty(ip_addr)) return { name, ip_addr, ip_masklen, ipType: '', ...rest }
		return {
			name,
			ip_addr,
			ip_masklen,
			ipType:
				is.empty(ip_addr) ? ''
				: parseInt(ip_masklen) == 32 ? 'loopback'
				: parseInt(ip_masklen) >= 30 ? 'transit'
				: parseInt(ip_masklen) >= 29 ? 'hybrid'
				: 'access',
			...rest
		}
	}, 		// end of function classifyBy.ipType
}






/*******************************************************************
		/****** datatable to HTML  *****************************************
		/*******************************************************************/

// render data tables to HTML strings
const tableHeaderColsToHTML = (tableHeaderArr) => `<td>index</td>` + tableHeaderArr.map((item) => `<th>${item}</th>`).join('')

const tableRowToHTML = (tableRowArr) => tableRowArr.map((item) => String.raw`<td class="cell-wrap-text">${item}</td>`).join('')	// .join('') is necessary or else commas are returned between elements

const tableBodyToHTML = (tableBodyArr) => tableBodyArr.map((item, index) => String.raw`<tr><td>${index}</td>${tableRowToHTML(item)}</tr>`).join('')

/** 
		 * a dataTable is an object with the following properties:
		 *
		 *    	header:  array of strings (column headers)
		 *			rows:		array of arrays (array of column data)
		 *		
		 *		Where the number of elements in the header is equal to the number of elements in each row
		 */
const dataTableToHTML = (table) =>
	`<table id='iptools-results-table' class="output-channel-item" tabIndex="0">
				<thead><tr>${tableHeaderColsToHTML(table.header)}</tr></thead>
				<tbody>${tableBodyToHTML(table.rows)}</tbody>
	</table>`


/** promote_dataLog_to_result   (a mapStateFn)
	 *
	 * 		Called within .mapState as it <parser>.mapState(promote_dataLog_to_result), this function
	 *    converts the current result and dataLog (which is output from user's .log() methods or tracing output),
	 * 		and maps the result to an object { result, dataLog }
	 *   
	 * 	Intended to be called at the very end of a module. 
	 *
	 *  NOTE: because this is a mapStateFn (i.e. (state)=>(state), it's inherently unsafe, so care must be taken
	 *		to ensure the integrity of the state object.  Note below that the dataLog is pulled out of the state
	 *		in the parameter and added back in under result, but a new empty dataLog field is added, because it's 
	 *    a core part of this state implementation.
	 *
	 */
const promote_dataLog_to_result = ({ result, dataLog, ...state }) => ({ ...state, dataLog: [], result: { dataLog, result } })


// example: object destructuring for Arrays:
//const csvLine = '1997,John Doe,US,john@doe.com,New York';
// { 2: country, 4: state } = csvLine.split(',')

// uses 'comma trick' in a JS statement to return 'result'
const logResult = (name) => (result) => (console.log(`\nLogging result name: ${name}: \n\t`, result), result)


/***************** Data manipulation functions used within Parser.map()  *****/
// NOTE: some of these are junk...need to review all, (carefully) toss what's not needed and keep the rest.




// experimental - 
// intended for output of arrays of dissimilar parser items that can be
// encountered in arbitrary order - particularly the tagged output of:
//	 many(oneOf(parser1, parser2, ...etc))).map(groupByTag)
const groupByTag = (taggedList) => {
	return groupByPropName('tag')(taggedList)
}

// arbitrarily add information tag to the result
//const setTag = (tagName, tagVal='') => (result) => addProp_withDefaultValue(tagName)(tagVal) (result) 
const addTag_prev = (tag, value = true) => (result) => Array.isArray(result) ? ({ [tag]: value, result }) : ({ [tag]: value, ...result })
const addTag = (tag, value=true) => (result) => Array.isArray(result) ? [{tag,value}, ...result] : ({ [tag]: value, ...result })

// utilty function used by getTagged
const flattenTagged = (obj, item) => ({ ...obj, [item.tag]: item.value })


// for use inside Parser.map(...) - takes either an array of tagged objects(from sequenceOf()), 
// or a single tagged object, then returns an array of untagged objects or an untagged object.
//
// **IMPORTANT** 
//		If run against an array, this function assumes the array has ***UNIQUE*** tags.  
// 		For a tagged array with *** NON-UNIQUE*** tags, use 'collectTaggedItems'
const getTagged = (result) => {
	const taggedResults = is.array(result) ?
		result.filter((item) => (item && item.tag)).reduce(flattenTagged, {})
		: ({ [result.tag]: result.value })
	return taggedResults
}

// takes in an array of tag/value objects (form is [ {tag, value} ] ), and returns a single object, organized by the tag
// all values are put into an array
// **IMPORTANT** 
//		This function is designed for arrays with *** NON-UNIQUE *** tags. 
// 		For a tagged array with *** UNIQUE*** tags, use 'getTagged'
const collectTaggedItems = (entries) => entries.reduce((accObj, { tag, value }) => {
	if (tag) {
		accObj[tag] = [...(accObj[tag] ?? []), value]
	}
	return accObj
}, Object.create(null))
// takes in an array of tag/value objects (form is [ {tag, value} ] ), and returns a single object.  
// all values are put into an array, instead of 
const collectTaggedItems_old = (entries) => entries.reduce((accObj, { tag = 'missing "tag" prop', value = '' }) => {
	accObj[tag] = [...(accObj[tag] ?? []), value]
	return accObj
}, {})


// use with  <Parser>.chainDeep()
//
//	const tlfn_logError = (errMsg) => ({data=[], error, index, isError, result, target}) => {
//		const traceMessage = `${errMsg}: (${result}) at:${index}`
//		return Parser.of(result).mapData( (errLog) => ( [...errLog, traceMessage]) )
//	}

// use with  <Parser>.chainDeep()
//
//		const tlfn_logOnError = (errMsg) => ({data=[], error, index, isError, result, target}) => {
//			const traceMessage = `${errMsg}: (${result}) at:${index}, isError:${isError}, error:${error}`
//			return (isError) ?
//				Parser.of(result).mapData( (errLog) => ( [...errLog, traceMessage]) )
//			:	Parser.of(result)
//		}



/** WeakMap._emplace(key,handler)  - insert map item OR update existing map item, depending on key existence
 * NOTE: potential new JS Map method.  Using underscores to be safe
 * @param key - just a key like any other map method
 * @param handler - an object with two function properties: update & insert, both supplied by the user.  
 * 	Each handles a different scenario
 * 		update is called when the key already exists
 * 		insert is called when the key does not exist
 * @returns the inserted item, not the Map (per spec), which is unfortunate as it prevents many potential one-liners
 */
WeakMap.prototype._emplace = function (key, handler) {
	const map = this
	const value = (map.has(key) && 'update' in handler)
		? handler.update(map.get(key), key, map)
		: handler.insert(key, map)
	map.set(key, value)
	return value
}


/** Map._emplace(key,handler)  - insert map item OR update existing map item, depending on key existence
 * NOTE: potential new JS Map method.  Using underscores to be safe
 * @param key - just a key like any other map method
 * @param handler - an object with two function properties: update & insert, both supplied by the user.  
 * 	Each handles a different scenario
 * 		update is called when the key already exists
 * 		insert is called when the key does not exist
 * @returns the inserted item, not the Map (per spec), which is unfortunate as it prevents many potential one-liners
 */
Map.prototype._emplace = function (key, handler) {
	const map = this
	const value = (map.has(key) && 'update' in handler)
		? handler.update(map.get(key), key, map)
		: handler.insert(key, map)
	map.set(key, value)
	return value
}


// takes in an array of tag/value objects (form is [ {tag, value} ] ), and returns a single object.  
// all values are put into an array, instead of 
const collectTaggedItemsM = (entries) => entries.reduce((accMap, { tag, value = '' }) => {
	accMap._emplace(tag, {
		insert: () => value,
		update: () => [accMap.get(tag), value].flat()
	})
	return accMap
}, new Map())


// multientryFn :: (prevAccumulatedValue,newValue) => accumulatedValue
const collectTagged = (multientryFn) => (result) => {
	const tempMap = !Array.isArray(result) ?
		({ [result.tag]: result.value })
		: result.filter((item) => (item && item.tag)).reduce((accMap, { tag, value = '' }) => {
			accMap._emplace(tag, {
				insert: () => value,
				update: () => multientryFn(accMap.get(tag), value),				// accMap.get(tag) returns the existing value before updating
			})
			return accMap
		}, new Map())
	return Object.fromEntries([...tempMap])
}

const getTagged_v2 = (result) => {
	const tempMap = not(is.array(result))
		? ({ [result.tag]: result.value })
		: result.filter((item) => (item && item.tag)).reduce((accMap, { tag, value = '' }) => {
			accMap._emplace(tag, {
				insert: () => value,
				update: () => [accMap.get(tag), value].flat()
			})
			return accMap
		}, new Map())
	return Object.fromEntries([...tempMap])
}


const untag = ({ tag = '', value = '' }) => ([tag, value])

const gta1 = (resultArr) => {
	const taggedResults = resultArr.reduce((accObj, item) => {
		// we want to do something different here to collect 
		if (item.tag == 'unmatched') {
			accObj = [...accObj, [item.tag, item.value]]
		}
		accObj = [...accObj, [item.tag, item.value]]
		return accObj
	}, [])
	return taggedResults
}

const getTagged10 = (result) => {
	if (is.array(result)) return result.filter((item) => (item && item.tag)).reduce(flattenTagged, {})
	return { [result.tag]: result.value }
}

const getTagged11 = (result) => {
	if (is.array(result)) return result.filter((item) => (item && item.tag)).reduce(flattenTagged, {})
	if (result.tag) return { [result.tag]: result.value }
	return result
}


// Recursively resolve {tag:..., value:...} objects
const splat = (obj) => {
	if (is.nonIterableObj(obj) && (obj?.tag && obj?.value)) {
		return {
			[obj.tag]: splat(obj.value)
		}
	}
	if (is.nonIterableObj(obj) && (!obj?.tag || !obj?.value)) {
		console.warn(`[splat]: non-iterable object, but no tag/value`)
		return flattenAll_retainAll(obj)
	}
	if (is.iterableObj(obj)) {
		return [...obj].map(splat).flat()
	}
	else return obj
}

/*** exportSwitchData
* domain-specific helper function used as the last step in a per-switch parser in a multi-switch parsing
* system.  This function takes one or more flat data tables (implemented as an array of similar objects)
* which were created inside the per-switch parser, and pre-processes them to facilitate importing via a 
*	multi-switch parser. At this time, the switch's name is added into every data table prior to 
*	export.  In the multi-switch parser, the partner function 'importSwitchData' is used to combine tables
* form multiple switches into reduced set of tables.
*
* example: 
* switch A's parser produces tables X,Y, and Z as an aggregate {X,Y,Z}. exportSwitchData adds a switchname to each table X,Y,Z and exports object {Xa,Yz,Za}
* switch B's parser likewise produces tables X and Y as an aggregate {X,Y}.  exportSwichData adds switch B's name to X and Y, and exports object {Xb, Yb}
*
* see the example from importSwitchData to complete the example of the export/import process
*/
const exportSwitchData = (switchName, tableAggregate) => {
	const tables = Object.entries(tableAggregate)
	const result = tables.map(([tableName, table]) => ([
		tableName, 																							// preserve the table name (the key)
		table.map((dataItem) => ({ switchName, ...dataItem }))	// add the table 
	]))
	const result2 = tables.map(([tableName, table]) => ([
		tableName, 																							// preserve the table name (the key)
		table.map((dataItem) => (typeof (dataItem) === 'string')			// we don't want to spread the string...
			? { switchName, dataItem }
			: { switchName, ...dataItem }
		)
	]))
	return Object.fromEntries(result2)
}

/*** importSwitchData
* takes an array of tableAggregates (the type of object returned from exportSwitchData), and recombines them
* into a larger single tableAggregate
*
* example: 
*	When a multi-switch parser is run, the raw result is an array of objects received from each switch's parser, which in the above
* example, looks like [ {Xa,Ya,Za}, {Xb,Yb}, {Xc,Yc,Zc}...]
*
* importSwitchData takes this array, and converts it into a single tableAggregate object again {X', Y', Z'}, where X', is the simple
* concatenation of all X tables, Y' is the same for all Y tables, and Z' for all Z tables.
*
*		[ {Xa,Ya,Za}, {Xb,Yb}, {Xc,Yc,Zc}...] -> {Xabc, Yabc, Zabc}
*/
const importSwitchData = (arrayOfTableAggregates) => {
	console.log(`[importSwitchData]: importing ${arrayOfTableAggregates.length} records`)
	if (!arrayOfTableAggregates) return []
	const tableNames = deDupShallow(arrayOfTableAggregates.flatMap((item) => Object.keys(item)))
	const result = tableNames.flat().map((tableName) => ([
		tableName,
		arrayOfTableAggregates				// we could have used a reducer to transform arrayOfTableAggregates but filter/flatMap seems easier 
			.filter((tableAggregate) => tableAggregate[tableName])
			.flatMap((tableAggregate) => ([...tableAggregate[tableName]]))
	]))
	const normalizedResult = result.map(([name, table]) => ([name, applySchemaAuto(table)]))

	console.log(`[importSwitchData]: completed import`)
	return Object.fromEntries(normalizedResult)
}



/*** exportSwitchData_v2
 *	Similar functionality as exportSwitchData above, but adapted to account for error channels as a 3rd parameter.
 *	*** Must be used with importSwitchData_v2 ***
 *	see the example from importSwitchData to complete the example of the export/import process
 */
const exportSwitchData_v2 = (switchName, aggregateResultTable = [], aggregateErrorTable = []) => {
	const result = Object.entries(aggregateResultTable).map(([tableName, resultTable]) => ([
		tableName, 																							// preserve the table name (the key)
		resultTable.map((dataItem) => ({ switchName, ...dataItem }))	// add the table 
	]))
	const errors = Object.entries(aggregateErrorTable).map(([tableName, errorTable]) => ([
		tableName, 																							// preserve the table name (the key)
		errorTable.map((dataItem) => ({ switchName, ...dataItem }))	// add the table 
	]))
	const returnVal = {
		parseResults: Object.fromEntries(result),
		parseErrors: Object.fromEntries(errors)
	}

	return returnVal
}



/*** importSwitchData_v2
*  Similar functionality as importSwitchData above, but adapted to account for a possible error channel
*  Must be used only with exportSwitchData_v2
*/
const importSwitchData_v2 = (aggregates) => {
	const tableAggregates = aggregates.map((agg) => agg.parseResults)
	const tableErrorAggregates = aggregates.map((agg) => agg.parseErrors)

	console.log(`[importSwitchData_v2]:
				importing ${tableAggregates.length} result records,
				importing ${tableErrorAggregates.length} error records
			`)

	const tableNames = deDupShallow(tableAggregates.flatMap((item) => Object.keys(item)))
	const tableErrorNames = deDupShallow(tableErrorAggregates.flatMap((item) => Object.keys(item)))

	const parseResults = tableNames.flat().map((tableName) => ([
		tableName,
		tableAggregates				// we could have used a reducer to transform arrayOfTableAggregates but filter/flatMap is more readable
			.filter((tableAggregate) => tableAggregate[tableName])
			.flatMap((tableAggregate) => ([...tableAggregate[tableName]]))
	]))
	const normalizedResults = parseResults.map(([name, table]) => ([name, applySchemaAuto(table)]))

	const parseErrors = tableErrorNames.flat().map((tableName) => ([
		tableName,
		tableErrorAggregates				// we could have used a reducer to transform arrayOfTableAggregates but filter/flatMap is more readable
			.filter((tableErrorAggregate) => tableErrorAggregate[tableName])
			.flatMap((tableErrorAggregate) => ([...tableErrorAggregate[tableName]]))
	]))
	const normalizedErrors = parseErrors.map(([name, table]) => ([name, applySchemaAuto(table)]))

	const returnVal = [
		Object.fromEntries(normalizedResults),
		Object.fromEntries(parseErrors)
	]
	return returnVal
}



/** 
 * reportSkippedLines - high-level parser error reporter (use inside .chain())
 *	For use inside <parser>.chain()
 *
 * 	This role of this type of functions is to force a parser error when data validation checks fail, although 
 *	parsing may succeed. This function in particular, looks for data records with a property called 'unmatched'. 
 * 	'unmatched' refers to lines of text parsed by a default line parser (via 'parseline(everythingUntil(eol))' presumably),
 *	instead of being matched by a more specific parser.  It prevents config lines from 'slipping through the cracks'.
 *
 *  @param {string} moduleName - a string describing which module this error was reported from
 *	@description 
 *		reportSkippedLines must be called from inside a parsers .chain() method:
 *    	example:    many(parseAllRecords)	.chain( reportSkippedLines('mymodule') )
 *		where parseAllRecords must be a 'dsArray' in its near-final form
 */
const reportSkippedLines = (moduleName) => pipe(
	groupBy((item) => obj.hasValFor('unmatched')(item)
		? 'failed'
		: 'passed'
	),
	(result) => (result?.failed?.length > 0)
		? fail({ reason: `${result.failed.length} unmatched lines in module ${moduleName}.  See records with property 'unmatched'`, failedRecords: result.failed })
		: succeedWith(result.passed)
)


function flatten(data) {
	// if the function is primitive, just return it
	if (typeof data !== "object" || data === null) {
		return data
	}
	// if the data is an array, map over it's values and flatten them
	if (Array.isArray(data)) {
		return data.map(flatten)
	}
	// if the data is an object, create a new object to store the flatten properties
	let result = Object.create(null)
	
	for (let key in data) {
		let value = data[key]
		let flattened = flatten(value)
		if (typeof flattened === 'object' && flattened !== null) {
			for (let subkey in flattened) {
				result[`${key}->${subkey}`] = flattened[subkey]
			}
		}
		else {
			result[key] = flattened
		}
	}
	return result
}


function flattenV2(data) {
	const flatten = flattenV2

	// if the function is primitive, just return it
	if (typeof data !== "object" || data === null) {
		return data
	}
	// if the data is an array, map over it's values and flatten them
	if (Array.isArray(data)) {
		return data.map(flatten)
	}

	// if the data is an object, create a new object to store the flatten properties
	let result = Object.create(null)

	if (data?.type === 'Record') {
		const recordResults = data.value
		const propList = recordResults.flat(10).filter( (item) => item?.tag && item?.value)
		const consolidatedPropList = propList.map( (item) => flatten(item) )
		const result = Object.fromEntries(consolidatedPropList)
		//return resultObject

	}
	else if (data?.type === 'List') {
		const recordList = data.value
		const result = recordList.map(flatten)
	}
	// else if (data?.tag && data?.value && data?.value?.tag && data?.value?.value) {
	// 	return {
	// 		[`${data.tag}.${data.value.tag}`]: flatten(data.value)
	// 	}
	// }
	else if (data?.tag && data?.value) {
		result = [`${data.tag}`, flatten(data.value) ]
	}
	else {
		for (let key in data) {
			let value = data[key]
			let flattened = flatten(value)
			if (typeof flattened === 'object' && flattened !== null) {
				for (let subkey in flattened) {
					result[`${key}->${subkey}`] = flattened[subkey]
				}
			}
			else {
				result[key] = flattened
			}
		}
	}
	return result
}


// // helper functions to map null results to desired type
// const nullToStr = (result) => result == null ? '' : result
// const nullToBoolean = (result) => result == null ? false : true
// const nullToArray = (result) => result == null ? [] : result





export {
	// functional array methods
	mapArray,
	flatMapArray,
	filterArray,
	flattenArray,
	flattenArrayN,
	joinWith,
	sortArray,
	reverseArray,
	arrayLength,
	zip,
	bifurcateArray,

	// dataset
	createObjectTemplateFrom,
	applyTemplateObject,
	applySchema,
	discoverSchema,
	applySchemaAuto,
	normalizedDataSet,
	normalizedDataTable,
	tableFromDataSet,
	promoteTableHeader,
	flattenTagged,
	consolidate,
	consolidateBy,
	joinBy,
	flattenDataSet,
	nullToStr,
	nullToArray,
	nullToObject,
	ifNotFound,
	asString,
	asNumber,
	asBoolean,
	asArray,
	getTagged,
	mapFn_resolvePeers,			// domain specific - for Arista BGP parser only - should be in a different module
	dataTableToHTML,
	dataSetToCSV,
	addTag,
	promote_dataLog_to_result,
	printErrorStack,
	parseError,
	collectTagged,
	collectTaggedItems,

	importSwitchData,
	exportSwitchData,
	intf_classifyBy,

	/////////////////////////////////////////////////
	/** re-exported from Column_and_Array_Predicates module **/
	/////////////////////////////////////////////////
	groupBy,
	groupByPropName,

	/////////////////////////////////////////////////
	/** re-exported from Pattern_Matching module **/
	/////////////////////////////////////////////////

	is,
	arr,
	match,

	/////////////////////////////////////////////////
	/** re-exported from Object_Flattening module **/
	/////////////////////////////////////////////////

	// older object flattening routines
	flattenObjByPropName_replace_curried,
	flattenObjByPropName_replace,
	flattenAll_replace,

	flattenObjByPropName_retain_curried,
	flattenObjByPropName_retain,
	flattenAll_retain,

	flattenObjByPropName_retainAll,
	flattenAll_retainAll,

	// older array multplication routines
	expandObjFromSubArray,
	multiplyItemByArrayProp2,
	multiplyObjByArraySubPropName,
	multiplyObjByArraySubPropName_curried,

	// newer object flattening routines
	flattenItem,
	flattenItemOnProps,
	flattenItemRecursively,
	flattenItemWith,
	flattenItemRecursivelyWith,

	// newer array multiplication routines
	multiplyBy,
	multiplyByZ,
	multiplyBy_v2,
	multiplyBy_v2_lossy,
	multiplyByND,

	logResult,

	pipe,
	col,

	// re-exported from "./Functional_Database.mjs"
	innerJoin,
	innerJoin2,
	innerJoin3,
	leftJoin,
	leftJoin2,
	leftJoin3,
	leftJoin4,
	leftJoin5,
	equiJoin2,
	outerJoin,
	outerJoin2,
}


