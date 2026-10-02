//@ts-check
import { groupByPropName, isEqual } from "./Column_And_Array_Predicates.mjs"
import { intersection, mapDiffK, mapIntersectionK } from "./DataSet_Dedup_and_Sets.mjs"
import { combineProps, multiplyBy, multiplyByND } from "./DataSet_Transformers.mjs"
import { applyTemplateObject, createObjectTemplateFrom, discoverSchema } from "./Parser_Result_Helpers.mjs"

// Predicate generator for comparing objects in different tables (i.e. join functions) with dot syntax
// purpose: provide a more semantic API for joins - i.e. DataSet.of(EmpID).join

// definitely a work in progress
const onColumn = (prop1) => {
	return { 
		eq: 	(prop2) => (obj1, obj2) => obj1[prop1] === obj2[prop2] ,
		neq: 	(prop2) => (obj1, obj2) => obj1[prop1] !== obj2[prop2] ,
		lt: 	(prop2) => (obj1, obj2) => obj1[prop1] <   obj2[prop2] ,	
		gt: 	(prop2) => (obj1, obj2) => obj1[prop1] >   obj2[prop2] ,
		lte: 	(prop2) => (obj1, obj2) => obj1[prop1] <=  obj2[prop2] ,
		gte: 	(prop2) => (obj1, obj2) => obj1[prop1] >=  obj2[prop2] ,
		isEqualTo: (prop2)=>(obj1, obj2)=> isEqual(obj1[prop1], obj2[prop2]), 
	}
}

// alternate curried predicate generator:  compare values across two objects by prop names
// usage: const deptID_eq_id = onColumn('DeptID') (eq)  ('id')
const onColumn_curried = (prop1) => (binaryComparator) => (prop2) => (obj1, obj2) => binaryComparator( obj1[prop1], obj2[prop2])


// non-comparator-based predicate to compare object equality w/respect to props 
//	Note: check performance against comparator-based functions like 'onColumn'
const itemsEqualOnColumns = (prop1, prop2) => (obj1, obj2) => (obj1[prop1] == obj2[prop2])

// class-based objects which implement a 'compare' method (i.e. IPv4 address objects)
const compareObj = (classInstance1, classInstance2) => classInstance1.compare(classInstance2)

// sortBy: when column values in dsItem[propName] are strings...case-insensitive string sort 
const sortBy = 		(propName) => (dsItemA, dsItemB) => (dsItemA?.[propName]?.toUpperCase() ?? 0) >= (dsItemB?.[propName]?.toUpperCase() ?? 0) ? 1 : -1
	
// sortBy: when column values in dsItem[propName] are numbers...
//	
const sortByNum = (propName) => (dsItemA, dsItemB) => parseFloat(dsItemA[propName]) - parseFloat(dsItemB[propName])

// add more as elaborate datatypes grow (i.e. class ipAddress, etc)
	



/** _sortBy : (propName:string, comparatorFn:(x,y)=>1|0|-1) => (x:Object<T>, y:Object<T>) => 1,0,-1
 * Constructs an object comparator function based on a general-purpose compartor function the user supplies.
 * If a dataSet has a column that contains a certain type of data, the user can supply a comparater function that operates on just the values of that data
 * instead of worrying about the propName. 
 * 
 * For example, if several columns in a dataset contain an IP address, by using only a single existing comparater function that operates on IP addresses, the user can 
 * construct a column-specific comparter, but supplying the propName & the ipaddress comparater into sortBy.
 *
 * @template T
 * @param {string} propName 
 * @param {<T>(x:T,y:T)=>1|0|-1} comparatorFn<T> 
 * @returns 1|-1|0
 */
const _sortBy = (propName, comparatorFn=((x,y)=>0)) => {
	return function (rec1,rec2) {
		if ( !(propName in rec1)) {
			console.warn(`[sortBy(${propName}, ${comparatorFn?.name ?? comparatorFn.toString()}]: propName ${propName} was missing in at least one of the items in the supplied dataset.  Doublecheck the key spelling or the dataset`) ?? 0
			return 0
		}
		return comparatorFn( rec1, rec2 )
	}
}


