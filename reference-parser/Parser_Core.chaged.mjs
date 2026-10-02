//@ts-check
/* eslint-disable no-unused-vars */
/* eslint-disable no-constant-condition */

const isVerbose = true


// Polyfill for String.prototype.replaceAll (not in node 14.x)
if (!String.prototype.replaceAll) {
	String.prototype.replaceAll = function (str, newStr){
		// If a regex pattern
		if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
			return this.replace(str, newStr)
		}
		// If a string
		return this.replace(new RegExp(str, 'g'), newStr)
	}
	isVerbose && console.log(`Parser_Core.mjs: polyfilled String.prototype.relaceAll()!`)
}


/** Import performance object only if it doesn't exist ** BIG UGLY HACK **
 * This block of code should be replaced with a better way soon.
 * If first checks to see if the performance object already exists (i.e. runs in browser or newer node versions)
 * It then runs an import on perf_hooks, which could fail if *not* running in a node envrironment
 * 
 */ 
const missing_global_performance_object = globalThis.performance ? false : true

// const imported_perf_hooks = await import('perf_hooks').catch(() => null)
// 
// if ( missing_global_performance_object && imported_perf_hooks != null ) {
// 	console.log(`[Parser_Core]: importing missing performance objects...`)
// 	globalThis.performance = imported_perf_hooks.performance
// 	globalThis.PerformanceObserver = imported_perf_hooks.PerformanceObserver
// }
// else {
// 	console.log(`[Parser_Core]: performance objects not missing, discarding import and using native performance system`)
// }


import { dedent } from "./dedent.mjs"
import { bifurcateArray, zip } from "./ArrayFunctionalUtils.mjs"
import { XML } from "./ClassXML.mjs";



/********** MODULE-START: Parser *******
 * @module Parser
 * @version 20-Mar-23
 * @requires Lots
 * 
 * @description A monoidal, parser combinator library for parsing semi-structured text files
 * and optimized for network automation purposes
 */

/***********************************************************************/
/****** Simple post-parsing utilities "Result Utilities"  *******/
/***********************************************************************/
// it just takes an array of strfings, and joins them together with a user-supplied delimiter.  Ripped from ArrayFunctionalUtilities.mjs to keep this module free of dependencies

/***********************************************************************/
/****  Display Utilities  *******/
/***********************************************************************/



// RegExp helper functions
//   to normalize RegExp parameters and string patterns indented for Regexp, so that
//   all patterns start with the '^' anchor
const fixedRegExp = (regExp) => (regExp.source.startsWith('^')) ?	regExp :	new RegExp('^' + regExp.source)
const stringRegExp = (strPattern) => (strPattern.startsWith('^')) ? new RegExp(strPattern) : new RegExp('^' + strPattern)



// utilities 


const terse = (value, indent = 0, cutoff = 100) => {
	const returnVal = (typeof value === 'string') ? `${value.slice(0, cutoff)}`
		: (typeof value === 'number' || typeof value === 'boolean') ? `${value}`
		: `${JSON.stringify(value, null, indent).slice(0, cutoff).replace(/["]/g, "")}`

	return returnVal
}

/**
 * @typedef {{
*   pname: string
*   error: string
*   contextError: string
*   atIndex: number
*   origPname: string
* }} ErrorPathRecord
*/

/**
 * @template T
 * @typedef {{
 *   target: string
 *   isError: boolean
 *   error: string
 *   data: any,
 *   dataLog: string[],
 *   result: T,
 *   index: number,
 *   pname: string,
 *   errorPath: ErrorPathRecord[],
 *   env: object,
 * }} ParserState<T>
  */



/**
 * @typedef { <T1,T2>( state: ParserState<T1>) => ParserState<T2>} ParseFn<T1,T2>
 */

	/**
	 * @typedef {{
	*   row: number
	*   rowStartIndex: number
	*   indentChar: string
	*   indentCount:	number
	*   rowLength: number
	* }} RowStructure
	*/


class Parser {
	static serialNumber = 1000
	static src = {}
	
	static traceLog = []
	static reset = () => {
		Parser.traceLog = []
		Parser.serialNumber = 1
	}

	// constructor(p, pname='') {
	// 	this.p = p
	// 	this.p.pname = pname || this.p.name || this.p.name
	// 	this.pname = this.p.pname
	// }

	
	/** @param {ParseFn} p */
	constructor(p, pname='') { 
		//this.constructor_w_tracing(p, pname)	
		this.constructor_lite(p, pname)	
	}


	// normal constructor without the global trace facility (Parser.traceLog)
	
	/** @param {ParseFn} p */
	constructor_lite(p, pname='') {
		this.id = Parser.serialNumber++
		/** @type ParseFn */
		this.p = p
		this.p
		this.p.pname = pname || this.p.name
		this.pname = this.p.pname
	}

	// decorated constructor which intercepts every single parser execution and logs to Parser.traceLog
	constructor_w_tracing(p, pname='') {
		this.id = Parser.serialNumber++

		// this block is equivalent to p, but adds performance & logging to each call (may be very slow!)
				this.p = (prevState) => {
			performance.mark(`${this.id}-start`)
			
			const newState = p(prevState)
		
			// intercept & modify the state while parser is in flight to actively add tracking information...
			newState.id = this.id
			newState.prevID = prevState?.id ?? 0

			const duration = performance.measure(`${this.id}-end`, `${this.id}-start`).duration

			// Parser.traceLog - record every parsing transaction and along with it, all state transitions
			Parser.traceLog.push({
				pname: this.p.pname,
				id: this.id,
				duration,
				indexChange: newState.index - prevState.index,
				currState_prevID: newState.prevID,	// 

				// extract the pre-parsed state & save to Parser.traceLog()
				prevState_pname: prevState.pname,
				prevState_id: prevState.id,
				prevState_index: prevState.index,
				prevState_isError: prevState.isError,
				prevState_error: prevState.error,
				prevState_result: prevState.result,
				// extract the newly-parsed state & save to Parser.traceLog() - for direct before/after comparison
				currState_pname: newState.pname,
				currState_id: newState.id,
				currState_index: newState.index,
				currState_isError: newState.isError,
				currState_error: newState.error,
				currState_result: newState.result,
			})
			return newState
		}
		
		this.p.pname = pname || this.p.name
		this.pname = this.p.pname

	}

	[Symbol.toStringTag]() {
		// return this.p?.pname ?? ''
		return `${this.p?.pname ?? '???'}`
	}


	[Symbol.toPrimitive]() {
		return `${this.p?.pname ?? '???'}`
	}


	// name a parsing function for debugging/tracing/logging purposes
	// NOTE: this one is immutable
	named(pname='') {
		const p = this.p
		return new Parser( function named$method (prevState) {
			prevState.pname = pname
			const nextState = p(prevState)
			return nextState
		}, pname )
	}

	// name a parsing function for debugging/tracing/logging purposes
	// NOTE: this one is mutable, but causes problems for things like
	// const MTU = digits.named('mtu') - because being mutable,
	// it would just rename digits to 'mtu'.  Not good.
	named_mutable(pname='') {
		this.p.pname = pname
		this.pname = this.p.pname
		return this
	}


	// note that run will normalize any Windows/DOS-type CRLF linefeeds to simple LF (Unix) text before processing
	// This vastly simplifies whitespace parsing and prevent corner-case errors that pop up due to these differences
	
	run( _targetString='', envData={} ) {
		// convert any newlines using CR/LFs to LF only, because:
		// 1.  the two-character-nature of such newlines messes with indentation & row/col calculations
		// 2.  provides a normalized text format that works regardless if configuration came from windows (i.e. copy/paste) or linux (i.e. mongoDB)
		if (typeof(_targetString) !== 'string') {
			console.error(`[Parser_Core]::run(_targetString): target string is not a string:`)
		}
		const targetString = _targetString.replaceAll(/\r\n/g, '\n')
		// const targetString = _targetString

		const pname = this.p.pname || ''
		const initialState = Parser.createParserState(targetString, pname)
		const finalState = this.p(initialState)

		const {row, col} = Parser.getRowAndCol(finalState.target, finalState.index)

		return finalState.isError ? {
			target: finalState.target,
			isError: true,
			error: finalState.error,
			data: finalState.data,
			dataLog: finalState.dataLog,
			result: '',
			index: finalState.index,
			pname,
			errorPath: finalState.errorPath,
			env: {...envData},
			row,
			col,
		}
			: {
				target: finalState.target,
				isError: false,
				error: '',
				data: finalState.data,
				dataLog: finalState.dataLog,
				result: finalState.result,
				index: finalState.index,
				pname,
				env: {...envData},
				row,
				col,
			}
	}

	
	// like .run() but for lightweight, shorter sections of text, like section parsers, avoiding overhead & complexity.
	runLite(targetString='') {
		const pname = this.p.pname || ''
		const initialState = Parser.createParserState(targetString, pname)
		const finalState = this.p(initialState)
		return finalState
	}

	// identical to runLite - trying to bikeshed the name here...
	parse(targetString='') {
		const pname = this.p.pname || ''
		const initialState = Parser.createParserState(targetString, pname)
		const finalState = this.p(initialState)
		return finalState
	}

