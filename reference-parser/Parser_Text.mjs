/********** MODULE-START: Parser *******
 * @module TextParser
 * @version 22-Mar-23
 * @requires Parser
 * 
 * @description A monadic parser combinator library for parsing semi-structured text files
 * and optimized for network automation purposes
 */


/**  *** IMPORTANT NOTE ABOUT TEXT ***
 * 	Note about whitespace: text documents to be parsed should have the whitespace in a well-known format, and should be clean prior
 * 	to parsing. Recommendations:
 * 		1) mixed tabs & spaces adds complexity to parsers that keep track of indentation & column positions (think YAML format).
 * 
 * 		2) Don't assume text from databases / files use only a carriage return.  They would use carriage return + linefeed.  It's best to
 * 			 clean your data before parsing with a function such as:
 * 				 const cleanedText = (text) => text.replaceAll(/\r\n/g,'\n')
 * 	
 */


import {
	// start exporting parsers only as needed and remove unused ones
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
	except,
	not,
	setData,
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
} from './Parser_Core.mjs'


import {
	untilStr,
} from './Parser_FlexParser.mjs'


const digits = regex(/^\d+/)
	.named('digits')
	.mapError(({ error, index, data }) => `[digits] ParseError (at index ${index}): Expecting digits [0-9].  Original Error ${error}`)

const letters = regex(/^[a-zA-Z]+/)
	.named('letters')
	.mapError(({ error, index, data }) => `[letters] ParseError (at index ${index}): Expecting letters [a-z, A-Z].  Original Error ${error}`)

const whitespace = regex(/^[ \t\r\n]+/)
	.mapError(({ error, index, data }) => `[whitespace] ParseError (at index ${index}): Expecting whitespace [ \n\t\r].  Original Error ${error}`)
	.named('whitespace_v2')

const optionalWhitespace = regex(/^[ \t\r\n]*/)
	.mapError(({ error, index, data }) => `[optionalWhitespace] ParseError (at index ${index}): Expecting whitespace [ \n\t\r].  Original Error ${error}`)
	.named('optionalWhitespace')


/** these Parsers to eventually replace the above parsers after testing **/

// common non-whitespace, single-character parsers
const comma							 = strng(',').named('comma')
const star							 = strng('*').named('star')
const dquote						 = strng('"').named('dquote')
const squote						 = strng('"').named('squote')
const dash							 = strng('-').named('dash')
const slash							 = strng('/').named('slash')
const backslash					 = strng('\\').named('backslash')
const lparen						 = strng('(').named('lparen')
const rparen						 = strng(')').named('rparen')
const lbracket					 = strng('[').named('lbracket')
const rbracket					 = strng(']').named('rbracket')
const lcurly						 = strng('{').named('lcurly')
const rcurly						 = strng('}').named('rcurly')
const colon							 = strng(':').named('colon')
const semicolon					 = strng(';').named('semicolon')
const langle_brackets		 = strng('<').named('langle_brackets')
const rangle_brackets		 = strng('>').named('rangle_brackets')

// whitespaces

// these are just string constants for reference - not parsers
const SPACE = '\t'     // aka ASCII hex 0x20, decimal 32, HTML &Space, ASCII canonical name "Space" 
const TAB   = '\t'     // aka ASCII hex 0x09, decimal 9, HTML &Tab, ASCII canonical name "Tab" 
const CR    = '\r'     // aka ASCII hex 0x0D, decimal 13, bash ^M, ASCII canonical name "Carriage Return"
const LF    = '\n'     // aka ASCII hex 0x0A, decimal 10, HTML &NewLine, canonical name "Line Feed"
const CRLF  = '\r\n'   // common combo on Windows/DOS for "new line".  This is why windows text files show up in Linux with "^M" at the end of each line

// specific newline formats
const cr				= regex(/^\r/).named('cr')									// consume one 'carriage return', aka '\r', ASCII 0x0D, decimal 13.  Shows up as ^M in bash / vi / etc
const lf				= regex(/^\n/).named('lf')									// consume one 'Unix newline', aka '\n', ASCII 0x0A, decimal 10.  "Unix style" newline.  Shows up as ^J in Linux (sometimes).  Note: Some languages may write output strings containing '\n' as '\r\n' on Windows
const crlf			= regex(/^\r\n/).named('crlf')							// consume one 'Windows newline', aka 'carriage return/line feed' combo, aka '\r\n'. 

