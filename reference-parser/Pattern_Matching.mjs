// @ts-ignore

/********** MODULE-START: pattern-matching *******
 * 
 * @module pattern-matching
 * @version 07-Jul-2022
 * @requires slide
 * @description 
 * 
 * 03NOV2021: Added regExp_fromString
 * 30DEC2021: fixed bug in matchDeep (optional chaining operators are required)
 * 07JUL2022:	
 * 
 */
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


// universal negating function for any functions in this API.  'not()' must wrap the entire predicate and is not composable.
// warning - be careful about the semantics: "not()" does not always convey the opposite intent, particularly with composed data types.  Always test!
/**@type {(predFn:PredFn) => (item:any) => boolean} */
const not = (predFn) => (item) => !predFn(item)
// loosely-typed value and type-checking predicates for primitives (typechecking is up to the user)
const is = {
	// value-related predicates (works for 'number', 'string', and 'boolean')
	eq 			 				: (value)			=>	/** @returns {boolean} */ (item)  =>  item == value,								// 	'==' is itentional for weak typechecking
	neq 		 				: (value)			=>	/** @returns {boolean} */ (item)  =>  item !=value,									//	for same reson, '!=' is intentional
	lt 			 				: (value)			=>	/** @returns {boolean} */ (item)  =>  item < value,
	gt 			 				: (value)			=>	/** @returns {boolean} */ (item)  =>  item > value,
	lte 		 				: (value)			=>	/** @returns {boolean} */ (item)  =>  item <= value,
	gte 		 				: (value)			=>	/** @returns {boolean} */ (item)  =>  item >= value,
	between  				: (low, high) =>	/** @returns {boolean} */ (item)	=> 	item >= low && item <= high,  // inclusive between
	betweenX 				: (low, high) =>	/** @returns {boolean} */ (item)	=> 	item >  low && item <  high,  // exclusive between
	betweenXL				: (low, high) =>	/** @returns {boolean} */ (item)	=> 	item >  low && item <= high,  // excludes low value, includes high value
	betweenXH				: (low, high) =>	/** @returns {boolean} */ (item)	=> 	item >= low && item <  high,  // excludes high value, includes low value
	// type-checking predicates (done the way JS should have done it)
	string					:	/** @returns { item is string 	} */		(item)	=>	typeof(item) === 'string',
	number					:	/** @returns { item is number		}	*/		(item)	=>	typeof(item) === 'number',
	bigint 					:	/** @returns { item is bigint 	} */		(item)	=>	typeof(item) === 'bigint',
	boolean					:	/** @returns { item is boolean	} */		(item)	=>	typeof(item) === 'boolean',
	symbol 					:	/** @returns { item is symbol 	} */		(item)	=>	typeof(item) === 'symbol',
	function				:	/** @returns { item is function	}	*/		(item)	=>	typeof(item) === 'function',
	classDef 				:	/** @returns { item is function	}	*/		(item)	=>	typeof(item) === 'function' && typeof(item?.prototype?.constructor) === 'function',
	object 					: /** @returns { item is object 	} */		(item)	=>	typeof(item) === 'object' 	&& item !== null,
	array 					: /** @returns { item is Array 		} */		(item)	=>	Array.isArray(item),
	regex 					:	/** @returns { item is RegExp		} */		(item)	=>	item instanceof RegExp,
	primitive 		 	:	/** @returns { boolean } */							(item)	=>	item === null ||  ['string', 'number', 'bigint', 'boolean', 'symbol', 'undefined'].includes( typeof (item) ),
	// below addresses the many aspects of JS 'falsiness' tests
	falsey 					:	/** @returns { boolean }						*/	(item)	=>	! (item),  										// returns false for: 0, NaN, '', null, undefined, and false.  Not good practice to use as this is one of Javascrpt's mistakes
	nullish 				:	/** @returns { boolean }						*/	(item)	=>	item ? false : true, 					// returns false for null and undefined
	nil 						:	/** @returns { boolean }						*/	(item)	=>	item ==  null,  				 			// identical to nullish. different implemetation
	null 						:	/** @returns { item is null } 			*/	(item)	=>	item === null,								// strictly null
	undefined 			:	/** @returns { item is undefined }	*/	(item)	=>	item === undefined,						// strictly undefined
	undef 					:	/** @returns { item is undefined }	*/	(item)	=>	item === undefined,						// shorthand for undefined
	defined 				:	/** @returns { item is !undefined }	*/	(item) 	=>	item !== undefined,						// opposite of undefined
	def 						:	/** @returns { item is !undefined }	*/	(item)	=>	item !== undefined,						// shorthand for defined
	// fancier and useful type checks
	data 						:	/** @returns {boolean} */	(item) 	=>	item !=  null && !Number.isNaN(item), 								// true if it has any value except null, undefined, or NaN - even if it's empty
	notEmpty 				: /** @returns {boolean} */	(item)	=>	item !=  null && (!Number.isNaN(item)) && ( (item.length??true) !== 0),
	empty 					:	/** @returns {boolean} */	(item)	=>	item ==  null || item?.length == 0 || Number.isNaN(item), 									// type-agnostic way to check for emptry strings, arrays, null values, NaN, or undefined
	emptyVal 				:	/** @returns {boolean} */	(item)	=>	item === null || item === '' || item?.length == 0 || Number.isNaN(item), 		// type-agnostic way to check for emptry strings, arrays, NaN, or null values.  
	promise					: /** @returns {boolean} */	(item)	=>	typeof item?.then === 'function',
	oneOf						: (...array)			=>				(item)	=>	array.flat().includes(item),
	instanceOf 			: (class_)				=>				(item)	=>	item instanceof class_,
	memberOf 				: (className)			=>				(item) 	=> 	item?.__proto__?.constructor?.name === ((typeof(className)==='string') ? className : className.name),
	// iterable objects (intentionally excludes considering strings as iterable)
	iterable 				:	/** @returns {boolean} */	(item)	=>	typeof item[Symbol.iterator] 			===  'function',
	asyncIterable 	:	/** @returns {boolean} */	(item)	=>	typeof item[Symbol.asyncIterator] ===  'function',
	// these are skipped in 'isnot' the same as obj.iterable & obj.notIterable, here for semantics
	iterableObj			:	/** @returns {boolean} */	(item)	=>	item !== null && typeof(item)==='object' && typeof item[Symbol.iterator] ===  'function',
	nonIterableObj	:	/** @returns {boolean} */	(item)	=>	item !== null && typeof(item)==='object' && typeof item[Symbol.iterator] !==  'function',
}
// short-named equivalents of some predicates
is.str  = is.string
is.num  = is.number
is.bool = is.boolean
is.fn 	= is.function
is.obj	= is.object
is.arr  = is.array
is.def  = is.defined
	