// SortBy is just a namepace for "Col" and future functions.  Structured for semantic purposes
const SortBy = {

	/** SortBy.Col : (propName:string, { direction='increasing', emptyIsHigh=true })
	 * 		Use directly inside Array.prototype.sort() calls
	 * 		Example:
	 * 		  someArrayOfRecords.sort(  SortBy.Col('rank', {direction:'>'})  )
	 * 		when direction is:
	 * 		  '<': sorts incre
	 * 		Offers special handling for property values that are null, undefined, or "":
	 * 		  emptyIsHigh == true:  records containing empty values will sort after the high values
	 * 		  emptyIsHigh == false: records containing empty values will sort before the low values 
	 * 
	 * @type {<T>(
	 *   propName: keyof T, 
	 *   options?: {
	 *     direction?: ">" | "<" | "increasing" | "decreasing"
	 *     emptyIsHigh?: boolean
	 *     caseSensitive?: boolean
	 *   }) => (rec1: T, rec2: T) => 1 | -1 | 0 
	 * } 
	 */
	// sorts a column, with the assumption that the data inside the column is a string.  Does not work for numbers
	Col: (propName, options={direction:'increasing', emptyIsHigh:true}) => {
		const { direction, emptyIsHigh } = options
		console.log(`[sortByCol('${String(propName)}', { direction: ${direction}, emptyIsHigh: ${emptyIsHigh})]`)
		switch(direction) {
			case '<':
			case 'increasing': {
				return function (rec1,rec2) {
					if (rec1[propName] == rec2[propName]) return 0
					if (typeof rec1 !== 'number') {		// the below handles null, undefined, & empty string.  We don't want '0' to be included, so skip over number for now
						if (emptyIsHigh==false && !rec1[propName])   return -1
						if (emptyIsHigh==false && !rec2[propName])   return 1
						if (emptyIsHigh==true && !rec1[propName])   return 1
						if (emptyIsHigh==true && !rec2[propName])   return -1
					}
					if (rec1[propName] < rec2[propName]) return -1
					if (rec1[propName] > rec2[propName]) return 1
					return 0
				}
			}
			case 'decreasing':
			case '>': {			// decreasing order
				return function (rec1,rec2) {
					if (rec1[propName] == rec2[propName]) return 0
					if (typeof rec1 !== 'number') {		// the below handles null, undefined, & empty string.  We don't want '0' to be included, so skip over number for now
						if (emptyIsHigh==false && !rec1[propName])   return 1
						if (emptyIsHigh==false && !rec2[propName])   return -1
						if (emptyIsHigh==true && !rec1[propName])   return -1
						if (emptyIsHigh==true && !rec2[propName])   return 1
					}
					if (rec1[propName] < rec2[propName]) return 1
					if (rec1[propName] > rec2[propName]) return -1
					return 0
				}
			} 
			default: {
				console.warn(`[sortByCol(${propName}, ${direction})]: Invalid direction specifier supplied.  Use either '>' or 'decreasing', '<' or 'increasing', .  Absense of a specific defaults to '>'`)
				return function (rec1,rec2) { 
					return 0 
				}
			}
		}
	},

	
	/** 
	 * @param {(obj1,obj2)=>number} compareFn 
	 */
	ColFn: (compareFn, options={direction:'increasing', emptyIsHigh:true}) => {
		const { direction, emptyIsHigh } = options
		console.log(`[sortBy.ColFn('${String(compareFn)}', { direction: ${direction}, emptyIsHigh: ${emptyIsHigh})]`)
		switch(direction) {
			case '<':
			case 'increasing': {
				return function (rec1,rec2) {
					const compareResult = compareFn(rec1,rec2)
					return compareResult
				}
			}
			case 'decreasing':
			case '>': {			// decreasing order
				return function (rec1,rec2) {
					const compareResult = compareFn(rec1,rec2)
					return compareResult * -1
				}
			} 
			default: {
				console.warn(`[sortByCol(${propName}, ${direction})]: Invalid direction specifier supplied.  Use either '>' or 'decreasing', '<' or 'increasing', .  Absense of a specific defaults to '>'`)
				return function (rec1,rec2) { 
					return 0 
				}
			}
		}
	},

	// shuould be idential to Col, but more concise
	Colv2: (propName, options={direction:'increasing', emptyIsHigh:true}) => {
		const { direction, emptyIsHigh } = options
		console.log(`[sortByCol('${propName}', { direction: ${direction}, emptyIsHigh: ${emptyIsHigh})]`)
		
		const directionToggle = ['<', 'increasing'].includes(direction) ? 1 : ['>', 'decreasing'].includes(direction) ? -1 : null

		if (directionToggle == null) {
			console.warn(`[sortByCol(${propName}, ${direction})]: Invalid direction specifier supplied.  Use either '>' or 'decreasing', '<' or 'increasing', .  Absense of a specific defaults to '>'`)
			return  (rec1,rec2) => 0
		}

		return (rec1,rec2) => {
			if (rec1[propName] == rec2[propName]) return 0
			if (typeof rec1 !== 'number') {		// the below handles null, undefined, & empty string.  We don't want '0' to be included, so skip over number for now
				if (emptyIsHigh==false && !rec1[propName])  return -1 * directionToggle  // -1  for increasing,  1 for decreasing
				if (emptyIsHigh==false && !rec2[propName])  return 1 * directionToggle   //  1  for increasing, -1 for decreasing
				if (emptyIsHigh==true && !rec1[propName])   return 1 * directionToggle   //  1  for increasing, -1 for decreasing
				if (emptyIsHigh==true && !rec2[propName])   return -1 * directionToggle  // -1  for increasing,  1 for decreasing
			}
			if (rec1[propName] < rec2[propName]) return -1
			if (rec1[propName] > rec2[propName]) return 1
			return 0
		}
	},

	// shuould be idential to Col, but more concise
	Cols: ({propNames=[], direction='increasing', emptyIsHigh=true}) => {
		const isInvalid = (val) => val === null || val === undefined || Number.isNaN(val)

		// directionToggle is a direction modifier for the -1 or 1 comparison results.
		// it eliminates the need for a big switch statement to return differnet functions
		// based on the 'direction' string...
		const directionToggle = ['<', 'increasing'].includes(direction) ? 1 : ['>', 'decreasing'].includes(direction) ? -1 : null
		if (directionToggle == null) {
			console.warn(`[sortBy.Colsv2(${propNames.join(',')}, ${direction})]: Invalid direction specifier supplied.  Use either '>' or 'decreasing', '<' or 'increasing', .  Absense of a specific defaults to '>'`)
			return  (rec1,rec2) => 0
		}

		// return the proper sort function
		return (rec1,rec2) => {
			for (const propName of propNames) {
				if (isInvalid(rec1[propName]) && isInvalid(rec2[propName])) {
					continue; // Both values are invalid, move to the next property
				}

				if (rec1[propName] == rec2[propName]) return 0
				if (typeof rec1 !== 'number') {		// the below handles null, undefined, & empty string.  We don't want '0' to be included, so skip over number for now
					if (emptyIsHigh==false && !rec1[propName])  return -1 * directionToggle  // -1  for increasing,  1 for decreasing
					if (emptyIsHigh==false && !rec2[propName])  return 1 * directionToggle   //  1  for increasing, -1 for decreasing
					if (emptyIsHigh==true && !rec1[propName])   return 1 * directionToggle   //  1  for increasing, -1 for decreasing
					if (emptyIsHigh==true && !rec2[propName])   return -1 * directionToggle  // -1  for increasing,  1 for decreasing
				}
				if (rec1[propName] < rec2[propName]) return -1 * directionToggle
				if (rec1[propName] > rec2[propName]) return 1 * directionToggle
				return 0
			}
		}
	},
	/// next static method here...
}



