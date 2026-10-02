const isVerbose = true

// Module boilerplate - can delete unless you're using logHeader for log entries
const { filename, dirname, url } = import.meta
const path = dirname ?? url.slice?.(0, url.lastIndexOf("/")+1) ?? 'unknown'
const moduleName =  url ? url.slice(url.lastIndexOf("/")+1) 
	: filename && /\//.test(filename) ? filename.split("/")?.at(-1) 
	: filename && /\\/.test(filename) ? filename.split("\\")?.at(-1) 
	: 'unknown'
const logHeader = `${moduleName}`
isVerbose && console.log(`[${logHeader}]: Starting, path ${path}...`)



/**
 * @typedef {{
 *   name: string
 *   message: string
 *   cause: string | undefined
 *   stack: string | undefined
 * }} SerializedError
 */


/**
 * @typedef {{
 *   message: string | null
 *   stack: string | null
 *   details: string | null
 *   history: SerializedError[]
 * }} ErrorResponse
 */


/**
 * @typedef {{
 *   message: string, 
 *   stack: Array<string>, 
 *   name: string ,
 *   cause: any,
 * }} ErrorEntry
 */


/**
 * @typedef {{
 *   fnName:string, 
 *   context:string, 
 *   row:string, 
 *   col:string
 * }} StackTraceEntry
 */


/** Older error serializiation functions 
 * 
 * 'nestedErrorToList' / 'nestedErrorsToList' - does two things:
 *   1) serializes an Error object so we can actually pass it across a realm (server->client, or worker->main)
 *   2) If the error has a .cause property, and the .cause is an instance of 'Error', it will recursively
 *      iterate through the sub-error and bring all causes into a list, which can be serialized  
 * 
 * In any case, thet will return an array, even if most of the time it will have the one element
 * 
 * NOTE: nestedErrorToList can be considered the newer, simpler version of the plural-named 'nestedErrorsToList
 *       nestedErrorToList is also used by flattenError, which is important
 *       nestedErrorsToList is is older, but still used by db_NetworkDevices.mjs - so we don't want to get rid of it yet
 *
 * 'nestedErrorsToList_v2' - I don't remember what this was trying to do - keeping it around for now but need to 
 *    test to see if it's working, and what problem it was trying to solve...
 *  
 * 'serializeErrorToJsonRpcError' - still a work in progress intended to send an error object back to the client, 
 *  but using the jsonRpc protocol...
 * 
 */

/**
 * @typedef {{
 *   message: string
 *   stack?: string
 *   name: string
 *   cause?: string | ErrorCause | Error
 * }} ErrorCause
 */


/** nestedErrorToList
 * 
 * @param {Error|ErrorCause} errorOrCause - an Error instance or user data indicating a root cause
 * @returns Array<unknown>
 */
function nestedErrorToList(errorOrCause) {
  const { message, name, cause, stack = '', ...rest } = errorOrCause;
  if (!message) return []; // case 1: Error object was not passed ins

  //if (cause && !(cause instanceof Error )) return [ { message, stack, name, cause }]	// case 2: Error object was passed with a cause, but the cause is not an instance of Error (no further recursion)
  if (!(cause instanceof Error)) return [{ message, stack, name, cause: cause ?? '', ...rest }]; // case 3: Error object was passed in without a cause(no further recursion)
  return [{ message, stack, name }, ...nestedErrorToList(cause)]; // case 4 (recursive case): Error object was passed with a cause , and cause must be an Error object (by elimination)
}


/** nestedErrorsToList
 * take an instance of an Error object, which could have an embedded error via the 'cause' property, and possibly recursively nested with more,
 * and converts the nested Error objects to a list, and at the same time, converts them from an Error object to a plain object suitable for
 * transmission across a worker boundary or serializable for fetch.
 * @template T
 * @param {T extends Error ? Error : T extends SerializedError ? SerializedError : T extends string ? string : never } errorOrCause
 */
function nestedErrorsToList(errorOrCause) {
  const { name, message = '', cause, stack = '' } = errorOrCause

  if (!message) return []; // case 1: Error object was not passed into function (termination case for recursion)
  if (cause && !(cause instanceof Error)) return [{ message, stack, name, cause }]; // case 2: Error object was passed with a cause, but the cause is not an instance of Error (no further recursion)
  if (!(cause instanceof Error)) return [{ message, stack, name, cause: undefined }]; // case 3: Error object was passed in without a cause(no further recursion)
  return [{ message, stack, name, cause }, ...nestedErrorsToList(cause)]; // case 4 (recursive case): Error object was passed with a cause , and cause must be an Error object (by elimination)
}


 /** nestedErrorsToList_v2
	 * take an instance of an Error object, which could have an embedded error via the 'cause' property, and possibly recursively nested with more,
	 * and converts the nested Error objects to a list, and at the same time, converts them from an Error object to a plain object suitable for
	 * transmission across a worker boundary or serializable for fetch.
	 */
 const nestedErrorsToList_v2 = (errorOrCause) => {
	// make sure this works...
	let name, message, cause, stack
	if (errorOrCause instanceof Error) {
		 ( {name, message='', cause='', stack=''} = errorOrCause )
		 if (cause instanceof Error) {
			 return [ { message, stack, name, cause }, ...nestedErrorsToList(cause) ]
		 }
	}
	// recursion cases:
	if (!message) return []																															// case 1: No error-like object was passed in (done with recursion) - note -this never happens it seems...
	if (message && cause!==null && !(cause instanceof Error )) return [{ message, stack, name, cause }]	// case 2: Error object was passed with a cause, but the cause is not an instance of Error (no further recursion)
	if (!(cause instanceof Error )) return [{ message, stack, name, cause:undefined }]	// case 3: Error object was passed in without a cause(no further recursion)

	return [ { message, stack, name, cause }, ...nestedErrorsToList(cause)]							// case 4 (recursive case): Error object was passed with a cause , and cause must be an Error object (by elimination)
}
 

 

