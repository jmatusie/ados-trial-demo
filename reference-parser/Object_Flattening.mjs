// Borrowed from PatternMatching.mjs.  Do not modify here...
const is = {
	// value-related predicates (works for 'number', 'string', and 'boolean')
	eq: (value) =>	/** @returns {boolean} */(item) => item == value,								// 	'==' is itentional for weak typechecking
	neq: (value) =>	/** @returns {boolean} */(item) => item != value,									//	for same reson, '!=' is intentional
	lt: (value) =>	/** @returns {boolean} */(item) => item < value,
	gt: (value) =>	/** @returns {boolean} */(item) => item > value,
	lte: (value) =>	/** @returns {boolean} */(item) => item <= value,
	gte: (value) =>	/** @returns {boolean} */(item) => item >= value,
	between: (low, high) =>	/** @returns {boolean} */(item) => item >= low && item <= high,
	betweenX: (low, high) =>	/** @returns {boolean} */(item) => item > low && item < high,
	betweenXL: (low, high) =>	/** @returns {boolean} */(item) => item > low && item <= high,
	betweenXH: (low, high) =>	/** @returns {boolean} */(item) => item >= low && item < high,
	// type-checking predicates (done the way JS should have done it)
	string:	/** @returns { item is string 	} */		(item) => typeof (item) === 'string',
	number:	/** @returns { item is number		}	*/		(item) => typeof (item) === 'number',
	bigint:	/** @returns { item is bigint 	} */		(item) => typeof (item) === 'bigint',
	boolean:	/** @returns { item is boolean	} */		(item) => typeof (item) === 'boolean',
	symbol:	/** @returns { item is symbol 	} */		(item) => typeof (item) === 'symbol',
	function:	/** @returns { item is function	}	*/		(item) => typeof (item) === 'function',
	classDef:	/** @returns { item is function	}	*/		(item) => typeof (item) === 'function' && typeof (item?.prototype?.constructor) === 'function',
	object: /** @returns { item is object 	} */		(item) => typeof (item) === 'object' && item !== null,
	array: /** @returns { item is Array 		} */		(item) => Array.isArray(item),
	regex:	/** @returns { item is RegExp		} */		(item) => item instanceof RegExp,
	primitive:	/** @returns { boolean } */							(item) => item === null || ['string', 'number', 'bigint', 'boolean', 'symbol', 'undefined'].includes(typeof (item)),
	// below addresses the many aspects of JS 'falsiness' tests
	falsey:	/** @returns { boolean }						*/	(item) => !(item),  										// returns false for: 0, NaN, '', null, undefined, and false.  Not good practice to use as this is one of Javascrpt's mistakes
	nullish:	/** @returns { boolean }						*/	(item) => item ? false : true, 					// returns false for null and undefined
	nil:	/** @returns { boolean }						*/	(item) => item == null,  				 			// identical to nullish. different implemetation
	null:	/** @returns { item is null } 			*/	(item) => item === null,								// strictly null
	undefined:	/** @returns { item is undefined }	*/	(item) => item === undefined,						// strictly undefined
	undef:	/** @returns { item is undefined }	*/	(item) => item === undefined,						// shorthand for undefined
	defined:	/** @returns { item is !undefined }	*/	(item) => item !== undefined,						// opposite of undefined
	def:	/** @returns { item is !undefined }	*/	(item) => item !== undefined,						// shorthand for defined
	// fancier and useful type checks
	data:	/** @returns {boolean} */	(item) => item != null && !Number.isNaN(item), 								// true if it has any value except null, undefined, or NaN - even if it's empty
	notEmpty: /** @returns {boolean} */	(item) => item != null && (!Number.isNaN(item)) && ((item.length ?? true) !== 0),
	empty:	/** @returns {boolean} */	(item) => item == null || item?.length == 0 || Number.isNaN(item), 									// type-agnostic way to check for emptry strings, arrays, null values, NaN, or undefined
	emptyVal:	/** @returns {boolean} */	(item) => item === null || item === '' || item?.length == 0 || Number.isNaN(item), 		// type-agnostic way to check for emptry strings, arrays, NaN, or null values.  
	promise: /** @returns {boolean} */	(item) => typeof item?.then === 'function',
	oneOf: (...array) => (item) => array.flat().includes(item),
	instanceOf: (class_) => (item) => item instanceof class_,
	memberOf: (className) => (item) => item?.__proto__?.constructor?.name === ((typeof (className) === 'string') ? className : className.name),
	// iterable objects (intentionally excludes considering strings as iterable)
	iterable:	/** @returns {boolean} */	(item) => typeof item[Symbol.iterator] === 'function',
	asyncIterable:	/** @returns {boolean} */	(item) => typeof item[Symbol.asyncIterator] === 'function',
	// these are skipped in 'isnot' the same as obj.iterable & obj.notIterable, here for semantics
	iterableObj:	/** @returns {boolean} */	(item) => item !== null && typeof (item) === 'object' && typeof item[Symbol.iterator] === 'function',
	nonIterableObj:	/** @returns {boolean} */	(item) => item !== null && typeof (item) === 'object' && typeof item[Symbol.iterator] !== 'function',
}
// short-named equivalents of some predicates
is.str = is.string
is.num = is.number
is.bool = is.boolean
is.fn = is.function
is.obj = is.object
is.arr = is.array
is.def = is.defined