/** sortByCol : (propName:string, direction:'>'||'<') => (x:Object<T>, y:Object<T>) => 1,0,-1 
 * 
 * Use directly inside Array.prototype.sort() calls instead of a statically 
 * defined (a,b)=>boolean function.  Example:
 *   someArrayOfRecords.sort(  sortByCol('rank', {direction:'>'})  )
 * when direction is:
 *   '<': sorts incre
 * Offers special handling for property values that are null, undefined, or "":
 *   emptyIsHigh == true:  records containing empty values will sort after the high values
 *   emptyIsHigh == false: records containing empty values will sort before the low values 
 * @type {(propName:string, opts:{direction?:'>'|'<', emptyIsHigh?:boolean}) => 0|1|-1 } 
 */
//	const _sortByCol = (propName, {direction='>', emptyIsHigh=true}={}) => {
//		console.log(`[sortByCol('${propName}', { direction: ${direction}, emptyIsHigh: ${emptyIsHigh})]`)
//		switch(direction) {
//			case '<': {		// increasing order
//				return function (rec1,rec2) {
//					if (rec1[propName] == rec2[propName]) return 0
//					if (typeof rec1 !== 'number') {		// the below handles null, undefined, & empty string.  We don't want '0' to be included, so skip over number for now
//						if (emptyIsHigh==false && !rec1[propName])   return -1
//						if (emptyIsHigh==false && !rec2[propName])   return 1
//						if (emptyIsHigh==true && !rec1[propName])   return 1
//						if (emptyIsHigh==true && !rec2[propName])   return -1
//					}
//					if (rec1[propName] < rec2[propName]) return -1
//					if (rec1[propName] > rec2[propName]) return 1
//					return 0
//				}
//			}		
//			case '>': {			// decreasing order
//				return function (rec1,rec2) {
//					if (rec1[propName] == rec2[propName]) return 0
//					if (typeof rec1 !== 'number') {		// the below handles null, undefined, & empty string.  We don't want '0' to be included, so skip over number for now
//						if (emptyIsHigh==false && !rec1[propName])   return 1
//						if (emptyIsHigh==false && !rec2[propName])   return -1
//						if (emptyIsHigh==true && !rec1[propName])   return -1
//						if (emptyIsHigh==true && !rec2[propName])   return 1
//					}
//					if (rec1[propName] < rec2[propName]) return 1
//					if (rec1[propName] > rec2[propName]) return -1
//					return 0
//				}
//			} 
//			default: {
//			console.warn(`[sortByCol(${propName}, ${direction})]: Invalid direction specifier supplied.  Use either '>' or '<'.  Absense of a specific defaults to '>'`) ?? 0
//			return 0
//			}
//		}
//	}




