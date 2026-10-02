////////// import { orderedProps, strHash, stringify } from "./DeepValues.mjs"


/*** newMap_from - system to create Maps 
	*
	*/
// "plug-in" functions used above as 'fn_itemToUniqueString' of the form:	(fn	::	dsItem => String)

//	these functions create keys used in Maps (typically strings)
const itemProp = 		(keyName) =>  (dsItem) => dsItem[keyName]
const itemProps = 	(keyArray) =>	(dsItem) => keyArray.map((key)=>dsItem[key] ?? `${key}:empty`).sort().join(':')
////////// const itemHash = 									(dsItem) => strHash( stringify( orderedProps(dsItem) ) )		// faster, but must pre-order propNames
const itemAsKey = 								(dsItem) => dsItem
	
const	keyArray_to_concatenatedValue	=	(keyArray, dsItem)	=> {
	return keyArray.reduce( (accStr, key) => accStr + dsItem[key], '' )
}

//	newMap_from = (dsItem => String) => dsArray => Map(String, dsItem)
const newMap_from = (fn_itemToUniqueString) => (dsArray) => new Map(	dsArray.map( (dsItem) => [ fn_itemToUniqueString(dsItem), dsItem ] ) ) 

// reduce form of 'newMap_from'.  same functions 
const newMap_fromR = (fn_itemToUniqueString) => (dsArray) => dsArray.reduce( 
	(accMap, dsItem) => accMap.set(fn_itemToUniqueString(dsItem), dsItem), 
	new Map()	
)

//	newMap_fromXYZ	::	str	=>	(keyFn=>dsItem=>String)	=>	dsArray	=>	Map
const newMap_fromProp = 	(key)				=>	newMap_from(itemProp(key)) 				
const newMap_fromProps = 	(keyArray) 	=>	newMap_from(itemProps(keyArray))
// const newMap_fromContent =								newMap_from(itemHash)
const newMap_fromContent2 =								newMap_from(itemAsKey)			// probably keyed by object reference rather than object content - verify - could still be useful dependong on app


// dedDups an dsArray by a property known to be unique
//	deDupByProp :: [propNames] => dsArray => dsArray
const deDupByProp = (keyName)	=>		(dsArray) =>	[ ...newMap_fromProp (keyName) (dsArray).values() ]
	
// dedDups an dsArray by using multiple columns in an array - creating a "virtual composite column" as the unique ID -
//	deDupByProps :: [propNames] => dsArray => dsArray
const deDupByProps = (...propArray)	=>	(dsArray) =>	[ ...newMap_fromProps ( propArray.flat() ) (dsArray).values() ]
	
// dedDups an dsArray using deep content for equality check - using the item's hash as the key
//	deDupByContent :: dsArray => dsArray
////////// const deDupByContent = (dsArray) => 		[ ...newMap_fromContent (dsArray) .values() ]
	
// dedDups an dsArray using deep content for equality check - using the actual item as the key
//	deDupByContent :: dsArray => dsArray
const deDupByContent2 = (dsArray) => 		[ ...newMap_fromContent2 (dsArray).values() ]
	
// deDups an dsArray using primitives for equality (number, boolean, string, symbol, null, undefined, object)
//	deDupShallow :: dsArray => dsArray
const deDupShallow = (dsArray) =>	Array.from(new Set([...dsArray]))
	
const keyedDataSet = (propName_Str, dataSet) => new Map(Array.from(dataSet, (item)=>[item[propName_Str],item]))

/////////////////////////////////////////////////////////////////////////////
// Mathematical "Set" operations 
/////////////////////////////////////////////////////////////////////////////
// Set Operations: for Arrays of primitive values 
// Set member ID: based on value of array item
const union = 				(arrA, arrB) => [ ...new Set([...arrA, ...arrB]) ] 
const intersection =	(arrA, arrB) => arrA.filter((x) =>  arrB.includes(x))
const diff = 		 			(arrA, arrB) => arrA.filter((x) => !arrB.includes(x))
const disjointUnion =	(arrA, arrB) => arrA.filter((x) => !arrB.includes(x)).concat(arrB.filter((x) => !arrA.includes(x)))

/////////////////////////////////////////////////////////////////////////////
// Set Operations: for sets of isomorphic objects (dsArray) 
// Set member ID: based on shallow value of array item at the supplied key

// necessary helper functions - may be replaced since this only provides uniqueness based on equality, not by dynamic calculation/high-order function result
const mapIntersectionK = (dsA, keyA, dsB, keyB) => {
	let dsA_Map = newMap_fromProp (keyA) (dsA)
	let dsB_Map = newMap_fromProp (keyB) (dsB)
	let dsA_keys_intersecting_with_dsB = intersection([...dsA_Map.keys()], [...dsB_Map.keys()] )
	let result = dsA_keys_intersecting_with_dsB.map((dsA_key) => dsA_Map.get(dsA_key))
	return result
}

const mapDiffK = (dsA, keyA, dsB, keyB) => {
	let dsA_Map = newMap_fromProp (keyA) (dsA)
	let dsB_Map = newMap_fromProp (keyB) (dsB)
	let dsA_keys_diffing_with_dsB = diff([...dsA_Map.keys()], [...dsB_Map.keys()] )
	let result = dsA_keys_diffing_with_dsB.map((dsA_key) => dsA_Map.get(dsA_key))
	return result
}

/** dsUnion / dsIntersection / dsDiff / dsDisjointUnion - these set operations assume DSA and DSB are actual Sets to beging with
	 * 	i.e. - they both contain unique records (relative to the keyPropName)
	 */
const dsUnion = 				(dsA, dsB, keyPropName) => [ ...newMap_fromProp (keyPropName) ( [...dsA, ...dsB, ...dsA]).values() ]  // see note
const dsIntersection = 	(dsA, dsB, keyPropName) => [ ...mapIntersectionK(dsA, keyPropName, dsB, keyPropName).values() ]
const dsDiff = 					(dsA, dsB, keyPropName) => [ ...mapDiffK(dsA, keyPropName, dsB, keyPropName).values() ]
const dsDisjointUnion = (dsA, dsB, keyPropName) => [ ...dsDiff(dsA, dsB, keyPropName), ...dsDiff(dsB, dsA, keyPropName) ]
/* NOTE: Since uniqueness is by supplied key, the first key found will be retained. 
	The price for this is the need to re-iterate dsA twice in dsUnion() above
	*/

export {
	mapDiffK,
	mapIntersectionK,
	union,
	intersection,
	diff,
	disjointUnion,
	dsUnion,
	dsIntersection,
	dsDiff,
	dsDisjointUnion,
	//////////		deDupByContent,
	deDupByContent2,
	deDupByProp,
	deDupByProps,
	deDupShallow,
	newMap_from,
	//////////		newMap_fromContent,
	newMap_fromContent2,
	newMap_fromProp,
	newMap_fromProps,
}