// NOTE: removed eqDeep & neqDeep from here (despite saying this should not be modified as it's a copy of PatternMatching.mjs), 
// This was done to eliminate the dependency on 'DeepValues.mjs'.  Now this module is completely independent.
const arr = {
	// eq: 					order not important, shallow-values only
	// alignedWith: order is important, shallow-values only
	// eqDeep: 			order is important, deep-values supported (not 100% reliable with instantiated objects (Maps, Sets, etc) due to JS - always test!!)
	eq: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && arr1.length === arr2.length && arr2.every((item) => arr1.includes(item)),
	neq: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && (arr1.length !== arr2.length || !(arr2.every((item) => arr1.includes(item)))),
	alignedWith: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && arr1.length == arr2.length && arr2.every((item, idx) => arr1[idx] === item),
	isEmpty: /** @type {PF_Pred} 			*/ 						 		(arr1) => Array.isArray(arr1) && arr1.length === 0,
	hasOne: /** @type {PF_Pred} 			*/ 						 		(arr1) => Array.isArray(arr1) && arr1.length === 1,
	hasMany: /** @type {PF_Pred} 			*/ 						 		(arr1) => Array.isArray(arr1) && arr1.length > 1,
	hasLength: /** @type {PF_Pred_Num} 	*/ (length) => (arr1) => Array.isArray(arr1) && arr1.length === length,
	notEmpty: /** @type {PF_Pred} 			*/ 								(arr1) => Array.isArray(arr1) && arr1.length > 0,
	includes: /** @type {PF_Pred_Any} 	*/ (value) => (arr1) => Array.isArray(arr1) && arr1.includes(value),														// aka 'has'
	excludes: /** @type {PF_Pred_Any} 	*/ (value) => (arr1) => Array.isArray(arr1) && !arr1.includes(value),
	includesSomeOf: /** @type {PF_Pred_Var}		*/ (...arr2) => (arr1) => Array.isArray(arr1) && arr2.flat().some((item) => arr1.includes(item)),		// aka 'intersects with'
	includesAllOf: /** @type {PF_Pred_Var}		*/ (...arr2) => (arr1) => Array.isArray(arr1) && arr2.flat().every((item) => arr1.includes(item)),   // aka 'proper subset of'
	excludesAllOf: /** @type {PF_Pred_Var}		*/ (...arr2) => (arr1) => Array.isArray(arr1) && !(arr2.flat().some((item) => arr1.includes(item))),
	// set ops:  some of these are equivalent to above - included here for semantic reasons
	subsetOf: /** @type {PF_Pred_Var} 	*/ (...arr2) => (arr1) => Array.isArray(arr1) && arr1.every((item) => arr2.flat().includes(item)),		// aka 'intersects with'
	supersetOf: /** @type {PF_Pred_Var} 	*/ (...arr2) => (arr1) => Array.isArray(arr1) && arr2.flat().every((item) => arr1.includes(item)),
	intersectsWith: /** @type {PF_Pred_Var} 	*/ (...arr2) => (arr1) => Array.isArray(arr1) && arr2.flat().some((item) => arr1.includes(item)),   	// aka 'proper subset of'
	isDisjointWith: /** @type {PF_Pred_Var} 	*/ (...arr2) => (arr1) => Array.isArray(arr1) && !(arr2.flat().some((item) => arr1.includes(item))),	// aka 'disjoint with'
}