// loosely-typed value and type-checking predicates for primitives (typechecking is up to the user)
const isnot = {
	// value-related predicates (works for 'number', 'string', and 'boolean')
	eq 			 				: (value)			=>	(item)  =>  item != value,
	neq 		 				: (value)			=>	(item)  =>  item == value,
	lt 			 				: (value)			=>	(item)  =>  item >= value,
	gt 			 				: (value)			=>	(item)  =>  item <= value,
	lte 		 				: (value)			=>	(item)  =>  item >  value,
	gte 		 				: (value)			=>	(item)  =>  item <  value,
	between  				: (low, high) =>	(item)	=> 	item <  low    || item >   high,
	betweenX 				: (low, high) =>	(item)	=> 	item <= low    || item >=  high,
	betweenXL				: (low, high) =>	(item)	=> 	item <= low    || item >   high,
	betweenXH				: (low, high) =>	(item)	=> 	item <  low    || item >=  high,
	// type-checking predicates (done the way JS should have done it)
	string					:									(item)	=>	typeof(item) !== 'string',
	number					:									(item)	=>	typeof(item) !== 'number',
	bigint 					:									(item)	=>	typeof(item) !== 'bigint',
	boolean					:									(item)	=>	typeof(item) !== 'boolean',
	symbol 					:									(item)	=>	typeof(item) !== 'symbol',
	function				:									(item)	=>	typeof(item) !== 'function',
	classDef 				:									(item)	=>	typeof(item) !== 'function' || typeof(item?.prototype?.constructor) !== 'function',
	object 					: 								(item)	=>	item === null || typeof(item) !== 'object' ,
	array 					: 								(item)	=>	! (Array.isArray(item)),
	primitive 		 	:									(item)	=>	item !== null && !['string', 'number', 'bigint', 'boolean', 'symbol', 'undefined'].includes( typeof (item) ),
	// falsiness checks
	falsey 					:									(item)	=>	!! item,  										// returns true for: 0, NaN, '', null, undefined, and false.  Not good practice
	nullish 				:									(item)	=>	item ? true : false, 					// returns true for null and undefined
	nil 						:									(item)	=>	item != null,  					 			// identical to nullish. different implentation
	null 						:									(item)	=>	item !== null,								// strictly null
	undefined 			:									(item)	=>	item !== undefined,						// strictly undefined
	undef 					:									(item)	=>	item !== undefined,						// shorthand for undefined
	defined 				:									(item) 	=>	item === undefined,						// opposite of undefined
	def 						:									(item)	=>	item === undefined,						// shorthand for defined
	data 						:									(item) 	=>	item === undefined || item ===  null || Number.isNaN(item), 		// false if it has any value except null, undefined, or NaN 
	empty 					:									(item)	=>	item?.length != 0 && item !== null && item !== undefined && !Number.isNaN(item) , 		// type-agnostic way to check for emptry strings, arrays, null values, or undefined
	// fancier and useful type checks
	oneOf						: /** @arg {function} func 	*/	(...arry)		=>	/** @returns {boolean} */ (item)	=>	! (arry.flat().includes(item)),
	instanceOf 			: /** @arg {function} func 	*/	(class_)		=>	/** @returns {boolean} */ (item)	=>	! (item instanceof class_),
	memberOf 				: /** @arg {function} func 	*/	(className)	=>	/** @returns {boolean} */ (item) 	=> 	(item?.__proto__?.constructor?.name ?? 'unknown') !== (typeof(className)==='string' ? className : className.name),
	// iterable objects (intentionally excludes considering strings as iterable)
	iterable 		:											(item)	=>	typeof (item[Symbol.iterator]) !== 'function',
	asyncIterable 		:								(item)	=>	typeof (item[Symbol.asyncIterator]) !== 'function',
}
/** Generic predicate definition
		 * @typedef { ( item : unknown ) => boolean } PredFn
		 * @typedef { string | function } ClassName
		 * @typedef { function }	ClassDef
		 */
/** @typedefs for objects
		 * @typedef { (className:string)				=>	(item:unknown) => boolean } PredFn_Obj_ClassName
		 * @typedef { (_class:function) 				=>	(item:unknown) => boolean } PredFn_Obj_Class
		 */
/** Point-free predicate taking another predicate (itself against type T) as a parameter
		 * @template T
		 * @typedef { (predFn:PredT<T>) 				=> (item:unknown) => boolean } PF_Pred_Pred<T>
		 */
/** Point-free predicates
		 * @typedef { 														 (item:unknown) => boolean } PF_Pred
		 * @typedef { (str:string) 							=> (item:unknown) => boolean } PF_Pred_Str
		 * @typedef { (num:number)							=> (item:unknown) => boolean } PF_Pred_Num
		 * @typedef { (low:number,high:number)	=> (item:unknown) => boolean } PF_Pred_NumRange
		 * @typedef { (regExp:(RegExp|string))	=> (item:unknown) => boolean } PF_Pred_Str_RegExp
		 * 
		 * @typedef { (obj:Object) 				 			=> (item:unknown) => boolean } PF_Pred_Obj
		 * @typedef { (func: function) 					=> (fn:function)  => boolean } PF_Pred_Fn
		 * @typedef { (value: unknown) 					=> (fn:function)  => boolean } PF_Pred_Any
		 * @typedef { (className:string)				=> (item:unknown) => boolean } PF_Pred_ClassName
		 * @typedef { (_class:function) 				=> (item:unknown) => boolean } PF_Pred_Class
		 * @typedef { (propName:string) 				=> (item:unknown) => boolean } PF_Pred_PropName
		 * @typedef { (...propNames:string[]) 	=> (item:unknown) => boolean } PF_Pred_PropList
		 * @typedef { (matchObj:object)					=> (item:unknown) => boolean } PF_Pred_MatchObj
			* @typedef { (arr2: Array) 						=> (arr1:unknown)	=> boolean } PF_Pred_Arr
		 * @typedef { (...arg0: any[]) 					=> (arr1:unknown)	=> boolean } PF_Pred_Var
		 */
const num = {
	eq 			 	:	/** @type {PF_Pred_Num} 			*/ (num)				=>	(item)	=> typeof(item)==='number' && item ===num,
	neq 		 	:	/** @type {PF_Pred_Num} 			*/ (num)				=>	(item)	=> typeof(item)==='number' && item != num,
	lt 			 	:	/** @type {PF_Pred_Num} 			*/ (num)				=>	(item)	=> typeof(item)==='number' && item <  num,
	gt 			 	:	/** @type {PF_Pred_Num} 			*/ (num)				=>	(item)	=> typeof(item)==='number' && item >  num,
	lte 		 	:	/** @type {PF_Pred_Num} 			*/ (num)				=>	(item)	=> typeof(item)==='number' && item <= num,
	gte 		 	:	/** @type {PF_Pred_Num} 			*/ (num)				=>	(item)	=> typeof(item)==='number' && item >= num,
	between  	:	/** @type {PF_Pred_NumRange}	*/ (low, high)	=> 	(item)	=> typeof(item)==='number' && item >= low && item <= high,
	betweenX 	:	/** @type {PF_Pred_NumRange}	*/ (low, high)	=> 	(item)	=> typeof(item)==='number' && item >  low && item <  high,
	betweenXL	:	/** @type {PF_Pred_NumRange}	*/ (low, high)	=> 	(item)	=> typeof(item)==='number' && item >  low && item <= high,
	betweenXH	:	/** @type {PF_Pred_NumRange}	*/ (low, high)	=> 	(item)	=> typeof(item)==='number' && item >= low && item <  high,
	integer	 	:	/** @type {PF_Pred}						*/ 									(item)	=> Number.isInteger(item),
	finite		:	/** @type {PF_Pred}						*/ 									(item)	=> Number.isFinite(item),
	NaN 		 	:	/** @type {PF_Pred}						*/ 									(item)	=> Number.isNaN(item),
}
					