// specific inline space formats
const sp			 	= regex(/^ /).named('sp')										// consume one single space
const tab			 	= regex(/^\t/).named('tab')									// consume one single tab
const sps			 	= regex(/^ +/).named('sps')									// consume one or more consequtive spaces
const tabs			= regex(/^\t+/).named('tabs')								// consume one or more consecutive tabs


// more generalized newline & inline whitespace formats

// consume **definite** whitespaces
const newline		= regex(/^((\r\n)|\r|\n)/).named('newline')	// consume one general purpose 'newline' (works for both Linux and Windows)
const eol				= regex(/^((\r\n)|\r|\n)/).named('eol')			// same as 'newline' above - more for semantics.  Some people think eol is the last character of a line, some think it's the first of a new line.
const newlines	= regex(/^[\r\n]+/).named('newlines')				// consume one or more consequtive newlines (i.e. "skip all blank lines")
const eols			= regex(/^[\r\n]+/).named('eols')						// same as 'newlines' above.  renamed for semantics (see 'eol' above)
const nbsp 			=	regex(/^[ \t]+/).named('nbsp')						// consume one or more spaces and/or tabs
const brksp			= regex(/^\s+/).named('brksp')							// consume one or more spaces of any type

// consume **possible** whitespaces
const _					= regex(/^[ \t]*/).named(`'_'`)							// consume all *inline* whitepace (tabs & spaces only)
const __				= regex(/^[ \n\r\t]*/).named(`'__'`)				// consume all whitespace if it's there (including newlines)


// non-whitespace (word) patterns
const hword = regex(/^[A-Za-z0-9_-]+/).named('hword')		// hyphenated word - letters, numbers, hyphens, underscores
const word = regex(/^[A-Za-z]+/).named('word')							// common letters - can effectively replace the 'letters' parser
const any = regex(/^\S+/).named('any')											// any group of non-space characters, aka a wildcard toke
const alphaNumeric = regex(/^[A-Za-z0-9]+/).named('alphaNumeric')				// letters and numbers

// supply this with additional symbols to build your own tokenizer
const alphaNumericWithSymbols = (characters) => many(choice([regex(/^[A-Za-z0-9]+/), anyOf_charset(characters)])).named(`alphaNumericWithSymbols('${characters}')`)

// parse values "between" delimiters...
// between is curried - each of these expects an additional parser argument...
const btw_parens 				= between (lparen) (rparen)			//.named('btw_parens')// (parse_me)
const btw_brackets 			= between (lbracket) (rbracket)	//.named('btw_brackets')// [parse_me]
const btw_curlies 			= between (lcurly) (rcurly)			//.named('btw_curlies')// {parse_me}
const btw_squotes 			= between (squote) (squote)			//.named('btw_squotes')// 'parse_me'
const btw_dquotes 			= between (dquote) (dquote)			//.named('btw_dquotes')// "parse_me"
const btw_angleBrackets = between (langle_brackets) (rangle_brackets)	//.named('btw_angleBrackets')// <parse_me>

// number formats
const float = sequenceOf([
	possibly(char('-')),
	digits,
	strng('.'),
	digits,
]).map((result) => result.join(''))
	.named('float')
	.mapError( ({error,index,data})=>`[float] index ${index}. Underlying error message: ${error}`)

// floating point exponential text
const exponential = sequenceOf([
	float,
	sequenceOf([
		char('e'),
		choice([char('+'), char('-')]),
		digits
	]),
]).map((result) => result.join(''))
	.named('exponential')
	.mapError( ({error,index,data})=>`[exponential] index ${index}. Underlying error message: ${error}`)


const hexDigits = regex(/^[A-Fa-f0-9]+/)
	.named(`hexDigits`)
	.mapError( ({error,index,data})=>`[hextDigits] index ${index}. Text at index are not hex digits. Underlying error message: ${error}`)



// const restOfLine = everythingUntil(eol).map((result) => result.trim())   // consume all characters until the end of line, don't advance into next line
// const restOfLine = rol


