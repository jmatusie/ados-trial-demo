
/** pipe & compoose
			 * 	Usage:
			 * 		const runstuff = (x, y) = compose ( fn1(x), fn2(y), fn3, etc )
			 * 		const runstuff = (x, y) = pipe( fn1(x), fn2(y), fn3, etc )
			 */
const compose = (...fns) => (...args) => fns.reduceRight((res, fn) => [fn.call(null, ...res)], args)[0]
const pipe = (...fns) => (x) => fns.reduce( (y, f) => f(y), x )		
	
////////////////////////////////////////////////////////////////////////////////
//	Functional Utilities
//	- to be used inside of a "pipe"
////////////////////////////////////////////////////////////////////////////////
			
// tapData	::	string => anydata	=> anydata (anydata is unmodified)
const tapData = (desc)	=> (data) => console.log(`tap: ${desc}`, data) || data
			
// run a pure sice effect - no data modification or access - 
// possible use cases: set a global variable, log a timestamp, etc. 
// 
const sideEffect = (fn) => (data) => { 
	fn() 
	return data
}
	
// replacement for sideEffect2
const ontheSide = (fn) => (data) => {
	fn(data)
	return data
}
		
export {
	pipe,
	compose,
	sideEffect,
	ontheSide,
}
