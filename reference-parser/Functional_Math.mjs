// supply one more more arrays of numbers, and this will sum everything up.
const sumArrays = (...numArray) => numArray.flat().reduce( (acc,item)=>acc+item, parseInt(0) ) 
		
		
		
//////////////////////////////////////////////////////////////////////////////////////////
// Two-argument math - curried
//
const sumInt = (x) => (y) => parseInt(x) + parseInt(y)
const subtractInt = (x) => (y) => parseInt(x) - parseInt(y)
const multiplyInt = (x) => (y) => parseInt(x) * parseInt(y)
const divideInt = (x) => (y) => parseInt( parseInt(x) / parseInt(y) )
const remainderInt = (x) => (y) => parseInt(x) % parseInt(y)	// 	watch out for negative results - not a "true" mod operator
			
const sum_fp = (x) => (y) => parseFloat(x) + parseFloat(y)
const subtract_fp = (x) => (y) => parseFloat(x) - parseFloat(y)
const multiply_fp = (x) => (y) => parseFloat(x) * parseFloat(y)
const divide_fp = (x) => (y) => parseFloat(x) / parseFloat(y)
		
export {
	// integer-based
	sumInt,
	subtractInt,
	multiplyInt,
	divideInt,
	remainderInt,
	// floating-point
	sum_fp,
	subtract_fp,
	multiply_fp,
	divide_fp,
}
