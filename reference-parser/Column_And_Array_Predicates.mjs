/** Borrowed code was used to minimize dependencies **/
const Code_Burrowed_from_Module_DeepValues = () => {

	const stringify = (dsItem)	=>	[...Object.keys(dsItem), ...Object.values(dsItem)].join() 	// faster than JSON.stringify() for hash purposes

	const __typeofDeep = (item) => {

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

		const type = __typeof(item)
		if (type === 'function') return`function::${item.name || item.toString().slice(0,200)}`
		if (type === 'class') return `class::` + item.name
		if (type !== 'object') return type
		if (item.constructor.name === 'Object') return `object::${Object.keys(item).toString()}`
		return `object::${item.constructor.name}`
	}

	return {
		__typeofDeep,
		stringify,
	}
}

const {
	__typeofDeep,
	stringify,
} = Code_Burrowed_from_Module_DeepValues()


//
// curried versions - x & y are read backwards compared to non-curried versions
// since y is 'pre-supplied' with a value, and x is the "target" of comparison
/*
	const eq_ = y => x => x === y
	const neq_ = y => x => x !== y
	const lt_ = y => x => x < y
	const gt_ = y => x => x > y
	const lte_ = y => x => x <= y
	const gte_ = y => x => x >= y
*/
// type & deep value equality comparison predicates 

const typeEqual = (y) => (x) => __typeofDeep(y) === __typeofDeep(x)
const isEqual = (y) => (x) => x.equals?.(y) ?? stringify(x) === stringify(y)

//	itemEquals :: String => (dsItem, dsItem) => Boolean
const itemEquals = (colName, value) => (item) => item[colName] === value

//	These factories can be used like modular mix-ins.  When used with Object.assign
// 	as a mix-in, they are merged by reference, not by value, so this is an efficient
// 	way to add a number of methods to an arbitrary data object.
//
//	Warning: these need a lot of testing & debugging.  They were created
//	very quickly. 


// can be imported into other functions as mixins via Object.assign (see col() below)
const predicateFactory = (colName) => ({
	eq: (value) => (dsItem) => dsItem[colName] === value,
	neq: (value) => (dsItem) => dsItem[colName] != value,
	lt: (value) => (dsItem) => dsItem[colName] < value,
	gt: (value) => (dsItem) => dsItem[colName] > value,
	lte: (value) => (dsItem) => dsItem[colName] < value,
	gte: (value) => (dsItem) => dsItem[colName] > value,
	includes: (value) => (dsItem) => dsItem[colName]?.includes(value),
	startsWith: (value) => (dsItem) => dsItem[colName]?.startsWith(value),
	endsWith: (value) => (dsItem) => dsItem[colName]?.endsWith(value),
	matches: (regexp) => (dsItem) => dsItem[colName]?.match(regexp),
})

const numberPredicateFactory = (colName) => ({
	eq: (value) => (dsItem) => dsItem[colName] === value,
	neq: (value) => (dsItem) => dsItem[colName] != value,
	lt: (value) => (dsItem) => dsItem[colName] < value,
	gt: (value) => (dsItem) => dsItem[colName] > value,
	lte: (value) => (dsItem) => dsItem[colName] < value,
	gte: (value) => (dsItem) => dsItem[colName] > value,
	between: (low, high) => (dsItem) => (dsItem?.[colName] ?? false > low) || (dsItem?.[colName] ?? false < high),
	betweenXL: (low, high) => (dsItem) => (dsItem?.[colName] ?? false >= low) || (dsItem?.[colName] ?? false <= high),
	betweenXH: (low, high) => (dsItem) => (dsItem?.[colName] ?? false > low) || (dsItem?.[colName] ?? false < high),
	betweenX: (low, high) => (dsItem) => (dsItem?.[colName] ?? false > low) || (dsItem?.[colName] ?? false < high),
	isFinite: () => (dsItem) => Number.isFinite(dsItem[colName]),
	isInteger: () => (dsItem) => Number.isInteger(dsItem?.[colName]) ?? false,
	isNaN: () => (dsItem) => Number.isNaN(dsItem[colName]),
	isInfinite: () => (dsItem) => (dsItem[colName] == Number.POSITIVE_INFINITY) ?? (dsItem[colName] == Number.NEGATIVE_INFINITY) ?? false,
})