// strictly-typed predicates for strings
const str = {
	eq 				:	/** @type {PF_Pred_Str}				*/ (str) 		  =>	(item)	=> typeof(item)==='string' && item === str,
	neq 			: /** @type {PF_Pred_Str}				*/ (str) 		  =>	(item)	=> typeof(item)==='string' && item !=  str,
	lt 				:	/** @type {PF_Pred_Str}				*/ (str) 		  =>	(item)	=> typeof(item)==='string' && item <   str,
	gt 				:	/** @type {PF_Pred_Str}				*/ (str) 		  =>	(item)	=> typeof(item)==='string' && item >   str,
	lte 			: /** @type {PF_Pred_Str}				*/ (str) 		  =>	(item)	=> typeof(item)==='string' && item <=  str,
	gte 			: /** @type {PF_Pred_Str}				*/ (str) 		  =>	(item)	=> typeof(item)==='string' && item >=  str,
	includes 	:	/** @type {PF_Pred_Str}				*/ (str)			=>	(item) 	=> typeof(item)==='string' && item.includes(str),
	startsWith:	/** @type {PF_Pred_Str}				*/ (str)			=>	(item) 	=> typeof(item)==='string' && item.startsWith(str),
	endsWith 	:	/** @type {PF_Pred_Str}				*/ (str)			=>	(item) 	=> typeof(item)==='string' && item.endsWith(str) ,
	isEmpty		:	/** @type {PF_Pred}						*/ 								(item)	=> typeof(item)==='string' && item === '',
	notEmpty	:	/** @type {PF_Pred}						*/ 								(item)	=> typeof(item)==='string' && item !== '',
	matches   : /** @type {PF_Pred_Str_RegExp}*/ (regExp)		=>	(item)	=> typeof(item)==='string' && new RegExp(regExp, 'i').test(item),
	len 			:	/** @type {PF_Pred_Pred<number>}*/ (predFnNum)=>(item)	=> typeof(item)==='string' && predFnNum(item.length),
}
const obj = {
	instanceOf 	: /** @type {PF_Pred_Class} 		*/ (class_)				=> (item)	=> item instanceof (class_),
	eq  				:	/** @type {PF_Pred_Obj}				*/ (obj)					=> (item)	=> (item !== null) && typeof(item) === 'object' && deepEqualFast(item,obj),
	class 			: /** @type {PF_Pred_ClassName}	*/ (className)		=> (item)	=> (item !== null) && typeof(item) === 'object' && (item?.__proto__?.constructor?.name === className) || false,
	notIterable	:	/** @type {PF_Pred} 					*/									 (item)	=> (item !== null) && typeof(item) === 'object' && typeof(item[Symbol.iterator]) !== 'function',
	iterable 		:	/** @type {PF_Pred} 					*/ 									 (item)	=> (item !== null) && typeof(item) === 'object' && typeof(item[Symbol.iterator]) === 'function',
	hasProp			:	/** @type {PF_Pred_Str } 			*/ (propName)			=> (item)	=> (item !== null) && typeof(item) === 'object' && propName in item,
	hasProps		:	/** @type {PF_Pred_PropList} 	*/ (...propNames)	=> (item)	=> (item !== null) && typeof(item) === 'object' && propNames.flat().every((propName)=>obj[propName]!==undefined),
	hasValFor		:	/** @type {PF_Pred_Str } 			*/ (propName) 		=> (item)	=> (item !== null) && typeof(item) === 'object' && item[propName],
	matches			:	/** @type {PF_Pred_MatchObj } */ (matchObj) 		=> (item)	=> (item !== null) && Match.objMatch(matchObj)(item)
	// hasDeep: 	:	(pathStr)			=>	(item)	=> 	<todo> a predicate function to search though an object deeply by providing a path
}
// predicates for functions
const fn = {
	eq 								: /** @type {PF_Pred_Fn} 	*/ (func) => (fn) => typeof(fn)==='function' && func===fn,
	name 							: /** @type {PF_Pred_Str} */ (name) => (fn) => typeof(fn)==='function' && fn.name === name,
	hasArity 					: /** @type {PF_Pred_Num} */ (int) 	=> (fn) => typeof(fn)==='function' && fn.length === int,
	hasArgs 					:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn.length > 0,
	isArrow 					:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && !(Object.getOwnPropertyNames(fn).includes('prototype')),
	notArrow 					:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && Object.getOwnPropertyNames(fn).includes('prototype'),
	isClassDef				:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && typeof(fn?.prototype?.constructor) === 'function',
	notClassDef 			:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && typeof(fn?.prototype?.constructor) !== 'function',
	isAsync 					: /** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn[Symbol.toStringTag] === 'AsyncFunction',
	notAsync 					: /** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn[Symbol.toStringTag] !== 'AsyncFunction',
	isGenerator  			:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn[Symbol.toStringTag] === 'GeneratorFunction',
	notGenerator  		:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn[Symbol.toStringTag] !== 'GeneratorFunction',
	isAsyncGenerator	: /** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn[Symbol.toStringTag] === 'AsyncGeneratorFunction',
	notAsyncGenerator : /** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn[Symbol.toStringTag] !== 'AsyncGeneratorFunction',
	possibleMethod	 	:	/** @type {PF_Pred} 		*/ 					 (fn)	=> typeof(fn)==='function' && fn.toString().match(/[\W]this\.[a-zA-Z0-9_$]+/), // check for implementation's use of 'this'
}
// strictly-typed predicates for arrays (does not validate order)
// NOTE: used for arrays of primitives, not arrays of objects
const arr = {
	// eq: 					order not important, shallow-values only
	// alignedWith: order is important, shallow-values only
	// eqDeep: 			order is important, deep-values supported (not 100% reliable with instantiated objects (Maps, Sets, etc) due to JS - always test!!)
	eq 						: /** @type {PF_Pred_Arr} 	*/ (arr2) 		=>	(arr1) => Array.isArray(arr1) && Array.isArray(arr2) && arr1.length===arr2.length && arr2.every( (item)=>arr1.includes(item) ),
	neq 					: /** @type {PF_Pred_Arr} 	*/ (arr2) 		=>	(arr1) => Array.isArray(arr1) && Array.isArray(arr2) && ( arr1.length!==arr2.length || !(arr2.every( (item)=>arr1.includes(item) )) ),
	alignedWith 	: /** @type {PF_Pred_Arr} 	*/ (arr2) 		=>	(arr1) => Array.isArray(arr1) && Array.isArray(arr2) && arr1.length==arr2.length && arr2.every( (item,idx)=>arr1[idx]===item ),
	eqDeep  			: /** @type {PF_Pred_Arr} 	*/ (arr2)			=>	(arr1) => Array.isArray(arr1) && Array.isArray(arr2) && deepEqualFast(arr1,arr2), // order is important!
	neqDeep				: /** @type {PF_Pred_Arr} 	*/ (arr2)			=>	(arr1) => Array.isArray(arr1) && Array.isArray(arr2) && !deepEqualFast(arr1,arr2),
	isEmpty 			: /** @type {PF_Pred} 			*/ 						 		(arr1) =>	Array.isArray(arr1) && arr1.length === 0,
	hasOne 				: /** @type {PF_Pred} 			*/ 						 		(arr1) =>	Array.isArray(arr1) && arr1.length === 1,
	hasMany 			: /** @type {PF_Pred} 			*/ 						 		(arr1) =>	Array.isArray(arr1) && arr1.length > 1,
	hasLength 		: /** @type {PF_Pred_Num} 	*/ (length)		=>	(arr1) =>	Array.isArray(arr1) && arr1.length === length,
	notEmpty			: /** @type {PF_Pred} 			*/ 								(arr1) =>	Array.isArray(arr1) && arr1.length > 0,
	includes 			: /** @type {PF_Pred_Any} 	*/ (value)		=>	(arr1) => Array.isArray(arr1) && arr1.includes(value),														// aka 'has'
	excludes 			: /** @type {PF_Pred_Any} 	*/ (value)		=>	(arr1) => Array.isArray(arr1) && !arr1.includes(value),
	includesSomeOf: /** @type {PF_Pred_Var}		*/ (...arr2)	=>	(arr1) => Array.isArray(arr1) &&  arr2.flat().some ((item)=>arr1.includes(item)),		// aka 'intersects with'
	includesAllOf : /** @type {PF_Pred_Var}		*/ (...arr2)	=>	(arr1) => Array.isArray(arr1) &&  arr2.flat().every((item)=>arr1.includes(item)),   // aka 'proper subset of'
	excludesAllOf	: /** @type {PF_Pred_Var}		*/ (...arr2)	=>	(arr1) => Array.isArray(arr1) && !(arr2.flat().some((item)=>arr1.includes(item))),
	// set ops:  some of these are equivalent to above - included here for semantic reasons
	subsetOf			: /** @type {PF_Pred_Var} 	*/ (...arr2) =>(arr1)=>	Array.isArray(arr1) && arr1.every((item)=>arr2.flat().includes(item)),		// aka 'intersects with'
	supersetOf 		: /** @type {PF_Pred_Var} 	*/ (...arr2) =>(arr1)=>	Array.isArray(arr1) && arr2.flat().every((item)=>arr1.includes(item)),
	intersectsWith: /** @type {PF_Pred_Var} 	*/ (...arr2) =>(arr1)=>	Array.isArray(arr1) && arr2.flat().some((item)=>arr1.includes(item)),   	// aka 'proper subset of'
	isDisjointWith: /** @type {PF_Pred_Var} 	*/ (...arr2) =>(arr1)=>	Array.isArray(arr1) && !(arr2.flat().some((item)=>arr1.includes(item))),	// aka 'disjoint with'
}
/** @typedefs for nodes
		 * @typedef { 										(node:HTMLElement) => boolean } PF_Pred_Node
		 * @typedef { (type: string)	=>	(node:HTMLElement) => boolean } PF_Pred_Node_Type
		 * @typedef { (predFn: PF_Pred_Str)=>	(node:HTMLElement) => boolean } PF_Pred_Node_PredFn
		 * @typedef { (name: string) 	=>	(node:HTMLElement) => boolean } PF_Pred_Node_Str
		 * @typedef { (int: number) 	=>	(node:HTMLElement) => boolean } PF_Pred_Node_Num
		 * @typedef { (value: any) 		=>	(node:HTMLElement) => boolean } PF_Pred_Node_Any
		 */