/////////////////////////////////////////////////////////////////////////////
// DB operations for dataSet Arrays 
/////////////////////////////////////////////////////////////////////////////
		
// merge two keyLists (schemas).  when B conflicts with A, apply default renaming function or use user-supplied
// test this - is this working???
const mergeSchemas = (keySetA, keySetB, conflictResolverFn=(item)=>`( ${item} )` )  => {
	const overlappingKeyNames = intersection(keySetA, keySetB)
	return [ ...keySetA, ...overlappingKeyNames.map((item)=>conflictResolverFn(item)) ]
}
	
//			// these are specialized functions that operate on a dsItem/dsArray
//				// add_key_fromProps = [propNames] -> dsItem -> dsItem
//			const addKey_fromProps = (...fromProps) => dsItem => ({
//				...dsItem,
//				[`key_${fromProps.flat().join('::')}`]: fromProps.flat().map(propName=>dsItem?.[propName])?.join('::') || `addKey_fromProps: invalid propName:  ${propName}`,
//			})
//
//			// add_key_fromcols = [propNames] -> dsArray -> dsArray
//			const addKey_fromCols = (...fromCols) => dsArray => dsArray.map(addKey_prop(fromCols.flat))

// leftJoin :: (dsArray, string, dsArray, string)  => dsArray 
const leftJoin = (table, key, foreignTable, foreignKey) => {
	const keySet = discoverSchema([ ...table, ...foreignTable ])
	const template =createObjectTemplateFrom(keySet)
	const result = table.map((item) => {
		return ({...template, ...item, ...foreignTable.find( (foreignItem) => foreignItem[foreignKey]===item[key]) })
	})
	return result
}

const equiJoin2 = (xs=[], ys=[], primary='', foreign='', sel )=> {
	const ix = xs.reduce((ix, row) => ix.set(row[primary], row), new Map)
	return ys.map((row) => sel  (ix.get(row[foreign]) ?? {}, row  ))
}
			