	succeedOnError(resultUponError=null) {
		const p = this.p
		const pname = (this.p.pname || this.p.name || '(unnamed)') + `.succeedOnError(${resultUponError})`
		return new Parser( function succeedOnError$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) {
				return Parser.updateResult(nextState, resultUponError, pname )
			}
			return Parser.updateError(nextState, `[${pname}]: Error at ${nextState.index} (from ${prevState.index}) due to successful match of parent parser`, pname)
		}, pname )
	}

	// map - map result to result
	// mapFn_on_result : (result) => result
	map(mapFn_on_result) {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).map()"'
		return new Parser( function map$method (prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			return Parser.updateResult(nextState, mapFn_on_result(nextState.result), pname )
		}, pname )
	}


	// mapData - map data to data
	// mapFn_on_data : (data) => data
	mapData(name='data', mapFn_datamapFn_on_result_data_obj) {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).mapData()"'
		return new Parser( function mapData$method(prevState) {
			const nextState = p(prevState)
			// if (nextState.isError) return nextState			// do nothing if error (early exit)
			const { result, data, env } = nextState
			const dataToUpdate = env[name] ?? data ?? null
			if (name=='') {
				const updatedData = mapFn_datamapFn_on_result_data_obj({ result, data:dataToUpdate })
				return Parser.updateData(nextState, updatedData, '', pname)
			}
			const updatedData = mapFn_datamapFn_on_result_data_obj({ result, data:dataToUpdate })
			return Parser.updateData(nextState, updatedData, name, pname)

		}, pname )
	}

	// setEnv - returns a parser that changes nothing except setting the data (even if error)
	// if no value is supplied, the current result is assumed.
	// if no name is supplied, 'data' is assumed
	setEnv(name='data', value=null) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `"(unnamed).setEnv(${name})"`
		return new Parser( function setEnv$method(prevState) {
			const nextState = p(prevState)
			// if (nextState.isError) return nextState			// do nothing if error (early exit)
			const dataValue = value ?? nextState.result
			const returnState = Parser.updateData(nextState, dataValue, name, pname)
			// console.log(`[setEnv](method):`, {prevState, nextState, returnState})
			return returnState
		}, pname )
	}


	// setData - returns a parser that changes nothing except setting the data (even if error)
	// if no value is supplied, the current result is assumed.
	// if no name is supplied, 'data' is assumed
	setData(value=null) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `"(unnamed).setData(${name})"`
		return new Parser( function setData$method(prevState) {
			const nextState = p(prevState)
			// if (nextState.isError) return nextState			// do nothing if error (early exit)
			const dataValue = value ?? nextState.result
			const returnState = Parser.updateData(nextState, dataValue, 'data', pname)
			// console.log(`[setData](method):`, {prevState, nextState, returnState})
			return returnState
		}, pname )
	}


	// saveAs - returns a parser that changes nothing except setting the data (even if error)
	// if no value is supplied, the current result is assumed.
	// if no name is supplied, 'data' is assumed
	saveAs(name) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `"(unnamed).saveData(${name})"`
		return new Parser( function setData$method(prevState) {
			const nextState = p(prevState)
			// if (nextState.isError) return nextState			// do nothing if error (early exit)
			const dataValue = nextState.data
			return Parser.updateData(nextState, dataValue, name, pname)
		}, pname )
	}


	// mapError - map error (with index & data) to error.  Don't include history.
	// This differs from mapError_fullHistory simply based on running an updateError on the prevState instead of the nextState
	// mapFn_on_error_index_data_obj :  ({error: string, index: number, data: any}) => error :string
	mapError(mapFn_on_error_index_data_obj) {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).mapError()"'
		return new Parser( function mapError$method(prevState) {
			const nextState = p(prevState)
			if (!nextState.isError)	return nextState 		// do nothing if *NOT* an error

			const { error, index, data } = nextState
			const modifiedErrorMessage = mapFn_on_error_index_data_obj({ error, index, data })
			return Parser.updateError(prevState, modifiedErrorMessage, pname, nextState.error)  // <-- difference is right here (nextState vs prevState)
		}, pname )
	}


	// mapError_fullHistory - map error (with index & data) to error.  Keep full history
	// This differs from mapError simply based on running an updateError on the nextState instead of the prevState so we can capture failure reasons instead of throwing them away
	// mapFn_on_error_index_data_obj :  ({error: string, index: number, data: any}) => error :string
	mapError_fullHistory(mapFn_on_error_index_data_obj) {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).mapError_fullHistory()"'
		return new Parser( function mapError_fullHistory$method(prevState) {
			const nextState = p(prevState)
			if (!nextState.isError)	return nextState 		// do nothing if *NOT* an error
			
			const { error, index, data } = nextState
			const modifiedErrorMessage = mapFn_on_error_index_data_obj({ error, index, data })
			return Parser.updateError(nextState, modifiedErrorMessage, pname, nextState.error)  // <-- difference is right here (nextState vs prevState)
		}, pname )
	}


	// force a failure, but capture the 
	fail(errMsg='') {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).fail()"'
		return new Parser( function fail$method(prevState) {
			const currentState = p(prevState)

			// if not an error, convert to error, but advance the result
			if ( currentState.isError == false )	{
				const returnVal = {
					target: 			prevState.target,	
					isError: 			true,
					error: 				`[${pname}.fail()]: ${errMsg}`,
					data: 				prevState.data,
					dataLog: 			[...prevState.dataLog, `[${pname}]: ran fail() method.  State:\n${Parser.rptState}`],
					result:				currentState.result,
					index: 				currentState.index,
					pname: 				pname ?? prevState.pname,
					errorPath: 		prevState.errorPath,
					env: 					prevState.env,
				}
				// console.log(`[fail]`, returnVal)
				return returnVal
			}
			return Parser.updateError(prevState, `[${pname}] (${prevState.index}->${currentState.index}): ${errMsg}`, pname, currentState.error)
		}, pname )
	}


	// ifError - very simple type of mapError, using a string as an argument instead of a function
	ifError(errMsg='') {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).ifError()"'
		return new Parser( function ifError$method(prevState) {
			const nextState = p(prevState)
			if (!nextState.isError)	return nextState 		// do nothing if *NOT* an error
			return Parser.updateError(prevState, `[${pname}] (${prevState.index}->${nextState.index}): ${errMsg}`, pname, nextState.error)
		}, pname )
	}


	envToResult(name) {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).map_fromData()"'
		return new Parser( function envToResult$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState			// do nothing if error (early exit),pname)

			const env = nextState.env
			const newResult = env?.[name] ?? `[${pname}]: no env var named ${name}...`

			return Parser.updateResult(nextState, newResult, pname )
		}, pname )
	}


	// map_fromData - map data + result to new result
	// mapFn_on_result_data_obj : ({result, data}) => result
	map_fromData(name, mapFn_on_result_data_env_obj) {
		const p = this.p
		const pname = this.p.pname || this.p.name || '"(unnamed).map_fromData()"'
		return new Parser( function map_fromData$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState			// do nothing if error (early exit),pname)

			const { result, data, env } = nextState
			const updatedResult = (name==null) ? data 
				:  (mapFn_on_result_data_env_obj == null) ? env?.[name]
				: mapFn_on_result_data_env_obj({result,data,env})
			
			return Parser.updateResult(nextState, updatedResult, pname )
		}, pname )
	}

	// Convert a success to a failure.  
	// use case: inside a many(oneOf(...parsers)) or setOf(...parsers) to force a termination
	// The reason we want to force a terminatis is that we can have a wildcard parser inside the set
	// such as const unknown = parseLine(everythingUntil(eol), and still force a termination on a
	// *known* set of termination parsers
	asFailure(errorMessage) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `"(unnamed).fail('${errorMessage}')"`
		return new Parser( function map_fromData$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			// if successful, fail, but do not advance as this will violate the indented use case as a terminatoin parser
			return Parser.updateError(prevState, `${errorMessage}`, pname )
		}, pname )
	}


	// 		const { result, data } = nextState
	// 		const dataToUpdate = data[name] ?? null
	// 		const updatedData = mapFn_datamapFn_on_result_data_obj({ result, data:dataToUpdate })
	// 		return Parser.updateData(nextState, updatedData, name, pname)

	/** mapState ** USE ONLY IF NECESSARY **  
	 *mapState - map any part of the state to new state (use with caution) - this bypasses Parser.updateXYZ guard methods
	 *basically a .map() method, but using a map function with access to the entire state
	 *
	 * mapFn_on_state_obj : ({target, isError, error, data, dataLog, result, index, pname}) -> ({target, isError, error, data, dataLog, result, index, pname})
	 */
	// mapState(mapFn_on_stateObj) {
	// 	const p = this.p
	// 	const pname = this.p.pname || this.p.name || '"(unnamed).mapState()"'
	// 	return new Parser( function mapState$method (prevState) {
	// 		const nextState = p(prevState)
	// 		if (nextState.isError) return nextState			// do nothing if error (early exit),pname)
	// 		return mapFn_on_stateObj(nextState)
	// 	}, pname )
	// }


	// chain - lift a result to a new Parser instance (ignored if isError == true)
	// tlfn_on_result : (result) => Parser
	chain(tlFn_on_result) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `unnamed`
		const tlfnName = tlFn_on_result?.p?.pname ?? 'unnamed_tlfn'
		const fullName = `${pname}.chain(${tlfnName})=>${tlfnName}`

		// console.error(`JUST A NOTE: chain is used, ${pname}`)
		return new Parser( function chain$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			const tlFnResult = tlFn_on_result(nextState.result)
			const pname_after_tlFn = tlFnResult?.p?.pname || tlFnResult?.p?.name || '"(unnamed_user_tlfn)"'
			const dataLog = []

			const startPosition = (Parser._tracing) ? Parser.rptPosition(prevState.target, prevState.index) : ''
			if (Parser._tracing) {
				dataLog.push(`[${pname}.chain(${tlFnResult?.pname ?? '???'})]: Starting .chain() at ${startPosition}`)
			}

			// execute the subParser...
			const resultState = tlFnResult.p(nextState)

			if (Parser._tracing) {
				const posPrev = Parser.rptPosition(prevState.target, prevState.index)
				const resultPosition =  Parser.rptPosition(resultState.target, resultState.index)
				console.log(`CHAIN:[${fullName}/${pname_after_tlFn}]: ${startPosition}->${resultPosition}`, [
					`prevState_pname:   ` + `${prevState?.pname ?? '???'}`,
					`this_pname: pname: ` + `${pname}`, 
					`nextState_pname:   ` + `${nextState?.pname ?? '???'}`,
					`nextState_result:  ` + `${nextState.result}`,
					`tlfn_pname:    		`	+ `${tlFn_on_result.pname}`,
					`tlfn_result_pname: ` + `${tlFnResult?.pname ?? '???'}`,
					`resultState_pname: ` + `${resultState?.pname ?? '???'}`,
				])
				return Parser.updateDataLog(resultState, `CHAIN:[${fullName}/${pname_after_tlFn}]: ${startPosition}->${resultPosition}`)
			}
			return resultState
		}, fullName)				/// this may not work due to the nature of a tlfn - need to test
	}


	// recover - like chain, but for isError == true, ignored otherwise
	// Lift a state (error, index, & data) to a new Parser which has its error state reset
	// 
	// tlFn_on_error_index_data_obj :  ({error, index, data}) => Parser (where Parser error is cleared)
	recover(tlFn_on_error_index_data_obj) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.recover()'`
		return new Parser( function recover$method(prevState) {
			const nextState = p(prevState)
			if (!nextState.isError) return nextState
			const { error, index, data } = nextState
			const nextParser = tlFn_on_error_index_data_obj({ error, index, data })
			return nextParser.p({ ...nextState, isError: false })
		}, pname )
	}


	// chain_fromData - like chain, but works for result + data input params instead of just result.  Not for isError=true
	// tlFn_on_result_data_obj : ({result,data}) = Parser
	chain_fromData(tlFn_on_result_data_obj) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.chain_fromData()'`
		return new Parser( function chain_fromData$method(prevState) {
			const nextState = p(prevState)
			if (nextState.error)
				return nextState
			const { result, data } = nextState
			const nextParser = tlFn_on_result_data_obj({ result, data })
			return nextParser.p(nextState)
		}, pname )
	}


	// tagAs: convert the result to a dictionary: {'tag': tagName, 'value': result }, with the property name 'tagName'

	// Allows you to name data as you parse it, and assign it a name, for recovery later.
	// Use with recovery methods:
	//  someParser.getTagged()					- to consolidate unique tag names from a 'sequenceOf' parser into a single dictionary
	//  someParser.collectedTagged() 	- to consolidate non-unique tag names into a consolidated object
	tagAs(tagName) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tagAs(${tagName})'`
		return new Parser( function tagAs$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			return Parser.updateResult(nextState, { tag: tagName, value: nextState.result }, pname)
		}, pname)
	}

	// like 'tagAs', but shorthand - will use supplied 'tagName' as the prop name, but if it's missing, will use the name of the parser as the tag name.
	tag(tagName='') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tag()'`
		return new Parser( function tag$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			return Parser.updateResult(nextState, { tag: tagName || pname, value: nextState.result }, pname)
		}, pname)
	}


	// tagList: convert the array result to a property list, with the property name 'tagName'
	// Allows you to name data as you parse it, and assign it a name, for recovery later.
	// Use with recovery methods:
	//  someParser.getTagged()					- to consolidate unique tag names from a 'sequenceOf' parser into a single dictionary
	//  someParser.collectedTagged() 	- to consolidate non-unique tag names into a consolidated object
	tagList(tagName='') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tagList(${tagName})'`
		if (!tagName) throw new Error(`[${pname}]: method .tagList() must contain a name`)
		return new Parser( function tagList$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			return Parser.updateResult(nextState, { 
				$type$: 'List', 
				tag: tagName, 
				value: Array.isArray(nextState.result) ? nextState.result : []
			}, pname)
		}, pname)
	}


	// like 'tagAs', but allows adding an external value, instead of a value from the result.
	// used to classify results.  E.g. - addTag('type', 'a'} will add a property {type: 'a'} to the result.
	// E.g. #2: addTag('ismroute', 'true')
	addTag(name,value) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'addTag.tag()'`
		return new Parser( function addTag$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			return Parser.updateResult(nextState, [nextState.result, { tag: name, value }], pname)
		}, pname)
	}

	// moves any log messages matching the filterFn to the result instead of the datawLogs.
	// Should be used for testing / qa purposes when developing parser scripts - intended to bring select log messages to results for analysis (i.e. skipped lines)
	// has not yet been tested.
	dataLog_toResult ( filterFn = (x)=>x ) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tagList(${filterFn?.name??filterFn})'`
		return new Parser( function dataLog_toResult$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			const {result, dataLog} = nextState
			const [movedLogs, keptLogs] = bifurcateArray (filterFn) (dataLog)
			nextState.dataLog = keptLogs
			return Parser.updateResult(nextState, { 
				dataLog,
				result,
			}, pname)
		}, pname)
	}

	// like tapParser, but a method.  The console.log is implicit
	tap(tapName_wColor=`unnamed:blue`, logFn=console.log) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tap(${tapName_wColor})`

		const [tapName, color='blue'] = tapName_wColor.split(':')  // used for colorizing console.log output...

		return new Parser( function tap$method(prevState) {
			if (prevState.isError) {
				console.error(`[.tap(${tapName_wColor})] SHOULD_NOT_SEE_THIS_ERROR (inherited) at parser: ${pname}:\n`, {
					error: prevState.error, lastIndex: prevState.index 
				})
				return prevState
			}

			const nextState = p(prevState)
			const lastParser = nextState.pname
			const lastLastParser = prevState.pname
			const currentRowCol = Parser.rptLine(nextState.target, nextState.index)
			const lastRowCol = Parser.rptLine(nextState.target, prevState.index)
			const stateChangeReport = Parser.rptStateChange(`[tap(${tapName_wColor})::${pname})`, nextState, prevState)
			
			const stateChangeReportFormatted = stateChangeReport.map(line=>JSON.stringify(line)).join('\n')

			if (nextState.isError) {
				const errLogFn = (logFn == console.log) ? console.warn : logFn
				
				errLogFn(dedent`
					[.tap(${tapName})] Parser Error at parser: ${pname}:
					[State Change Report]
					${stateChangeReportFormatted}
				`, {
					lastParser,
					lastLastParser,
					pname,
					error: nextState.error,
					currentRowCol,
					lastRowCol,
					data: nextState.data,
					errorPath: nextState.errorPath,
					prevState,
					nextState,
					stateChangeReport,
				})
			} 
			else {
				logFn(dedent`
					[.tap(${tapName})] Parser Result from parser: ${pname}:
					%c[State Change Report]
					%c${stateChangeReportFormatted}
				`, 
				`color:${color};font-weight:bold;font-size:14px`, 			// <- this parameter is used because we prepended %c in the log string. console.log looks for a parameter for color
				`color:${color}`, 			// <- this parameter is used because we prepended %c in the log string. console.log looks for a parameter for color
				{
					lastParser,
					lastLastParser,
					pname,
					result: nextState.result,
					currentRowCol,
					lastRowCol,
					data: nextState.data,
					prevState,
					nextState,
					stateChangeReport,
				})
			}

			return Parser.updateDataLog(nextState, stateChangeReport)
		}, pname)
	}


	// like tapParser, but a method.  The console.log is implicit
	tapOnError(tapName=`unnamed`, logFn=console.warn) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tapOnError(${tapName})'`

		return new Parser( function tapOnError$method(prevState) {
			if (prevState.isError) {
				console.error(`[.tapOnError(${tapName})] SHOULD_NOT_SEE_THIS_ERROR (inherited) at parser: ${pname}:\n`, {
					error: prevState.error, lastIndex: prevState.index 
				})
				return prevState
			}

			const nextState = p(prevState)
			if (!nextState.isError) return nextState  // early exit if not an error

			const lastParser = nextState.pname
			const lastLastParser = prevState.pname
			const currentRowCol = Parser.rptLine(nextState.target, nextState.index)
			const lastRowCol = Parser.rptLine(nextState.target, prevState.index)
			const stateChangeReport = Parser.rptStateChange(`[tap(${tapName})::${pname})`, nextState, prevState)

			logFn(`[.tapOnError(${tapName})] ERROR at parser: ${pname} :\n`, {
				lastParser,
				lastLastParser,
				pname,
				error: nextState.error,
				currentRowCol,
				lastRowCol,
				data: nextState.data,
				errorPath: nextState.errorPath,
				prevState,
				nextState,
				stateChangeReport,
			})

			return Parser.updateDataLog(nextState, stateChangeReport)
		}, pname)
	}


	tapResult(tapName='unnamed', logFn=console.log) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tapResult(${tapName})`

		return new Parser( function tapResult$method(prevState) {
			if (prevState.isError) {
				console.error(`[.tapResult(${tapName})] SHOULD_NOT_SEE_THIS_ERROR (inherited) at parser: ${pname}:\n`, {
					error: prevState.error, lastIndex: prevState.index 
				})
				return prevState
			}

			const nextState = p(prevState)
			const lastParser = nextState.pname
			const lastLastParser = prevState.pname
			const currentRowCol = Parser.rptLine(nextState.target, nextState.index)
			const lastRowCol = Parser.rptLine(nextState.target, prevState.index)

			if (nextState.isError) {
				logFn(`[tapResult(${tapName})] ERROR at  parser: ${pname}:\n`, {
					error: nextState.error,
					currentRowCol,
					lastRowCol,
					errorPath: nextState.errorPath,
					lastParser,
					lastLastParser,
					pname,
				})
				return nextState
			} 

			logFn(`[.tapResult(${tapName})] RESULT from parser: ${pname}:\n`, {
				result: nextState.result,
				data: nextState.data,
				currentRowCol,
				lastParser,
				lastLastParser,
				pname,
			})

			return nextState
		}, pname)
	}

	// logs only the result to the console if not an error - like the old someParser.logResult('resultname')
	tapEnv(tapName = 'unnamed', logFn = console.warn) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tapEnv(${tapName})'`

		return new Parser( function tapEnv$(prevState) {
			const currState = p(prevState)

			const { target, index, isError, error, result, data, dataLog, pname:lastParser, ...rest } = currState

			const prevText = (buffsize) => target.slice( ( (index < buffsize) ? 0 : index-buffsize ), index )
			const nextText = (buffsize) => target.slice( index, prevState.index + buffsize )
			const currentRowCol = Parser.rptLine(target, index)

			// if (isError) return currState  // early exit if error
			logFn(dedent`
				[${pname}].tapEnv(${tapName}):, 
				[${JSON.stringify(currState.env, null, 2)}]
			`)

			return Parser.updateDataLog(currState,
				`[${pname}.tapEnv(${tapName})]:`,
				`[${JSON.stringify(currState.env, null, 2)}]`,
			)
		}, pname)
	}


	// like tapParser, but a method.  The console.log is implicit
	tapIf(predicateFn_on_state, tapName=`unnamed`, logFn=console.log) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.tap(${tapName})`

		return new Parser( function tap$method(prevState) {
			if (prevState.isError) {
				console.error(`[.tap(${tapName})] SHOULD_NOT_SEE_THIS_ERROR (inherited) at parser: ${pname}:\n`, {
					error: prevState.error, lastIndex: prevState.index 
				})
				return prevState
			}

			const nextState = p(prevState)
			const shouldBeTapped = predicateFn_on_state(nextState)

			if (typeof(shouldBeTapped !== 'boolean')) {
				console.warn(`[Parser::tapIf(fn, ${tapName})]: the supplied predicate function on the state returned '${JSON.stringify(shouldBeTapped)}', which is not a boolean.  Proceeding with JS type conversion rules`)
			}

			// short-circuit if tapping condition is not met
			if (!shouldBeTapped) {
				return nextState
			}

			const lastParser = nextState.pname
			const lastLastParser = prevState.pname
			const currentRowCol = Parser.rptLine(nextState.target, nextState.index)
			const lastRowCol = Parser.rptLine(nextState.target, prevState.index)
			const stateChangeReport = Parser.rptStateChange(`[tap(${tapName})::${pname})`, nextState, prevState)

			if (nextState.isError) {
				const errLogFn = (logFn == console.log) ? console.warn : logFn
				errLogFn(`[.tap(${tapName})] ERROR at parser: ${pname} :\n`, {
					lastParser,
					lastLastParser,
					pname,
					error: nextState.error,
					currentRowCol,
					lastRowCol,
					data: nextState.data,
					errorPath: nextState.errorPath,
					prevState,
					nextState,
					stateChangeReport,
				})
			} 
			else {
				logFn(`[.tap(${tapName})] RESULT from parser: ${pname}:\n`, {
					lastParser,
					lastLastParser,
					pname,
					result: nextState.result,
					currentRowCol,
					lastRowCol,
					data: nextState.data,
					prevState,
					nextState,
					stateChangeReport,
				})
			}
			return Parser.updateDataLog(nextState, stateChangeReport)
		}, pname)
	}





	// adds a log, and uses any data from data field for additional context-based tagging...
	log(successMsg = '') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.log(${successMsg})'`
		return new Parser( function log$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState

			const lastParser1 = prevState?.pname || ''
			const lastParser2 = nextState?.pname || ''
			// const parentState = nextState?.data?.parentState ?? null
			// const relativeIndex = parentState?.index ?? 0
			// const data = nextState?.data?.parentState?.data ?? ''
			// const parent_pname = nextState?.data?.parentState?.pname ?? `"(parent_pname_unknown)"`
			// const parentIndices = (parentState) ? `parent:${relativeIndex + prevState.index}->${relativeIndex + nextState.index}` : `parent: none`
			return Parser.updateDataLog( nextState, `${successMsg}`)
		}, pname)
	}

	// adds a log, and uses any data from data field for additional context-based tagging...
	// can take a function, such as (res) => `parser as successfully found the result for ${res}`
	logResult(onSuccess = '') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.log(${onSuccess})'`
		
		return new Parser( function logResult$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState

			const fromPos = Parser.rptPosition(prevState.target, prevState.index)
			const toPos = Parser.rptPosition(prevState.target, nextState.index)
			const logMessage = typeof(onSuccess) === 'function' ? onSuccess(nextState.result) : onSuccess

			return Parser.updateDataLog(nextState, `${logMessage} (from: ${fromPos}, to: ${toPos}))`)
		}, pname)
	}

	// adds a log, and uses any data from data field for additional context-based tagging...
	// can take a function, such as (res) => `parser as successfully found the result for ${res}`
	logResult_v2(onSuccess = '') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.log(${onSuccess})'`
		
		return new Parser( function logResult$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState

			const fromPos = Parser.rptPosition(prevState.target, prevState.index)
			const toPos = Parser.rptPosition(prevState.target, nextState.index)
			const logMessage = typeof(onSuccess) === 'function' ? onSuccess(nextState.result) : onSuccess

			return Parser.updateDataLog(prevState, `${logMessage} (from: ${fromPos}, to: ${toPos}))`)
		}, pname)
	}


	// adds a log, and uses any data from data field for additional context-based tagging...
	logResultVerbose(successMsg = '') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.log(${successMsg})'`
		return new Parser( function logResult$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState

			const lastParser1 = prevState?.pname || ''
			const lastParser2 = nextState?.pname || ''
			// const parentState = nextState?.data?.parentState ?? null
			// const relativeIndex = parentState?.index ?? 0
			// const data = nextState?.data?.parentState?.data ?? ''
			// const parent_pname = nextState?.data?.parentState?.pname ?? `"(parent_pname_unknown)"`
			// const parentIndices = (parentState) ? `parent:${relativeIndex + prevState.index}->${relativeIndex + nextState.index}` : `parent: none`
			const fromPos = Parser.rptPosition(prevState.target, prevState.index)
			const toPos = Parser.rptPosition(prevState.target, nextState.index)
			return Parser.updateDataLog(nextState, `[${pname}]: ${successMsg}, from: ${fromPos}, to: ${toPos}), result: "${nextState.result}")`)
		}, pname)
	}

	// add a log, or array of logs, based on the environment (env) object
	// fn_on_env must return a string, or an array of strings (log).  logEnv will filter out any
	// entries that are null, undefined, empty strings, or empty arrays
	logEnv(fn_on_env) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.log(${fn_on_env})'`
		
		return new Parser( function logEnv$method(prevState) {
			const currState = p(prevState)

			const extractedLogs = fn_on_env(currState.env)
			const extractedLogs_refined = (Array.isArray(extractedLogs) ? extractedLogs.flat() : extractedLogs)
			const extractedLogs_filtered = extractedLogs_refined.filter( (log) => log ?? false)  // removes log results of null, undefined, or empty string
			// console.log(`logEnv`, {extractedLogs_refined, currState})
			return Parser.updateDataLog(currState, extractedLogs_filtered)
		}, pname)
	}


	// log with a message ONLY if the parser is an error
	logOnError(errorMsg = '') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.logOnError(${errorMsg})'`
		return new Parser( function logOnError$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) {
				return Parser.updateDataLog( nextState,
					`[${pname}.logOnError()]: ParseError: (${prevState.index}->${nextState.index}): ${errorMsg}).`,
					`  Original error message: ${nextState.error}`,
				)
			} 
			return (nextState)
		}, pname)
	}


	// enable trace flag, for additional logging of output (can be very verbose)
	traceOn(tag = '') {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.traceOn(${tag})'`

		return new Parser( function traceOn$method(prevState) {
			const wasTracing = Parser._tracing
			const nextState = p(prevState)
			Parser._tracing = true
			return (!wasTracing) ?
				Parser.updateDataLog(
					nextState,
					`[${pname}.traceOn(${tag})]: Parser._tracing is enabled, index: ${nextState.index}:`,
					`...parserAt: ${Parser.rptState(nextState)}, wasAt: ${Parser.rptState(prevState)}`,
					`...prevState: ${JSON.stringify(prevState, null, 2)}`,
					`...currState: ${JSON.stringify(nextState, null, 2)}`,
				)
				: nextState
		}, pname )
	}


	// disable trace flag, for additional logging of output (can be very verbose)
	traceOff() {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.traceOff()'`
		return new Parser( function traceOff$method(prevState) {
			const wasTracing = Parser._tracing
			const nextState = p(prevState)
			Parser._tracing = false
			return (wasTracing) ?
				Parser.updateDataLog(nextState, `[${pname}.traceOff()]: Parser._tracing is now disabled, index: ${nextState.index}:`)
				: nextState
		}, pname )
	}


	// use this method to append an array of messages into the running dataLog of the parser
	insertLogs(...logs) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.insertLogs()'`

		return new Parser( function insertLogs$method(prevState) {
			const nextState = p(prevState)
			return Parser.updateDataLog(nextState, logs.flat())
		}, pname )
	}


	// getTagged()
	//  shortcut for someParser.map(getTagged) - use as someParser.getTagged()
	//  takes in an array of tagged objects (i.e. each object looks like {tag:tagName, value:value} ] ), and 
	//	returns a single object, organized by the tag
	// 
	// **IMPORTANT** 
	//		This function is designed for result arrays with *** UNIQUE *** tags. 
	// 		For a tagged array with *** NON UNIQUE*** tags, use 'collectTagged'
	//
	// getTagged : Parser result[] -> Parser obj
	getTagged() {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.getTagged()'`

		return new Parser( function getTagged$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState

			const consolidatedResult = Array.isArray(nextState.result) ? 
				nextState.result
					.filter((item) => (item?.tag ?? false))
					.reduce(
						(obj, item) => ({ ...obj, [item.tag]: item.value }),
						Object.create(null)
					)
				: ({ 
					[nextState.result.tag]: nextState.result.value 
				})
			return Parser.updateResult(nextState, consolidatedResult, pname)
		}, pname )
	}


	// getTaggedR() - recursively consolidate all tagged results into a reduced data structure
	// 	NOTE: eliminates all untagged results automatically
	getTaggedR() {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.getTaggedR()'`

		return new Parser( function getTaggedR$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState

			const consolidatedResult = Parser.getTaggedR(nextState.result)
			return Parser.updateResult(nextState, consolidatedResult, pname)
		}, pname )
	}

	// shortcut for someParser.map(collectTaggedItems) - use as someParser.collectTagged()
	//  takes in an array of tagged objects (i.e. each object looks like {tag:tagName, value:value} ] ), and 
	//	returns a single object, organized by the tag
	// 
	// **IMPORTANT** 
	//		This function is designed for result arrays with *** NON-UNIQUE *** tags
	// 		For a tagged array with *** UNIQUE*** tags, use 'getTagged'
	collectTagged() {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.collectTagged()'`

		return new Parser( function collectTagged$method(prevState) {
			const nextState = p(prevState)
			if (nextState.isError) return nextState
			const { result } = nextState

			// early exit if result is not an array
			if (!Array.isArray(result)) return Parser.updateError(nextState, `[${pname}]: the result needs to be an array, but got ${JSON.stringify(result)}`, pname)

			// build the new result
			const consolidatedResult = result.reduce((accObj, { tag, value }) => {
				if (tag) {
					accObj[tag] = [...(accObj[tag] ?? []), value]
				}
				return accObj
			}, Object.create(null)) 		// initial value of return object
			return Parser.updateResult(nextState, consolidatedResult, pname)
		}, pname )
	}


	// starts debugger during run phase of the parser
	debug() {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.debug()'`
		console.warn(`NOTE: enabled debugging for parser ${pname}`)
		debugger
		return new Parser ( function debug$method(prevState) {
			debugger
			const nextState = p(prevState)
			debugger
			return nextState
		}, pname )
	}


	// starts debugger during run phase of the parser, but only if the supplied predicate on the state is true
	debugIf(statePredicateFn) {
		const p = this.p
		const pname = this.p.pname || this.p.name || `'unnamed.debug()'`
		console.warn(`NOTE: enabled debugging for parser ${pname}`)
		return new Parser ( function debug$method(prevState) {
			const nextState = p(prevState)
			if (statePredicateFn(nextState)) {
				debugger
			}
			return nextState
		}, pname )
	}



	// of :: a -> Parser e a s
	static of = (result) => {
		const pname = `parser.of(${result})`
		return new Parser( (state) => Parser.updateResult(state, result, 'Parser.of'), pname)
	}

	/** static methods are used to simplify exporting */
	// (stringToParse:string, initialData:any) => parserState
	/** @type {(target:string, pname:string, envData:object)=>ParserState<null>} */
	static createParserState = (target = '', pname = '', envData = {}) => {
		return {
			target,
			isError: false,
			error: '',
			data: null,
			dataLog: (Parser._tracing) ? [`[createParserState]`] : [],
			result: null,
			index: 0,
			pname,
			errorPath: [],
			env: envData,
		}
	}




	// (state:parserState, error:string, dataLog:string[]) => parserState
	// (state:parserState, newResult:any, dataLog:string[]) => parserState
	/**  @type {<T1,T2>(state:ParserState<T1>, result:T1, pname:string)=>ParserState<T2>} */
	static updateResult = (state, result, pname = '') => {
		if (pname=='') { throw('updateResult - no pname supplied') }

		//(dataLog.length > 0) && console.log(`[Parser.updateResult]: (dataLog size: ${dataLog.length}) Called from ${pname}, at index ${state.index}.`)
		if(state.isError) {
			console.warn(`[Parser.updateResult]: INCONSISTENT STATE!  should not have an updated result AND an error at the same time`) 
			throw new Error(`[Parser.updateResult]: INCONSISTENT STATE!  should not have an updated result AND an error at the same time`)
		}
		return {
			target: state.target,
			isError: state.isError,
			error: state.error,
			data: state.data,
			dataLog: state.dataLog,
			result,
			index: state.index,
			pname,
			errorPath: [],
			env: state.env,
		}
	}

	/**  @type {<T>(state:ParserState<T>, error:string, pname:string)=>ParserState<T>} */
	static updateError = (state, error, pname = '', contextError = '') => {
		if (pname=='') {
			throw('updateError - no pname supplied')
		}
		return {
			target: state.target,
			isError: true,
			error,
			data: state.data,
			dataLog: state.dataLog,
			result: state.result,
			index: state.index,
			pname,
			errorPath: [ ...state.errorPath, {	pname, error, contextError, atIndex:state.index, origPname: state?.pname??'unk' } ],  // stack is unwinding at this point, so innermost calls are already in ...state.errorPath, we're adding a new 'outer' context, represeting the beginning of the calls
			env: state.env,
		}
	}

	/** 
	 * @param {ParserState} state 
	 * @param {number} index
	 */
	static updateIndex = (state, index, pname = '') => {
		if (pname=='') { throw('updateIndex - no pname supplied') }
		return {
			target: state.target,
			isError: state.isError,
			error: state.error,
			data: state.data,
			dataLog: state.dataLog,
			result: null,
			index,
			pname,
			errorPath: state.errorPath,
			env: state.env,
		}
	}


	/** 
	 * @param {ParserState} state 
	 * @param {any} value
	 */
	static updateData = (state, value, propName = 'data', pname = '') => {
		if (pname=='') { throw('updateData - no pname supplied') }
		return {
			target: state.target,
			isError: state.isError,
			error: state.error,
			data: propName === 'data' ? value : state.data, 
			dataLog: state.dataLog,
			result: state.result,
			index: state.index,
			pname,
			errorPath: state.errorPath,
			// env is a simple dictionary
			env: {
				...state.env, 
				[propName]: value 
			},
		}
	}


	// (state:parserState, data:any, dataLog:string[]) => parserState
	/** 
	 * @param {ParserState} state 
	 * @param {any[]} dataLog
	 */
	static updateDataLog = (state, ...dataLog) => {
		const flattenedLogs = dataLog.flat(2)
		// console.log(`updateDataLog`, {dataLog, flattenedLogs, state})
		const prevDataLogs = state.dataLog
		// (dataLog.length > 0) && console.log(`[Parser.updateIndex]: (dataLog size: ${dataLog.length}).  At index ${state.index}.`)
		return {
			target: state.target,
			isError: state.isError,
			error: state.error,
			data: state.data, 
			dataLog: flattenedLogs?.length ? [...prevDataLogs, ...flattenedLogs] : [...prevDataLogs],
			result: state.result,
			index: state.index,
			pname: state.pname,
			errorPath: state.errorPath,
			env: state.env,
		}
	}

	/** 
	 * @param {ParserState} state 
	 * @param {number} index
	 * @param {any} result
	 */
	static updateParserState = (state, result, index, pname = '') => {
		if (pname=='') { throw('updateParserState - no pname supplied') }
		// (dataLog.length > 0) && console.log(`[Parser.updateParserState]: (dataLog size: ${dataLog.length}) Called from ${pname}, at index ${state.index}.`)

		return {
			target: state.target,
			isError: state.isError,
			error: state.error,
			data: state.data,
			dataLog: state.dataLog,
			result,
			index,
			pname,
			errorPath: state.errorPath,
			env: state.env,
		}
	}

	// Parser.mergeParserState
	// enhanced form of updateParserState, with more variables to update (env, dataLog, errorPath) - more dangerous but more powerful.
	// using named variables (in an object) instead of a parameter list.
	// Not for converting non-errors to error states, but will pass along an error if incoming state has error
	// appends new dataLogs
	// merges new env into existing env (be careful w/key conflicts- new keys overwrites old keys!)
	/** 
	 * @param {{
	 * 	fromState:ParserState
	 *  index:number
	 *  result: any
	 *  data:any
	 *  env:object[] | any
	 *  dataLog: string[]
	 *  pname: ?string
	 * }} _
	 */
	
	static mergeParserState = ({fromState, index, result, data, env, dataLog=[], pname}) => {
		return {
			target: fromState.target,					// not merged / not updated
			isError: fromState.isError,				// not merged / not updated
			error: fromState.error,						// not merged / not updated
			data: data ?? fromState.data,     // replaces data if 'data' property supplied in the parameter
			dataLog: dataLog?.length ? [...fromState.dataLog, ...dataLog.flat()] : fromState.dataLog, // merged with existing dataLog
			result: result ?? fromState.result,  // updates result if supplied
			index: index ?? fromState.index,     // updates index if supplied
			pname: pname ?? fromState.pname,     // updates pname if supplied
			errorPath: fromState.errorPath,      // not merged/updated
			env: env ? {
				...fromState.env, 
				data: data ?? fromState.data, 
				...env
			} : fromState.env,  // merged with existing env if supplied
		}
	}


	static trace = {
		enabled: false,
		msg_id: 0,
		traceLog: [],
		wasWarned: false,
		reset: () => {
			Parser.trace.msg_id = 0
			Parser.trace.traceLog = []
			Parser.trace.wasWarned = false
		},
		log: (level=0, tag='', logMsg='', data) => {
			const id = Parser.trace.msg_id++
			if ( !Parser.trace.enabled ) {
				if ( !Parser.trace.wasWarned ) {
					console.warn(`[Parser.trace.log()]: Must set the Parser.trace.enabled to true.  Also, note that tracing should not be done on production data, or production-sized data, or otherwise risk heap exhaustion...`)
					Parser.trace.wasWarned = true
				}
				return
			}
			Parser.trace.traceLog.push({level, id, tag, logMsg, data})
		},
		show: (filterFn=(x)=>true) => {
			const outputBuffer = []
			const indentChar = "  "
			const subset = Parser.trace.traceLog.filter(filterFn)
			for (const {level, id, tag, logMsg, data} of subset) {
				const indentedPrefix = `${id}: ${indentChar.repeat(level)} [${tag}]: `
				if (data) {
					console.log(`${indentedPrefix}${logMsg}`, data)
				}
				else {
					console.log(`${indentedPrefix}${logMsg}`)
				}
			}
		},
		get: (filterFn = (x)=>true) => {
			const outputBuffer = []
			const indentChar = "  "
			const subset = Parser.trace.traceLog.filter(filterFn)
			for (const {level, id, tag, logMsg, data} of subset) {
				const indentedPrefix = `${id}: ${indentChar.repeat(level)} [${tag}]: `
				outputBuffer.push(`${indentedPrefix}${logMsg}`)
			}
			return outputBuffer
		},
		getFull: (filterFn = (x)=>true) => {
			const outputBuffer = []
			const indentChar = " "
			const subset = Parser.trace.traceLog.filter(filterFn)
			for (const {level, id, tag, logMsg, data} of subset) {
				const indentedPrefix = `${id}: ${indentChar.repeat(level)} [${tag}]: `
				outputBuffer.push({message: `${indentedPrefix}${logMsg}`, data})
			}
			return outputBuffer
		},

	}


	// used for various caches
	/**@type {Map<string,RowStructure[]>} */
	static #rowStructureCache = new Map()
	// static findRowAndColCache = new Map()


	/**  getRowStructure :: (text:string) -> [ RowRecord ]
	 *   RowRecord      :: { row:number, rowStartIndex:number, rowLength:number, indentChar:string, indentCount:number }
	 * 
	 *   Description:  
	 *     If the supplied text has not been seen before, this will computes row/column/indentation/linesize/etc information from text. 
	 *     If the supplied text has been seen, this will return the cached results (and array) corresponding to the supplied text
   *   
	 *   Output: 
	 *     An array of 'rowMetaData' objects, as shown in the signature above. Details of each field as as such:
	 *     - row:        Line number associated with the record, essentially the array index + 1.  
	 *                   row is explicitly stored instead of calculated as index+1 for simplicity.
   *     - rowStartIndex: The cursor index into the text, where the line starts. This is the same cursor used in the parser state, 
	 *                   and is thus a zero-based offset from the start of teh string
   *     - indentChar: The character used for whitespace at the start of each line, used by indentation-based parsers
	 *                   This value would typically be a space or tab.  It's adviced that tabs/spaces are never mixed on the same line, or else indentation parsers will likely not work correctly
   *     - indentCount: The number of indentChar's at the start of each line
   *     - rowLength: The size of the line in characters, including all indentation and end-of-line characters
	 */

	/**
	 * @type { (text:string) => RowStructure[] }
	 */
	static getRowStructure = (text='') => {
		// This function will return any memoized (cached) results if the text has been seen.  
		if (Parser.#rowStructureCache.has(text)) {
			return Parser.#rowStructureCache.get(text) 
		}

		// if text has not been seen, continue analyzing the text row structure...

		// The supplied regex below captures indentation data for a line, using it with .matchAll() gives us not only
		// indentation data for each line, but also the raw data of each line to calculate the all indexes from.
		const allRows = [...text.matchAll(/^([ \t]*)/gm)]
		const numRows = allRows.length

		// iterate over the matchAll results to build the structural metadata for supplied text
		const rowStructure = allRows.map( (row, c) => {
			if (c !== (allRows.length-1) ) {
				return {
					row: c + 1,
					rowStartIndex: row.index,
					indentChar: row[0] ?? '',
					indentCount:	row[0].length,
					rowLength: allRows[c + 1 ].index - row.index
				}
			}
			// if at the last row, use the target.length as the basis for calculating lineLength
			return {
				row: c + 1,
				rowStartIndex: row.index,
				indentChar: row[0] ?? '',
				indentCount:	row[0].length,
				rowLength: text.length - row.index
			}
		})  // end of function allLines.map(...)

		/** cache the result, using text itself as the hash value
		 *  @todo: consider using a hash function instead of text as the Map hash  */
		Parser.#rowStructureCache.set(text, rowStructure )
		// We might as well use recursion so the next iteration can warm up the cache to return the result.
		return Parser.getRowStructure(text)
	}


	/** getRowRecord  :: (text:string, atIndex:number) -> RowRecord
	 *  RowRecord      :: { row:number, index:number, indentChar:string, indent:number, lineLength:number }
	 * 
	 *  Description: Since the (previously calculated) row structure is based on the row number, we need a way to 
	 *  look up the row if we only have an index into the text.
	 */
	static getRowRecord = (text='', atIndex=0) => {
		const textRowStructure = Parser.getRowStructure(text)
		if (atIndex===0) return textRowStructure[0]

		// finds the row by iterating through the row structure records, 
		// finding the first row record whose rowStartIndex is greater than or equal to the supplied index
		let currentRowRecord = null
		for (const rowRecord of textRowStructure) {
			if (atIndex >= rowRecord.rowStartIndex) { 
				currentRowRecord = rowRecord 
			}
			else { 
				break 
			}
		}
		return currentRowRecord
	}


	// getCurrentRowIndent : get row/col/indentation
	// retreives the row structure for the row at the supplied index, but also calculates the column offset and adds to the result
	static getPositionData = (text='', atIndex=0) => {
		const currentRowRecord = Parser.getRowRecord(text, atIndex)
		return { 
			col: (atIndex - currentRowRecord.rowStartIndex) + 1,	// calculate column based on offset between supplied index & row records's index  (attempting to account for tabs in column calc - not yet done)
			...currentRowRecord 
		}
	}

	/** getRowAndCol ::   (text:string, atIndex:number) -> { row:number, col:number }
	 * 
	 *  Description:  
	 *    Given the supplied text and a 0-based index into the text, this will return a
	 *    {row, col} object, where both row and col start with 1
	 */
	static getRowAndCol = (text='', atIndex=0) => {
		const currentRowRecord = Parser.getRowRecord(text, atIndex)
		return { 
			row: currentRowRecord.row, 
			col: atIndex - currentRowRecord.rowStartIndex + 1					// calculate column based on offset between supplied index & row records's index,
		}
	}


	/** searchIndentationRange : (text:string, atIndex:number, indentPredicateFn) -> [ currentRowRecord:rowRecord, nextRowrecord:rowRecord ]
	 * 		
	 * Description:  
	 *   Given the supplied text, a 0-based index into the text, and a predicate function 'indentPredicateFn', this will return an array
	 *   of two rowMetaData records.  The first is for the current row, and the second is the rowMetaDataRecord 
	 *   with the same or less indent value.
	 * 
	 * indentPredicateFn:  (indentLevel:number, currentIndentLevel:number) => Boolean (defaults to finding next indent level that is the same as current)
	 * Example:  searchIndentationRange(sometarget, someindex,  (findIndentLevel, currentIndentLevel) => findIndent <= currentIndent )
	 * 
	 * Where used: 
	 *   Parser functions that need to navigate relative indentation (to find the changes in the indent block (greater than, less than, equal to, etc)
	 */
	static searchIndentationRange = (text='', atIndex=0, indentComparisonFn = (currentLevel,findLevel) => findLevel==currentLevel ) => {
		// using our current row as our starting point...
		const currentRowRecord = Parser.getRowRecord(text, atIndex)
		const nextRowWithIndent = Parser.getRowStructure(text)														// get the list of remaining row structural records...
			.slice(currentRowRecord.row)																									// ...but starting from our current row, not from the beginning...
			.find( (rowRecord) => indentComparisonFn(rowRecord.indentCount, currentRowRecord.indentCount) )	// run the predicate to find the next matching condition
		return [currentRowRecord, nextRowWithIndent]
	}


	/** getIndentationRange : (text:string, atIndex:number) -> [ currentRowRecord:rowRecord, nextRowrecord:rowRecord ]
	 * 		
	 * Description:  
	 *   Given the supplied text and a 0-based index into the text, this will return an array
	 *   of two rowMetaData records.  The first is for the current row, and the second is the rowMetaDataRecord 
	 *   with the same or less indent value.
	 * 
	 * Where used: 
	 *   Parser functions that need to navigate relative indentation (
	 *   to find the start/end rows of it's indent block, for example)
	 */
	static getIndentationRange = (text='', atIndex=0) => {
		// using our current row as our starting point...
		const currentRowRecord = Parser.getRowRecord(text, atIndex)
		const nextRowWithIndent = Parser.getRowStructure(text)														// get the list of remaining row structural records...
			.slice(currentRowRecord.row)																									// ...but starting from our current row, not from the beginning...
			.find( (rowRecord) => rowRecord.indentCount <= currentRowRecord.indentCount )	// find the next row with the same or lesser indent level as our current row

		return [currentRowRecord, nextRowWithIndent]
	}

	// simple utility function that's repeated in multiple places - it simply reports a string like "8,773 (row 377, col 2)"
	static rptPosition = (target, index) => {
		const { row, col } = Parser.getPositionData(target,index)
		return `row ${row}, col ${col}`
	}
	
	// like rptPosition, but prints position, linesize, & indentation data
	static rptLine = (target, index) => {
		const { row, col, indentChar, indentCount, rowLength } = Parser.getPositionData(target, index)
		return `index ${index} (row ${row}, col ${row}).  Line: length:${rowLength??'n/a'}, indentLevel:${indentCount}, indentChar '${indentChar==" "? "SPACE" : indentChar=="\t" ? "TAB" : "unknown"}' `
	}

	static rptResult = (state) => `${state.result ? terse(state.result) + '...' : 'unavailable'}`


	// parserState => [string]
	static rptState = (state) => {
		if (typeof state.target === 'undefined') state.target = ``
		const output =
			`${state?.pname || '(from_unknown)' } (index ${state.index}): ${state.target.slice(state.index, state.index + 100)}...\n` +
			`isError: ${state.isError} 	${state.isError ? `Error: ${state.error}` : `Result: ${Parser.rptResult(state)}`}`
		return output
	}

	// parserState => string
	/** @type {(header:string, state:ParserState, prevState:ParserState|null) => string[]} prevState */
	static rptStateChange = (header=`State Change Report`, state, prevState=null) => {
		const {
			target,
			isError,
			error,
			data,
			dataLog,
			result,
			index,
			pname,
			errorPath,
			env,
		} = state

		if (state.target === undefined) state.target = ""

		/**@type {(buffize:number, target:string, index:number)=>string} */
		const prevText = (buffsize,target,index) => target.slice( ( (index < buffsize) ? 0 : index-buffsize ), index )
		/**@type {(buffize:number, target:string, index:number)=>string} */
		const nextText = (buffsize,target,index) => target.slice( index, state.index + buffsize )

		// const currentRowCol = Parser.rptLine(target, index)
		// const lastRowCol = Parser.rptLine(target, prevState.index)

		const prevStateItems = (prevState) ? [
			`WAS (from ${prevState.pname || "unknown"} ):`,
			`  index:        ${prevState.index}`,
			`  position:     ${Parser.rptPosition(target, prevState.index)}`,
			`  isError:      ${prevState.isError}`,
			`  error:        ${prevState.error}`,
			`  preceding:    '${prevText(50, target, prevState.index)}'`,
			`  following:    '${nextText(50, target, prevState.index)}'`,
			`  result:       ${result}`,
		] : []

		const currStateItems = [
			``,
			`NOW (from ${pname || "unknown"} ):`,
			`  index:        ${index}`,
			`  position:     ${Parser.rptPosition(target, index)}`,
			`  isError:      ${isError}`,
			`  error:        ${error}`,
			`  preceding:    '${prevText(50, target, index)}'`,
			`  following:    '${nextText(50, target, index)}'`,
			`  result:       ${result}`,
			`  data:         ${data}`,
			`  env:          ${JSON.stringify(env,null,0)}`,
		]

		return [
			`[${header}]`,
			...prevStateItems,
			...currStateItems,
			`  errorPath:\n`,			
			errorPath.map( ({pname, error}) => `    Name: ${pname}, Error: ${error}`)
		].flat()
	}


	/**
	 * The below static functions are utility-functions that are still a WIP.  These are meant to help automate post-parsing
	 */


	// utilty function used by getTagged
	/**
	 * @param {{tag:string, value:unknown}} obj 
	 * @param {any} taggedItem 
	 * @returns {object}
	 */
	static flattenTagged = (obj, taggedItem) => ({ ...obj, [taggedItem.tag]: taggedItem.value })


	// for use inside Parser.map(...) - takes either an array of tagged objects(from sequenceOf()), 
	// or a single tagged object, then returns an array of untagged objects or an untagged object.
	//
	// **IMPORTANT** 
	//		If run against an array, this function assumes the array has ***UNIQUE*** tags.  
	// 		For a tagged array with *** NON-UNIQUE*** tags, use 'collectTaggedItems'
	static getTagged = (results) => {
		const taggedResults = Array.isArray(results) ?
			results.filter((result) => (result?.tag)).reduce(Parser.flattenTagged, Object.create(null))
			: ({ [results.tag]: results.value })
		return taggedResults
	}

	/** Parser.getTaggedR() - a recursive form of getTagged. 
	 * Used by Parser instance method .getTagged() 
	 *
	 * Parameters: 
	 *    'item': at first entry (before recursion) item is expected to be an array of tagged objects
	 *            after getTaggedR recurses through the item, it will encounter various data types, 
	 *            so this could be anything
	 *    'level': an integer which keeps track of the recursion level.  Not called by user, only by subsequent
	 *            recursive passes, so it defaults to 0.
	 * 
	 * Returns: a single object, rolled up recursively, where all incoming ({tag,value}) array entries are combined into 
	 *          a record which combines all the {tag,value} entries into one object (almost like a reverse of Object.entries)
	 * 
	 * NOTE: 
	 *    For troubleshooting, ensure that the Parser.trace facility is enabled (Parser.trace.enabled = true).  Then run this function
	 *    and get the results by calling Parser.trace.getFull() or any of the other helper methods
	 */
	static getTaggedR = (item, level=0) => {
		const trace = Parser.trace
		const getTaggedR = Parser.getTaggedR

		
		// in the context of this function, all Arrays are assumed to actually a rawRecords.  If an actual list was passed, the user should have 
		// passed it in as a {tag,value,type:'$List$'} object, by calling tagList('propname'), instead of tag('propname').
		if (Array.isArray(item)) {
			const flattenedEntries = item.flat(20)   // flattens any data structure to an arbitrarily deep amount - hopefully we'll never have data 20 levels deep
			const filteredEntries = flattenedEntries.filter( (entry) => entry?.tag && entry.hasOwnProperty('value') )
			
			// return nothing if there are no {tag,value} entries in the array
			if (filteredEntries.length > 0) {
				// trace.log(level, `CASE-1: ENTER`, `item is a RawRecord (array with tagged entries, not a user-list).  Mapping over entries to create a record object: `, structuredClone(filteredEntries) )
				// const returnVal = Object.fromEntries(	filteredEntries.map( (entry) => [	
				// 	entry.tag, 
				// 	entry?.$list$ ? entry.value.map((x)=>getTaggedR(x,level+1)) : getTaggedR(entry.value, level+1)
				// ]))
				const compiledObject = Object.fromEntries(filteredEntries.map( (entry,c) => { 
					trace.log(level, `  PROP #${c}:'${entry.tag}'`, `processing value...`, entry)
					if (entry?.$type$ ) {
						trace.log(level, `  PROP #${c}:'${entry.tag}-IS-LIST-START'`, `prop contains a value which is a user List (array) of ${entry.value.length} items. Mapping over each entry...  entry value is: `, entry.value)
						const returnVal = [
							entry.tag,
							entry.value.map( (x) => getTaggedR(x,level+1) ).filter( (x)=> typeof(x)!=='undefined' )
						]
						trace.log(level, `  PROP #${c}:'${entry.tag}-IS-LIST-DONE'`, `The list has been post-processed.  The value for this tag ${entry.tag} is: `, returnVal)
						return returnVal
					}
					else {
						trace.log(level, `  PROP #${c}:'${entry.tag}-NOT-LIST-START'`, `prop's value does NOT contain a user list.  Recursively calling getTaggedR on the value.  The entry value is:`, entry.value)
						const returnVal = [	
							entry.tag, 
							getTaggedR(entry.value, level+1)
						]
						trace.log(level, `  PROP #${c}:'${entry.tag}-IS-LIST-DONE'`, `the prop has been post-processed.  The value for this tag ${entry.tag} is: `, returnVal)
						return returnVal
					}
				}))
				// trace.log(level, `CASE-1-EXIT`, `RawRecord has been tranformed into a Record object `, structuredClone(compiledObject) )
				return compiledObject
			}
			return    // throw out all other non-tagged arrays (only taggged lists are allows).  This will return undefined, so it needs to be filtered out when processing the results of user lists
		}
	
		// cover null before object check next, because in JS null is an object
		if (item === null) {
			trace.log(level, `CASE-8-NULL-ENTER-EXIT`, `item is primitive (${item}), returning item unchanged`)
			return item
		}

		if (typeof(item)=='object') {
			trace.log(level, `CASE-3-ENTER`, `item is an object`)
			
			if (item?.$type$ == 'List' && item?.tag && item.value) {
				trace.log(level, `?? CASE-3-OBJ-AS-PROP[${item.tag}-OF-LIST-START`, `The object is a (tagged list) with $type$=='List'. The tag is ${item.tag}.  As such, we're mapping over the entries - preserving any values as is except for rawRecords, which will be converted into Records.  Item value is:`, item.value)
				const flattenedObject = {
					[`${item.tag}`]: item.value.map( (x) => getTaggedR( x, level+1 ) ).filter( (x)=> typeof(x)!=='undefined' )
				}
				trace.log(level, `?? CASE-3-OBJ-AS-PROP[${item.tag}-OF-LIST-DONE`, `  Returning flattened object:`, flattenedObject)
				return flattenedObject
			}
	
			// handle other {tag,value} objects. Should not be the common use case if we properly applied the .getTagged() function, and properly flattened all RawObject structures
			if (item?.tag && item?.hasOwnProperty('value')) {
				trace.log(level, `?? CASE-3-OBJ-AS-PROP[${item.tag}-NOT-LIST-START`, `the item iself is a standalone {tag,value} object.  Should be uncommon. Investigate how this happened` )
				const flattenedObject = { 
					[`${item.tag}`]: getTaggedR(item.value, level+1)
				}
				trace.log(level, `?? CASE-3-OBJ-AS-PROP[${item.tag}-NOT-LIST-DONE`, `the dual-prop {tag,value} object has been flattened into a single-prop {[tag]:value}.  Should be uncommon.  Flattened object is: `, flattenedObject)
				return flattenedObject
			}

			// Not an ordinary object, or  special object, nor null, nor Array, so just return the value itself
			trace.log(level, `CASE-3-OBJ-FROM-USER-ENTER-EXIT`, `item is a normal user object (type is ${item?.constructor?.name || typeof(item)}). Returning without processing, but could flatten here later`)
			return item
		}

		else {
			// Not an ordinary object, or  special object, nor null, nor Array, so just return the value itself
			trace.log(level, `CASE-9-PRIMITIVE-ENTER-EXIT`, `item is primitive data (type is ${item?.constructor?.name || typeof(item)})`)
			return item
		}
	}
	
	



	// automatically collect up & 
	static consolidateAllResults = (result) => {
		if (result == null) return result
		if ( typeof(result) == `string` 
			|| typeof(result) == `boolean` 
			|| typeof(result) == `number` 
			|| typeof(result) == `function` 
			|| typeof(result) == `symbol` 
			|| typeof(result) == `bigint` 
		) return result
	
		if (Array.isArray(result)) return result.flat().map(Parser.consolidateAllResults)
	
		// for other non-iterable objects (i.e. we're not handling Sets, Maps, etc) here
		if (typeof(result)==='object' && typeof result[Symbol.iterator] !== 'function') {
			return Object.fromEntries( Object.entries(result).reduce ( (updatedEntries, [key,val]) => {
				if (key=='tag') return [...updatedEntries, [val, Parser.consolidateAllResults(result?.value)] ]
				if (key=='value') return updatedEntries
				return [...updatedEntries, [key, Parser.consolidateAllResults(val)]]
			}, []	))
		}
	
		// for other iterables, convert toArray first, we elements can be deep-copied, and then reconstructed
		return new result.constructor(Parser.consolidateAllResults([...result]))
	}
	
}   // class Parser