/** 
		* @typedef { (attrName: any) => {
		*   exists: 							(node: any) => boolean
		*   notExists: 						(node: any) => boolean
		*   hasVal: 							(node: any) => boolean
		*   eq: (val: any) 		  =>(node: any) => boolean
		*   is: (predFn: (x:any)=>boolean) =>  (node: any) => any
		* }} NodeAttrPreds
		*/
// common predicates for DOM nodes
const node = {
	attrs:  /** @type {PF_Pred_Node_PredFn} */ (predFn)		=> (node)	=> [node?.getAttributeNames() ?? [] ].every(predFn),
	attr: 	/** @type {NodeAttrPreds}  			*/ (attrName) => ({
		exists: 						 (node) => (node instanceof HTMLElement) && node.hasAttribute(attrName),
		notExists:					 (node) => (node instanceof HTMLElement) && !(node.hasAttribute(attrName)),
		hasVal: 						 (node) => (node instanceof HTMLElement) && node.getAttribute(attrName) !== '',
		eq: 			(val)		=> (node) => node?.getAttribute?.(attrName) === val,
		is: 			(predFn)=> (node) => node?.hasAttribute?.(attrName) ? predFn(node?.getAttribute?.(attrName)) : false,
	}),
	isType: 			/** @type {PF_Pred_Node_Type}	*/ (type) => (node) => node?.localName === type ?? node?.nodeName === type ?? false,
	hasClass: 		/** @type {PF_Pred_Node_Str} 	*/ (name) => (node) => node?.classList?.contains?.(name) ?? false,
	isLive: 			/** @type {PF_Pred_Node}  		*/ (node) => node?.isConnected?.() ?? false,
	noChildElems: /** @type {PF_Pred_Node}  		*/ (node) => node?.childElementCount === 0 ?? false,
	hasChildElems:/** @type {PF_Pred_Node}  		*/ (node) => node?.childElementCount > 0 ?? false,
	hasTextValue: /** @type {PF_Pred_Node}  		*/ (node) => node?.innerText !== '',
}
			
/** _do - turn a series of JS statements into functions, 
		 * 		- execute JS statements with a 'do' block (as proposed by TC39.  
		 * 		- allows try/catch in functional style.
		 * @param { () => any			} succeedThunk - a 'thunk' containing a JS statement, block, or expression that *may* return a value or undefined, and *might* throw an exception.  
		 * @param { (err) => any? } failHandler - an error-handling function to execute upon cataching the exception (value is returned), or a value to return in the event of exception.	
		 * 
		 */
/*@type { (succeedThunk: ()=>any, failHandler: (Error)=>void ) => any } */		
function _do (succeedThunk, failThunk) { 
	try { return succeedThunk() }
	catch(e) { return failThunk(e) }
}
					
/** _try - functional version of try/catch, and a more robust version of '_do'
	 * 
	 * @description _try - functional version of try/catch 
	 * @example:
	 * 	// we want to run JSON parse on all items in an array from an unstrusted source (user input, database, etc)
	 * 
	 * 	const input_data = [
	 * 		1,
	 * 		[2],
	 * 	  '{"three":3}',
	 * 	  '{four:4}',					// <-- spoiler alert:  this our "bad" value
	 * 		"5"
	 * 	];
	 * 	
	 * 	// normally we just run a JSON.parse over the array via .map: 
	 * 	
	 * 	input_data.map( (val)=>JSON.parse(val) );  	//  <-- this will fail
	 * 	
	 * 	
	 * 	// Instead of the entire dataset bombing out, we can wrap the mapping function in a _try function:
	 * 	
	 * 	const safe_JSON_parse = (json) => _try( 
	 * 	  () => JSON.parse(json)								// <-- NOTE: expression supplied to _try must be a 'thunked' function
	 * 	).catch( (error) => {
	 * 		console.error(`safe_JSON_parse: caught error: invalid json ${json} supplied`);
	 * 		return `invalid JSON data: ${json}`;
	 * 	});
	 * 	
	 * 	input_data.map(val=>safe_JSON_parse(val))
	 * 	
	 * 	
	 * 	// almost the same function but a bit more verbose, for when we don't  have the convenience of inline functions 
	 * 	
	 * 	const safe_JSON_parse2 = (json) => _try( () => {    // <-- note that thunking can be done here to lay out the code better
	 * 		console.log(`safe_JSON_parse: ${json}`);
	 * 		const returnVal = JSON.parse(json);
	 * 		return returnVal;
	 * 	}).catch( (error) => {
	 * 		console.error(`safe_JSON_parse: caught error: invalid json ${json} supplied`);
	 * 		return `invalid JSON data: ${json}`;
	 * 	});
	 * 	
	 * 	input_data.map(val=>safe_JSON_parse2(val))
	 * 	
	 * 	
	 * 	// The additional benefit is that the function can be re-used in other parts of the code, avoiding copy/pasting 
	 * 	
	 */