// alternate restOfLine (faster - avoids 'everythingUntil' inside parseLine & other functions)
// NOTE: consumes no eol character - responsibility of another parser
const rol = new Parser ( function rol$(state) {
	const pname = `rol`
	if (state.isError) return state
	const {target, index} = state
	if (index >= target.length) {
		return Parser.updateError(state, `[${pname}]: at end of input`, pname)
	}
	const remainingText = target.slice(index)
	const regexp_rol = /(.*)(\r\n|\n|\r)/    // finds entire rest of line in [0], and everything until end of line in [1]
	const regexMatch = remainingText.match(regexp_rol) ?? null
	if (regexMatch !== null) {
		const result = regexMatch[1]
		const nextIndex = index + result.length
		return Parser.updateParserState(state, result, nextIndex, pname)
	}
	// if we're here, there are not more end of lines, just return rest of input
	return Parser.updateParserState(state, remainingText, index + remainingText.length, pname)
}, 'rol' )


// matches a number (any length), but executes a user-supplied validation function to the found result
const integerWith = (validationFn) => {
	const pname = `integerWith(${validationFn?.name??validationFn})`
	return new Parser((state) => {
		const { target, index } = state
		const integerRegEx = /^\d+/
		const integerMatch = target.slice(index).match(integerRegEx)
		if (!integerMatch) {
			return Parser.updateError(state, `[integerWith]: ParseError at index ${index}: Not a valid integer.\nRemaining string:\n ${target.slice(index)}`, pname)
		}
		const integerString = integerMatch[0]
		const integer = parseInt(integerString)
		if (validationFn(integer) === false) {
			return Parser.updateError(state, `[integerWith]: ParseError at index ${index}: integer ${integerString} did not pass validation function [${validationFn.toString()}].\nRemaining string:\n ${target.slice(index)}`, pname)
		}
		const foundAt = integerMatch.index
		const foundLen = integerString.length
		const newIndex = index + foundAt + foundLen

		return Parser.updateParserState(state, integerString, newIndex)
	}).named(pname)
}


// Positional booleans
const currentPosition = succeedWith(null)					// used for 'between' when starting with current position - i.e - between (currentPosition) (strng('!')) 

const at_startOfLine = lookBehind(1, eol).named('at_startOfLine')	// succeed if cursor is at the start of a new line - will not advance
	.mapError( ({error,index,data}) => `[at_startOfLine]: not at start of line`)

const at_endOfLine = lookAhead(eol)											// succeed if cursor is at the end of the line - will not advance
	.mapError( ({error,index,data}) => `[at_endOfLine]: not at end of line`)

// same as at_endOfLine - just shorter
const at_eol = lookAhead(eol).map(()=>true)											// succeed if cursor is at the end of the line - will not advance
	.mapError( ({error,index,data}) => `[at_eol]: not at end of line`)


// use these in map() calls right after the section parser to return the result, and not the skipped over parts
const ignoreSkipped = (result) => result.result
const logSkipped = (tagName) => (result) => console.warn(`[skipped text]: ${result.skipped}`)



// may replace untilDelimiterString for end of line
const skip_restOfLine = new Parser( (state) => {
	const pname = `skip_restOfline`
	if (state.isError) return state

	const { target, index } = state
	if (target.length === index) return state 		// if we're already at end of input

	const endOfLineFoundAt = target.slice(index).indexOf('\n')
	const nextIndex = (endOfLineFoundAt == -1)
		? target.length
		: index + endOfLineFoundAt + 1

	return Parser.updateIndex(state, nextIndex, `skip_restOfline`)
}).named(`skip_restOfLine`)



// may replace untilDelimiterString for end of line
const get_restOfLine = new Parser( (state) => {
	const pname = 'get_restOfLine'
	if (state.isError) return state
	const { target, index } = state
	if (target.length == index) return state

	const endOfLineFoundAt = target.slice(index).indexOf('\n')
	const nextIndex = (endOfLineFoundAt == -1)
		? target.length
		: index + endOfLineFoundAt

	const restOfLine = target.slice(index, nextIndex).trimRight()
	return Parser.updateParserState(state, restOfLine, nextIndex, `get_restOfLine`)
}).named(`get_restOfline`)



//const where_am_i_rc = getRowCol.mapData({data})=>console.warn(`where_am_i_rd`, data)).named('wai_rc')
// const where = getIndex.mapData( ({result,data})=>console.warn(`[where]: at index ${data}`)).named('where')