/*******************************************************************************************************/
/*******************************************************************************************************/


// curried version
const flattenObjByPropName_replace_curried = (subObjectPropName) => (obj) => {
	// if propKey doesn't exist, do nothing
	if (typeof obj[subObjectPropName] === 'undefined') return { ...obj }
	// if propKey refers to array or iterable...do nothing
	if (typeof obj[subObjectPropName][Symbol.iterator] === 'function') return { ...obj } 						// propName is array or iterable - do nothing

	// valid use case - propKey refers to non-iterable subObject
	if (typeof (obj[subObjectPropName]) === 'object') {				// valid use case:
		let reshapedObj = {
			...obj, ...obj[subObjectPropName],
		}  // parent's propName is overwritten upon conflict
		delete reshapedObj[subObjectPropName]
		return reshapedObj
	}
	// propKey does not refer to a subObject - do nothing
	return { ...obj }
}



// flattenObjByPropName_replace (obj, propName) // signature:  (obj, string) -> obj.[maybe{string}]
// moves all props within subObject named 'subObjectPropName' into main object 'obj'.  Duplicate propnames in subobject
// replace those in main object
// NOTE: subObjPropName should *NOT* be an Iterable - use "expandObjFromSubArray" instead
const flattenObjByPropName_replace = (obj, subObjectPropName) => {
	// if propKey doens't exist, do nothing
	//		if (typeof obj[subObjectPropName] === undefined) return { ...obj }
	if (typeof obj[subObjectPropName] === 'undefined') return { ...obj }
	// if propKey refers to array or iterable...do nothing
	if (typeof obj[subObjectPropName][Symbol.iterator] === 'function') return { ...obj } 						// propName is array or iterable - do nothing

	// valid use case - propKey refers to non-iterable subObject
	if (typeof (obj[subObjectPropName]) === 'object') {				// valid use case:
		let reshapedObj = {
			...obj, ...obj[subObjectPropName],
		}  // parent's propName is overwritten upon conflict
		delete reshapedObj[subObjectPropName]
		return reshapedObj
	}
	// propKey does not refer to a subObject - do nothing
	return { ...obj }
}


// flattenAll_strong (obj) // signature:  (obj.subObj.properties) -> obj.properties
// moves ALL immediate child props which are non-iterable Objects into main object 'obj'.
// Upon propname conflict, child wins over parent (due to use of flattenObjByWeakPropName)
const flattenAll_replace = (obj) => {
	const cumulativeResult = Object.keys(obj).reduce((newObj, propName) => {
		let tmpObj = flattenObjByPropName_replace(newObj, propName)
		return tmpObj
	}, obj)
	return cumulativeResult
}



/*******************************************************************************************************/
/*******************************************************************************************************/