class Try {
	constructor(tryFn) {
		this.hasResolved = false
		this.hasError = false
		this.result = undefined
		this.error = undefined
		try {
			this.result = tryFn()
			this.hasResolved = true
			return this
		} 
		catch (e) {
			this.error = e
			this.hasError = true
			return this
		}
	}
	then(nextFn) {
		if (this.hasError) return this
		const nextResult = nextFn(this.result)
		this.result = nextResult
		return this
	}
	catch(failFn) {
		if (this.hasResolved) return this.result 										// short-circuit
		if (typeof(failFn)=='function') return failFn(this.error)
		throw (`Try::onfail(failFn): parameter must be a function`)
	}
}
const _try = (tryFn) => new Try(tryFn)

class Match {
	then(printWhoIs) {
		throw new Error('Method not implemented.');
	}
	constructor (valueToMatch) {
		/**@type {ValueT} */
		this.value			= valueToMatch
		this.returnVal	= undefined		// the user-supplied return value 
		this.error 			= undefined 	// to capture the first exceptions 
		this.matchFound = false
		this.successTerm = 0 					// set only when a result is found & value is delivered
		// intstrumentation
		this.termsEvaluated = 0   		// for debugging for now...
		this.debugMode = false
		this.commentLoggingEnabled = false
		Match.instanceCount++
	}
	static instanceCount = 0
	/**@param {function} loggingFn */
	debug (debugModeValue=true, loggingFn=console.log) {
		this.debugMode = debugModeValue
		this.loggingFn = loggingFn
		loggingFn(`[match(${Match.instanceCount})]. Debug mode for instance ${Match.instanceCount} ${this.debugMode?'enabled':'disabled'}`)
		return this
	}
	
	enableCommentLogging(commentLoggingEnabled=true) {	
		this.commentLoggingEnabled = commentLoggingEnabled 
		console.log( (this.commentLoggingEnabled) ? `[match]: comment logging is enabled for instance #${Match.instanceCount}` : `[match]: comment logging is disabled for instance #${Match.instanceCount}`)
		return this 
	}
	viewComments (viewCommentMode=true, loggingFn=console.log) {
		this.loggingFn = loggingFn
		loggingFn(`[match]. Debug mode ${this.debugMode?'enabled':'disabled'}`)
		return this
	}
	log(name,msg,data) {	(this.debugMode) && this.loggingFn(`[match(${Match.instanceCount})]: term #${this.termsEvaluated}, method ${name}(): ${msg}`, data) }
	
	/**@param {Array[any]} _matchDevices */
	whenAll(..._matchDevices) {
		const matchDevices = _matchDevices.flat()
		
		if (this.matchFound) return this  	// short-circuit if a match already occurred
		this.termsEvaluated++ 							// used only for troubleshooting/log messages to find where a match fails
		
		try {
			this.matchFound = matchDevices.every( (matchDevice,i) => {
				let matchFound = false
				try {
					if (typeof(matchDevice) === 'function') { 
						matchFound = !!( matchDevice(this.value) )
					}
					else if (typeof(matchDevice) === 'object' ) { 
						matchFound = !!( Match.matchDeep (matchDevice) (this.value) ) 
					}
					else { 
						matchFound = (matchDevice === this.value) 
					}
					if (matchFound === true) { 
						this.log(`whenAll`, `subterm ${i} passed:`, `[${matchDevice.name || matchDevice.toString().slice(0,80)}]` )
						return true
					} else {
						this.log(`whenAll`, `subterm ${i} failed:`, `[${matchDevice.name || matchDevice.toString().slice(0,80)}]` )
						return false
					}
				}
				catch(error) {
					const errorObj = {
						error, 
						subTerm:			i,
						matchDevice: `${matchDevice}`,
					}  // inner catch
					this.log('whenAll',`subterm ${i} ERROR ${error}`, errorObj)
					throw errorObj
				}  // catch
			}) // every
			
			if (this.matchFound === true) { 
				this.log('whenAll', `found match...executing next .do() or .return() clause `) 
			}
			else { 
				this.log('whenAll', `failed to match all subterms.`) 
			}
			return this
		}  // outer try
		
		catch(error) {
			this.error = {
				...error, 
				method: 'whenAll',
				matchValue:		this.value,
				failedTerm: 	this.termsEvaluated, 
			}
			console.error('whenAll - caught error ${error}', this.error)
			this.log('whenAll','caught error',this.error)
			return this
		} // outer catch
	}
		
	/**@param {Array[any]} _matchDevices */
	whenAny(..._matchDevices) {
		const matchDevices = _matchDevices.flat()
			
		if (this.matchFound) return this  	// short-circuit if a match already occurred
		this.termsEvaluated++ 							// used only for troubleshooting/log messages to find where a match fails
			
		try {
			this.matchFound = matchDevices.some( (matchDevice,i) => {
				let matchFound = false
				try {
					if (typeof(matchDevice) === 'function') { 
						matchFound = !!( matchDevice(this.value) )
					}
					else if (typeof(matchDevice) === 'object' ) { 
						matchFound = !!( Match.matchDeep (matchDevice) (this.value) ) 
					}
					else { 
						matchFound = (matchDevice === this.value) 
					}
					if (matchFound === true) { 
						this.log(`whenAny`, `subterm ${i} passed:`, `[${matchDevice.name || matchDevice.toString().slice(0,80)}]` )
						return true
					} else {
						this.log(`whenAny`, `subterm ${i} failed:`, `[${matchDevice.name || matchDevice.toString().slice(0,80)}]` )
						return false
					}
				}
				catch(error) {
					const errorObj = {
						error, 
						subTerm:			i,
						matchDevice: `${matchDevice}`,
					}  // inner catch
					this.log('whenAny',`subterm ${i} ERROR ${error}`, errorObj)
					throw errorObj
				}  // catch
			}) // every
						
			if (this.matchFound === true) { 
				this.log('whenAny', `found match...executing next .do() or .return() clause `) 
			}
			else { 
				this.log('whenAny', `failed to match any subterms.`) 
			}
		
			return this
		}  // outer try
			
		catch(error) {
			this.error = {
				...error, 
				method: 'whenAny',
				matchValue:		this.value,
				failedTerm: 	this.termsEvaluated, 
			}
			this.log('whenAny','caught error',this.error)
			return this
		} // outer catch
	}   // method whenAny