const booleanPredicateFactory = (colName) => ({
	isTruthy: (value) => (dsItem) => dsItem[colName] == true,
	isTrue: (value) => (dsItem) => dsItem[colName] === true,
	isFalsey: (value) => (dsItem) => dsItem[colName] == false,
	isFalse: (value) => (dsItem) => dsItem[colName] === true,
	isTruthy2: (value) => (dsItem) => !!dsItem[colName],
	isFalsey2: (value) => (dsItem) => !dsItem[colName],
})

const typePredicateFactory = (colName) => ({
	isObj: (dsItem) => dsItem[colName] !== null && typeof dsItem[colName] == 'object',  // 
	notObj: (dsItem) => dsItem[colName] !== null && typeof dsItem[colName] !== 'object',
	isIterable: (dsItem) => typeof dsItem[colName] == 'object' && typeof dsItem?.[colName]?.[Symbol.iterator] == 'function',
	notIterable: (dsItem) => !(typeof dsItem[colName] == 'object' && typeof dsItem?.[colName]?.[Symbol.iterator] == 'function'),
	isArray: (dsItem) => Array.isArray(dsItem[colName]),
	isPrimitive: (dsItem) => ['string', 'number', 'bigint', 'boolean', 'undefined', 'null'].includes(typeof (dsItem[colName])),
	isEmptyArray: (dsItem) => Array.isArray(dsItem[colName]) && dsItem[colName].length === 0 || false,
	isNonEmptyArray: (dsItem) => Array.isArray(dsItem[colName]) && dsItem[colName].length > 0 || false,
	isNullish: (dsItem) => !dsItem[colName],
	notNullish: (dsItem) => !!dsItem[colName],
	isNull: (dsItem) => dsItem[colName] === null,
	isUndefined: (dsItem) => typeof dsItem[colName] == 'undefined',
	passesLogicalOrOpWith: (dsItem) => dsItem[colName] || 'rightValue',
	passesLogicalAndOpWith: (dsItem) => dsItem[colName] && 'rightValue',
	passesTernary: (dsItem) => dsItem[colName] ? 'passes' : 'fails',
	passesNullishCoalescingOpWith: (dsItem) => dsItem[colName] ?? 'rightValue',
})

//////////////////////////////////////////////////////
// col() example:
// 		dsItem => col('colname').eq(value) (dsItem) 
//	same as: 
//		dsItem => dsItem.colName == value
//	performance the same
const col = (colName) => {
	const result = (dsItem) => dsItem[colName]
	Object.assign(result, predicateFactory(colName))   // <-- this mixin adds additional functionality to each object
	return result
}

/* operation:
*	col('somecol') = returns a function (dsItem) => dsItem[colName],
	but before it returns it, it adds a number of properties to allow for method chaining.
	It's important for the properties to be functions that also take (dsItem) as its last parameter
	
	a call to col('somecol') retuns this function: 
			dsItem => dsItem['somecol']            ~((dsItem))
	
	a call to col('somecol').eq('someval') returns this function:   
			dsItem => dsItem['somecol'] === 'someval'
	
	Key point:  The chaining process looks like object.method, but it's still currying in disguise.
	The object.method(arg) still retutrns a function which needs the final dsItem.
	
	When a dsItem has a property that we want to promote 'on the fly' to an object, like a Date, or IPv4,
	Instead of col(colName), we use colIP(colName), which will automatically cast the text value of that 
	particular column into an instantiated object, such as an IPv4, if we know the column has ip addresses.
	We can also make colDate, colFancyObj, etc.
	
	For IP, the call to to colIP('someIPCol') returns this function:
			dsItem => new IPv4(dsItem['someIPCol'])
	
	It's important to note that it returns a function, not an IPv4 object.
	
	likewise, a call to colIP('someIPCol').eq('someIP'), returns this:
			dsItem => (new IPv4(dsItem['someIPCol']) ).eq('someIP')
	
	we want to generalize, and allow all methods that the eventual object has.  
	So a call to colIP.someMethod(someArgs), return this:
			dsItem => (new IPv4(dsItem['someIPCol']) ).someMethod(someArgs)
	
	so need to trap the method call 'someMethod', which, because of currying, 
	is a method call on a function:	`dsItem => new IPv4(dsItem['someIPCol'])`   (no dsItem yet)
	
	so we wrap the function object in a proxy, get the method name & its parameters, 
	store them in a closure, and return a new function:  
		dsItem => {
			[[method & args in closure]] 
			temp_ipObj = new IPv4(dsItem['someIPCol'])
			result = temp_ipObj.call('methodName', methodArgs)
			return retult
		}
*/