// flattenObjByPropName_retain (obj, propName): signature:  (obj, string) -> obj.[string]
// flattens - or moves all props within a given object's (obj) subObject property, named 'subObjectPropName' into main object 'obj'.  Duplicate propNames in subObject
// do NOT replace those in main object - main object's propname is retained
// NOTE: subObjPropName should *NOT* be an Iterable - use "expandObjFromSubArray" instead
const flattenObjByPropName_retain_curried = (subObjectPropName) => (obj) => {
	// if propKey doens't exist, do nothing
	if (typeof obj[subObjectPropName] === 'undefined') return { ...obj }
	// if propKey refers to array or iterable...do nothing
	if (typeof obj[subObjectPropName][Symbol.iterator] === 'function') return { ...obj } 						// propName is array or iterable - do nothing

	// valid use case - propKey refers to non-iterable subObject
	if (typeof (obj[subObjectPropName]) === 'object') {
		let reshapedObj = { ...obj[subObjectPropName], ...obj, }  // parent's propName is not overwritten upon conflict
		delete reshapedObj[subObjectPropName]
		return reshapedObj
	}
	// propKey does not refer to a subObject - do nothing
	return { ...obj }
}


// flattenObjByPropName_retain (obj, propName): signature:  (obj, string) -> obj.[string]
// flattens - or moves all props within a given object's (obj) subObject property, named 'subObjectPropName' into main object 'obj'.  Duplicate propNames in subObject
// do NOT replace those in main object - main object's propname is retained
// NOTE: subObjPropName should *NOT* be an Iterable - use "expandObjFromSubArray" instead
const flattenObjByPropName_retain = (obj, subObjectPropName) => {
	// if propKey doens't exist, do nothing
	if (typeof obj[subObjectPropName] === 'undefined') return { ...obj }
	// if propKey refers to array or iterable...do nothing
	if (typeof obj[subObjectPropName][Symbol.iterator] === 'function') return { ...obj } 						// propName is array or iterable - do nothing

	// valid use case - propKey refers to non-iterable subObject
	if (typeof (obj[subObjectPropName]) === 'object') {
		let reshapedObj = {
			...obj[subObjectPropName],
			...obj,
		}  				// parent's propName is not overwritten upon conflict
		delete reshapedObj[subObjectPropName]
		return reshapedObj
	}
	// propKey does not refer to a subObject - do nothing
	return { ...obj }
}


// flattenAll_weak (obj) // signature:  (obj.subObj.properties) -> obj.properties
// moves ALL immediate child props which are non-iterable Objects into main object 'obj'.
// Upon propname conflict, parent wins over children (due to use of flattenObjByWeakPropName)
const flattenAll_retain = (obj) => {
	const cumulativeResult = Object.keys(obj).reduce((newObj, propName) => {
		let tmpObj = flattenObjByPropName_retain(newObj, propName)
		return tmpObj
	}, obj)
	return cumulativeResult
}

/*******************************************************************************************************/
/*******************************************************************************************************/




// flattenObjByPropName_retainAll (obj, propName) // signature:  (obj, string) -> obj.string_propvalue
// moves all values of subObject referenced by propName to obj.propName_<value>
// NOTE: subObjPropName should *NOT* be an Iterable - use "expandObjFromSubArray" instead
const flattenObjByPropName_retainAll = (obj, subObjectPropName) => {
	// if propKey doens't exist, do nothing
	if (typeof obj[subObjectPropName] === 'undefined') return { ...obj }
	// if propKey refers to array or iterable...do nothing
	if (typeof obj[subObjectPropName]?.[Symbol.iterator] === 'function') return { ...obj } 						// propName is array or iterable - do nothing

	// valid use case - propKey refers to non-iterable subObject
	if (typeof (obj[subObjectPropName]) === 'object') {
		let newObj = {}
		let subObjEntries = Object.entries(obj[subObjectPropName])
		for (let entry of subObjEntries) {
			newObj[`${subObjectPropName}_${entry[0]}`] = entry[1]    // subPropName of propName are renamed
		}
		let reshapedObj = { ...obj, ...newObj, }
		delete reshapedObj[subObjectPropName]
		return reshapedObj
	}
	return { ...obj } 						// propName not object - do nothing
}