// global flag to enable/disable tracing  (not yet fully implemented)
Parser._tracing = false


const {
	rptStateChange,
	rptState,
	rptResult,
} = Parser


// utility to debug (after .run())
const debug = new Parser ( function debug$(state) {
	debugger
	return state
}, 'debug' )




/***********************************************************************/
/** Atomic Parsers  *******/
/***********************************************************************/

// strng (aka 'str' in javascript) : match a string exactly
/**
 * @typedef {{
 *   help: string = `This is a test` 
 * }} strng
 */
const strng = (str) => {
	const pname = `strng('${str}')`
	if (typeof(str) !== 'string' || str.constructor.name !== 'String')
		throw new TypeError(`[${pname}] must be called with a string, but got ${str}`)

	return new Parser( function strng$(state) {
		if (state.isError) return state

		if (str.length == 0) return state
		const lastParser = state?.pname || ''

		if (state.index >= state.target.length) return Parser.updateError(
			state, 
			`[${pname}]: (at index ${state.index}): Expecting string '${str}', but got end of input`, 
			pname,
		)
		const remainingText = state.target.slice(state.index)
		if (remainingText.startsWith(str)) return Parser.updateParserState(
			state, 
			str, 
			state.index + str.length,
			pname,
		)
		return Parser.updateError(
			state, 
			`[${pname}]: (at index ${state.index}): Expecting string '${str}', but got '${remainingText.slice(0, str.length)}...'\n`,
			pname,
		)
	}, pname)
}