/*** castColAs(classFn)
* create a col function (curried) for a dsArray, using the specified class (classFn)
		const ipColumn = castColAs(IPv4)('myIpColumn')
	ipColumn can then be used like colIP below.
	
	But castColAs is generic for any class function.  We can use Dates, 
	
**/
const castColAs = (classFn,) => (colName) => {
	const valueGetterFn = (dsItem) => dsItem?.[colName] ?? `no column ${colName} found`
	const proxyForValueGetterFn = new Proxy(valueGetterFn, {
		get: (_, methodName) => {
			const trappedMethod = (...methodArgs) => (dsItem) => {
				return (classFn?.prototype?.[methodName]) ? (new classFn(dsItem[colName]))[methodName](methodArgs[0])	// first, run as instance method (i.e. in prototype)
					: (methodName in classFn) ? classFn[methodName](methodArgs[0])  // if not, run as a static method
					: (methodName in dsItem) ? dsItem[methodName](methodArgs[0])
					: dsItem			// return dsItem unchanged if no methods exist
			}
			return trappedMethod
		}			// get
	})   // trap obj & Proxy
	return proxyForValueGetterFn
}

const castColAs_old = (classFn,) => (colName) => {
	const valueGetterFn = (dsItem) => dsItem?.[colName] ?? `no column ${colName} found`
	const proxyForValueGetterFn = new Proxy(valueGetterFn, {
		get: (_, methodName) => {
			const trappedMethod = (...args) => (dsItem) => {
				if (dsItem[colName] === undefined) return `no column ${colName} found`
				if (dsItem[colName] === null) return `(${colName}):: this record has no data in column ${colName}`
				return (classFn?.prototype?.[methodName]) ? (new classFn(dsItem[colName]))[methodName](args[0])	// check if method is available in the instance
					: (methodName in classFn) ? classFn[methodName](args[0])   // check if method is available as static method
					: `[column(${colName}).${methodName}(${args[0]})]: method ${methodName} not found`
			}
			return trappedMethod
		}			// get
	})   // trap obj & Proxy
	return proxyForValueGetterFn
}

/*** colIP (colName_with_ip_networks_or_string)
*		IPv4-specific version of col(colName) - where colName contains IP addresses
*		more specific thatn castColAs - references IPv4() directly
*		@note - check if method is available as a static method in the class function itself
**/
// NOTE: colIP() below has been replaced by colIP, implemented in the IPv4 module
//	const colIP_old = (colName) => {
//		const valueGetterFn = dsItem => dsItem?.[colName] ?? `[colIP]: no column ${colName} found`
//		const proxyForValueGetterFn = new Proxy(valueGetterFn, {
//			get: (origObj, propKey) => {
//				const trappedMethod = (...args) => dsItem => {
//					//console.log(`colIP - calling property on real object`, {dsItem, colName, mia: dsItem[colName], args, argsFlat:args.flat() })
//					// had to remove the returning of error strings below, since predicate failures won't return falsey values
//					//					if (dsItem?.[colName]===undefined) return `[colIP](${colName}): no column ${colName} found`
//					//					if (! dsItem[colName] ) return `[colIP](${colName}):: this record has no data in column ${colName}`
//					if ((dsItem?.[colName] === undefined) || (!dsItem[colName])) return null   // maybe fix this in the future to return an IPv4 object with an embedded error?  May affect predicates & behavior of Array.filter()
//					if (!(propKey in IPv4.prototype)) return `[colIP_old(${colName}).${propKey}(${args[0]})]: method ${propKey} not found on IPv4 object`
//					const ipObject = new IPv4(dsItem[colName])
//					return ipObject[propKey](args[0])
//				}
//				return trappedMethod
//			}			// get
//		})   // trap obj & Proxy
//		return proxyForValueGetterFn
//	}