// (string-optimized) - move cursor to line starting with supplied string
//	returns: null if successful, error if past end of input
// const gotoLine = (str) => seqOf(untilStr('\n' + str), '\n')




// move cursor to the column within the current line.  Will not be able to advance out of the line.
// Negative indexing is allowed to start from end.
const colRange = (_colStart, _colEnd) => {
	const pname = `colRange(${_colStart},${_colEnd})`
	return new Parser( function colRange$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ``
		const { target, index } = state

		const rowRecord = Parser.getRowRecord(target, index)
		const maxColumn = rowRecord.lineLength + 1
		
		const colEnd = (_colEnd > maxColumn) ? maxColumn : _colEnd
		const result = target.slice(index, rowRecord.index + colEnd - 1)
		return Parser.updateParserState(state, result, rowRecord.index + colEnd - 1, pname )
	}).named(pname)
}


// regex_bksp is wrong.  It's used by parseLine1.  Remove when we can eliminate parseLine1.
const re_bksp = /^\s*/											// possibly a sequence of breaking or non-breaking space
const regex_bksp = possibly(regex(re_bksp)) // is the 'possibly' necessary?

const parseLine1 = (...list_of_parsers_or_strings) => sequenceOf([
	...list_of_parsers_or_strings.flat().map((p) => tok(p)),		// for every 'stringsAndParsers' supplied, add a tok parser (non-breaking space)
	everythingUntil(eol),
	regex_bksp	// breaking space
]).map((result) => result.slice(0, -2)).named('parwseLine1')  // return everything except the last two items


const parseLine2 = (...list_of_parsers_or_strings) => sequenceOf([
	...list_of_parsers_or_strings.flat().map((p) => tok(p)),
	untilStr('\n'),
	regex_bksp
]).map((result) => result.slice(0, -2))


const parseLine3 = (...list_of_parsers_or_strings) => sequenceOf([
	...list_of_parsers_or_strings.flat().map((p) => tok(p)),
	regex(/^.*[\n]+/),
]).map((result) => result[1])


// this one works by fixing flaws in parseLine1 (accounting for the last line having endOfInput, and not skipping past anywhitespace line to line)
const parseLine4 = (...list_of_parsers_or_strings) => {
	return sequenceOf([
		...list_of_parsers_or_strings.flat().map((p) => tok(p)),		// for every 'stringsAndParsers' supplied, add a tok parser (non-breaking space)
		untilStr('\n'),
	]).map((result) => result.slice(0, -1)).named('parseLine')  // return everything except the last item
}


const parseLine = (...list_of_parsers_or_strings) => {
	const parsers = list_of_parsers_or_strings.flat().map( (parser) => {
		if (parser?.constructor?.name === 'String') return tok(strng(parser))
		if (parser?.constructor?.name === 'RegExp') return tok(regex(parser))
		return tok(parser)
	})

	const pname =  `parseLine()`
	const pnameLong =  `parseLine(${parsers.join(', ')})`

	return sequenceOf(...parsers, skip_restOfLine ).named(pname)
		.map((result) => result.slice(0, -1)) 	// return everything except the last item
		.mapError( ({error,index,data}) => {
			return `[parseLine]: Error at index ${index}.  Underlying error message: ${error}`
		})
}


/*******************************************************************
/***** Table Parser Example                                     ****
/*******************************************************************/