	// improved - using deep matching
	when(matchDevice) {
		if (this.matchFound) return this  	// short-circuit if a match already occurred
		this.termsEvaluated++ 							// used only for troubleshooting/log messages to find where a match fails
			
		try {
			if (matchDevice === null) {                    // handle null first, because JS considers null an 'object' 
				this.matchFound = (this.value === null)
			}
			if (typeof(matchDevice) === 'function') { 
				this.matchFound = !!( matchDevice(this.value) )
			}
			else if (Array.isArray(matchDevice)) { 
				this.matchFound = !!( Match.arrMatch (matchDevice) (this.value) )
			}
			else if (typeof(matchDevice) === 'object' ) { 
				this.matchFound = !!( Match.matchDeep (matchDevice) (this.value) ) 
			}
			else { 
				this.matchFound = (matchDevice === this.value) 
			}
		
			if (this.matchFound) { 
				this.log('when', `found match...executing next .do() or .return() clause `) 
			}
			else {
				this.log('when', `failed to match this term.`) 
			}
		
			return this
		}
		catch(error) {
			this.error = {
				error, 
				method: 'when',
				failedTerm: 	this.termsEvaluated, 
				matchValue:		this.value,
			}
			this.log('when','caught error',this.error)
			return this
		}
	}
	comment(msg, data='') {
		// early exit if we already found a match, but continue if no match, or if last .when.. was a success
		if (this.matchFound && this.successTerm > 0) return this
		const successOrFail = (this.matchFound && this.error === undefined) 
			? `MATCHES!`
			: `NO MATCH`
		const logMsg = `match(${Match.instanceCount})-comment: ${msg}`
		this.commentLoggingEnabled && console.log(
			logMsg, 
			data,
			`result: (${successOrFail})`,
		)
		return this
	}
	// return simply returns the returnVal if its match is true.
	// intended when returning a function, because return(0 does not attempt to execute the function like .do() does...
	return(returnVal) {
		if (this.matchFound && this.successTerm === 0 && this.error === undefined) {
			this.returnVal = returnVal
			this.successTerm = this.termsEvaluated
			this.log(`return`, `Term ${this.termsEvaluated}: returning value: ${this.returnVal}`, {returnVal} )
		}
		return this
	}

	// a semantic helper to add a 'submatch' within the context of the parent match, and allow for unlimited levels
	// *** not tested ***
	match(matchObj) {
		return new Match(matchObj)
	}
	
	// mapFn is evaluated against the matched object and results are stored in this.returnVal
	do(mapFn) {
		if (this.matchFound && this.successTerm === 0 && this.error === undefined) {
			try {
				this.returnVal = mapFn(this.value)
				this.successTerm = this.termsEvaluated
				this.log(`do`, `mapFn=${mapFn.name??mapFn.toString()}: returning value: ${this.returnVal}`, {mapFn,returnVal:this.returnVal} )
			}
			catch(error) {
				this.error = {
					error, 
					failedTerm: 	this.termsEvaluated, 
					matchValue:		this.value,
				}
				this.log(`do`,`Error: mapFn=${mapFn.name??mapFn.toString()}:`, this.error)
			}  // catch
		}  // if
		return this
	}

	// when the match statement is not expectd to return a value, but merely to carry out actions, a .continue() method after a .do() continues evaluations of 
	// subsequent terms
	continue() {
		this.log(`continue`, `Term ${this.termsEvaluated}: continuing to next term`)
		this.matchFound = false
		this.successTerm = 0
		return this
	}
	
	onError(handlerFn) {
		if (this.error !== undefined) {
			this.returnVal = handlerFn(this.error)
			this.log(`onError`,`handler=${handlerFn.name??handlerFn.toString()}:`, {handlerFn,error:this.error, lastTerm:this.termsEvaluated})
		}
		return this
	}
	
	else (defaultResult) {
		if (this.error !== undefined) return this.error
		if (this.successTerm > 0)  return this.returnVal
		this.termsEvaluated++ 							// used only for troubleshooting/log messages to find where a match fails
					
		const isFunction = typeof(defaultResult) == 'function'
		const result = isFunction ? defaultResult(this.value) : defaultResult
		this.log(`else`,`no matches, ${isFunction?'applying function to matched value, ':''} returning ${result}`, {defaultResult, result})
		return result
	}
	/** objMatch 	:: object -> evaluatorFn
					 * @description used as a helper for "Match" pattern-matching, implementing the work for a single .when() statement.  
					 * objMatch takes an object template, which is compared against an eventual object (but not in this method)
					 * to determine if the template object matches against the eventual data object.  The object template is supplied by the user, and can have properties that
					 * contain values or functions.  
					 * 
					 * More specfically, objmatch does the following:
					 * 	1) splits each object into an array of value entries, and an array of predicate functions (each function must return only true/false)
					 *  2) returns an evaluator function holding these arrays in a closure (yes, objMatch is curried, so it can be partially executed & held in a variable to be used later)
					 * 	3) the evaluator function, when used, receives a data objects.  
					 *  3a) each entry in the evaluator's value array is compared against the object.  All entries must match - any failure would short-circuit the entire evaluation (array.every() does this)
					 *  3b) each entry in the evaluator's function array is run through the matching object property's value. 
					 * 	4) if all tests pass, objMatch returns true, else it fails.
					 */
	/**@type {(templateObj:object) => (dataObj:object)=>boolean} */
	static objMatch = (templateObj) => {
		const checkEntries = Object.entries(templateObj)
		/** @type [string, any][] */
	
	
	
		/** @type {[ [string, (_:any)=>boolean ][], [string, any][] ]} */ 	
		const [checkEntriesAsFns, checkEntriesAsValues] = Match.bifurcateArray( /**@param {[key:string,val:any]} */ ([key,val])=>typeof(val)==='function' ) (checkEntries)
	
		/* for testing the type system - should have zero type errors with JSDoc/TS */
		const fnObj = Object.fromEntries(checkEntriesAsFns)
		const valObj = Object.fromEntries(checkEntriesAsValues)
	
		return /**@type {(dataObj:object)=>boolean} */ (dataObj) => {
			const allValuesMatch = checkEntriesAsValues.every( ([key,val]) => {
				const result = dataObj?.[key]===val ?? false
				return result
			})
			if (allValuesMatch == false) return false   																// short-circuit on value failure
			if (checkEntriesAsFns.length === 0) return true															// if there are no functions to evaluate, we're done
	
			const result = checkEntriesAsFns.every( ([key, fn]) => fn(dataObj?.[key]) ?? false )					// evaluate every function against value - array.every will short circuit on any 'false' checks
	
			return result
		}
	}
		