// strng (aka 'str' in javascript) : match a string exactly
const strng_prev = (str) => {
	// const pname = `strng(${JSON.stringify(str)})`
	const pname = `strng('${str}')`

	if (typeof(str) !== 'string' || str.constructor.name !== 'String') {
		throw new TypeError(`[${pname}] must be called with a string, but got ${str}`)
	}
	return new Parser( function strng$(state) {
		if (str.length == 0) return state
		if (state.isError) return state
		const lastParser = state?.pname || ''
		const { target, index } = state
		if (index >= target.length) return Parser.updateError(
			state, 
			`[${pname}]: (at index ${index}): Expecting string '${str}', but got end of input`, 
			pname,
		)
		const remainingText = target.slice(index)
		if (remainingText.startsWith(str)) return Parser.updateParserState(
			state, 
			str, 
			index + str.length,
			pname,
		)
		return Parser.updateError(
			state, 
			`[${pname}]: (at index ${index}): Expecting string '${str}', but got '${remainingText.slice(0, str.length)}...'\n`,
			pname,
		)
	}, pname)
}

{// strng (aka 'str' in javascript) : match a string exactly
	const strng_original = (str) => {
		const pname = `strng('${str}')`
		if (typeof(str) !== 'string' || str.constructor.name !== 'String') {
			throw new TypeError(`[${pname}] must be called with a string, but got ${str}`)
		}
		return new Parser( function strng$(state) {
			if (str.length == 0) return state
			if  (state.isError) return state
			const lastParser = state?.pname || ''
			const { target, index } = state
			const remainingText = target.slice(index)
			if (remainingText.length == 0) return Parser.updateError(
				state, 
				`[${pname}]: (at index ${index}): Expecting string '${str}', but got end of input`,
				pname,
			)
			if (remainingText.startsWith(str)) return Parser.updateParserState(
				state, 
				str, 
				index + str.length
			)
			return Parser.updateError(
				state, 
				`[${pname}]: (at index ${index}): Expecting string '${str}', got '${remainingText.slice(0, str.length)}...'\n`,
				pname,
			)
		}, pname )
	}

}
const str = strng
const char = strng
 