// leftJoin2 - uses predicateFn instead of matching column names
//
// example usage: result = leftJoin2(ds_Employees, ds_DepartmentIDs, onColumn('EmpID').eq('EmpID') )  )
//
// leftJoin2 signature:  dsArray => forignTable =>  ( dsArray_item => comparator => foreignTable_item => boolean) => dsArray
// NOTE: handles predicate equality well, but does not handle other predicates well - will match the first foreign item that satisfied, but not more
//
// leftJoin2 :: (dsArray, dsArray, (dsItem, dsItem => boolean) )  => dsArray 
const leftJoin2 = (table, foreignTable, predicateFn) => {
	const keySet = discoverSchema([ ...table, ...foreignTable ])
	const template = createObjectTemplateFrom(keySet)
	const result = table.map((item) => {
		return ({...template, ...item, ...foreignTable.find( (foreignItem) => predicateFn(item, foreignItem)  ) })
	})
	return result
}
	
// leftJoin3 :: (dsArray, string, dsArray, string, (dsItem, dsItem => dsItem) )  => dsArray 
const leftJoin3 = (table, key, foreignTable, foreignKey, sel) => {
	// step 1: build a lookup map of foreign table for efficiency			// can this be memoized inside a DataSet?
	const foreignTableMap = foreignTable.reduce(
		(accumulatorMap, foreignItem) => accumulatorMap.set(foreignItem[foreignKey], foreignItem),
		new Map
	)
	// step 2: iterate through primary table, looking up items in the (now indexed) foreign table based on the value stored (an eqivalency check)
	return table.map(
		(dsItem) => sel(	dsItem, foreignTableMap.get(dsItem[key])	)
	)
	// step 3: once we have the primary table item, and associated foreign table item, send it through a selector function to merge
	// the two into a single object, aligned with the same # of rows as the primary table
}
// Usage Notes:
// sel has this signature:
//	sel	::	(dsItemA, dsItemB)	=>	merged_dsItem
// an example of a sel function, using inline parameter destructuring to extract only needed fields out of each object:
// 	({id: uid, name}, {id, text, createdBy}) => createdBy === uid && {id, text, name})
	
	
const leftJoin4 = (table, foreignTable, uniqFn, sel=(x,y)=>({...x,...y}) ) => {
	const foreignTableMap = foreignTable.reduce(
		(accumulatorMap, foreignItem) => accumulatorMap.set(uniqFn(foreignItem), foreignItem),
		new Map
	)
	return table.map(
		(dsItem) => sel(	dsItem, foreignTableMap.get(uniqFn(dsItem)) ?? {}	)
	)
}
	

const parseParams = (param) => { 
	const [, lprops, rprops] = param.match( /([^=]+)=+([^=]+)/y) 
	const results = {
		leftProps: lprops.split(',').map((prop)=>prop.trim()),
		rightProps: rprops.split(',').map((prop)=>prop.trim())
	}
	return results
}
	
const rxParser = /^((?<ltable>\w+):){0,1}(?<lcols>[\w|,]+)(?<equality>=)+((?<rtable>\w+):){0,1}(?<rcols>[\w|,]+)/	
	
const parseParams_Regx = (regxParser) => (param) => {
	const parseResult = param.match(regxParser).groups
	console.log({parseResult})
	return {
		...parseResult,
		lv: parseResult.lcols?.split(',') ?? null,
		rv: parseResult.rcols?.split(',') ?? null,
	}
}
	
	
const parseParams_v2 = parseParams_Regx(rxParser)
	
// given a list of props and an object, return a concatenated 
const keysVal = (...propList) => (item) => propList.flat().reduce( (acc,prop) => {
	const itemVal = prop in item ? item[prop] ?? '' : `no such prop ${prop}` 
	acc = `${acc}${itemVal}`
	return acc
}, '')
	
	
const test123 = (colNames) => (item) => ({ 	['combined']:  keysVal(colNames), 	...item, 	})
	