// flattenRetain (obj) // signature:  (obj.subObj.property) -> obj.subObj_properties
// moves ALL immediate child props which are non-iterable Objects into main object 'obj'.
// No propname conflicts - child subProps names are concantenated with their key
const flattenAll_retainAll = (obj) => {
	const cumulativeResult = Object.keys(obj).reduce((newObj, propName) => {
		let tmpObj = flattenObjByPropName_retainAll(newObj, propName)
		return tmpObj
	}, obj)
	return cumulativeResult
}




/*******************************************************************************************************/
/*******************************************************************************************************/


// for each item in object's array property named 'arrayPropName', copy the entire object, and re-assign the arrayPropName
// to the value of the item of the subArray
// signature: (obj, [item]) -> [obj.item]
const expandObjFromSubArray = (obj, arrayPropName) => {
	if (is.array(obj[arrayPropName])) return [{ ...obj }]
	//	if (!typeof obj[arrayPropName][Symbol.iterator] === 'function') return [{...obj}]  	// if arrayPropName is not iterable 
	if (obj[arrayPropName].length === 0) return [{ ...obj }]  														// if arrayPropName has zero length

	const result = obj[arrayPropName].map((subitem) => {
		return { ...obj, [arrayPropName]: subitem }
	})
	return result
}


// same as multiplyBy(propName) defined above
const multiplyItemByArrayProp2 = (arrayPropName) => (dsItem) =>
	is.iterable(dsItem[arrayPropName])						// if array
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: dsItem


const multiplyObjByArraySubPropName = (obj, arrayPropName) => {
	const result = expandObjFromSubArray(obj, arrayPropName).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
	return result
}

const multiplyObjByArraySubPropName_curried = function (arrayPropName) {
	return function (obj) {
		return expandObjFromSubArray(obj, arrayPropName).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
	}
}


/*******************************************************************************************************/
/*******************************************************************************************************/



const flattenItemOnProps = (...propNames) => (dsItem) => Object.fromEntries(
	Object.entries(dsItem).reduce((updatedEntries, [key, value]) =>
		(is.nonIterableObj(value) && propNames.flat().includes(key)) ?
			[...updatedEntries, ...Object.entries(value)]
			: [...updatedEntries, [key, value]]
	, [])
)


const flattenItem = (dsItem) => Object.fromEntries(
	Object.entries(dsItem).reduce((updatedEntries, [key, value]) => (is.nonIterableObj(value))   											// if the entry is an object (but not an array), 
		?	[...updatedEntries, ...Object.entries(value)] 		// ...then flatten the object using Object spread...  (destructive upon name collision)
		: [...updatedEntries, [key, value]]								// otherwise...He, return the object untouched
	, [])
)

// like flattenItem (flattens all non-interable sub-objects), but recursively
// note: like flattenItem, any overlapping prop names in sub-object will be overwritten.
// so care must be taken to ensure that keys do not overlap
const flattenItemRecursively = (dsItem) => {
	return (Object.values(dsItem).some((value) => is.nonIterableObj(value)))  	// only looking for non-iterable sub-objects
		? flattenItemRecursively(flattenItem(dsItem))
		: dsItem
}

// object reshaping functions 
const flattenItemWith = (delimStr) => (dsItem) => Object.fromEntries(
	Object.entries(dsItem).reduce((updatedEntries, [key, value]) => (is.nonIterableObj(value))			// check if the subproperty is a non-iterable object
		? [...updatedEntries, ...Object.entries(value).map(([key2, val2]) => [`${key}${delimStr}${key2}`, val2])] 	// if so, add sub-object kvas into the kva accumulator... 
		: [...updatedEntries, [key, value]]														// if not, skip this prop & return the kva accumulator untouched
	, [])
)