// pattern can be a string or regular expression
// pattern should be preceded with a '^', but will automatically add one if not
// returns the entire matched pattern a string, if not using capture groups.  If using capture groups, will return the group object,
// along with an 'all' property to represent the entire string matched.
const regex = (pattern) => {
	if (pattern.constructor.name !== 'RegExp' && pattern.constructor.name !== 'String') 
		throw new TypeError(`[regex(${pattern})] must be called with a RegExp object or string, but got ${pattern?.constructor?.name ?? pattern}`)

	const usedPattern = (pattern?.constructor?.name === 'RegExp') ?	fixedRegExp(pattern) : stringRegExp(pattern)
	const pname = `regex('${usedPattern}')`

	return new Parser( function regex$(state) {
		if  (state.isError) return state
		const lastParser = state?.pname || ''

		if (state.index >= state.target.length) return Parser.updateError(
			state,
			`[${pname}]: (at index ${state.index}): Expecting text matching '${usedPattern.source}', but got end of input.`,
			pname,
		)

		const remainingText = state.target.slice(state.index)
		const regexMatch = remainingText.match(usedPattern) ?? false

		if (!regexMatch) return Parser.updateError(
			state, 
			`[${pname}]: (at index ${state.index}): Expecting text matching pattern '${usedPattern}', but got '${remainingText.slice(0, 12)}...'`,
			pname,
		)

		const result = (regexMatch?.groups) ? {	all: regexMatch[0],	...regexMatch.groups } : regexMatch[0]
		return Parser.updateParserState(state, result, state.index + regexMatch[0].length, pname)
	}, pname )
}


//	// digit : match any single digit 
//	const digit = new Parser(function digit(state) {
//		const pname = 'digit'
//		if  (state.isError) return state
//		const { target, index } = state
//		if (target.length > index) {
//			return (target.length && target[index] && /[0-9]/.test(target[index]))
//				? Parser.updateParserState(state, target[index], index + 1, pname)
//				: Parser.updateError(state, `[${pname}] (at index ${index}): Expecting digit, got '${target[index]}'`, pname)
//		}
//		return Parser.updateError(
//			state,
//			`[${pname}]: (at index ${index}): Expecting a digit, but got end of input.`,
//			pname
//		)
//	}).named('digit')
//	
//	
//	// letter : match any single letter
//	const letter = new Parser(function letter(state) {
//		const pname = 'letter'
//		if  (state.isError) return state
//		const { index, target } = state
//		if (target.length > index) {
//			return (target.length && target[index] && /[a-zA-Z]/.test(target[index]))
//				? Parser.updateParserState(state, target[index], index + 1, pname)
//				: Parser.updateError(state, `[${pname}] (at index ${index}): Expecting letter, got '${target[index]}'`, pname)
//		}
//		return Parser.updateError(state, `[${pname}] (at index ${index}): Expecting letter, but got end of input.`, pname)
//	}).named('letter')
//	
//	
// anyOf_charset : match any one character in the supplied set of characters (supplied as a string)
const anyOf_charset = (charset) => {
	const pname = `anyOf_charset('${charset}')`
	if (typeof (charset) !== 'string')
		throw new TypeError(`[anyOf_charset]: The supplied parameter ${charset} must be a string`)

	return new Parser(function anyOf_charset$(state) {
		if  (state.isError) return state

		const { target, index } = state
		if (target.length > index) {
			return (charset.includes(target[index]))
				? Parser.updateParserState(state, target[index], index + 1, pname)
				: Parser.updateError(state, `[${pname}]: (at index ${index}): Expecting any of the string "${charset}", got ${target[index]}`, pname)
		}
		return Parser.updateError(state, `[${pname}]: (at index ${index}): Expecting any of the string "${charset}", but got end of input.`, pname)
	}, pname )
}


// endOfInput : match (returning null) if the parser is at the end
const endOfInput = new Parser(function endOfInput$(state) {
	const pname = 'endOfInput'
	if  (state.isError) return state

	if (state.index < state.target.length) 
		return Parser.updateError(state, `[${pname}]: (at index ${state.index}): Expected end of input but got '${state.target.slice(state.index, state.index + 20)}...'`,	pname	)

	return Parser.updateResult(state, null, pname)
}).named('endOfInput')



// succeedWith : constructs a Parser with a user-supplied result
const succeedWith = (result) => Parser.of(result).named(`succeedWith(${result})`)


// fail : convert a result parser to a failed parser, with the user-supplied error message
const fail = (errorMessage) => {
	const pname = `fail('${errorMessage})'`
	return new Parser(function fail$(state) {
		const pname = `fail('${errorMessage}')`
		if  (state.isError) return state
		return Parser.updateError(state, errorMessage, pname)
	}, pname)
}


/**
 * Basic Combinators - higher-level parsers that consume other parsers.
 * These parsers perform the most basic, well-defined functions. 
 */



// many : evaluates the same supplied parser again and again, until it fails (or hits the end of input)
// many will always succeed, even if the supplied parser fails (i.e. no matches),
// except if the supplied parser does not advance (avoid an infinite loop)
// In the end, many Will provide a result array of all matches, or an empty array if no matches
const many = (parser) => {
	const pname = `many(${parser?.p?.pname ?? 'unnamed_parser'})`

	return new Parser( function many$(state) {
		if  (state.isError) return state
		const lastParser = state?.pname || ``

		const results = []
		// used for instrumentation & logging
		let successIterations = 0
		const startingIndex = state.index

		let currentState = { ...state } 					// currentState will keep advancing for every successive match
		const target = currentState.target

		while (true) {
			let nextState = parser.p(currentState)

			if ( !Number.isFinite(nextState.index) ) return Parser.updateError(
				currentState, 
				`[${pname}]: Corruption in the parser state.  Probably cannot break out of the while statement due to parser not advancing`,
				pname
			)

			// for 'many', an error is just a normal terminating condition.  
			// ...so we won't return any errors but we'll keep the log history so we can trace where (any why) we terminated
			if (nextState.isError) {	
				if (Parser._tracing || nextState.env?.trace) {
					const fromPos = Parser.rptPosition(target, startingIndex)
					const toPos = Parser.rptPosition(target, currentState.index)
					const errorPos = Parser.rptPosition(target, nextState.index)
					const endState = Parser.updateDataLog(currentState, `[${pname}]: matched ${successIterations} items (from: ${fromPos}, to: ${toPos})), failing at ${errorPos}`)
					// nextState = (Parser._tracing) ?
					// 	Parser.updateDataLog(nextState, `[${pname}]: matched ${successIterations} items (${startingIndex}->${nextState.index})`)
					// 	: nextState
					return Parser.updateResult(endState, results, pname)
				}
				return Parser.updateResult(currentState, results, pname)
				// break   // exit the loop
			}
			else {					// keep going if we keep finding matches
				if (nextState.index === currentState.index) {    // used to detect if parser is not advancing, which can happen in some circumstances
					return Parser.updateError(
						currentState, 
						`[${pname}]: The supplied parser is not advancing.  Index is stuck at ${currentState.index}.  Check parser.\n\tparserAt: ${Parser.rptState(nextState)}\n\tWas at: ${Parser.rptState(currentState)}`,
						pname
					)
					// throw new Error(`[many]: The subparser is not advancing, we're stuck at index ${currentState.index}.  Check subparser. parserAt: ${Parser.rptState(nextState)} `)
				}
				currentState = nextState
				results.push(currentState.result)
				if (currentState.index >= target.length) {
					break
				}
			}  // if not error
			successIterations++
		}   // loop
		// console.log(`[${pname}]: iteration count: ${successIterations}`)
		return Parser.updateResult(currentState, results, pname)
	}, pname)
}



// many1 : returns Parser failure if nothing matches, or a result array if any matches
const many1 = (parser) => {
	const pname = `many1(${parser?.p?.pname ?? 'unnamed_parser'})`

	return new Parser( function many1$(state) {
		if  (state.isError) return state
		const finalState = many(parser).p(state)
		if (finalState.result.length > 0) return finalState
		return Parser.updateError(
			finalState, 
			`[${pname}]: (at index ${state.index}): Expecting to match at least one value of supplied parser`, 
			pname
		)
	}, pname )
}


// like 'many' or 'many1' but runs a parser exactly n times
const exactly = function exactly(n, parser) {
	const pname = `exactly(${n}, ${parser?.p?.pname ?? 'unnamed_parser'})`

	const count = parseInt(n)

	if (isNaN(count) || n <= 0 ) {
		throw new TypeError (`[${pname} must be called with a number > 0, but got ${n}`)
	}

	return new Parser(function exactly$(state) {
		if (state.isError) return state
		const lastParser = state?.pname || ``

		const results = []
		
		// used for instrumentation & logging
		let successIterations = 0
		const startingIndex = state.index

		let currentState = state
		for (let i = 0; i < n; i++) {
			const nextState = parser.p(currentState)
			if(nextState.isError) {
				return Parser.updateError(
					nextState, 
					`[${pname}]: ParseError (at ${nextState.index}): Expecting ${n} instances of ${parser}, but only encountered ${successIterations})}`,
					pname
				)
			}
			currentState = nextState
			results.push(currentState.result)
			successIterations = i
		}
		return Parser.updateResult(currentState, results, pname)
	}, pname )
}


/** matchCount
 *  Like 'exactly', but allows a user-supplied function to constrain the iteration count
 * 	The supplied function is of the following form:  (n:number) => boolean | message: string
 *  The message can be an error message.
 */
const matchCount = function matchCount(predicateFn, parser) {
	const pname = `matchCount(${predicateFn?.name ?? predicateFn}, ${parser?.p?.pname ?? 'unnamed_parser'})`
	if (typeof (predicateFn) !== 'function') {
		throw new TypeError (`[${pname} must be supplied with a valid function that takes a number, and returns a true/false, but got ${predicateFn}`)
	}
	return new Parser(function matchCount$(state) {
		if (state.isError) return state
		const lastParser = state?.pname || ``

		const results = []
		let successIterations = 0
		let currentState = state

		while(!currentState.isError) {
			const nextState = parser.p(currentState)
			if(nextState.isError) {
				const countConstraint = predicateFn(successIterations)
				if ( countConstraint !== true ) return Parser.updateError(
					nextState,
					`[${pname}]: ParseError (at ${nextState.index}): ${parser} failed after ${successIterations}),  iterations, due to failing the count constraint in the supplied user function.  Function returned ${countConstraint}`,
					pname
				)
			}	
			successIterations++
			results.push(currentState.result)
			currentState = nextState
		}
		return Parser.updateResult(currentState, results, pname)
	}, pname )
}


/*  Tried to refactor to be more functional.  ** Needs work **
// sepBy : 
const sepBy_new = (separaterParser) => (valueParser) => {
	const pname = `sepBy (${separaterParser?.p?.name??'unnamed'}) (${valueParser?.p?.name??'unnamed'})`
	return new Parser( function sepBy_new$method (state) {
		if (state.isError) return state

		const fromParser = state?.pname || ``
		const results = []

		let nextState = state
		let errorState = null
		
		while (true) {
			// run the pair of parsers in sequence...
			const stateAfterValue = valueParser.p(nextState)
			const stateAfterSeparator = separaterParser.p(stateAfterValue)

			// if the value parser has an error, we are finished with this loop.  Return what we have so far.
			if (stateAfterValue.isError) return (results.length === 0) 
				? Parser.updateResult(state, results) 
				: errorState
			results.push(stateAfterValue.result) // otherwise, keep collecting results

			if (stateAfterSeparator.isError) {
				return Parser.updateResult(stateAfterValue, results)
			}
		}

		if (errorState) {
			return (results.length === 0)
				? Parser.updateResult(state, results)
				: errorState
		}

		// if we made it this far, we had a successful iteration of separator asnd value parser,
		// so update cursor and continue.
		nextState = sepState

	}, pname )
}
*/


// sepBy : 
const sepBy = (separatorParser) => (valueParser) => new Parser( function sepBy$(state) {
	const pname = `sepBy(${separatorParser.p.pname})(${valueParser.p.pname})`
	if  (state.isError) return state

	let nextState = state
	let error = null
	const results = []
	while (true) {
		const valState = valueParser.p(nextState)
		const sepState = separatorParser.p(valState)
		if (valState.isError) {
			error = valState
			break
		}
		else {
			results.push(valState.result)
		}

		if (sepState.isError) {
			nextState = valState
			break
		}
		nextState = sepState
	}

	if (error) {
		if (results.length === 0)
			return Parser.updateResult(state, results, pname)
		return error
	}

	return Parser.updateResult(nextState, results, pname)
}).named(`sepBy(${separatorParser.p.pname})(${valueParser.p.pname})`)


// sepBy1 : 
const sepBy1 = (separatorParser) => (valueParser) => new Parser( function sepBy1$(state) {
	const pname = `sepBy1(${separatorParser.p.pname})(${valueParser.p.pname})`
	if  (state.isError) return state

	const out = sepBy(separatorParser)(valueParser).p(state)

	if (out.isError) return out
	if (out.result.length === 0) return Parser.updateError(
		state, 
		`[${pname}]: (at index ${state.index}): Expecting to match at least one separated value`, 
		pname
	)
	return out
}).named(`sepBy1(${separatorParser.p.pname})(${valueParser.p.pname})`)


// sequenceOf : evaluates a sequence of parsers & returns the results of each in an array
// NOTE: if any parsers fail, the entire sequence fails and nothing advances
const sequenceOf = (..._parsers) => {
	const parsers = _parsers.flat().map( (parser) => {
		if (parser?.constructor?.name === 'String') return strng(parser)
		if (parser?.constructor?.name === 'RegExp') return regex(parser)
		return parser
	})
	const pnameShort = `sequenceOf(${parsers.length} parsers)`
	const pnameLong = `sequenceOf(${parsers.join(', ')})`
	const pname = pnameLong

	if (parsers.length === 0) throw new Error(`[${pname}]: List of parsers can't be empty.`)

	return new Parser( function sequenceOf$(state) {
		if  (state.isError) return state
		const lastParser = state?.pname || ``

		const results = []									// initialize the return value
		const startingIndex = state.index		// for instrumentation & logging. . . 
		const dataLog = []									// accumulate logs from this parser and user-supplied parsers

		
		let currentPosition
		let nextPosition


		let currentState = { ...state }			// currentState will keep advancing with every successful parser

		// startPosition is a snapshot of the position before entering the for loop
		const startPosition = Parser.rptPosition(state.target, currentState.index)

		//let currentPosition = Parser.rptPosition(state.target, currentState.index)
		

		for (let i = 0; i < parsers.length; i++) {
			let parser = parsers[i]
			let parserName = parser.p?.pname || `'unnamed'`

			const nextState = parser.p(currentState)

			// next two lines moved inside if...ifError block for performance...
			// currentPosition = Parser.rptPosition(state.target, currentState.index)
			// nextPosition = Parser.rptPosition(state.target, nextState.index)

			//Parser._tracing && dataLog.push(`[${pname}]: trying parser (#${i}) '${parserName}', ${state.pname}/${nextState.pname}`)
			if (nextState.isError) {
				// more detailed error message whne Parser._tracing is enabled (performance-affecting)
				if (Parser._tracing || nextState.env?.trace) {
					currentPosition = Parser.rptPosition(state.target, currentState.index)
					nextPosition = Parser.rptPosition(state.target, nextState.index)
					const contextErrorMessage = `[${pname}]: failed parser (#${i}) '${parserName}': ${startPosition} --> ${nextPosition}`
					return Parser.updateError(nextState, nextState.error, pname, contextErrorMessage )
				}
				// less detailed error message whne Parser._tracing is not enabled
				const contextErrorMessage = `[${pname}]: failed parser (#${i}) '${parserName}'`
				return Parser.updateError(nextState, nextState.error, pname, contextErrorMessage )
			}
			// if successful, add to log...
			Parser._tracing && dataLog.push(`[${pname}]: matched parser (#${i}) '${parserName}':  ${currentPosition} --> ${nextPosition}`)

			currentState = nextState
			results[i] = nextState.result
		}
		Parser._tracing && dataLog.push(`[${pname}]: matched all ${parsers.length} parsers: ${startPosition} --> ${nextPosition}`)
		return Parser.updateResult(currentState, results, pname, dataLog)
	}, pname )
}