// leftJoin5(devices, deviceLocs).where('id').eq('devId') or,
// leftJoin5(devices, deviceLocs).where2('id=devId'),
const leftJoin5 = (primaryTable=[], foreignTable=[], mergeFn=(x,y)=>({...x,...y})) => {
	return {
		where: (...pCols) => {
			return {
				eq: (...fCols) => {
					return leftJoin(primaryTable, pCols.flat(),foreignTable, fCols.flat())
				}
			}
		},
		where2: (expr) => {						// expr looks like" "id,name=fid,fname"
			const {leftProps:lv,rightProps:rv} = parseParams(expr)
			const foreignTableMap = foreignTable.reduce(
				(accumulatorMap, foreignItem) => accumulatorMap.set(keysVal(rv)(foreignItem), foreignItem),
				new Map
			)
			return primaryTable.map(
				(dsItem) => mergeFn( dsItem, foreignTableMap.get(keysVal(lv)(dsItem)) ?? {} )
			)
		},
		where4: (expr) => {						// expr looks like" "id,name=fid,fname"
			const {ltable="", lv="", rtable="", rv=""} = parseParams_v2(expr)
				
			const foreignTableKeyName = `${rv.join('::')}`
			const primaryTableKeyName = `${lv.join('::')}`
			// add new combined key column to foreign table
			const keyed_primaryTable = primaryTable.map(	combineProps(...lv)('::') )
			const keyed_foreignTable = foreignTable.map(	combineProps(...rv)('::') )
			const mvLookup_foreignTable = groupByPropName(foreignTableKeyName)(keyed_foreignTable)
	
			const result = keyed_primaryTable.map((item) => {
				const foreignObj = mvLookup_foreignTable[item[primaryTableKeyName]] ?? ""
				return {
					...item, 
					[rtable]: foreignObj
				}
			}).flatMap(multiplyByND(rtable))
			return result
		},
	
		where5: (expr) => {						// expr looks like" "id,name=fid,fname"
			const {leftProps:lv,rightProps:rv} = parseParams(expr)
			const foreignTableKeyName = `${rv.join('::')}`
			const primaryTableKeyName = `${lv.join('::')}`
			// add new combined key column to foreign table
			const keyed_foreignTable = foreignTable.map(	combineProps(...rv)('::') )
			const mvLookup_foreignTable = groupByPropName(rv.join('::'))(keyed_foreignTable)
			// work in progress...
			const result = primaryTable.flatMap(multiplyBy(foreignTableKeyName))
	
			// mergeFn( dsItem, foreignTableMap.get(keysVal(lv)(dsItem)) ?? {} )
		},
	}
}
	
	
/* Inner Join pseudocode:
		1) Make new table with columns: Union(DataSetA.propSet + DataSetB.propSet)
		2) Find all DataSet A records that intersect with DataSet B for (keyA == keyB)
		3) Find all DataSet B records that intersect with DataSet A for (keyA == keyB)
		4) Import the DataSetA subset into the result
		5) leftJoin the DataSetB subset into the result
		*/
