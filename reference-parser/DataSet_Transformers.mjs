
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

const arr = {
	// eq: 					order not important, shallow-values only
	// alignedWith: order is important, shallow-values only
	// eqDeep: 			order is important, deep-values supported (not 100% reliable with instantiated objects (Maps, Sets, etc) due to JS - always test!!)
	eq: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && arr1.length === arr2.length && arr2.every((item) => arr1.includes(item)),
	neq: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && (arr1.length !== arr2.length || !(arr2.every((item) => arr1.includes(item)))),
	alignedWith: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && arr1.length == arr2.length && arr2.every((item, idx) => arr1[idx] === item),
	// eqDeep: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && deepEqualFast(arr1, arr2), // order is important!
	// neqDeep: /** @type {PF_Pred_Arr} 	*/ (arr2) => (arr1) => Array.isArray(arr1) && Array.isArray(arr2) && !deepEqualFast(arr1, arr2),
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




const classify = (item) => {
	console.log(`[classify] ORION: ${item.toLocalString()}`)
	const primitiveType = typeof (item)
	let classifier = ''
	switch (primitiveType) {
		case 'string': { classifier = (item == '') ? 'string::primitive::falsey' : 'string::primitive'; break }
		case 'number': { classifier = (isNaN(item)) ? 'number::primitive::falsey' : 'number::primitive'; break }
		case 'bigint': { classifier = 'bigint::primitive'; break }
		case 'boolean': { classifier = 'boolean::primitive'; break }
		case 'symbol': { classifier = 'symbol::primitive'; break }
		case 'undefined': { classifier = 'undefined::primitive::falsey'; break }
		case 'function': {
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
		case 'object': {
			// classification level 1
			if (item == null) {
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
				classifier = `${classifier}::iterator`
			}
			else {
				classifier = `${classifier}::noniterator`
			}
		}	// case
	}	// switch
	return classifier
}  // end of function




/*** Object Transformation Helpers
	 * 
	 * kvaMap - 		applies a key-value array mapping (kvaMapFn) to each entry in Object.entries(obj), to manipulate 
	 * 							object keys & vals, but keeps the same number of & order of keys (rename, reorder, etc)
	 * 
	 * kvaReduce - 	applies a key-value array reducer (kvaReduceFn) to Object.entries(obj) to manipulate object keys & values. 
	 * 							Can rename/append/insert/prepend/reorder/combine/delete keys).
	 * 
	 * 
	 * user-created kvaMapFn:		::  params	=>	[key,val] => [key,val]
	 * 		example:		prefixObjKeys = (prefixStr) => ([key,val]) => [ `${prefixStr}_${key}`, val ]
	 * user-created kvaReduceFn 	::	params	=>	( accumulator, [key,val] ) => [key,val]
	 * 		example:		dropProps = (propsToDrop) => (acc, [key,val] ) => propsToDrop.includes(key) ? acc : [...acc, [key,val] ]
	 * 
	 * 	Definitions:
	 * 	  
	 * 	objEntry  			- 	tuple implemented as 2-element JS array: [propName, value]  
	 * 	kva							-		key/value array - same as objEntry  
	 * 	objEntries			::	[objEntry]			// array of kvas (used to create object or Map via Object.fromEntries)  
	 * 	acc:<type>			-		tags the type as an accumulator (for a reducer)  
	 * 	(p1, p2, ...)		-		n-ary arguments  
	 *   
	 * kvaMapFn				::	{arbitraryArgs} => objEntry	=>	objEntry  
	 * kvaMap					::	kvaMapFn	=> dsObject	=> dsObject  
	 * 
	 * kvaReducerFn		::	{arbitraryArgs} => (acc:[objEntry], objEntry)	=>	objEntry   
	 * kvaReduce				::	kvaReducerFn	=> dsObject	=> dsObject  
	 * 
	 * kvaMapFn_TL			::	{arbitraryArgs} => objEntry	=>	[ objEntry ]			// notice the typelift into an array  
	 * kvaFlatMap			::	kvaMapFn_typeliftedFn	=> dsObject	=> dsObject			// monadic - downlifts a typelifted mapping function  
	 *   
	 * NOTE on typelifting (kvaMapFn_TL): 
	 *  
	 * This typelifted function was required to make an array of N elements map over and return an array of N+M elements 
	 * Some array elements are mapped to several new elements in an expansion routine 
	 * Others just return an mapped element (just like array.map) 
	 * But since we have to return the same type for both scenarios, both are returned in an extra array wrapper. 
	 * When we apply this typelifted function, the array flatMap function will automatically unwrap for us 
	 * In this context, array is a Monad
	*/

// objReduce :: kvaReduceFn => dsItem	=> dsItem
// performs a reduce operation on object entries (each in the form of a [key,value] array)
// 100% identical to kvaReduce - changing name of kvaReduce to objReduce
const objReduce = (kvaReducerFn) => (obj) => Object.fromEntries(Object.entries(obj).reduce(kvaReducerFn, []))

// objMap :: kvaMapFn => dsItem	=> dsItem
// performs a map operation on object entries (each in the form of a [key,value] array)
// 100% identical to kvaMap - changing name of kvaMap to objMap
const objMap = (kvaMapFn) => (obj) => Object.fromEntries(Object.entries(obj).map(kvaMapFn))

// objFlatMap :: kvaFlatMapFn => dsItem	=> dsItem
// performs a map operation on object entries (each in the form of a [key,value] array)
// 100% identical to kvaMap - changing name of kvaMap to objMap
const objFlatMap = (kvaFlatMapFn) => (obj) => Object.fromEntries(Object.entries(obj).flatMap(kvaFlatMapFn))

// objFilterOut :: kvaPredicateFn => dsItem	=> dsItem
// performs a filter operation on object entries (each entry in the form of a [key,value] array, aka 'kva')
const objFilter = (kvaPredicateFn) => (obj) => Object.fromEntries(Object.entries(obj).filter(kvaPredicateFn))


const kvaMap = (kvaMapFn) => (oldObj) => Object.fromEntries(Object.entries(oldObj).map(kvaMapFn))

// kvaFlatMap :: kvaMapFn_TL => dsItem => dsItem
const kvaFlatMap = (kvaMapFn_TL) => (oldObj) => Object.fromEntries(Object.entries(oldObj).flatMap(kvaMapFn_TL))

// kvaReduce :: kvaReduceFn => dsItem	=> dsItem
const kvaReduce = (kvaReduceFn) => (oldObj) => Object.fromEntries(Object.entries(oldObj).reduce(kvaReduceFn, []))

// apply a kvaMapFn to dsArray:
//	mapCols_kva ::	kvaMapFn => dsArray => dsArray
const mapCols_kva = (kvaMapFn) => (dsArray) => dsArray.map(kvaMap(kvaMapFn))

/** Example functions of type: kvaMapFn
	 * 
	 * key-renaming kvaMapFns:
	 * 	const prefixObjKeys = (prefixStr) => 	([ key, val ]) => [ `${prefixStr}_${key}`	, val ]
	 * 	const suffixObjKeys = (suffixStr) => 	([ key, val ]) => [ `${key}_${suffixStr}`	, val ]
	 * 	const renameMap = 		(mappingObj)=> 	([ key, val ]) => [ `${mappingObj[key] ?? key}`	, val ]
	 *
	 * data-manipulating kvaMapFns:
	 * 	const fillWithInitialValues = (initValue)	=>		([ key, val ]) => [ key, initValue ]
	 * 	const valueIfEmpty = 					(defaultValue) =>	([ key, val ]) => [ key, val ?? defaultValue ]
	 * 	const swapKeysAndValues = 											([ key, val ]) => [ val, key ]
	 *  
	 */


// discovers every first-level property name in an array of objects returns a the union of all property names
// discoverSchema :: [object] -> [string]
const discoverSchema = (objArray=[]) => {
	const allKeys = objArray.map((item) => Object.keys(item)).flat()
	return [...new Set(allKeys)]				// dedup any identically-schema'd records
}


/*** colNamesWith can be used wherever an array of propNames [propName] is expected
	*/
const colNamesWith = (stringPredicateFn) => (dsArray) => {
	const schema = discoverSchema(dsArray)
	return schema.filter(stringPredicateFn)
}


/*** column dropping routines 
	 * Purpose: column dropping / aka column 'filter-out'
	 * 
	 * kvaReduceFn dropProp		::	propName => (acc:[objEntry], objEntry)	=>	objEntry 
	 * dropCol :: propName => dsArray	=>	dsArray 
	 * 
	 * dropCol2 :: propName => dsArray	=>	dsArray 				(possibly more performant??  probably not but check)
	 * 
	 * kvaReduceFn dropProps :: [propName] => (acc:[objEntry], objEntry)	=>	objEntry  
	 * dropCols :: 	[propName] => dsArray	=>	dsArray 
	 * 
	 * // these avoid use of reducer function
	 * dropProps2 ::	[propName] => dsItem	=> dsItem
	 * dropCols ::		[propName] => dsArray => dsArray
	 * 
	 */

//	kvaReduceFn dropProp		::	propName => (acc:[objEntry], objEntry)	=>	objEntry 
const dropProp = (propToDrop) => (acc, [key, val]) =>
	key == propToDrop							// is this true? 
		? acc 											// if so, skip the prop & return accumulator unchanged 
		: [...acc, [key, val]]			// if not, append kva to accumulator

const dropCol = (propToDrop) => (dsArray) => dsArray.map(kvaReduce(dropProp(propToDrop)))

// as as dropCol but using older code - measure performance against large & small datasets
const dropCol2 = (propToDrop) => (dsArray) => {
	const copyOfArray = structuredClone(dsArray)
	copyOfArray.forEach((dsItem) => delete dsItem[propToDrop])		//	forEach mutates the array, which is why we're working with a copy
	return copyOfArray
}

//	objReduceFn dropProps		::	[propName] => (acc:[objEntry], objEntry)	=>	objEntry 
const $dropProps = (...propsToDrop) => (acc, [key, val]) =>
	propsToDrop.flat().includes(key)			// is this true? 
		? acc												// if so, skip & return the accumulator unchanged (effectively dropping the prop)
		: [...acc, [key, val]] 		// if not, append to the accumulator & return it

//	objReduceFn $dropPropsWhereKey		::	[propName] => (acc:[objEntry], objEntry)	=>	objEntry 
const $dropPropsWhereKey = (key_predicateFn) => (acc, [key, val]) =>
	key_predicateFn(key)					// is this true? 
		? acc												// if so, skip & return the accumulator unchanged
		: [...acc, [key, val]] 		// if not, append to the accumulator & return it

//	ojbReduceFn $dropPropsWhereKVA	::	[propName] => (acc:[objEntry], objEntry)	=>	objEntry 
const $dropPropsWhereKVA = (kva_predicateFn) => (acc, [key, val]) =>
	kva_predicateFn([key, val])		// is this true? 
		? acc												// if so, skip & return the accumulator unchanged
		: [...acc, [key, val]] 		// if not, append to the accumulator & return it

const dropProps = (...propsToDrop) => (dsItem) => objReduce($dropProps(propsToDrop.flat()))(dsItem)
//const dropCols = (...propsToDrop) => (dsArray) => dsArray.flat().map( kvaReduce(dropProps(propsToDrop) ))
const dropCols = (...propsToDrop) => (dsArray) => dsArray.flat().map(dropProps(propsToDrop.flat()))

// without use of kvaReducerFn
const dropProps2 = (...propsToDrop) => (dsItem) => Object.fromEntries(Object.entries(dsItem).filter((x) => !propsToDrop.flat().includes(x[0])))
const dropCols2 = (...propsToDrop) => (dsArray) => dsArray.map(dropProps2(propsToDrop.flat()))


/*** Column extraction routines / aka "select" or "selectCols" 
	 * Purpose: column selection / aka column 'filter-in'
	 * 
	 *	extractCols 	::	[string]	=>	dsArray 	=>	dsArray
	 *	extractCol		::	string		=>	dsArray		=>	rawArray	(array of primitives instead of array of single-property objects)
	 */

// extractcols1: implementation as a reducer for 'kvaReduce'  (for future transducer use)
//	kvaReduceFn extractProps		::	[propName] => (acc:[objEntry], objEntry)	=>	objEntry 
const extractProps = (propsToGet) => (acc, [key, val]) =>
	propsToGet.includes(key)			// is this true? 
		? [...acc, [key, val]] 		// if so, append to the accumulator
		: acc												// if not, skip this prop

const extractCols1 = (..._colsToGet) => (dsArray) => {
	const colsToGet = _colsToGet.flat()
	return dsArray.map(kvaReduce(extractProps(colsToGet)))
}

// extractCols2 - w/out invoking "kvaReduce".  Performance between extractCols1 & 3
const extractCols2 = (..._colsToGet) => (dsArray) => {
	const colsToGet = _colsToGet.flat()
	return dsArray.map(
		(dsItem) => Object.keys(dsItem).reduce((acc, prop) =>
			colsToGet.includes(prop)
				? ({ ...acc, [prop]: dsItem[prop] })
				: acc,
		{}
		)
	)
}

// extractCols3 - exactly like extractCols2, 
//	...but rest/flat() treatment of params enables array to be passed without brackets!
const extractCols3 = (...colsToGetp) => (dsArray) => {
	const colsToGet = colsToGetp.flat()								// in conjunction with rest params
	return dsArray.map(
		(dsItem) => Object.keys(dsItem).reduce((acc, prop) =>
			colsToGet.includes(prop)
				? ({ ...acc, [prop]: dsItem[prop] })
				: acc,
		{}
		)
	)
}

// extractCols4 - no reducer.  Performance winner 
const extractCols4 = (...colsToGetp) => (dsArray) => {
	const colsToGet = colsToGetp.flat()
	return dsArray.map(
		(dsItem) => Object.fromEntries(Object.entries(dsItem).filter((x) => colsToGet.includes(x[0])))
	)
}

// extractCols aliases...(set to any of the extractCols functions above)
//
const extractCols = extractCols2				// extractCols2 chosen for better performance
const selectCols = extractCols
const select = selectCols

// extractCol	::	string => dsArray => [	primitive ]
const extractCol = (propName) => (dsArray) => dsArray.map((dsItem) => dsItem?.[propName] ?? `% extractCol:no column '${propName}'`)


/** 	Colum insertion routines
	 * Purpose: add columns or propNames based on internal data or user-supplied data
	 * 
	 *	addProp_withDefaultValue	::	string	=>	value	=> dsItem	=> dsItem 
	 *	addCol_withDefaultValue		::	string	=>	value	=> dsArray	=> dsArray
	 * 
	 *  addProp_withComputedValue ::	string =>	valueCalcFn =>	dsItem => dsItem
	 *	addCol_withComputedValue  ::	string =>	valueCalcFn => 	dsArray => dsArray
	 *
	 *	adProps ::	[propName] =>	dsItem	=>	dsItem
	 *	addCols	::	[colName]	=>	dsArray => dsArray
	 * 
	 */
//	addProp_withDefaultValue	::	string	=>	value	=>	dsItem	=>	dsItem
const addProp_withDefaultValue = (propToAdd) => (defaultValue) => (dsItem) => ({ ...dsItem, [propToAdd]: defaultValue, })
const addCol_withDefaultValue = (colToAdd) => (defaultValue) => (dsArray) => dsArray.map(addProp_withDefaultValue(colToAdd)(defaultValue))

//	addProp_withComputedValue	::	string	=>	fn	=>	dsItem	=>	dsItem
// 		valueCalcFn	::	someParam	=>	dsItem	=>	value			// typically resolves to a string
const addProp_withComputedValue = (propToAdd) => (valueCalcFn) => (dsItem) => ({ ...dsItem, [propToAdd]: valueCalcFn(dsItem), })
const addCol_withComputedValue = (colToAdd) => (valueCalcFn) => (dsArray) => dsArray.map(addProp_withComputedValue(colToAdd)(valueCalcFn))

/**
	 * sample valueCalcFn:
	 * const newColumnCombineEmpID_and_Name = dsItem	=> dsItem.EmpID+dsItem.Name
	 */

// addProps	::	propArray	=>	dsItem	=>	dsItem
const addProps = (propsToAdd) => (dsItem) => {
	const entriesToMerge = propsToAdd.map((propName) => [propName, ""])
	return Object.fromEntries(Object.entries(dsItem).concat(entriesToMerge))
}
const addCols = (colsToAdd) => (dsArray) => dsArray.map(addProps(colsToAdd))


/** 	Object / column flattening routines
	 * Purpose: flatten tables/objects with embedded objects/array into flat tables/objects
	 * 	
	 *	kvaReduceFn flattenProps		::	[propName] => (acc:[objEntry], objEntry)	=>	objEntry 
	 *	flattenItemOnProps	:: 	[propName]	=>	dsItem	=> dsItem
	 * 	flattenCols	::	[propName]	=>	dsArray => dsArray 
	 * 	
	 *	kvaReduceFn flattenProp		::	propName => (acc:[objEntry], objEntry)	=>	objEntry 
	 *	flattenItem	:: 	propName	=>	dsItem	=> dsItem
	 *	flattenCol	::	propName	=>	dsArray => dsArray
	 *	
	 * 	kvaReduceFn flattenProp2		::	propName	=>	objEntry	=>	[objEntry] 
	 *	flattenItem2	:: 	propName	=>	dsItem	=> dsItem
	 * 	flattenCol	::	propName	=>	dsArray => dsArray
	 *
	 *	flattenObjByPropName :: propName => dsItem => dsItem (legacy function - test performance) 
	 *	flattenColByPropName :: colName => dsArray => dsArray (legacy function - test performance) 
	 *
	 * 	kvaReduceFn flattenAllObjProps		::	(acc:[objEntry], objEntry)	=>	objEntry 
	 * 
	 * 	flattenItem	::	dsItem	=>	dsItem
	 * 	flattenAllObjCols	::	dsArray => dsArray
	 * 
	 * 	kvaReduceFn flattenAllObjPropsND		::	(acc:[objEntry], objEntry)	=>	objEntry 
	 * 	flattenItemND	::	renameFn => dsItem	=>	dsItem
	 * 	flattenAllColsND	::	renameFn => dsArray => dsArray
	 * 
	 * 	multiplyItemByArrayProp	::	propName	=>	dsItem	=>	[	dsItem	]
	 * 	flattenArrayCol :: colName => dsArray => [dsArray]
	 * 
	 * 
	 * 
	 * 
	 */


const flattenProps = (propsToFlatten) => (acc, [key, val]) =>
	propsToFlatten.includes(key) && is.nonIterableObj(val)		// check if true...
		? [...acc, ...Object.entries(val)] 									// if so, add sub-object kvas into the kva accumulator...  (destructive upon name collision)
		: [...acc, [key, val]]																// if not, skip this prop & return the kvam accumulator untouched

//	flattenItemOnProps	:: 	[propName]	=>	dsItem	=> dsItem
const flattenItemOnProps = (propsToFlatten) => (dsItem) => kvaReduce(flattenProps(propsToFlatten))(dsItem)

//	flattenCols	::	[propName]	=>	dsArray => dsArray 
const flattenCols = (colsToFlatten) => (dsArray) => dsArray.map(flattenItemOnProps(colsToFlatten))


//	kvaReduceFn flattenProp		::	propName => (acc:[objEntry], objEntry)	=>	objEntry 
const flattenProp = (propToFlatten) => (acc, [key, val]) =>
	(propToFlatten === key) && classify(val).includes('noniterator')	// check if true...
		? [...acc, ...Object.entries(val)] 						// if so, add all sub-object kvas into the kva accumulator...  (destructive upon name collision)
		: [...acc, [key, val]]													// if not, skip this prop & return the kvam accumulator untouched

//	flattenItemOnProp	:: 	propName	=>	dsItem	=> dsItem
const flattenItemOnProp = (propToFlatten) => (dsItem) => kvaReduce(flattenProp(propToFlatten))(dsItem)

//	flattenCol	::	propName	=>	dsArray => dsArray
const flattenCol = (colToFlatten) => (dsArray) => dsArray.map(flattenItemOnProp(colToFlatten))


//	kvaReduceFn flattenProp2		::	propName	=>	objEntry	=>	[objEntry] 
const flattenProp2 = (propToFlatten) => ([key, val]) => {
	return (propToFlatten == key) && is.nonIterableObj(val) 			// check if true...
		? Object.entries(val)  		// if so, add all sub-object kvas into the kva accumulator...  (destructive upon name collision)
		: [[key, val]] 						// if not, skip this prop & return the kva 
}

//	flattenItemOnProp2	:: 	propName	=>	dsItem	=> dsItem
const flattenItemOnProp2 = (propName) => kvaFlatMap(flattenProp2(propName))

//	flattenCol2	::	propName	=>	dsArray => dsArray
const flattenCol2 = (propName) => (dsArray) => dsArray.map(flattenItemOnProp2(propName))

//	old implementation - mutable, maybe faster???
// valid use case - propKey refers to non-iterable subObject
const flattenObjByPropName = (subObjectPropName) => (obj) => {
	if (typeof (obj[subObjectPropName]) === 'object') {				// valid use case:
		let reshapedObj = { ...obj, ...obj[subObjectPropName], }  // parent's propName is overwritten upon conflict
		delete reshapedObj[subObjectPropName]
		return reshapedObj
	}
	// propKey does not refer to a subObject - do nothing
	return { ...obj }
}

//	flattenColByPropName 	::	propName	=>	dsArray => dsArray
const flattenColByPropName = (propName) => (dsArray) => dsArray.map(flattenObjByPropName(propName))

// 	flattenAllObjProps:  kva reducer to flatten ALL non-iterable subobjects in an given dsItem:
//	kvaReduceFn flattenAllObjProps		::	(acc:[objEntry], objEntry)	=>	objEntry 
const flattenAllObjProps = (acc, [key, val]) => {
	const result = is.nonIterableObj(val) ?						// if the entry is an object (but not an array), 
		[...acc, ...Object.entries(val)] 							//    then flatten the object using Object spread...  (destructive upon name collision)
		: [...acc, [key, val]]														// otherwise, return the object untouched
	return result
}

//	flattenItem	::	dsItem	=>	dsItem
const flattenItem = (dsItem) => {
	const result = objReduce(flattenAllObjProps)(dsItem)
	return result
}

// like flattenItem (flattens all non-interable sub-objects), but recursively
// note: like flattenItem, any overlapping prop names in sub-object will be overwritten.
// so care must be taken to ensure that keys do not overlap
const flattenItemR = (dsItem) => {
	return (Object.entries(dsItem).some(([key, val]) => is.nonIterableObj(val)))  	// only looking for non-iterable sub-objects
		? flattenItemR(flattenItem(dsItem))
		: dsItem
}

//	renameTag	::	string => dsItem	=>	dsItem
const renameTag = (propName) => ({ tag, ...rest }) => ({ [propName]: tag, ...rest })



/**	flattenTagged :: 	string => object	=>	dsItem
	 * 	Similar to flattenItem, but accepts a string parameter which flattens the object, but also
	 *  renames the 'tag' property name to the propName supplied by the user.
	 * 
	 * 	Used in situations where you have a 'oneOf' parser matching one of an array of parsers, each of which names
	 *  it's result with a different tag.
	 * 	If this were a 'seqOf' parser, we would use .map(getTagged), but seqOf is an object builder, whereas
	 * 	'oneOf' is a selector, which may or may not return an object.  This is only useful where the parsers within
	 *  the 'oneOf' already return objects.  The .tagAs() adds a prop called 'tag', set to the given value, but
	 *  we don't alwasy want the name to be 'tag'.  So this function basically tags the object, flattens it, and renames
	 *  the 'tag' prop to that which was supplied by the user.
	 * 
	 * 		const oneOfTheseLineParsers = oneOf(
	 * 			ipAddr			.tagAs('type123'),
	 * 			ipAddrOrNet .tagAs('ipAddrOrNet'),
	 * 			ipNet 			.tagAs('ipNet'),
	 * 			ipMcAddr		.tagAs('ipMcAddr'),
	 * 			ipUcAddr		.tagAs('ipUcAddr'),	
	 * 		).map(flattenTagged('newcol'))
	 * 
	 * Which, instead of using .getTagged to select whi
	 */


const flattenTagged = (newPropName) => ({ tag, ...dsItem }) => ({ [newPropName]: tag, ...dsItem })

//	flattenAllObjCols	::	dsArray => dsArray
const flattenAllObjCols = (dsArray) => dsArray.map(flattenItem)

/*	Use this as 'kvaMappingFn' input into flattenAllObjPropsND to add a separator in column names
	const kvaPrefixer =  (separatorStr) => (prefix) => ([ key, val ]) => [ `${prefix}${separatorStr}${key}`	, val ]
	const kvaSuffixer =  (separatorStr) => (suffix) => ([ key, val ]) => [ `${key}${separatorStr}${suffix}`	, val ]
	
	usage:	flattenAllObjPropsND(kvaPrefixer('->') ) // will non-destructively merge all columns, making an arrow-looking string between parent and child object
	*/
// kvaPrefixer('->')
const kvaPrefixer = (separatorStr) => (prefix) => ([key, val]) => [`${prefix}${separatorStr}${key}`, val]
const kvaSuffixer = (separatorStr) => (suffix) => ([key, val]) => [`${key}${separatorStr}${suffix}`, val]


const kvaPrefixer2 = (prefix) => ([key, val]) => [`${prefix}'->'${key}`, val]
const kvaSuffixer2 = (suffix) => ([key, val]) => [`${key}'->'${suffix}`, val]

// 	flattenAllObjPropsND:  (non-destructive) kva reducer to flatten ALL non-iterable subobjects in an given dsItem:
//	kvaReduceFn flattenAllObjPropsND		::	(acc:[objEntry], objEntry)	=>	objEntry 
const flattenAllObjPropsNDa = (kvaMappingFn) => (acc, [key, val]) => {
	const result = is.nonIterableObj(val)			// check if true...
		? [...acc, ...Object.entries(val).map(kvaMappingFn(key))] 	// if so, add sub-object kvas into the kva accumulator...  kvaMappingFn will resolve naming collisions, taking the parent key name as input
		: [...acc, [key, val]]														// if not, skip this prop & return the kva accumulator untouched
	return result
}
const flattenAllObjPropsNDb = (kvaMappingFn) => (acc, [key, val]) => {
	const result = is.nonIterableObj(val)			// check if true...
		? [...acc, [...Object.entries(val)].map(kvaMappingFn(key))] 	// if so, add sub-object kvas into the kva accumulator...  kvaMappingFn will resolve naming collisions, taking the parent key name as input
		: [...acc, [key, val]]														// if not, skip this prop & return the kva accumulator untouched
	return result
}
const flattenAllObjPropsNDc = (kvaMappingFn) => (acc, [key, val]) => {
	//			const result = typeof(val) == 'object' && !isIterableObj(val)			// check if true...
	const result = is.nonIterableObj(val)			// check if true...
		? [...acc, Object.entries(val).map(kvaMappingFn(key))] 	// if so, add sub-object kvas into the kva accumulator...  kvaMappingFn will resolve naming collisions, taking the parent key name as input
		: [...acc, [key, val]]														// if not, skip this prop & return the kva accumulator untouched
	return result
}
const flattenAllObjPropsND = flattenAllObjPropsNDa


//	flattenItemND	::	renameFn => dsItem	=>	dsItem
const flattenItemND = (renameFn) => (dsItem) => kvaReduce(flattenAllObjPropsND(renameFn))(dsItem)


//	flattenAllColsND	::	renameFn => dsArray => dsArray
const flattenAllObjColsND = (renameFn) => (dsArray) => dsArray.map(flattenItemND(renameFn))


// 	flattenAllObjPropsND2:  (non-destructive) kva reducer to flatten ALL non-iterable subobjects in an given dsItem:
//			like flattenAllObjPropsND, but with user-supplied column delimiter used when joining the columns to preserve old & new column names
//	kvaReduceFn flattenAllObjPropsND2 - instead of renameFn, supply a delimiterString and manually append column when reconsituting the subObj
//	kvaReduceFn flattenAllObjPropsND2		::	string => (acc:[objEntry], objEntry)	=>	objEntry 
const flattenAllObjPropsND2 = (colDelimStr) => (acc, [key, val]) => {
	const result = is.nonIterableObj(val)			// check if true...
		? [...acc, ...Object.entries(val).map(([key2, val2]) => [`${key}${colDelimStr}${key2}`, val2])] 	// if so, add sub-object kvas into the kva accumulator...  (destructive upon name collision)
		: [...acc, [key, val]]														// if not, skip this prop & return the kva accumulator untouched
	return result
}
//	flattenItemND2	::	(colDelimStr) => dsItem	=>	dsItem
const flattenItemND2 = (colDelimStr) => (dsItem) => kvaReduce(flattenAllObjPropsND2(colDelimStr))(dsItem)
//	flattenAllColsND2	::	(colDelimStr) => dsArray => dsArray
const flattenAllObjColsND2 = (colDelimStr) => (dsArray) => dsArray.map(flattenItemND2(colDelimStr))



// 	flattenAllObjPropsND:  (non-destructive) kva reducer to flatten ALL non-iterable subobjects in an given dsItem:
//	kvaReduceFn flattenAllObjPropsND		::	(acc:[objEntry], objEntry)	=>	objEntry 
var flattenKvaByPropND = (propName, kvaMappingFn) => (acc, [key, val]) => {
	const result = (propName === key) && is.nonIterableObj(val)			// check if true...
		? [...acc, ...Object.entries(val).map(kvaMappingFn(key))] 	// if so, add sub-object kvas into the kva accumulator...  kvaMappingFn will resolve naming collisions, taking the parent key name as input
		: [...acc, [key, val]]														// if not, skip this prop & return the kva accumulator untouched
	return result
}
//	flattenItemND	::	renameFn => dsItem	=>	dsItem
var flattenItemByPropND_b = (propName) => (renameFn) => (dsItem) => kvaReduce(flattenKvaByPropND(propName, renameFn))(dsItem)



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




// multiplyBy_old  = arrayPropName<string> => objectWithArray<obj> => arrayOfObj<[obj]>
// if arrayPropName is non-existent in the dsItem, the dsItem itself will be returned (see note)
// NOTE: returning the item itself doesn't seem right - because the output should be an array, whether empty or a single item inside
const multiplyBy_old = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: dsItem ?? []


// multiplyBy = arrayPropName<string> => objectWithArray<obj> => arrayOfObj<[obj]>
// if arrayPropName is non-existent in the dsItem, the dsItem itself will be returned in an array (as in [dsItem])
const multiplyBy = (arrayPropName) => (dsItem) =>
	arr.notEmpty(dsItem[arrayPropName])						// if array and array has at least one item
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenObjByPropName_replace(objItem, arrayPropName))
		: [dsItem]


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
		? dsItem[arrayPropName].map((subItem) => ({ ...dsItem, [arrayPropName]: subItem })).map((objItem) => flattenItemND(kvaPrefixer('->'))(objItem, arrayPropName))
		: dsItem





/* a reducer for an Array used to convert array of similar objects, (all with 
		 the same keyName, each key containing a unique value) to a single object, keyed
		 by the value of the item's 'keyName' */
const reduce_itemToObject = (keyName) => (obj, item, index) => {
	if (!obj[item[keyName]]) {			// if entry doens't exist in object yet (no keyName collisions)
		obj[item[keyName]] = item
		return { ...obj, }
	}
	else {												// otherwise, use old array index position as a key
		obj[index] = item
		return { ...obj, }
	}
}
const arrayToObject = (name) => (result) => {
	return result.reduce(reduce_itemToObject(name), {})
}


//	multiplyItemByArrayProp	::	propName	=>	dsItem	=>	[	dsItem	]
const multiplyItemByArrayProp = (propName_ofArrayToFlatten) => (dsItem) =>
	is.iterable(dsItem[propName_ofArrayToFlatten])
		? dsItem[propName_ofArrayToFlatten].map((subItem) => ({ ...dsItem, [propName_ofArrayToFlatten]: subItem }))
		: dsItem
const flattenArrayCol = (arrayColToFlatten) => (dsArray) => dsArray.flatMap(multiplyItemByArrayProp(arrayColToFlatten))


const combineProps = (...fromCols) => (delim) => (dsItem) => ({ ...dsItem, [fromCols.flat().join(delim)]: fromCols.map((colname) => dsItem[colname]).join(delim) })
const combineCols = (...fromCols) => (delim) => (dsArray) => dsArray.map(combineProps(fromCols.flat())(delim))

const mergeCols = (fromCols) => (delim) => (dsArray) => {
	const interrimResult = combineCols(fromCols)('|')(dsArray)
	return dropCols(fromCols)(interrimResult)
}



export {
	dropProp,
	dropCol,
	dropCol2,
	$dropProps,
	$dropPropsWhereKey,
	dropProps,
	dropCols,
	dropProps2,
	dropCols2,
	extractProps,
	extractCols,
	select,
	extractCol,
	addProp_withDefaultValue,
	addCol_withDefaultValue,
	addProp_withComputedValue,
	addCol_withComputedValue,
	addProps,
	addCols,
	flattenProps,
	flattenItemOnProps,
	flattenCols,
	flattenProp,
	flattenItemOnProp,
	flattenCol,
	flattenProp2,
	flattenItemOnProp2,
	flattenCol2,
	flattenObjByPropName,
	flattenColByPropName,
	flattenItem,
	flattenItemR,
	renameTag,
	flattenTagged,
	flattenAllObjCols,
	flattenAllObjPropsND,
	flattenAllObjColsND,
	flattenAllObjPropsND2,
	flattenAllObjColsND2,
	arrayToObject,
	multiplyItemByArrayProp,
	flattenArrayCol,
	combineProps,
	combineCols,
	mergeCols,
	multiplyBy,
	multiplyByND,
	kvaReduce,
	classify,
}