// choice - evaluate the list of supplied parsers, and return the first matching result.
const choice = (..._parsers) => {
	const parsers = _parsers.flat().map( (parser) => {
		if (parser?.constructor?.name === 'String') return strng(parser)
		if (parser?.constructor?.name === 'RegExp') return regex(parser)
		return parser
	})
	const pnameShort =  `choice(${parsers.join(', ')})`
	const pnameLong =  `choice(${parsers.join(', ')})`
	const pname = pnameLong

	if (parsers.length === 0) throw new Error(`[${pname}]: List of parsers can't be empty.`)

	return new Parser( function choice$(state) {
		if  (state.isError) return state
		const lastParser = state?.pname || ``

		// errorState represents the state of this parser if not matches are found.  
		let errorState = null

		// instrumentation
		const dataLog = []

		for (let i = 0; i < parsers.length; i++) {
			let parser = parsers[i]
			let parserName = parser.p?.pname || `'unnamed'`
			let startingIndex = state.index

			const nextState = parser.p(state)

			Parser._tracing && dataLog.push(`[${pname}]: trying parser (#${i}) '${parserName}', ${state.pname}/${nextState.pname}`)
			if ( !nextState.isError ) {  // means we found a match, to return the state to break out of function
				if (Parser._tracing) {
					const positionStart = Parser.rptPosition(state.target, state.index)
					const positionEnd = Parser.rptPosition(state.target, nextState.index)
					Parser._tracing && dataLog.push(`[${pname}]: matched parser (#${i}) '${parserName}':  ${positionStart} --> ${positionEnd}`)
					return Parser.updateDataLog(nextState, dataLog ) 
				}
				return nextState
			}
			// if were here, there's an error, so continue toe loop with the next one
			if (errorState === null || (errorState && nextState.index > errorState.index)) {
				errorState = nextState
			}
		}	// end looping through parsers
		// if we're still here, we failed to match any parsers in the list.
		return Parser.updateError(state, `[${pname}]: (at ${Parser.rptPosition(state.target, state.index)}) - none of the supplied parsers found a match`, pname)
	}, pname)
}


// between - match parser between left and right parsers, returning only what's between
const between = (leftParser) => (rightParser) => (parser) => {
	const lparser = (leftParser.constructor.name=='Parser') ? leftParser : strng(leftParser)
	const rparser = (rightParser.constructor.name=='Parser') ? leftParser : strng(rightParser)
	return sequenceOf([
		lparser,
		parser,
		rparser,
	]).map((result) => result[1])
		.named(`between (${lparser.p.pname}) (${rparser.p.pname}) (${parser.p.pname})`)
}


/** "no-unused-vars": ["error", { "vars": "all", "args": "after-used", "ignoreRestSiblings": false }] */
// everythingUntil - 
const everythingUntil = (parser) => {
	const pname = `everythingUntil(${parser?.p?.pname ?? 'unnamed'})`
	return new Parser( function everythingUntil$(state) {
		const startTime = performance?.mark(pname)
		if  (state.isError) return state
		const lastParser = state?.pname || ''

		const results = []
		const startingIndex = state.index

		let currentState = state

		let iterationCount = 0
		while (true) {
			iterationCount++

			const nextState = parser.p(currentState)
			if (nextState.isError) {					// isError means that we tried the parser at the current index, and it failed, which means we advance 1 more character
				const { index, target } = currentState
				const val = target[index]    // get the character 

				if (val) {
					results.push(val)					// store the character
					currentState = Parser.updateParserState(currentState, val, index + 1, pname)			// advance the state by 1 character 
				}
				else {
					return Parser.updateError(
						state,
						`[${pname}]: ParseError: Reached the end of the target string with no match for the supplied parser (${parser})`, 
						pname
					)
				}
			}
			else {				// finally, if parser succeeds, we break the loop
				break
			}
		}
		// console.log(`[${pname}]: iteration count: ${iterationCount}, index: ${currentState.index}, startingIndex: ${startingIndex}, lastParser: ${state.pname}, finalParser: ${currentState.pname}, time: ${runTime}`)
		return Parser.updateResult(currentState, results.join(''), pname)
	}, pname )
}

// anythingExcept - advances one character, except if the supplied parser is matched
// NOTE: why would it advance one character?  Because you could get caught in a 'many' parser that will never advance
// very slow for large text.
const anythingExcept = function anythingExcept(parser) {
	const pname = `anythingExcept(${parser?.p?.pname ?? 'unnamed'})`

	return new Parser(function bnythingExcept$(state) {
		if  (state.isError) return state
		const lastParser = state?.pname || ''

		const { target, index } = state
		if (state.index === target.length) {
			return Parser.updateError(
				state,
				`[${pname}] (at index ${index}): already at end of input (lastParser '${lastParser})' )`,
				pname
			)
		}
		const nextState = parser.p({ ...state })
		if (nextState.isError) {
			return Parser.updateParserState(state, target[index], index + 1, pname)
		}
		return Parser.updateError(
			state, 
			`[${pname}] (at index ${index}): Matched '${nextState.result}' from the exception parser`,
			pname
		)
	}, pname )
}


// lookAhead : 
//	- if parser succeeds: don't advance, but succeed with result
// 	- if parser fails - fail 
const lookAhead = (parser) => {
	const pname = `lookAhead(${parser?.p?.pname ?? 'unnamed'})`

	return new Parser( function lookAhead$(state) {
		if  (state.isError) return state

		const nextState = parser.p({ ...state })

		if (nextState.isError) return Parser.updateError(state, nextState.error, pname)
		return Parser.updateResult(state, nextState.result, pname)
	}, pname )
}


// possibly :
//	-	if parser succeeds: advance, succeed with result
//	-	if parser fails: 		don't advance, succeed with a result of null
const possibly = (parser) => {
	const pname = `possibly(${parser?.p?.pname ?? 'unnamed'})`

	return new Parser( function possibly$(state) {
		if  (state.isError) return state

		const nextState = parser.p({ ...state })

		// if 'parser' fails, convert to a result, supplying 'null' as the result, 
		if (nextState.isError) return Parser.updateResult(state, null, pname)

		// if 'parser' succeeds, just pass the success directly to caller
		return nextState
	}, pname )
}

// skip :
//	-	if parser succeeds: advance per parser, succeed with null
//	-	if parser fails, skip will fail
// skip - 
const skip = (parser) => {
	const pname = `skip(${parser?.p?.pname ?? 'unnamed'})`
	return new Parser( function skip$(state) {
		if (state.isError) return state

		const nextState = parser.p({ ...state })

		// if 'parser' fails, just return the errored state to the parser that called skip for handling, without error message
		if (nextState.isError) return nextState

		// if 'parser' succeeds, return a result of 'null', and advance the cursor.
		return Parser.updateResult(nextState, null, pname)
	}, pname )
}


// either :
// 	- if parser succeeds: succeed with a result object like this: { isError: false, value: <myresult> }
//	- if parser fails:		succeed with result object like this: { isError: true, value: <my_error_message> }
const either = (parser) => {
	const pname = `either(${parser?.p?.pname ?? 'unnamed'})`

	return new Parser( function either$(state) {
		if  (state.isError) return state

		const nextState = parser.p({ ...state })

		return Parser.updateResult(
			{ ...nextState, isError: false },				// this is the state
			{
				isError: nextState.isError,
				value: nextState.isError ? nextState.error : nextState.result,
			},
		)
	}, pname )
}


// decide - equivalent to the .chain() method of a parser.
// A user-supplied function can make a choice of the next parser based on the result
// think: 'if this result, then run parser X, else run parser Y'
// The tlFn_on_result, as it's name suggests is of the form:
//   result => Parser
const decide = (tlFn_on_result) => new Parser( function decide$(state) {
	const pname = `decide(${tlFn_on_result})`
	if  (state.isError) return state
	const parser = tlFn_on_result(state.result)
	return parser.p(state)
})


// delayedParser : 
//   - supply a parserThunk, which is a function like this: '() => myparser'
// this will allow myparser to call itself recursively, for nested, self-similar structures (i.e. xml, JSON, languages)
// NOTE: can have heavy performance impact - use memoization
const delayedParser = (parserThunk) => new Parser((state) => parserThunk().p(state))



/******************************************************************************/
/** Special Combinator for user-supplied generator functions using 'yield'   **/
/******************************************************************************/


// coroutine : run parsers imperative-style, inside a user-defined generator function.
//   NOTE: the generator function must call parsers using yield statements.  Each yield returns the actual result.  Any failure will fail the entire coroutine
const coroutine = (generatorFunction) => Parser.of(null).chain(() => {
	const generator = generatorFunction()
	const step = (nextValue) => {
		const result = generator.next(nextValue)
		const value = result.value
		const done = result.done

		if (!done && (!value || typeof value.chain !== 'function'))
			throw new Error(`[coroutine]: yielded values must be Parsers, got ${result.value}.`)

		return (done) ? Parser.of(value) : value.chain(step)
	}
	return step()
})




/** lookBehind 
 * Similar in concept to a regex 'lookbehind' to affirm the context of a certain match.  Used in parsers that advance 
 * the position (i.e. "search...", "find..", "next...", "goto...", etc) where you need to peeking backwards, and run
 * a parser from that point.  But this happens without actually moving the parser backwards.  Typical use case:
 * search forward for some record that begins after a newline.   
 */
const lookBehind = function lookBehind(numChars, parser) {
	const pname = `lookBehind(${numChars}, ${parser})`
	return new Parser(function lookBehind$(state) {
		if  (state.isError) return state
		const lookBehindState = parser.p({ ...state, index: state.index - parseInt(numChars) })
		if (lookBehindState.isError) return Parser.updateError(
			state, 
			`[${pname}]: lookbehind parser error: ${lookBehindState.error}`, 
			pname
		)
		return Parser.updateResult(state, lookBehindState.result, pname)
	}, pname )
}


// peekAhead - like lookAhead, but specifying the number of characters
// gets the result of 'numChars' ahead, but does not advance the cursor
const peekAhead = function peekAhead(numChars) {
	const pname = `peekAhead(${numChars})`
	return new Parser(function peekAhead$(state) {
		if  (state.isError) return state
		if (state.index + numChars > state.target.length) return Parser.updateError(
			state, 
			`[${pname}]: end of input exceeded`, 
			pname
		)
		const peekAheadResult = state.target.slice(state.index, state.index + numChars, pname)
		return Parser.updateResult(state, peekAheadResult, pname)
	})
}



// treat str with possible whitespace (tabs & spaces) before & after:
const paddedString = (str) => {
	const pname = `paddedString('${str}')`
	if (typeof(str) !== 'string' || str.constructor.name !== 'String')
		throw new TypeError(`[${pname}] must be called with a string, but got ${str}`)

	return new Parser( function strng$(state) {
		if (state.isError) return state

		if (str.length == 0) return state

		if (state.index >= state.target.length) return Parser.updateError(
			state, 
			`[${pname}]: (at index ${state.index}): Expecting string '${str}', but got end of input`, 
			pname,
		)

		// advance the cursor past any spaces before checking if string is there
		let cursor = state.index
		const SPACE = ' '; const TAB = '\t';
		while ( state.target.charAt(cursor) === SPACE || state.target.charAt(cursor) === TAB ) {
			cursor++
		}
		const spaceCount = cursor - state.index	// instrumentation purposes - delete when done
		const remainingText = state.target.slice(cursor)
		//console.log(`paddedStr: remainingText: ${remainingText}`)
		if (remainingText.startsWith(str)) {
			//console.log(`paddedStr: matched!! str: ${str} at remaining text: ${remainingText}, advancing past ${spaceCount} spaces first, moving index from ${state.index} to newIndex:${cursor+str.length}`)
			return Parser.updateParserState(
				state, 
				str, 
				cursor + str.length,
				pname,
			)
		}
		//console.log(`paddedStr: failed!! str: ${str} not at remaining text: ${remainingText}, after advancing past ${spaceCount} spaces.  Cursor still at ${state.index}`)
		return Parser.updateError(
			state, 
			`[${pname}]: (at index ${state.index}): Expecting string '${str}', but got '${remainingText.slice(0, str.length)}...'\n`,
			pname,
		)
	}, pname)
}


// advances cursor beyond string match if any spaces or tabs come afterward (for backward compatiblity with tok(str))
const paddedString_extended = (str) => {
	const pname = `paddedString('${str}')`
	if (typeof(str) !== 'string' || str.constructor.name !== 'String')
		throw new TypeError(`[${pname}] must be called with a string, but got ${str}`)

	return new Parser( function strng$(state) {
		if (state.isError) return state

		if (str.length == 0) return state

		if (state.index >= state.target.length) return Parser.updateError(
			state, 
			`[${pname}]: (at index ${state.index}): Expecting string '${str}', but got end of input`, 
			pname,
		)

		// advance the cursor past any spaces before checking if string is there
		let cursor = state.index
		const SPACE = ' '; const TAB = '\t';
		while ( state.target.charAt(cursor) === SPACE || state.target.charAt(cursor) === TAB ) {
			cursor++
		}
		const spaceCount = cursor - state.index	// instrumentation purposes - delete when done
		const remainingText = state.target.slice(cursor)
		//console.log(`paddedStr: remainingText: ${remainingText}`)
		if (remainingText.startsWith(str)) {
			let cursor2 = cursor + str.length

			while ( state.target.charAt(cursor2) === SPACE || state.target.charAt(cursor) === TAB ) {
				cursor2++
			}
			const spaceCount2 = cursor2 - cursor	// instrumentation purposes - delete when done
			//console.log(`paddedStr: matched!! str: ${str}.  First advancing past ${spaceCount} spaces, then matching ${str} (${str.length} spaces), then moving additional ${spaceCount2} spaces.  Overall, moved index from ${state.index} to newIndex:${cursor+str.length+cursor2}`)			
			return Parser.updateParserState(
				state, 
				str, 
				cursor2,
				pname,
			)
		}
		//console.log(`paddedStr: failed!! str: ${str} not at remaining text: ${remainingText}, after advancing past ${spaceCount} spaces.  Cursor still at ${state.index}`)
		return Parser.updateError(
			state, 
			`[${pname}]: (at index ${state.index}): Expecting string '${str}', but got '${remainingText.slice(0, str.length)}...'\n`,
			pname,
		)
	}, pname)
}




/***********************************************************************/
/** Higher-Level Combinators  *******/
/***********************************************************************/


/** Improved version of the original 'tok' parser (now called "tok_old")   ** see the TO-DO Note below ***
 *  - optimized for handling the 'maybe' whitespace (regex is used to buffer strings instead of parsers)
 *    - this is accomplished by deconstructing any supplied regex back to its source string, prepending/appending regex as an optional string [ \t]*, and recompiling
 *  - more flexible: strings can be supplied, which are compiled to regex
 * 
 * ** TO DO ***
 * This is still a very "noisy" parser when it comes to error output.  This can be simplified by converting it to
 * a bare-metal parser (like 'lineOf'), and not rely on combinator-based padding, such as 'possible_space(...)',
 * etc.  Thse combinators add a lot to the noise in the error output
 */ 
const tok_v1 = (pattern) => {
	const regex_spaces = `[ \t]*`
	const possibleSpace = regex(/^[ \t]*/).named_mutable('@possibleSpace')
	//const possibleSpace = regex(/^[ \t]*/).named('@possibleSpace')
	const possible_space_prev  = possibly(regex(/^[ \t]*/)).named(`possible_space`)		// borrowed from Parser_Text module

	// convert string to RegExp, then to regex
	if (pattern.constructor.name === 'String') {
		const stringParser = strng(pattern)
		const tokenizedStringParser = sequenceOf(	possibleSpace, stringParser, possibleSpace ).map( (res) => res[1] )
		return tokenizedStringParser.named(`tok('${pattern}')`)
	}
	// If RegExp, deconstruct it to ensure it has the anchor '^' (to match a string instead of search for one), and return a single regex parser that will strip the whitespaces
	if (pattern.constructor.name === 'RegExp') {
		const sourceRegExp = pattern.source.startsWith('^') ? pattern.source.slice(1) : pattern.source
		return regex('^' + regex_spaces + sourceRegExp + regex_spaces )
			.map( (res)=>res.trim())
			.named(`tok('/^${sourceRegExp}}/')`)
			//.logOnError(`[tok1]: failed on '${string_or_token_parser}'.  Supplied as a RegExp...but converted to 'regex(/^[ \t]*${rx_src}[ \t]*/)'`)
			//.tap(`[tok1]: converted RegExp ${string_or_token_parser} to ${regex('^' + rx_spaces_src + rx_src + rx_spaces_src )})`)
	}
	// if not a string or RegExp, just use higher-level combinators and return the result skipping the possible spaces
	// const rx_spaces = regex(new RegExp(`^` + rx_spaces_src))
	// const tokenizedParser = sequenceOf(	possible_space, pattern, possible_space ).map( (res) => res[1] )
	const tokenizedParser = sequenceOf(	possibleSpace, pattern, possibleSpace ).map( (res) => res[1] )
	return tokenizedParser.named(`tok(${tokenizedParser})`)
	//.tap(`[tok1-Parser(${string_or_token_parser})]`)
	//.logOnError(`[tok1]: failed on '${string_or_token_parser}'.  Supplied as a Parser, but padded using 'sequenceOf([possibly(rx_spaces, ${string_or_token_parser}, possibly(rx_spaces))])`)
}


// left-trimming only
const tok_v2 = (pattern) => {
	// CASE1: pattern is string:  
	// Method: call paddedStr on pattern, which physically removes spaces or tabs preceding
	if (pattern.constructor.name === 'String') {
		const tokenizedStringParser = paddedString(pattern)
		//	console.log(`CASE1: [tok]: pattern is String`, {pattern, tokenizedStringParser})
		return tokenizedStringParser.named(`tokv2.1('${pattern}')`)
	}
	// CASE2: pattern is RegExp:
	// Method: deconstruct it to ensure it has the anchor '^' (to match a string instead of search for one), and return a single regex parser that will strip the whitespaces
	if (pattern.constructor.name === 'RegExp') {
		const regex_spaces = `[ \t]*`
		const sourceRegExp = pattern.source.startsWith('^') ? pattern.source.slice(1) : pattern.source
		const tokenizedParser = regex('^' + regex_spaces + sourceRegExp).map( (res)=>res.trim())
		//	console.log(`CASE2: [tok]: pattern is RegExp`, {pattern, sourceRegExp, tokenizedParser})
		return tokenizedParser.named(`tokv2.2('/^${sourceRegExp}}/')`)
	}
	// CASE3: pattern is a Parser (presumably)
	const possibleSpace = regex(/^[ \t]*/).named('possibleSpace')
	const tokenizedParser = sequenceOf(	possibleSpace, pattern).map( (res) => res[1] )
	//	console.log(`CASE3: [tok]: pattern is (presumably) Parser`, {pattern, tokenizedParser})
	return tokenizedParser.named(`tokv2.3(${tokenizedParser})`)
}