// innerJoin :: (dsArray, string, dsArray, string) => dsArray 
const innerJoin = (table, key, foreignTable, foreignKey) =>  {
	const keySet = discoverSchema([ ...table, ...foreignTable ])		// union of column names between both tables
	const template = createObjectTemplateFrom(keySet)								// template object contains all column names, used to ensure final dataset records all have consistent columns
		
	let result = table.reduce( (collector, item) => {
		const result = foreignTable.filter(	(foreignItem) => foreignItem[foreignKey]===item[key] )
			.map((foreignItem) => ({...template, ...item, ...foreignItem}))
		return [...collector, ...result]
	},
	[]			// collector initial-state
	)				// reducer
	return result
}
	
	
// innerJoin2 - uses predicateFn instead of matching column names
// example usage: result = innerJoin2(ds_Employees, ds_DepartmentIDs, onColumn('EmpID').eq('EmpID') )  )
// 
// innerJoin2 :: (dsArray, dsArray, (dsItem, dsItem => boolean) )  => dsArray 
const innerJoin2 = (table, foreignTable, predicateFn) =>  {
	const keySet = discoverSchema([ ...table, ...foreignTable ])
	const template = createObjectTemplateFrom(keySet)
		
	let result = table.reduce( (collector, item) => {
		const result = foreignTable.filter(	(foreignItem) => predicateFn(item, foreignItem) )
			.map((foreignItem) => ({...template, ...item, ...foreignItem}))
		return [...collector, ...result]
	},
	[]			// collector initial-state
	)				// reducer
	return result
}
	
	
// innerJoin3: same as innerJoin2, but with built-in conflict resolution needs work or be scrapped in favor of better solution
// WIP
const innerJoin3 = (table, foreignTable, predicateFn) =>  {
	const schemaA = discoverSchema([ ...table ])
	const schemaB = discoverSchema([ ...foreignTable ])
	const conflictingKeys = intersection(schemaA, schemaB)
		
	const columnConflictMap = (arrA, arrB, conflictResolver=(item)=>`_(${item})_`) => intersection(arrA, arrB).map((item)=>({oldName: item, newName:conflictResolver(item) }))
		
	const keySet = discoverSchema([ ...table, ...foreignTable ])
	const template = createObjectTemplateFrom(keySet)
		
	let result = table.reduce( (collector, item) => {
		const result = foreignTable.filter(	(foreignItem) => predicateFn(item, foreignItem) )
			.map((foreignItem) => ({...template, ...item, ...foreignItem}))
		return [...collector, ...result]
	},
	[]			// collector initial-state
	)				// reducer
	return result
}
	
	
/*	outerJoin
		/ generally used when table1 and table2 records have identical ID types, but possibly containing different 
		/	attribute data.  The goal is to create a new table with the Union of all IDs
		/ table 2 is used to:
		/		1) find the union of keys from table1 and table2.  The union is the basis of a new result table
		/		2a) resulting table is leftJoined to tableA (table A columns are added to result)
		/		2b) resulting table is then leftJoined to tableB (table B columns are added to result)
		*/
	
// outerJoin :: (dsArray, string, dsArray, string) => dsArray 
const outerJoin = (table, key, foreignTable, foreignKey) => {
	// first, get the complete to-be combined schema for both tables & convert tables to expanded schema
	const keySet = discoverSchema([ ...table, ...foreignTable ])
	const template = createObjectTemplateFrom(keySet)
	const applyTemplateToItems = applyTemplateObject(template)
	const applyTemplateTo = (dsArray) => dsArray.map(applyTemplateToItems)  // partially-applied at this point... waiting for the dataSet
		
	let intersectionsAonB = mapIntersectionK(table, key, foreignTable, foreignKey)
	let diffAonB = mapDiffK(table, key, foreignTable, foreignKey) 
	let diffBonA = mapDiffK(foreignTable, foreignKey, table, key) 
		
	return applyTemplateTo([ ...intersectionsAonB, ...diffAonB, ...diffBonA ])
}
	
// not working yet - difficulties resolving conflicts on key names
const conflictResolver2 = (item) => `__(${item})__`
// outerJoin2 :: (dsArray, dsArray, (dsItem, dsItem => boolean) )  => dsArray
const outerJoin2 = (table, foreignTable, predicateFn) => {
	// first, get the complete to-be combined schema for both tables & convert tables to expanded schema
	const keySet = discoverSchema([ ...table, ...foreignTable ])
	const template = createObjectTemplateFrom(keySet)
	const applyTemplateToItems = applyTemplateObject(template)
	const applyTemplateTo = (dsArray) => dsArray.map(applyTemplateToItems)  // partially-applied at this point... waiting for the dataSet
		
	let intersectionsAonB = mapIntersectionK(table, key, foreignTable, foreignKey)
	let diffAonB = mapDiffK(table, key, foreignTable, foreignKey) 
	let diffBonA = mapDiffK(foreignTable, foreignKey, table, key) 
		
	return applyTemplateTo([ ...intersectionsAonB, ...diffAonB, ...diffBonA ])
}
		
export {
	equiJoin2,
	innerJoin,
	innerJoin2,
	innerJoin3,
	outerJoin,
	outerJoin2,
	leftJoin,
	leftJoin2,
	leftJoin3,
	leftJoin4,
	leftJoin5,

	SortBy,
}

