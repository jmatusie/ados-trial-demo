/**
 * @description A set of small curried functions for common array operations
 */

// convert common array methods to pure (and curried) functions
const mapArray = (mapFn) => (array) => array.map(mapFn)


const flatMapArray = (mapFn) => (array) => array.flatMap(mapFn)


const filterArray = (predicateFn) => (array) => array.filter(predicateFn)


const flattenArray = (array) => array.flat()


const flattenArrayN = (N_levels) => (array) => array.flat(N_levels)


const joinWith = (delimiter) => (array) => array.join(delimiter)


const sortArray = (sortFn) => (array) => [...array].sort(sortFn)


const reverseArray = (array) => [...array].reverse()


const arrayLength = (array) => array.length



/** zip
 * take two arrays of same length (or first is one larger),
 * and return a merged array like a zipper, starting with first element of arr1 
 * 
 * 	zip ::	[items1] => [items2] => [items]
 */
const zip = (arr1) => (arr2) => arr1.flatMap((item, idx) => [item, arr2[idx]])


/** bifurcateArray
 * 	runs a predicate over the entire array and return a two-element array, each its own array
 * 
 *	- result[0] contains all array items that passed the filter
 *  - result[1] contains all failures
 *
 * bifurcateArray  :: (predicateFn: item->boolean) -> [items] -> [ [passedItems], [failedItems] ]
 */
const bifurcateArray = (predicateFn) => (array) => array.reduce( (resultArray, item) => {
	resultArray[Number(!predicateFn(item))].push(item)    // using Number turns boolean into 0 or 1 for array index
	return resultArray
}, [[], []])


export {
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
	bifurcateArray
}