// two-way trimming
const tok_ext = (pattern) => {
	// CASE1: pattern is string:  
	// Method: call paddedStr on pattern, which physically removes spaces or tabs preceding
	if (pattern.constructor.name === 'String') {
		const tokenizedStringParser = paddedString_extended(pattern)
		// console.log(`CASE1: [tok]: pattern is String`, {pattern, tokenizedStringParser})
		return tokenizedStringParser.named(`tokv2.1('${pattern}')`)
	}
	// CASE2: pattern is RegExp:
	// Method: deconstruct it to ensure it has the anchor '^' (to match a string instead of search for one), and return a single regex parser that will strip the whitespaces
	if (pattern.constructor.name === 'RegExp') {
		const regex_spaces = `[ \t]*`
		const sourceRegExp = pattern.source.startsWith('^') ? pattern.source.slice(1) : pattern.source
		const tokenizedParser = regex('^' + regex_spaces + sourceRegExp + regex_spaces ).map( (res)=>res.trim())
		// console.log(`CASE2: [tok]: pattern is RegExp`, {pattern, sourceRegExp, tokenizedParser})
		return tokenizedParser.named(`tokv2.2('/^${sourceRegExp}}/')`)
	}
	// CASE3: pattern is a Parser (presumably)
	const possibleSpace = regex(/^[ \t]*/).named('possibleSpace')
	const tokenizedParser = sequenceOf(	possibleSpace, pattern, possibleSpace).map( (res) => res[1] )
	// console.log(`CASE3: [tok]: pattern is (presumably) Parser`, {pattern, tokenizedParser})
	return tokenizedParser.named(`tokv2.3(${tokenizedParser})`)
}


const tok = tok_v2


const tok_old = (string_or_token_parser) => {
	const rx_spaces_src = `[ \t]*`
	// convert string to RegExp, then to regex
	if (string_or_token_parser.constructor.name === 'String') {
		const rx = new RegExp('^' + rx_spaces_src + string_or_token_parser + rx_spaces_src)
		return regex(rx)
			.map( (res)=>res.trim())
			.named(`tok('${string_or_token_parser}')`)
			//.logOnError(`[tok1]: failed on '${string_or_token_parser}'.  Supplied as a string, but converted to 'regex(/^[ \t]*${string_or_token_parser}[ \t]*/)'`)
			.tap(`[tok1-String]: converted ${string_or_token_parser} to ${rx})`)
	}
	// take a supplied native RegExp, deconstructing it to ensure it has the preceding '^', and returing a regex parser that will strip the whitespaces
	if (string_or_token_parser.constructor.name === 'RegExp') {
		const rx_src = string_or_token_parser.source.startsWith('^') ?
			string_or_token_parser.source.slice(1)
			: string_or_token_parser.source
		return regex('^' + rx_spaces_src + rx_src + rx_spaces_src )
			.map( (res)=>res.trim())
			.named(`tok('/^${rx_src}}/')`)
			//.logOnError(`[tok1]: failed on '${string_or_token_parser}'.  Supplied as a RegExp...but converted to 'regex(/^[ \t]*${rx_src}[ \t]*/)'`)
			.tap(`[tok1-RegExp]: converted ${string_or_token_parser} to ${regex('^' + rx_spaces_src + rx_src + rx_spaces_src )})`)
	}
	// if not a string or RegExp, just use higher-level combinators and return the result skipping the possible spaces
	const rx_spaces = regex(new RegExp(`^` + rx_spaces_src))
	return sequenceOf([
		possibly(rx_spaces),
		string_or_token_parser,
		possibly(rx_spaces),
	]).map((result) => result[1])
		.named(`tok(${`${string_or_token_parser}`})`)
		//.logOnError(`[tok1]: failed on '${string_or_token_parser}'.  Supplied as a Parser, but padded using 'sequenceOf([possibly(rx_spaces, ${string_or_token_parser}, possibly(rx_spaces))])`)
		.tap(`[tok1-Parser(${string_or_token_parser})]`)
}


// Alternate 'tok' parser, which treats newlines as spaces, 
const tokL = (pattern) => {
	const rx_spaces_src = `[ \t]*`
	// convert string to RegExp, then to regex
	if (pattern.constructor.name === 'String') {
		const rx = new RegExp('^' + rx_spaces_src + pattern + rx_spaces_src)
		return regex(rx)
			.map( (res)=>res.trim())
			.named(`tok('${pattern}')`)
	}
	// take a supplied native RegExp, deconstructing it to ensure it has the preceding '^', and returing a regex parser that will strip the whitespaces
	if (pattern.constructor.name === 'RegExp') {
		const rx_src = pattern.source.startsWith('^') ?
			pattern.source.slice(1)
			: pattern.source
		return regex('^' + rx_spaces_src + rx_src + rx_spaces_src )
			.map( (res)=>res.trim())
			.named(`tok('/^${rx_src}}/')`)
	}
	// if not a string or RegExp, just use higher-level combinators and return the result skipping the possible spaces
	const rx_spaces = regex(new RegExp(`^` + rx_spaces_src))
	return sequenceOf([
		possibly(rx_spaces),
		pattern,
		possibly(rx_spaces),
	]).map((result) => result[1])
		.named(`tok(${`${pattern}`})`)
}


// Original tok parser, to be replaced by tok above
const tok2 = (string_or_token_parser) => {
	const spaceRegExpSource = `^[ \t]*`
	const space = regex(/^[ \t]*/).named(`regx_space`)
	const tokenParser = typeof (string_or_token_parser) == 'string' ? strng(string_or_token_parser) : string_or_token_parser
	return sequenceOf([
		possibly(space),
		tokenParser,
		possibly(space),
	]).map((result) => result[1])
		.named(`tok(${`${string_or_token_parser}`})`)
}


// any sequence of strings or parsers separated by non-breaking white-space
const seqOf = (...patterns) => {
	const parsers = patterns.flat().map( (parser) => {
		if (parser?.constructor?.name === 'String') return strng(parser)
		if (parser?.constructor?.name === 'RegExp') return regex(parser)
		return parser
	})
	const pname =  `seqOf(${parsers.join(', ')})`
	const pnameLong = `seqOf(${parsers.join(', ')})`

	return sequenceOf( parsers.map((parser) => tok(parser).named(`${parser}`)) )
		.named(pname)
		// .mapError( ({error,index,data}) => `[${pname}]: Error at index ${index}.  Underlying error message: ${error}`)
		.mapError_fullHistory( ({error, index, data}) => `[${pname}]: Error at index ${index}.  Underlying error message: ${error}`)
}


// Takes a simple array of strings and/or parser names and returns a choice tokenized parsers
// Note: if the item is a string, it's added to the choice as a token(str).  If not, it's added as a tok(parser)
const oneOf = (...patterns) => {
	const parsers = patterns.flat().map( (parser) => {
		if (parser?.constructor?.name === 'String') return strng(parser)
		if (parser?.constructor?.name === 'RegExp') return regex(parser)
		return parser
	})
	const pname =  `oneOf(${parsers.length} parsers)`
	const pnameLong = `oneOf(${parsers.join(', ')})`

	return choice( parsers.map( (parser) => tok(parser).named(`${parser}`)) )
		.named(pname)
		.mapError_fullHistory( ({error, index, data}) => `[${pname}]: Error at index ${index}.  Underlying error message: ${error}`)

	// return choice( listOfPatterns.flat().map((parser) => tok(parser).named(`${parser}`)) )
	// 	.named(pname)
	// 	.mapError_fullHistory( ({error,index,data}) => `[${pname}]: Error at index ${index}.  Underlying error message: ${error}`)
}


// treat a list of parsers or patterns as a set.  
// Warning:  avoid wildcards.
const setOf = (...patterns) => {
	return many(oneOf(patterns.flat()) )
		.named('setOf()')
}


// next-generation (maybe?) of parseLine.
// Optimized for per-line parsing without all the 'tok()' stuff in parseLine (reduces 'noise' in error output)
const lineOf = (..._patterns) => {
	const patterns = _patterns.flat().map( (pattern, idx) => {
		if (pattern?.constructor?.name === 'String') return pattern.trim()
		if (pattern?.constructor?.name === 'RegExp') return fixedRegExp(pattern)
		if (pattern?.constructor?.name === 'Parser') return pattern
		throw new Error(`[lineOf]: the supplied pattern ${pattern} is not a string, RegExp, nor Parser`)
	})
	const pname = `lineOf(${patterns.length} patterns)`
	if (patterns.length === 0) throw new Error(`[${pname}]: List of patterns can't be empty.`)

	return new Parser( function lineOf$(state) {
		if  (state.isError) return state

		let results = []										// initialize the return value

		const startingIndex = state.index		// for instrumentation & logging. . . 
		const restOfTarget = state.target.slice(state.index)

		const eolIndex = (restOfTarget.indexOf('\n') > 0) ? restOfTarget.indexOf('\n') : restOfTarget.length     // if \n not found, assume we're at the end

		const lineToParse = restOfTarget.slice(0, eolIndex)
		const endOfLineIndex = state.index + lineToParse.length + 1

		let currentState = { ...state }			// currentState will keep advancing with every successful parser
		let remainingLine = lineToParse.trimStart()

		for (let i = 0; i < patterns.length; i++) {
			let pattern = patterns[i]

			if (pattern?.constructor?.name == 'String') {
				if ( ! remainingLine.startsWith(pattern) ) return Parser.updateError(	state, 
					`[lineOf(parser #${i} of ${patterns.length}(String))]: starting at index ${startingIndex} - string '${pattern[i]}' failed to match`,
					//	`[${pname}]: (at index ${index}): Expecting text matching pattern '${pattern}/(${usedPattern})', but got '${remainingLine.slice(0, 12)}...'`,
					pname,
				)
				// results = results.concat(parser)			// don't add string matches to the result
				remainingLine = remainingLine.slice(pattern.length).trimStart()
			}

			else if (pattern?.constructor?.name == 'RegExp') {
				const regexMatch = remainingLine.match(pattern) ?? false
				if ( ! regexMatch ) return Parser.updateError( state, 
					`[lineOf(parser #${i} of ${patterns.length})]: starting at index ${startingIndex} - RegExp '${pattern[i]}' failed to match`,
					pname,
				)
				const matchLength = regexMatch[0].length
				const matchResult = regexMatch?.groups ?? regexMatch?.[0]
				results = results.concat(matchResult)
				remainingLine = remainingLine.slice(matchLength).trimStart()
			}

			else  {	// this is when parser is a "Parser" instance
				const lineState = pattern.runLite(remainingLine)
				if (lineState.isError) return Parser.updateError( state, 
					lineState.error, 
					pname, 
					`[lineOf(parser #${i} of ${patterns.length})(Parser)]: starting at index ${startingIndex} - Parser ${pattern[i]} failed to match`,
				)
				results = results.concat(lineState.result)
				remainingLine = remainingLine.slice(remainingLine.length).trimStart()
			}
		}		// end of loop

		// if there is a single result, return it.  If there are multiple, return an array.  If none, return null
		// const returnedResults = (results.length > 1) ? results : (results.length > 0) ? results[0] : null
		// const returnedResults = results.at(-1) ?? null
		const returnedResults = results
		return Parser.updateParserState(currentState, returnedResults, endOfLineIndex, pname)
	}, pname )
}


// except:  this parser first checks to see if exceptionParser passes.  If so, except will fail.  
// If exceptionParser fails, 'except' will process elseParser, and return the results.
// The use case is very narrow, but a common important one:
// When normally running through a set of possible parsers to build a record, such as  'many(oneOf(list_of_potential_matches))' 
//   i.e. - parsing through interface line entries to build a record, you either have to explicitly match every possible line, or 
//   use a wildcard.  Trying to match every possible line is not a problem in a closed language, but with semi-structured text, you 
//   don't alwasys know if you'll encounter an unknown line.  So thus you employ "wildcard" parsers to match "anything not matched".
//   The problem with wildcards happens when not using a boundard parser (like 'until'), which runs a subparser against a small section
//   of text.   Without a bounded parser, there is no explicit termination, so a wildcard can likely go well beyond the intended "section".
//   Thus, 'except' will help here.  The exception parser defines the explicit termination, which allows the use of a wildcard to capture everything else. 
//   you have a many(oneOf(list_of_potential_matches_including_wildcard)) situation, you know that before the first potential match is tried,
//   it will check the exception parser.  If it succeeds, 'except' will fail, allowing you to terminate the many loop.
//   In this context, the except parser allows for an explicit termination of the section.  
//
// The general use case is thus:
//   many( except(parser_that_will_terminate_many, oneOf(parsers to match against) )
//
// as a safe alternative to:
//	setOf(parsers to match against)
//
const except = (exceptionParser, elseParser) => {
	const pname = `except(${exceptionParser}, ${elseParser})`
	return new Parser( function except$(state) {
		if  (state.isError) return state

		const exceptionState = exceptionParser.p(state)
		

		if ( !exceptionState.isError) {
			const traceLog = Parser._tracing ? [
				`[except(${exceptionParser}, ${elseParser})]: found positive exception at ${Parser.rptPosition(state.target, exceptionState.index)}`,
				`${Parser.rptStateChange(``, state)}`
			] : []
			return Parser.updateError(
				(traceLog.length > 0) ? Parser.updateDataLog(exceptionState, traceLog) : exceptionState, 
				`[${pname}]: at index ${state.index}}, matched exception result: ${exceptionState.result}.  Next index would be: ${exceptionState.index}`,
				pname,
			)
		}
		const elseState = elseParser.p(state)
		return elseState
	}, pname)
}


//  Fails if next token is p.  
//  Succeeds if the next token is NOT p, but does NOT advance, and returns 'null'
const not = (p) => skip(lookAhead(anythingExcept(tok(p))))
	.named(`not(${p})`)
	.mapError( ({error,index,data}) => `[not(${p})]: Error at index ${index}.  Underlying error: ${error}`)


/**
 * Higher-level variant of "possibly", just like seqOf is a higher-level for sequenceOf:
 * 	automatically handles possible whitespace before & after supplied pattern arg
 *  pattern arg can be a native string, RegExp, or parser
 */
const maybe = (pattern) => {
	// first - pattern-match the supplied parameter, so we can convert to the proper parser
	const parser = 
		(pattern?.constructor?.name === 'String') ? strng(pattern)
		: (pattern?.constructor?.name === 'RegExp') ? regex(pattern)
		: pattern

	return possibly(parser).named(`maybe_v1(${pattern})`)
}


/** maybe_v2  ** EXPERIMENTAL **
 * Builds upon maybe to automatically convert the output to the expected type based on the supplied pattern
 *  | pattern          | success return returns         | failed pattern returns  |
 *  | -------          | -----------------------        | ----------------------- |
 *  | string (JS)      | strng result                   | ""                     |
 *  | regexp (JS)      | regex result                   | ""                     |
 *  | many(mpattern)   | JS Array of mpattern results ] | []                     |
 *  | many1(mpattern)  | JS Array of mpattern results ] | []                     |
 *  | other Parser     | Parser result                  | ""                     |
 *
 * Result so far make this a mess.  The requirement to check if the pattern.ppname.startsWith('many') to modify the output type
 * for the sake of convenience to the user breaks because if the user later converts a working use of this version
 * using a pattern that is renamed, the name checking below breaks and will change the output.
 * The only solution so far is likely to carry a fundamental return-type with each Parser object (just like Parser.p, 
 * there would be a Parser.type or something).
 * This is getting to be a typed system, which is not bad, but defintely changes the fundamentals of this entire parser.
 * For now, this function will stay here for reference and further study, but not be exported/used.
 */
const maybe_v2 = (pattern) => {
	// first - pattern-match the supplied parameter, so we can convert to the proper parser
	const parser = 
		(pattern?.constructor?.name === 'String') ? strng(pattern)
		: (pattern?.constructor?.name === 'RegExp') ? regex(pattern)
		: pattern

	return possibly(parser).map( (result) => {
		if (result==null) {
			// things break here with the supplied parser being named - we need a type-tagging system for return types
			if (pattern?.p?.pname.startsWith('many')) return []				// if the pattern was a 'maybe' but found nothing, return empty array
			return ''																					// otherwise convert null to empty string
		}
		return result 
	}

	).named(`maybe_v2(${pattern})`)
}


// Parses a template literal, where the variables are parsers
// Returns a seqOf(...) consisting of all literal string & parsers from the template.
// NOTE: Quite ***unforgiving*** w/regards to whitespace - use 'parseTemplate' for looser parsing w/regards to whitespace
function parseTemplate_strict(strings, ...templateVars) {
	const pname = `parseTemplate_strict(...)`
	const zippedSequence = zip (strings) (templateVars) // interleave strings & parsers - which returns the parsed expressing with all parts, in order
	const parseTasksFiltered = zippedSequence.filter( (p) => p )  // eliminate empty string & undefined
	const parseTasks = parseTasksFiltered.map( (p) => (typeof(p)=='string')
		? strng(p.replace(/(^[ \t]*)|([ \t]*$)/g, ''))			// trim any and all inline whitespace (spaces & tabs, not linebreaks)
		: p
	)
	return seqOf(parseTasks)
		.named(pname)
		.mapError( ({error, index, data}) => `[parseTemplate]: failed at index ${index}.\nOriginal error was: ${error}`)
		.getTaggedR()			// seqOf will automatically tokenize within a line
}