// universal flattening routine - supply a key-merging delimiter 
const flattenItemRecursivelyWith = (keyMergingDelimiterString) => (dsItem) => {
	const flatten = flattenItemWith(keyMergingDelimiterString)
	return (Object.values(dsItem).some((value) => is.nonIterableObj(value)))  	// if has any non-array sub-objects...
		? flattenItemRecursively(flatten(dsItem))
		: dsItem
}





// object reshaping functions 
const flattenObjectWith = (delimStr) => (dsItem) => Object.fromEntries(
	Object.entries(dsItem).reduce((updatedEntries, [key, value]) => (is.nonIterableObj(value))			// check if the subproperty is a non-iterable object
		? [...updatedEntries, ...Object.entries(value).map(([key2, val2]) => [`${key}${delimStr}${key2}`, val2])] 	// if so, add sub-object kvas into the kva accumulator... 
		: [...updatedEntries, [key, value]]														// if not, skip this prop & return the kva accumulator untouched
	, [])
)

const flattenObject = flattenItemWith('.')

// Recursively flatten any (non-iterable) sub-object properties of an object 
// WARNING #1: array properties part of the original object are original, not copied.  Use with care
// WARNING #2: this is intended for raw dataset processing, not application state/DOM manipulation.  
// This works for simple hierarchical objects, does not check for complex objects with cycles - no limiter (yet) is built in
const flattenObjectRecursively = (dsItem) => {
	return (Object.values(dsItem).some((value) => is.nonIterableObj(value)))  	// if has any non-array sub-objects...
		? flattenItemRecursively(flattenObject(dsItem))
		: dsItem
}


// universal flattening routine - supply a key-merging delimiter 
const flattenObjectRecursivelyWith = (keyMergingDelimiterString) => (dsItem) => {
	const flatten = flattenItemWith(keyMergingDelimiterString)
	return (Object.values(dsItem).some((value) => is.nonIterableObj(value)))  	// if has any non-array sub-objects...
		? flattenItemRecursively(flatten(dsItem))
		: dsItem
}




/*******************************************************************************************************/
/*******************************************************************************************************/


// collection of functions to plug into flattenItemND as a "kvaMapFn_renamer"
// used by flattenItemND
const keyRenamer = {
	prefixer: (separatorStr) => (parentKey, subKey) => `${subKey}${separatorStr}${parentKey}`,
	suffixer: (separatorStr) => (parentKey, subKey) => `${parentKey}${separatorStr}${subKey}`,
	// kvaPrefixer('->')
	prefixer_arrow: (parentKey, subKey) => `${parentKey}'->'${subKey}`,
	suffixer_arrow: (parentKey, subKey) => `${subKey}'->'${parentKey}`,
}


const flattenItemND = (kvaMapFn_renamer) => (dsItem) => Object.fromEntries(
	Object.entries(dsItem).reduce((acc, [parentKey, val]) => is.nonIterableObj(val)			// check if true...
		? [...acc, ...Object.entries(val).map(([subKey, subVal]) => ([kvaMapFn_renamer(parentKey, subKey), subVal]))]		// if so, add sub-object kvas into the kva accumulator...  kvaMappingFn will resolve naming collisions, taking the parent key name as input
		: [...acc, [parentKey, val]]																												// if not, skip this prop & return the kva accumulator untouched
	), []
)

const dropProp = (propToDrop) => (acc, [key, val]) =>
	key == propToDrop							// is this true? 
		? acc 											// if so, skip the prop & return accumulator unchanged 
		: [...acc, [key, val]]			// if not, append kva to accumulator

const objReduce = (kvaReducerFn) => (obj) => Object.fromEntries(Object.entries(obj).reduce(kvaReducerFn, []))