/** 	grouping / groupBy functions
 * 
 * 	sortBy :: String => (string property, string property) => ( 1 | 0 | -1 )
 * 	sortByNum :: String => (number, number) => ( 1 | 0 | -1 )
 * 
 * 	NOTE: with grouping, the dsArray is split into multiple arrays (no loss/gain of total rows) based
 * 	on user-supplied classificication function (itemClassifierFn).  The function returns a string 
 * 	which are held together by an Object.  
 * 
 * 	The object keys are each array has a key that is determined by the result of a calculation of the items value 
 * 	as such, this can replace the "splitBy" function by supplying a predicate
 * 	dsArray 					=== 	dsArray
 * 	propName					=== 	String
 * 	itemClassifierFn 	:: 		dsItem => String  (where String is a user-chosen groupName)
 * 	dsGrouped					===		Object(key: String groupName, value: dsArray)
 */

//	reducer_clasifyItem 	:: (itemClassifierFn) -> dsArray -> reducerFn 
//	 where:
// 			itemClassifierFn :: (dsItem -> string)    // where string is the category (group) name
// 			reducerFn ::  ( accumulatorArray, dsItem ) => dsGrouped
const reducer_classifyItem = (itemClassifierFn) => (dsArray) => (accObj, dsItem) => {
	const bucketName = itemClassifierFn(dsItem)
	accObj[bucketName] = accObj?.[bucketName] ?? []
	accObj[bucketName].push(dsItem)
	return accObj
}


/// countUniqueItems - like reducer_classifyItem, but tally's groups of things of an 
//	array.  If it's an array of objects, a group classifier function is used to map the object
// to a string - the string being the name of the category.  Simple items (if classified by their
// value, like strings or numbers, should be fed a function of the form x=>x, or x=>`${x}`, respectively.
// usage: 
//	countUniqueItems (x=>x) ( ['hi','bye','cat','blue','bye','bye','hi'] )  // 
const countUniqueItems = (itemClassifierFn) => (dsArray) => dsArray.reduce((accObj, item) => {
	const bucketName = itemClassifierFn(item)
	accObj[bucketName] = accObj?.[bucketName] ?? 0  // <-- bucket initialization counter
	accObj[bucketName]++														// <-- bucket increment counter
	return accObj
}, {})




/** @type {<T extends object>(dsArray: T[] | undefined, fieldSelectorFn: (item: T, index: number) => PropertyKey) => Partial<Record<PropertyKey, T>>} */
const groupBy_T = (dsArray=[], fieldSelectorFn) => Object.groupBy( dsArray, fieldSelectorFn )



// groupBy: PREVIOUS IMPLEMENTATION:
//		//	groupBy :: reducer_classifyItem f => dsArray => dsGrouped
//		const groupBy = (fieldSelectorFn) => (dsArray) => {
//			return dsArray.reduce(reducer_classifyItem(fieldSelectorFn)(dsArray), {})
//		}

// Updated implementation of curried groupBy:

/** @type { <T extends Object>((fieldSelectorFn: SelectorFn<T>) => dsArray?: T[] | undefined) => Partial<Record<PropertyKey, T[]>> } GroupBy<T> */
const groupBy = (fieldSelectorFn) => (dsArray=[]) => Object.groupBy( dsArray, fieldSelectorFn )





// groupByPropName :: string => dsArray => dsGroups
// Previous implementation:
// const groupByPropName = (propName) => (dsArray) => groupBy(col(propName))(dsArray)


// Updated implementation of curried groupByPropName:
const groupByPropName = (propName='') => (dsArray=[]) => {
	return Object.groupBy(dsArray, ((item)=>item[propName]))
}


// example: concat the values of two columns to derive a 'category':
// (helper/mappingFn) combine2Columns	::	[string]	=> dsItem	=>	string
const combine2Columns = (propNameArray) => (dsItem) => `${dsItem[propNameArray[0]]}::${dsItem[propNameArray[1]]}`

// (main) groupByPropSet :: [string] => dsArray => Object<dsArray>
//  example: groupByPropSet(['DeptName', 'EmpID']) (DS1)
const groupByPropSet = (propNameArray) => (dsArray) => groupBy(combine2Columns(propNameArray))(dsArray)



//*******************************************************************
// these run functions on each group to get subtotals