/*

// const  { ipNetwork } = await import('./Parser_Network.mjs')

////////////////////////////////////////////////////////////////
// individual column data parsers
//
const col_intName = tok(interfaceName)
const col_ipNetwork = oneOf(ipNetwork, 'unassigned')
const col_intStatus = oneOf( 'up', 'admin down', 'down' ) 
const col_protStatus = oneOf('up', 'down', 'lowerlayerdown', 'notpresent' ) 
const col_intMTU = digits



const arista_show_ip_int_brief_tableDef = [
	{ headerString: 'Interface', 	colParser: col_intName,		tagAs: 'Interface'},
	{ headerString: 'IP Address', colParser: col_ipNetwork,	tagAs: 'ipAddr'		},
	{ headerString: 'Status', 		colParser: col_intStatus,	tagAs: 'Status' 	},
	{ headerString: 'Protocol', 	colParser: col_protStatus,tagAs: 'Protocol'	},
	{ headerString: 'MTU', 				colParser: col_intMTU 	                    },
]




////////////////////////////////////////////////////////////////
// table-building routines  (should not have to modify)
//

// takes table def array and returns a parser that parses each item in tableDef inside a [sequenceOf] parser
const lineOfData = (tableDef) => parseLine(
	...tableDef.map((column)=>column.colParser.tagAs(column.tagAs)),
).getTagged()



// parses table header
const headerRecord = (tableDef) => seqOf(
	tableDef.map( (column) => tok(column.headerString).tagAs(column.tagAs))
).getTagged()


// many rows
const tableData = (tableDef) => seqOf(
	goto(lineOfData(tableDef)),
	many(lineOfData(tableDef)),
).map( (result)=>result[1] )

// main table parsing routine
const parseTable = (tableDef) => seqOf(
	goto(headerRecord(tableDef)),
	headerRecord(tableDef),
	tableData (tableDef).tagAs('dataSet'),
).getTaggedR()
	.map((result)=>[...result.dataSet])



*/

/*******************************************************************
/****** Parsers likely to be tossed...  ****************************
/*******************************************************************/

// get next token
//	const reWord = /(?<=^|\s)[\S]+(?=\s)/
//	const nextWord = nextRegx(reWord)
//	const nextline = nextRegx(/[\n\r]/)


//from current position, match everything upto, but not including, all the remaining whitespace on the line
const regx_restOfLine_no_trailing_whitespace = /^.*[^\s](?=[\s]*$)/
const regx_restOfLine_only_possible_trailing_whitespace = /^[\s]*$/



/*******************************************************************
/****** Utility Parsers ********************************************
/*******************************************************************/


// csv Parser
const joinedMany = (parser) => many(parser).map((x) => x.join(''))
const cell = joinedMany(anythingExcept(regex(/^[,\n]/)))
const cells = sepBy(char(','))(tok(cell))
const csvParser = sepBy(char('\n'))(cells)


// start exporting parsers only as needed and remove unused ones
export {
	// basics
	digits,
	letters,
	whitespace,
	optionalWhitespace,

	// common single-character parsers
	comma,
	star,
	dquote,
	squote,
	dash,
	slash,
	backslash,
	lparen,
	rparen,
	lbracket,
	rbracket,
	lcurly,
	rcurly,
	colon,
	semicolon,
	langle_brackets,
	rangle_brackets,

	// newlines
	crlf,
	lf,
	cr,

	// inline spaces
	sp,
	tab,
	sps,
	tabs,

	// generalized/more flexible whitespace formats
	newline,	// consume one general purpose 'newline' (works for both Linux and Windows)
	eol,			// same as 'newline' above - more for semantics.  Some people think eol is the last character of a line, some think it's the first of a new line.
	newlines,	// consume one or more consequtive newlines (i.e. "skip all blank lines")
	eols,			// same as 'newlines' above.  renamed for semantics (see 'eol' above)
	brksp,		// consume one or more spaces of any type
	nbsp,			// consume one or more spaces and/or tabs

	// *possible* consequtive whitespace
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// non-whitespace (word) patterns
	hword,
	word,
	any,
	alphaNumeric,
	alphaNumericWithSymbols,		// supply your own set of special characters as a string parameter

	// parse values "between" delimiters...
	// curried - take a single parser as the argument to parse what's between
	btw_parens,
	btw_brackets,
	btw_curlies,
	btw_angleBrackets,
	btw_squotes,
	btw_dquotes,

	// numerical
	float,
	exponential,
	hexDigits,

	rol,						// consumes rest of line (but not including the end of line)
	integerWith, 		// validator - takes a number predicate (number -> boolean) as a parameter.  Will convert string to number

	// relative position "predicates" (do not consume but succeed with null if true, or fail if not
	currentPosition,
	at_startOfLine,
	at_eol,

	// section parser helpers
	ignoreSkipped,
	logSkipped,

	// parser/subparser
	skip_restOfLine,			// may replace untilDelimiterString for end of line
	get_restOfLine, 			// may replace untilDelimiterString for end of line

	// line parsers
	parseLine,
}