function parseTemplate_strict_traced(strings, ...templateVars) {
	const pname = `parseTemplate_strict(...)`
	const zippedSequence = zip (strings) (templateVars)			// interleave strings & parsers - which returns the parsed expressing with all parts, in order
	const parseTasksFiltered = zippedSequence.filter( (p) => p )  // eliminate empty string & undefined
	const parseTasks = parseTasksFiltered.map( (p) => (p?.constructor?.name == 'String') ? 
		strng(p.replace(/(^[ \t]*)|([ \t]*$)/g, ''))			// trim any and all inline whitespace (spaces & tabs, not linebreaks)
		: p
	)
	// for troubleshooting & logging
	const templateReport = zippedSequence.map((p,idx) => {	// create report for troubleshooting purposes
		if (p === '') 											return `item #${idx} is: "" (empty string).  Will be ignored`
		if (typeof(p) == 'undefined')				return `item #${idx} is: undefined.  Will be ignored`
		if (p?.constructor?.name=='String') return `item #${idx} is: '${p}' (string).  Will be converted to Parser strng('${p.replace(/(^[ \t]*)|([ \t]*$)/g, '')}')`
		// if (p?.constructor?.name=='RegExp') return `item #${idx} is: '${p}' (RegExp).  Will be converted to Parser regex(/^${p.source}/${p.flags})`
		return `parser #${idx}: Parser '${p?.p.pname}' will be used.`
	})

	console.warn(dedent`
		[${pname}]:  ${parseTasks.length} parsers to be sequenced:
		${templateReport.join('\n')}
	\n`, {
		strings, 
		templateVars, 
		zippedSequence,
		parseTasksFiltered,
		parseTasks,
	})

	return seqOf(parseTasks).getTaggedR()
}


// functions like parseTemplate_strict, but is very forgiving with whitespace - parsers and literal string parts can be interleaved with 
//	zero or more linebreaks, consequtive spaces & tabs, for the purpose of making template handling easy to use
function parseTemplate(strings, ...templateVars) {
	const pname = `parseTemplate(...)`
	const __	= regex(/^[ \n\r\t]*/)												// parser that consumes all possible whitespace - used to pad all strings & vars in the template
	const zippedSequence = zip (strings) (templateVars)			// interleave strings & parsers - which returns the parsed expressing with all parts, in order

	const parseTasks = zippedSequence.reduce( (acc, parseTask) => {
		if (parseTask === '' || typeof(parseTask) == 'undefined') return acc		// p was nothing
		if (parseTask?.constructor?.name == 'String') return [...acc, strng(parseTask.trim()), __ ]
		return [...acc, parseTask, __] // acc is the accumulated list of parsers we'll be returning, and p is the current parseTask
	}, [] )

	return seqOf(parseTasks)
		.named('parseTemplate')
		.mapError( ({error, index, data}) => `[parseTemplate]: failed at index ${index}.\nOriginal error was: ${error}`)
		.getTaggedR()
}


function parseTemplate_traced(strings, ...templateVars) {
	const pname = `parseTemplate(...)`
	const __	= regex(/^[ \n\r\t]*/)												// parser that consumes all possible whitespace - used to pad all strings & vars in the template
	const zippedSequence = zip (strings) (templateVars)			// interleave strings & parsers - which returns the parsed expressing with all parts, in order

	const parseTasks = zippedSequence.reduce( (acc, parseTask) => {
		if (parseTask === '' || typeof(parseTask) == 'undefined') return acc		// p was nothing
		if (parseTask?.constructor?.name == 'String') return [...acc, strng(parseTask.trim()), __ ]
		return [...acc, parseTask, __] // acc is the accumulated list of parsers we'll be returning, and p is the current parseTask
	}, [] )

	// for troubleshooting & logging
	const templateReport = zippedSequence.map((p,idx) => {	// create report for troubleshooting purposes
		if (p === '') 											return `item #${idx} is: "" (empty string).  Will be ignored`
		if (typeof(p) == 'undefined')				return `item #${idx} is: undefined.  Will be ignored`
		if (p?.constructor?.name=='String') return `item #${idx} is: "${p}" (string).  Will be converted to Parser 'strng(${p.trim()}', followed by a '__' (any possible whitespace)`
		// if (p?.constructor?.name=='RegExp') return `item #${idx} is: '${p}' (RegExp).  Will be converted to Parser regex(/^${p.source}/${p.flags})`
		return `item #${idx} is Parser '${p?.p.pname}', followed by a '__' (any possible whitespace)`
	})
	console.warn(dedent`
		[${pname}]:  ${parseTasks.length} parsers to be sequenced:
		${templateReport.join('\n')}
	\n`, {
		strings, 
		templateVars, 
		zippedSequence,
		parseTasks,
	})

	return seqOf(parseTasks).getTaggedR()
}


// functions like parseTemplate, but is very forgiving with whitespace
function parseTemplate_traced2(strings, ...templateVars) {
	const __	= regex(/^[ \n\r\t]*/).named(`'__'`)				// consume all whitespace if it's there (including newlines)
	const zippedSequence = zip (strings) (templateVars)			// interleave strings & parsers - which returns the parsed expressing with all parts, in order

	const parseTasks = zippedSequence.reduce( (acc,p,idx) => {
		if (p === '' || typeof(p) == 'undefined') return acc		// p was nothing
		if (p?.constructor?.name == 'String') return [...acc, strng(p.trim()), __ ]
		return [...acc, p, __] // p was parser
	}, [] )

	return seqOf(parseTasks).getTaggedR()
}



/***********************************************************************/
/** Data Management Parsers                                            */
/**   - parsers that modify results/data/logs, but don't advance       */
/***********************************************************************/


// getData - returns a parser that changes nothing except adds the current data into the result stream
// if no name is supplied 'data' is assumed
const getData = (name='data') => new Parser( function getData$(state) {
	if  (state.isError) return state
	const dataValue = state[name] || null
	return Parser.updateResult(state, dataValue, `getData(${name})`)
}).named(`getData(${name})`)


// setData - returns a parser that changes nothing except setting the data (even if error)
// if no value is supplied, the current result is assumed.
// if no name is supplied, 'data' is assumed
const setData = (value=null) => new Parser( function setData$(state) {
	// if  (state.isError) return state
	const dataValue = value ?? state.result
	const nextState = Parser.updateData(state, dataValue, 'data', `setData(${value})`)
	return nextState
}).named(`setData(${name})`)


// Operates just like the method named setData
// setData - returns a parser that changes nothing except setting the data (even if error)
// if no value is supplied, the current result is assumed.
// if no name is supplied, 'data' is assumed
const clearData = (name='') => new Parser( function clearData$(state) {
	const {[name]:omit, ...newEnv} = state.env
	//const clearEnvName = (envVar) => ({envVar, ...env}) => env
	//const newEnv = clearEnvName (name) (state.env)
	const nextState = {...state}
	nextState.env = newEnv
	// console.log(`[clearData]:`, {state, nextState})
	return nextState
}).named(`clearData(${name})`)



// mapData - equivalent to calling the .mapData method of a parser
const mapData = (name='data', mapFn_datamapFn_on_result_data_obj) => new Parser( function mapData$(state) {
	const pname = `mapData(${name})`
	if  (state.isError) return state
	const { result, data, env } = state

	if (name=='') {
		const dataToUpdate = data ?? null
		const updatedData = mapFn_datamapFn_on_result_data_obj({ result, data:dataToUpdate })
		return Parser.updateData(state, updatedData, '', pname)
	}
	const dataToUpdate = env?.[name] ?? null
	const updatedData = mapFn_datamapFn_on_result_data_obj({ result, data:dataToUpdate })
	return Parser.updateData(state, updatedData, name, pname)
}).named(`mapData(${name}`)


// mapTo - equivalent to calling the .map method of a parser 
const mapTo = (mapFn) => new Parser( function mapTo$(state) {
	if  (state.isError) return state
	return Parser.updateResult(state, mapFn(state.result), `mapTo(${mapFn?.name??''})`)
}).named(`mapTo(${mapFn?.name??''})`)


// mapErrorTo - equivalent to calling .mapError method of a parser
const mapErrorTo = (mapFn_on_error_index_data_obj) => new Parser( function mapErrorTo$(state) {
	const pname = `mapErrorTo(${mapFn_on_error_index_data_obj?.name??''})`
	if  (!state.isError) return state  			// early exit if not error

	const { error, index, data } = state
	const modifiedErrorMessage = mapFn_on_error_index_data_obj({ error, index, data })
	return Parser.updateError(state, modifiedErrorMessage, pname)
}).named(`mapErrorTo(${mapFn_on_error_index_data_obj?.name??''})`)


// withData - starts a user-supplied parser, with user data already supplied prior to parsing (for context purposes)
const withData = (parser) => (userData) => setData('', userData).chain(() => parser)


/***********************************************************************/
/** Data Extractors                                                    */
/***********************************************************************/


// like toValue, this unwraps result from Parser context, but returns resolved promise of the result

// const toPromise = (state) => (state.isError)
//	? Promise.reject(({ error, index, data, dataLog }) => ({ error, index, data, dataLog }))
//	: Promise.resolve(state.result)


/***********************************************************************/
/** Tapping / Debugging / Instrumentation parsers                      */
/***********************************************************************/

// tapParser : line the .tapParser method, but reports the result inline
const tap = (tapName='unnamed', logFn=console.log) => {
	const pname = `tap(${tapName})`

	return new Parser( function tap$(nextState) {

		const lastParser = nextState.pname
		const currentRowCol = Parser.rptLine(nextState.target, nextState.index)
		//const stateChangeReport = Parser.rptFinal(`[tap(${tapName})::${pname})`, nextState)
		const stateChangeReport = [`[Parser_Core.mjs]: function tap(), need to fix this above line!!!`]



		if (nextState.isError) {
			const errLogFn = (logFn == console.log) ? console.warn : logFn
			errLogFn(`[tap(${tapName})] Parser Error at parser: ${pname} :\n`, {
				lastParser,
				pname,
				error: nextState.error,
				currentRowCol,
				data: nextState.data,
				errorPath: nextState.errorPath,
				nextState,
			})
		} 
		else {
			logFn(`[tap(${tapName})] Parser Result from parser: ${pname}:\n`, {
				lastParser,
				pname,
				result: nextState.result,
				currentRowCol,
				data: nextState.data,
				nextState,
			})
		}

		return Parser.updateDataLog(nextState, stateChangeReport)
	}, pname )
}


const tapResult = (tapName='unnamed', logFn=console.log) => {
	const pname = `tapResult(${tapName}):`

	return new Parser( function tapResult$(state) {
		const lastParser = state.pname
		const currentRowCol = Parser.rptLine(state.target, state.index)

		if (state.isError) {
			logFn(`[tapResult(${tapName})] ERROR at parser: ${pname}:\n`, {
				error: state.error,
				currentRowCol,
				errorPath: state.errorPath,
				lastParser,
				pname,
			})
			return state
		} 

		logFn(`[tapResult(${tapName})] RESULT from parser: ${pname}:\n`, {
			result: state.result,
			data: state.data,
			currentRowCol,
			lastParser,
			pname,
		})

		return state

	}, pname )
}


// tapParser : line the .tapParser method, but reports the result inline
const tapResult_prev = (tapName='', logFn = console.log) => {
	const pname = `tapResult(${tapName}):`

	return new Parser( function tap$(state) {
		const { target, index, isError, error, result, data, dataLog, pname:lastParser, ...rest } = state
		logFn(`[${pname}]:\n`, {
			lastParser,
			index,
			isError,
			error,
			data,
			result,				
			before: `${target.slice(index - 50, index)}...`,
			after:  `...${target.slice(index, index + 50)}`,
			dataLog,
		})
		return Parser.updateDataLog(state,
			`[${pname}.tap(${tapName})]:`,
			`  index:      ${index}`,
			`  isError:    ${isError}`,
			`  error:      ${error}`,
			`  preText:    ${target.slice(index - 50, index - 1)}...`,
			`  postText:...${target.slice(index - 50, index - 1)}`,
			`  data:       ${data}`,
			`  result      ${result}`,
		)
	}, pname )
}

const tap2 = (tapName='', logFn = console.warn) => succeedWith(null).named(`tap(${tapName})`).tap(tapName, logFn)


// traceOn : a Parser that does nothing but turn on the tracing flag 
const traceOn = (tag = 'untagged') => new Parser( function traceOn$(state) {
	if (Parser._tracing == true) return state
	Parser._tracing = true
	return Parser.updateDataLog(state, `[traceOn(${tag})]: Parser._tracing is enabled, ${Parser.rptState(state)}`)
}).named(`traceOn(${tag})`)


// traceOff : a Parser that does nothing but turn on the tracing flag 
const traceOff = () => new Parser( function traceOff$(state) {
	if (Parser._tracing == false) return state
	Parser._tracing = false
	return Parser.updateDataLog(state, `[traceOff()]: Parser._tracing is disabled, ${Parser.rptState(state)}`)
}).named(`traceOff()`)


// prepare a parse function that can be called directly (without a .run(target))
const parse = (parser) => (targetString) => parser.run(targetString)


/** inspect - run a user-supplied function that receives the entire state as a parameter (like tapParser, but more general)
	*		@param fn - user supplied function that receives the internal state as a parameter
	*		@return state - unmodified
	*		This is very similar to 'tapParser' - just a bit more generic.  
	*/
const inspect = (fn) => new Parser( function inspect$(state) {
	fn({ ...state })
	return state
}).named(`inspect(${fn?.name??''})`)


/** inspectParser - run a user-supplied function that receives the entire state as a parameter (like tapParser, but more general)
	*		@param fn - user supplied function that receives the internal state as a parameter
	*		@return state - unmodified
	*		This is very similar to 'tapParser' - just a bit more generic.  
	*/
const inspectParser = (parser) => new Parser( function inspectParser$(state) {
	const pname = `inspectParser(${parser})`
	const nextState = parser.p(state)
	const target = state.target
	const changeReport = {
		index: `was ${state.index}, now ${nextState.index} (${(nextState.index>state.index)?'+':''}${nextState.index - state.index})`,
		isError: `was ${state.isError}, now ${nextState.isError}`,
		rowCol: `was ${JSON.stringify(Parser.getRowAndCol(target, state.index),null,2)}, now ${JSON.stringify(Parser.getRowAndCol(target, nextState.index),null,2)}`,
		data: `was ${JSON.stringify(state.data)}, now ${JSON.stringify(nextState.data)}`,
		fromName: `was ${state.pname}, now ${nextState.pname}`,
	}
	const changeReportList = [
		`index: was ${state.index}, now ${nextState.index} (${(nextState.index>state.index)?'+':''}${nextState.index - state.index})`,
		`isError: was ${state.isError}, now ${nextState.isError}`,
		`was at ${JSON.stringify(Parser.getRowAndCol(target, state.index),null,2)}`, 
		`now at ${JSON.stringify(Parser.getRowAndCol(target, nextState.index),null,2)}`,
		`data: was ${JSON.stringify(state.data)}, now ${JSON.stringify(nextState.data)}`,
		`fromName: was ${state.pname}, now ${nextState.pname}`,
	].join('\n')

	// console.log(`[${pname}-1]:\n`, changeReport)
	// console.log(`[${pname}-2]:\n`, JSON.stringify(changeReport, null, 2))
	console.table([state, nextState])
	console.log(`[${pname}-3]:\n`, changeReportList)

	// {
	// 	let {target, isError, error, index, data, fromName, dataLog, errorPath } = state
	// 	console.log(`[${pname}]-4: From State`, {
	// 		isError,
	// 		error,
	// 		index,
	// 		row: Parser.findRowAndCol(target, index).row,
	// 		col: Parser.findRowAndCol(target, index).col,
	// 		preIndex:  `${target.slice(index - 50, index - 1)}..."`,
	// 		postIndex: `...${target.slice(index, index + 50)}"`,
	// 		data,
	// 		fromName,
	// 		dataLog,
	// 		errorPath
	// 	})
	// }
	// {
	// 	let {target, isError, error, index, data, fromName, dataLog, errorPath } = nextState
	// 	console.log(`[${pname}]-5: To State`, {
	// 		isError,
	// 		error,
	// 		index,
	// 		row: Parser.findRowAndCol(target, index).row,
	// 		col: Parser.findRowAndCol(target, index).col,
	// 		preIndex:  `${target.slice(index - 50, index - 1)}..."`,
	// 		postIndex: `...${target.slice(index, index + 50)}"`,
	// 		data,
	// 		fromName,
	// 		dataLog,
	// 		errorPath
	// 	})
	// }
	return nextState
}).named(`inspectParser(${parser})`)
	
	

// start exporting parsers only as needed and remove unused ones
export {
	Parser,
	regex,
	lookAhead,
	many,
	many1,
	between,
	everythingUntil,
	lookBehind,
	strng,
	tok,
	lineOf,
	endOfInput,
	fail,
	skip,
	anyOf_charset,
	succeedWith,
	sepBy,
	anythingExcept,
	possibly,
	sequenceOf,
	choice,
	seqOf,
	oneOf,
	setOf,
	except,
	maybe,
	not,
	tap,
	tapResult,
	setData,
	clearData,
	getData,
	mapData,
	withData,
	mapErrorTo,
	mapTo,
	coroutine,
	decide,
	either,
	inspect,
	inspectParser,
	parse,
	peekAhead,
	delayedParser,
	sepBy1,
	traceOff,
	traceOn,
	str,
	char,
	parseTemplate_strict,
	parseTemplate_strict_traced,
	parseTemplate,
	parseTemplate_traced,
	exactly,
}