// a reducerSet has a reducer function and initial value, since the initial value and function are tightly bound by type
//				const groupReducerSet = [ (subtotal,dsItem) => acc + dsItem.column, 0  ]
//				
//				// automating a reducerSet with user-supplied monoidal binary operation ('op').  Note that 'op' must be compatible with the datatypes in the column
//				const makeGroupReducer = (propName, op, initialValue) => [ (subtotal,dsItem) => op(dsItem[propName])(subtotal), initialValue	]

// summarizeByGroup	::	dsGroupObj => 
const summarizeByGroup = (groupObject) => (groupReducerSet) => {
	const reducedEntries = Object.entries(groupObject).map(([groupName, group]) => ([groupName, group.reduce(...groupReducerSet)]))
	return Object.fromEntries(reducedEntries)
}

// NOTE: pezDispense below is like a take(2) function.  This can probably be refactored using an interator...
// like a Pez dispenser.  Returns two values - popped value off the top (right value), and the remaining array on the left 
// pezDispense :: [item] -> [ [item], item ]
const pezDispense = (_arr) => {
	const remainingArray = [..._arr]
	const value = remainingArray.pop()
	return [remainingArray, value]
}


//*******************************************************************
// these split the array into two (using a binary classifier (aka predicate fn) in 'groupBy')

// higher order replacements of orignal functions (test performance on these against orig)
//	splitArrayBy :: (dsItem => boolean) => dsArray => Object<dsArray>
const splitArrayBy = (predicateFn) => (dsArray) => groupBy(predicateFn)(dsArray)


//	splitArray :: dsArray => (dsItem => boolean) => Object<dsArray>
const splitArray = (dsArray) => (predicateFn) => groupBy(predicateFn)(dsArray)

const splitDuplicatesByContent = (dsArray) => {
	const uniqueItemCache = new Map()
	return dsArray.reduce((accObj, dsItem) => {
		const bucketName =
			uniqueItemCache.has(stringify(dsItem)) ? 'duplicate'
			: (uniqueItemCache.set(stringify(dsItem), dsItem), 'original')
		accObj[bucketName] = accObj?.[bucketName] ?? []
		accObj[bucketName].push(dsItem)
		return accObj
	}, {})
}

const splitDuplicatesByPropName = (propName) => (dsArray) => {
	const uniqueItemCache = new Map()
	return dsArray.reduce((accObj, dsItem) => {
		const bucketName =
			!(dsItem?.[propName]) ? 'missingProp'
			: uniqueItemCache.has(dsItem[propName]) ? 'duplicate'
			: (uniqueItemCache.set(dsItem[propName], dsItem), 'original')  // default value

		accObj[bucketName] = accObj?.[bucketName] ?? []
		accObj[bucketName].push(dsItem)
		return accObj
	}, {})
}

/** groupByKeyValidity
 * using propName as a unique key, return a dsGroup object grouping records into various classifications
 * of validity:
 *  'missingKey' - records which have no key
 * 	'nullishKeyValue' - records with nullish key value ('', null, NaN, or undefined)
 * 	'duplicateKeyValue' - records that show up more than once
 * 	'uniqueKeyValue'
*/
const groupByKeyValidity = (propName) => (dsArray) => {
	const uniqueItemCache = new Map()
	return dsArray.reduce((accObj, dsItem) => {
		const bucketName =
			!(propName in dsItem) ? 'missingKeyRecs'
			: !(dsItem[propName] ?? null) ? 'nullishKeyValueRecs'
			: uniqueItemCache.has(dsItem[propName]) ? 'duplicateKeyValueRecs'
			: (uniqueItemCache.set(dsItem[propName], dsItem), 'validRecs')  // default value
		accObj[bucketName] = accObj?.[bucketName] ?? []
		accObj[bucketName].push(dsItem)
		return accObj
	}, {})
}


[
	0, 1, 2
]
//*******************************************************************

//	filterBy :: (dsItem => Boolean) => dsArray => dsArray
const filterBy = (predicateFn) => (dsArray) => groupBy(predicateFn)(dsArray).true			//  all matching

//	nfilterBy :: (dsItem => Boolean) => dsArray => dsArray
const nfilterBy = (predicateFn) => (dsArray) => groupBy(predicateFn)(dsArray).false		// 	complement of filterBy


export {
	isEqual,
	col,
	groupBy,
	groupByPropName,
	groupByKeyValidity,
	groupByPropSet,
	filterBy,
	nfilterBy,
}