	// improved version of objMatch - replaces Match:objMatch and Match:arrMatch utility functions, and is recursive
	/**
					 * @typedef { [string, any][] } ObjEntry
					 */
	/**@type {(templateObj:object) => (dataObj:object)=>boolean} */
	static matchDeep = (templateObj) => {
		/**@type {ObjEntry} */
		const checkEntries = Object.entries(templateObj)
		/** @type {[ [string, PredFn ][], [string, any][] ]} */ 	
		const [checkEntriesAsFns, checkEntriesAsValues] = Match.bifurcateArray ( ([_,val])=>fn.notClassDef(val)) (checkEntries)
	
		// match uses lazy-evaluation, so we're currying here and thus returning a function, parameterized by data, a future value
		return (data) => {
			if (checkEntries.length === 0) return false   	 // handles empty template object

			// first, check the value entries.  For performance:  there is no need to run function checks if any of the values don't match
			const allValuesMatch = checkEntriesAsValues.every( ([templateKey,templateVal]) => 
				is.defined(data?.[templateKey]) && is.primitive(templateVal) ?	data[templateKey]===templateVal
				: is.regex(templateVal)					?	templateVal.test(data)
				:	is.obj(templateVal)						?	is.obj(data?.[templateKey]) && Match.matchDeep (templateVal) (data[templateKey])
				:	is.arr(templateVal)						? is.arr(data?.[templateKey]) && Match.arrMatch  (templateVal) (data[templateKey])
				//		:	is.arr(templateVal)						? is.arr(data?.[templateKey]) && templateVal.every( (templateArrayItem,idx) => Match.matchDeep (templateArrayItem) (data[templateKey][idx]))  // array positions must match exactly
				:	console.error(`[Match.matchDeep]: API error: condition not matched for key ${templateKey}`) || false   	// safe catch-all if none of the above types match, but should never see this line.
			)

			//	// first, check the value entries.  For performance:  there is no need to run function checks if any of the values don't match
			//	const allValuesMatch = checkEntriesAsValues.every( ([templateKey,templateVal]) => 
			//		is.defined(data?.[templateKey]) && is.primitive(templateVal) ?	data[templateKey]===templateVal
			//		: is.regex(templateVal)					?	templateVal.test(data)
			//		:	is.obj(templateVal)						?	is.obj(data?.[templateKey]) && Match.matchDeep (templateVal) (data[templateKey])
			//		:	is.arr(templateVal)						? is.arr(data?.[templateKey]) && Match.arrMatch  (templateVal) (data[templateKey])
			//		//		:	is.arr(templateVal)						? is.arr(data?.[templateKey]) && templateVal.every( (templateArrayItem,idx) => Match.matchDeep (templateArrayItem) (data[templateKey][idx]))  // array positions must match exactly
			//		:	console.error(`[Match.matchDeep]: API error: condition not matched for key ${templateKey}`) || false   	// safe catch-all if none of the above types match, but should never see this line.
			//	)
			if (allValuesMatch===false) return false						// short-circuit & dont bother with functions if any value does not match 
			if (checkEntriesAsFns.length===0) return true				// short-circuit if we made it this far and have no functions to check
						
			// second, check functions entries:  NOTE: Array.every() will automatically short-circuit upon the first value
			const allPredicateFnsTrue = checkEntriesAsFns.every( ([templateKey, predicateFn]) => 
				(is.defined(data[templateKey]) && (predicateFn(data[templateKey]) === true))
			)
			return (allValuesMatch && allPredicateFnsTrue)
		}
	} 	// end of method
	// improved version of objMatch - replaces Match:objMatch and Match:arrMatch utility functions, and is recursive
	static matchDeep_old = (templateObj) => {
		const checkEntries = Object.entries(templateObj)
		const [checkEntriesAsFns, checkEntriesAsValues] = Match.bifurcateArray ( ([_,val])=>fn.notClassDef(val)) (checkEntries)
	
		// match uses lazy-evaluation, so we're currying here...
		return (data) => {
			if (checkEntries.length === 0) return false   	 // handles empty template object
	
			// first, check the value entries.  For performance:  there is no need to run function checks if any of the values don't match
			const allValuesMatch = checkEntriesAsValues.every( ([templateKey,templateVal]) => 
				is.defined(data[templateKey]) && 
							is.primitive(templateVal)				?	data?.[templateKey]===templateVal
				: is.regex(templateVal)					?	templateVal.test(data)
				:	is.obj(templateVal)						?	is.obj(data?.[templateKey]) && Match.matchDeep(templateVal)(data[templateKey])
				:	is.arr(templateVal)						? is.arr(data?.[templateKey]) && templateVal.every( (templateArrayItem,idx) => Match.matchDeep(templateArrayItem)(data[templateKey][idx]))  // array positions must match exactly
				:	fn.isClassDef(templateVal)		?	is.instanceOf(templateVal)(data?.[templateKey])
				:	console.error(`[matchDeep]: API error: condition not matched`) || false   	// safe catch-all if none of the above types match, but should never see this line.
			)
			if (allValuesMatch===false) return false						// short-circuit & dont bother with functions if any value does not match 
			if (checkEntriesAsFns.length===0) return true				// short-circuit if we made it this far and have no functions to check
						
			// second, check functions entries:  NOTE: Array.every() will automatically short-circuit upon the first value
			const allPredicateFnsTrue = checkEntriesAsFns.every( ([templateKey, predicateFn]) => 
				is.defined(data[templateKey]) &&
								predicateFn(data[templateKey]) === true
			)
			return (allValuesMatch && allPredicateFnsTrue)
		}
	} 	// end of method
	static arrMatch_fast = (...templateArr) => {
		const checkEntries = templateArr.flat()
		return (dataArr) => checkEntries.every( (templateEntry,templateIndex) => {
			const result = (typeof(templateEntry) == 'function') ? templateEntry(dataArr[templateIndex]) : templateEntry === dataArr[templateIndex]
			return result
		})
	}
	/** arrMatch - pattern-match an array against a template, 
					 * Similar to with added functional utilities 
					 * 
					 * @type {myFn} false | ((...templateArr: any[]) => (...dataArr: any[]) => any)
					 * @param {*} prevResult 
					 * @returns {boolean}
					 * 
					 * @example General case - compare values item by item
					 * compareArray ([0,1,2,3,4,5,6,7,8,9]) ([0,1,2,3,4,5,6,7,8,9]) 	// true
					 * 
					 * @example using general predicte functions to match value position by position 
					 * compareArray ([0,1,2,3,is.eq(4),is.lt(6),6,7,8,is.gt(8)]) ([0,1,2,3,4,5,6,7,8,9]) 	// true
					 * 
					 * @example using special built-in function 'slide' 
					 * compareArray ([0,1,2,slide(4),7,8,9]) ([0,1,2,3,4,5,6,7,8,9]) 	// slide(4) skips 4 positions, then continues matching
					 * compareArray ([0,1,2,slide(-2),8,9]) ([0,1,2,3,4,5,6,7,8,9]) 	// slide(-2) moves back -2 positions from end, then continues matching
					 * 
					 * @example using special built-in function 'until' 
					 * compareArray ([0,1,2,until(6),7,8,9]) ([0,1,2,3,4,5,6,7,8,9]) 	// until(6) finds value 6 in the data array, then continues matching from that point
					 * 
					 * @todo merge compareArray into Match
					 * @todo move fn.name into predicate library
					 */
	static arrMatch = (templateArr) => (dataArr) => {
		const [nextTemplateItem, ...restOfTemplateItems] = templateArr
		const [nextDataItem, ...restOfDataItems] = dataArr
	
		return match(nextTemplateItem)
			.when(arr.isEmpty(restOfTemplateItems)).do( (x) => {
				// terminating condition - we're at the end of the match template array
				const itemsMatch = nextTemplateItem === nextDataItem
				console.log(`arr.isEmpty: `, {nextTemplateItem, nextDataItem})
				return itemsMatch
			})
			.when(is.undefined).do( (x)	=> {
				// if we the end of both template and data arrays, we're done
				if (arr.isEmpty(restOfTemplateItems) && (arr.isEmpty(restOfDataItems))) 
					return true
				// else, if at the end of only the template array, we failed to match the arra
				if(arr.isEmpty(restOfTemplateItems))
					return false
				// if we have an undefined in the middle of the template array, just skip over it w/out matching
				return arrMatch (restOfTemplateItems) (restOfDataItems)
			})
			.when(is.primitive).do( (x)	=>	{
				console.log(`is.primitive: `, {nextTemplateItem, nextDataItem, remaining:restOfDataItems.length})
				const itemsMatch = nextTemplateItem === nextDataItem
				return (itemsMatch === true) ?
					Match.arrMatch (restOfTemplateItems) (restOfDataItems)
					: false
			})
			.when(fn.name('$$skip')).do( (x) => {
				const slideValue = nextTemplateItem()
				const sliceValue = (slideValue < 0) ? slideValue : slideValue - 1
				console.log(`is.eq($slide): `, {nextTemplateItem, nextDataItem, slideValue, sliceValue, remaining:restOfDataItems.length})
				return Match.arrMatch (restOfTemplateItems) (restOfDataItems.slice(sliceValue))
			})
			.when(fn.name('$$find')).do( (x) => {
				const untilValue = nextTemplateItem()
				const foundInPosition = restOfDataItems.indexOf(untilValue)
				if (foundInPosition < 0) return false   // means no such value in list
				console.log(`is.eq($until): `, {nextTemplateItem, nextDataItem, untilValue, foundPosition: foundInPosition, remaining:restOfDataItems.length})
				return Match.arrMatch (restOfTemplateItems) (restOfDataItems.slice(foundInPosition + 1))
			})
			.when(is.eq(Match._tail)).do( (x) => {
				console.log(`is.eq(tail): `, {nextTemplateItem, nextDataItem, restOfDataItems})
				return restOfDataItems.length === 0 
			})
			.when(fn.isGenerator).do( (x) => {
				console.log(`fn.isGenerator: `, {nextTemplateItem, nextDataItem, remaining:restOfDataItems.length})
				const newTemplateItems = [ ...nextTemplateItem() ]
				const expandedTemplateArr = [...newTemplateItems, ...restOfTemplateItems]
				return Match.arrMatch ([...expandedTemplateArr]) ([nextDataItem, ...restOfDataItems])
			})
			.when(is.fn).do( (x) => {
				console.log(`is.fn: `, {nextTemplateItem, nextDataItem, remaining:restOfDataItems.length})
				const itemsMatch = nextTemplateItem(nextDataItem)
				return (itemsMatch === true)	?
					Match.arrMatch (restOfTemplateItems) (restOfDataItems)
					:	false
			})
			.when(is.arr).do( (x) => {
				console.log(`is.arr `, {nextTemplateItem, nextDataItem, remaining:restOfDataItems.length})
				return Match.arrMatch (nextTemplateItem) (nextDataItem)
			})
			.when(is.obj).do( (x) => {
				console.log(`is.obj `, {nextTemplateItem, nextDataItem, remaining:restOfDataItems.length})
				return Match.matchDeep (nextTemplateItem) (nextDataItem)
			})
			.else( (x)=>{
				console.log(`else: `, x)
				return false
			})
	}
	/* bifurcateArray  :: ( item -> boolean) -> [item] -> [ [item], [item] ]
					 * Just a simple utility function for internal use of this class.
					 * Applies a predicate against every evalue in an array.  Will return a truthy array, and a falsey array
					 */
	/**@typedef {any} matchVal */
	/**@typedef {any} nonmatchVal */
	/**@typedef {any} anyVal */
	/**@typedef { (any:any) => boolean} PredicateFn */
	/**@type { (predFn:PredicateFn) => (arry:[any]) =>  ([ [matchVal],[nonmatchVal] ]) } */
	static bifurcateArray = (predFn) => (arry) => arry.reduce(	(accArr,item) => {
		accArr[Number(!predFn(item))].push(item)    // using Number turns boolean into 0 or 1 for array index
		return accArr
	},	[[],[]] )
	// internal utility functions - used for arrMatch helpers
	// static _tail = () => slide(-1) 															// advance to the end of the array
	static _find = (val) => function $$find() { return val }		// advance until value is found
	static _skip = (n) => function $$skip() { return n	}				// slide position forward from current position, or backward from end (negative number)
		
}	// end of class
		
		
// assumes inputString is properly formatted with a leading and trailing '/'.  Usage of flags is not assumed
// NOTE: As RegExp flags are added to the standard, they must be added here
const regExp_fromString = (inputString) => {
	// one-liner version:  (requires a curried 'take' function from functional_dataUtils)
	// 		(inputString) => new RegExp(...take(2)(input.slice(1).split(/\/([gmiyusd]*)$/)))  
	//
	// spelled-out version:
	const regexSplitter = /\/([gmiyusd]*)$/   // a RegExp used in step2 to separate the pattern string from the flags string 
	
	const step1_removedLeadingSlash = inputString.startsWith('/') 
		? inputString.slice(1) 
		: (()=>{ throw Error(`[regExp_fromString]: parameter inputString must start with a '/'`) })() 
	// -> 'abc\/dsfdafd\/ef/gi' 
	
	const step2_parsed_string_intoRegexp_and_flag_strings = step1_removedLeadingSlash.split(regexSplitter)  
	// -> ['abc\/dsfdafd\/ef', 'gi', '']
	
	/**@type {[string,string]} */    // fixes typescript complaining about step3 using rest params when @ts-check on
	const step3_fix_for_Regexp_constructor = step2_parsed_string_intoRegexp_and_flag_strings.slice(0,2)  // aka take(2)(array)
	// -> ['abc\/dsfdafd\/ef', 'gi']
	
	const step4_create_RegExp_feeding_two_element_array_into_args_using_spread = new RegExp(...step3_fix_for_Regexp_constructor)
	// -> RegExp is /abc\/dsfdafd\/ef/gi   (inputString was "/abc\/dsfdafd\/ef/gi")
	
	return step4_create_RegExp_feeding_two_element_array_into_args_using_spread
	/* Testing  (if you want to use string literals as input in console, you need to use String.raw`string` to skip special character processing, i.e. \n, \t, etc)
				regExp_fromString(String.raw	`/acdefg/`		)				->	/acdefg/
				regExp_fromString(String.raw	`/acdefg/gi`	)				->	/acdefg/gi
				regExp_fromString(String.raw	`/acdefg/hi`	)				->	/acdefg/hi
	
			*/
	
}
const $tail =  Match._tail
const $find =  Match._find
const $skip =  Match._skip
		
const match = (value) => new Match(value)
	
const matchDeep = Match.matchDeep
const arrMatch =  Match.arrMatch
const objMatch =  Match.objMatch
		
export {
	regExp_fromString,
	match,
	not,
	is,
	isnot,
	num,
	str,
	fn,
	obj,
	arr,
	node,
	_do,
	_try,
	// matchDeep,
	// arrMatch,
	// objMatch,
}