// multiplyBy = arrayPropName<string> => objectWithArray<obj> => arrayOfObj<[obj]>
// if arrayPropName is non-existent in the dsItem, the dsItem itself will be returned in an array (as in [dsItem])
const multiplyBy_old = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])						// if array, and array has at least one item
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: [dsItem]

// multiplyByZ = arrayPropName<string> => objectWithArray<obj> => arrayOfObj<[obj]>
// if arrayPropName is non-existent in the dsItem, an empty array is returned
const multiplyByZ_old = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])						// if array, and array has at least one item
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: []




// multiplyBy = arrayPropName<string> => objectWithArray<obj> => arrayOfObj<[obj]>
// version 2 lossless - if array length is 0, will return the item wrapped in an array, but with the array property removed.  
// this way, the item will always be retained
const multiplyBy_v2 = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])													// if array and array has at least one item
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: [objReduce(dropProp(arrayPropName))(dsItem)]						// if no items in arrayPropName array, return the dsItem wrapped in an array, but dropping the 'arrayPropName' 


// multiplyBy_v2_lossy :: 				
// version 2 lossy - if array length is 0, an empty array will be returned.  Just like multiplying by 0 
const multiplyBy_v2_lossy = (arrayPropName) => (dsItem) =>
	is.array(dsItem[arrayPropName]) 				// if propname exists, AND if array  (true even if propname array is an empty array)
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: []


// non-destructive multiplyBy  (uses kvaPrefixer of '->' to resolve column conflicts).  Change prefix string, or alternately change to new kvnRenameFn other 
// than kvaPrefixer - like kvaSuffixer or something else
const multiplyByND = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])						// if array and array has at least one item
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenItemND(keyRenamer.prefixer('->'))(objItem, arrayPropName))
		: dsItem


/** multiplyByZ  (until I think of a better name)  **NOTE: curried ***
 * 
 *  Takes a prop name, and a dsItem with that propname (which mush be an array), 
 *  and returns an array that merges the dsItem itself, and 
 *   
 */
const multiplyByZ_py_wip = (arrProp) => (dsItem) => {
	if ( ! Array.isArray(dsItem[arrProp]) ) {
		return {
			...dsItem,
			[arrProp]: `The supplied propname into explode ${arrProp} does not reference an array`
		}
	}
	if (dsItem[arrProp]?.length === 0) {
		return null
	}
	const explodedList = dsItem[arrProp].map( (arrItem) => ({
		...dsItem,
		[arrProp]: arrItem
	}))
	return explodedList
}


const multiplyBy_py_wip = (arrProp) => (dsItem) => {
	if ( ! Array.isArray(dsItem[arrProp]) ) {
		return {
			...dsItem,
			[arrProp]: `The supplied propname into explode ${arrProp} does not reference an array`
		}
	}
	if (dsItem[arrProp]?.length === 0) {
		return [dsItem]
	}
	const explodedList = dsItem[arrProp].map( (arrItem) => ({
		...dsItem,
		...arrItem
	}))
	console.log({explodedList})
	return explodedList
}



// multiplyBy = arrayPropName<string> => objectWithArray<obj> => arrayOfObj<[obj]>
// if arrayPropName is non-existent in the dsItem, the dsItem itself will be returned in an array (as in [dsItem])
const multiplyBy = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])	?					// if array, and array has at least one item
		dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: [dsItem]																	// not an array, or array is empty - just return the dsItem in an array

// multiplyByZ = arrayPropName<string> => objectWithArray<obj> => arrayOfObj<[obj]>
// if arrayPropName is non-existent in the dsItem, an empty array is returned
const multiplyByZ = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])						// if array, and array has at least one item
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: null





// functions for export
export {
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
	flattenItemOnProps,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,

	flattenObject,
	flattenObjectRecursively,
	flattenObjectRecursivelyWith,
	
	// newer array multiplication routines
	multiplyBy,
	multiplyByZ,
	multiplyBy_v2,
	multiplyBy_v2_lossy,
	multiplyByND,
}

