import {
	flattenAll_replace,
	// newer object flattening routines
	// newer object flattening routines
	flattenItemOnProps,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,

	// newer array multiplication routines
	multiplyBy,
	multiplyBy_v2,
	multiplyBy_v2_lossy,
	multiplyByND,
} from "./Object_Flattening.mjs"

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
		// accObj[bucketName] ??= consolidatedRecord
		if (accObj[bucketName] == null) accObj[bucketName] = consolidatedRecord
		// accObj[bucketName][conservedPropName] ??= []
		if (accObj[bucketName][conservedPropName] == null) accObj[bucketName][conservedPropName] = []
		accObj[bucketName][conservedPropName].push(conservedValue)
		return accObj
	}, {})
	return results
}


// like consolidate, but with an item classifierFn
// itemClassifierFn :: dsItem -> string     // e.g - value of a :  fn = propName => item=> item[propName]
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

// Signature:  null or [nonemptyArray A] -> nullToArray -> [] or [nonemptyArray A]
const nullToArray = (result) => (result === null) ? [] : result


const nullToObject = (result) => (result === null) ? Object.from(null) : result


export {
	consolidate,
	consolidateBy,
	joinBy,
	flattenDataSet,
	nullToStr,
	nullToArray,
	nullToObject,
	multiplyBy,
}