/** stackToList_v8 - parses a V8-style stack trace into an array of objects (see note)
 * 
 * NOTE: THis doesn't work too well - the attempt to parse the many forms of stack trace lines
 * entries is a bit naive using regex (there is sometimes a layer of nesting).
 * This whould use a Parser instance to properly parse, but that's not completed yet.
 * 
 * {
 *   fnName,
 *   context,
 *   row,
 *   col
 * }
 * NOTE: V8 is used by Node, Deno, Chrome, & Edge.  This has not been tested in Safari, Firefox, or Bun
 * 
 * @param {string} stackTrace 
 * @returns {Array<StackTraceEntry>}
 */
const stackToList_v8 = (stackTrace) => {
	// first line is thrown out because it's already capture in .message and .name props of the error. The rest is the real stack trace
	const [firstLine, ...callStackHistory] = stackTrace?.split('\n') ?? []
	// the rest of the stack lines undergo text processing to extract the function names & row/columns
	const stackList = callStackHistory.map( (stackHistoryLine='') => {
		//const cleanedLine = stackHistoryLine.replace(/\s*at\s*/,'')
		const [_at, fnName, detail] = stackHistoryLine.trim().split(/\s+/)
		const [context, row, col] = detail?.replace(/^\(/,'')?.replace(/\)$/, '')?.split(':') ?? []
		return {
			fnName,
			context,
			row,
			col
		}
	})
	return stackList
}


/**  flattenError
 * 
 * @param {Error} error 
 * @returns {{ message:string, errorType:string, cause: }}
 */
const flattenError = (error) => {
	// early exit if not an error
	if ( ! (error instanceof Error) ) {
		console.error(`[flattenError]: the supplied parameter should be a valid instance of Error `)
		return {
			message: `[flattenError]: the supplied parameter should be a valid instance of Error `,
			errorType: `${error?.constructor?.name ?? typeof error}`,
			cause: error?.cause ?? '',
			errorHistory: []
		}
	}

	const [mostRecentError, ...errorHistory ] = nestedErrorToList(error)
	return {
		message: mostRecentError.message,
		errorType: mostRecentError?.name ?? '',		
		cause: mostRecentError?.cause instanceof Error ? `see errorHistory` : error?.cause ?? '',		
		// cause: mostRecentError?.cause ?? '',
		errorHistory: errorHistory.map( ({stack='', ...errorObj}) => ({...errorObj, stackList: stackToList_v8(stack), stack} ) )
	}
}





/** @type { (error:Error) => unknown} */
const serializeErrorToJsonRpcError = (error, id = null) => {
	// Helper function to recursively collect error causes
 
	/** @param {Error } error */
	function collectCauses(error) {
		const causes = []
 
		while (error.cause) {
			causes.push({
				message: error.cause.message,
				name: error.cause.name,
				stack: error.cause.stack
			})
			error = error.cause
		}
 
		return causes
	}
 
	// Construct the JSON-RPC error response
	const jsonRpcError = {
		jsonrpc: '2.0',
		error: {
			code: -32000, // Custom server error code
			message: error.message,
			data: collectCauses(error)
		},
		id: id
	}
 
	return jsonRpcError
}



/** getCaller - get the parent function in the current execution context
 * Use within any function X, and getCaller will get the name of the function that called X
 * This is probably very slow but useful for debugging...
 * 
 * @see https://devimalplanet.com/javascript-how-to-get-the-caller-parent-functions-name
 * @returns string - the name of the function that called current function
 * 
 * Example usage: 
 * 
 *   function child() {
 *     const caller = getCaller();
 *      console.log(caller);
 *    }
 *    
 *   function parent() {
 *    child();
 *   }
 * 
 *   parent(); // console logs 'parent'
 */
function getCaller() {
  try {
    throw new Error();
  } 
	catch (error) {
    // matches this function, the caller and the parent
    const allMatches = error.stack.match(/(\w+)@|at (\w+) \(/g);
    // match parent function name
    const parentMatches = allMatches[2].match(/(\w+)@|at (\w+) \(/);
    // return only name
    return parentMatches[1] || parentMatches[2];
  }
}



export {
	flattenError,
	nestedErrorToList,
	nestedErrorsToList,
}
