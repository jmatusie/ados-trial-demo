const isVerbose = false


import {
	Parser, lookAhead, everythingUntil, sequenceOf, seqOf
} from './Parser_Core.mjs'


// getIndex : adds current index to data
const getIndex = new Parser((state) => Parser.updateData(state, state.index, 'index', 'getIndex'))


// getRow : adds the current line number to data based on the current index
const getRow = new Parser((state) => Parser.updateData(state, Parser.getRowAndCol(state.target, state.index).row, 'row', 'getRow'))


// getCol : adds the current line number to data based on the current index
const getCol = new Parser((state) => Parser.updateData(state, Parser.getRowAndCol(state.target, state.index).col, 'col', 'getCol'))


// getRowAndCol : adds an object to data {row, col} based on the current index
const getRowAndCol = new Parser((state) => Parser.updateData(state, Parser.getRowAndCol(state.target, state.index), 'rowCol', 'getRowAndCol'))


// getIndentation : adds the indentation object information of the current row  & stores as data named 'indentation'
const getIndentationData = new Parser((state) => Parser.updateData(state, Parser.getIndentationRange (state.target, state.index), 'indentation', 'getIndentationData'))

// getIndentation : adds the indentation object information of the current row  & stores as data named 'indentation'
// this is the older name
const getIndentation = new Parser((state) => Parser.updateData(state, Parser.getIndentationRange (state.target, state.index), 'indentation', 'getIndentation'), 'getIndentation')


// getPositionData : adds row/col and indentation level of the current index
const getPosition =  new Parser((state) => Parser.updateData(state, Parser.getPositionData(state.target, state.index), 'position', 'getPositionData')).named('getPosition')

// getPositionData : adds row/col and indentation level of the current index
const getPosition_asResult =  new Parser((state) => Parser.updateResult(state, Parser.getPositionData(state.target, state.index), 'getPosition_asResult') )
	

/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////

// "goto"-type parsers - various parsers used to jump to a string / pattern / index / indentLevel / or another parser, without returning a result 
//   result: none
//   index:  from start of pattern or pParser
//   tmp:    none
//   error:  message when string / pattern / patternParser not found
//
// Use cases: 
//	1) first parser in a sequence-type parser for the purpose of fixing the cursor on what you're about to parse
// 	2) a termination parser used as the first parameter of the 'until' parser
//
// Note:  strng and regex patterns allowed for efficiencies (uses language's own search capabilities)


/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////



/** gotoStr( stringToFind: string ) 
 * error:  string not found
 */ 
function gotoStr(str) {
	const pname = `gotoStr('${str}')`
	if (typeof (str) !== 'string' && str.constructor.name != 'String') throw new TypeError(`${pname} must be called with a string or String object`)

	return new Parser(function gotoStr$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ''

		const foundAt = state.target.indexOf( str, state.index )			/// the 'index' parameter finds the absolute position of str within the target, starting from the index
		if (foundAt == -1) return Parser.updateError(
			state, 
			`[${pname}]: ParseError (at index ${state.index}): No match found for supplied string '${str}'.`, 
			pname
		)
		return Parser.updateIndex(state, foundAt, pname)
	}).named(pname).setAsPositionalParser(true)
}


/** gotoRegExp( pattern: stringPattern or RegExp ) 
 * error:  if pattern not found at all
 */
function gotoRegExp (pattern) {
	const pname = `gotoRegExp(${pattern})`
	if (pattern.constructor.name !== 'RegExp' && pattern.constructor.name !== 'String')
		throw new TypeError(`[${pname}] must be called with a RegExp object or string-based pattern, but got ${pattern?.constructor?.name ?? pattern}`)

	return new Parser( function gotoRegExp$(state) {
		if (state.isError) return state
		const lastParser = state?.pname || ''

		const regexMatch = state.target.slice(state.index).match(pattern) ?? false
		if (regexMatch == false) return Parser.updateError(
			state, 
			`[${pname}] ParseError (at index ${state.index}): did not find supplied pattern '${pattern}'`, 
			pname
		)
		return Parser.updateIndex(state, state.index + regexMatch.index, pname)
	}).named(pname).setAsPositionalParser(true)
}

// gotoIndex - simple parser to advance the cursor to absolute position & but adds no results.  
// 	Keeps index in-bounds between 0 and target length in case absolutePosition is out of bounds
const gotoIndex = (absolutePosition) => new Parser(function gotoIndex(state) {
	return Parser.updateIndex( state,	(absolutePosition > state.target.length) ? state.target.length
		: (absolutePosition < 0) ? 0
		: absolutePosition,
	`gotoIndex(${absolutePosition})`)
})



/** goto( gotoParser:Parser ) 
 * Behavior: searches text for the first match of the supplied pattern (which can be a string, RegExp, or parser),
 *   then moves the cursor to the start of the pattern, without returning a result.
 * Input: gotoParser: string, RegExp, or Parser.
 *   RegExp & string is most efficient as it uses the languanges native string search capabilities as opposed to combinators
 *   If a Parser is supplied, the Parser is run, but only the parser's index is used to advance the cursor, the result is thrown out
 *   
 * Output:
 *   result: none
 *   error:  upon failure to find match
 * 
 */ 
function goto(gotoPattern) {
	const paramName = (gotoPattern?.constructor?.name === 'Parser') ? gotoPattern.p.pname  
		: (gotoPattern?.constructor?.name === 'String') ? `'${gotoPattern}'`
		: gotoPattern

	const pname = `goto(${paramName})`

	const gotoParserOptimized = 
		(gotoPattern?.constructor?.name === 'String') ? 	gotoStr(gotoPattern).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (gotoPattern?.constructor?.name === 'RegExp') ?	gotoRegExp(gotoPattern).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (gotoPattern?.constructor?.name === 'Parser') ? (gotoPattern.isPositionalParser()) ?     // /** Positional Parser optimization case */
			gotoPattern.mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
			:	everythingUntil(gotoPattern).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)		/** Non-positional parser default case - uses very slow everythingUntil parser instead */
		: null
		

	if (gotoParserOptimized === null) throw new Error(`[${pname}]: supplied parser is not a string, RegExp, nor Parser object`)

	return new Parser( function goto$(state) {
		if (state.isError) return state

		// advance to the the supplied gotoParser (optimizing for strings if the supplied termination parser is a string):
		const gotoParserState = gotoParserOptimized.p(state)
		if (gotoParserState.isError) return Parser.updateError(state, gotoParserState.error, pname)
		return Parser.updateIndex(gotoParserState, gotoParserState.index, pname)
	}).named(pname).setAsPositionalParser(true)
}




const gotoRow = (rowNumber) => {
	const pname = `gotoRow(${rowNumber})`
	// since row is an array index, convert the user-suplied row (1-based) to a zero-based number
	// also, account for negative indexint (counting backwards)
	const rowMetaDataIndex = (rowNumber <= 0) ? rowNumber : rowNumber - 1  	
	return new Parser( function gotoRow(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ``
		const rowMetaData = Parser.getRowStructure(state.target)
		const numRows = rowMetaData.length
		const indexAtRow = rowMetaData.at(rowMetaDataIndex)?.rowStartIndex		// uses .at() to handle negative numbers, allowing indexing from the end

		if (indexAtRow==null) return Parser.updateError(
			state, 
			`[gotoRow]: supplied linenumber (${Number.parseInt(rowNumber)}) exeeds the number of rows (${numRows})`, 
			pname
		)
		return Parser.updateIndex(state, indexAtRow, pname)
	}).setAsPositionalParser(true)
}


const gotoCol = (colNumber) => {
	const pname = `gotoCol(${colNumber})`
	return new Parser( function gotoCol$(state) {
		if (state.isError) return state
		const {index, target} = state
		const rowData = Parser.getRowRecord(target, index)
		const baseIndex = rowData.rowStartIndex
		const lastIndex = baseIndex + rowData.rowLength
		// bounds checking for normal columns
		if (colNumber >= 0) {
			if ( colNumber  > rowData.rowLength) {
				return Parser.updateError(state, `[${pname}]: supplied column number is out of bounds.  The current row has a length of ${rowData.rowLength}`, pname)
			}
		}
		// bounds checking for negative columns
		if (colNumber < 0) {
			if ( -1 * colNumber  > rowData.rowLength) {
				return Parser.updateError(state, `[${pname}]: supplied negative column number is out of bounds.  The current row has a length of ${rowData.rowLength}`, pname)
			}
		}
		// the adjusted index allows for negative colunm numbering to go backwards, but will not go outside the current line
		const adjustedIndex = (colNumber < 0) ? lastIndex + colNumber - 1 : baseIndex + colNumber - 1  // subtract 1 to account for zero-based offset of parser index

		if (adjustedIndex < baseIndex || adjustedIndex > lastIndex ) 
			return Parser.updateError(state, `[${pname}]: supplied column number is out of bounds`, pname)
		
		return Parser.updateIndex(state, adjustedIndex, pname)
	}).named(pname).setAsPositionalParser(true)
}


const gotoRowCol = (rowNumber, colNumber) => {
	const pname = `gotoRowCol(${rowNumber}, ${colNumber})`

	// for rowMetaDataIndex, refer to gotoRow implementation
	const rowMetaDataIndex = (rowNumber <= 0) ? rowNumber : rowNumber - 1  	

	return new Parser( function gotoRowCol$(state) {
		if (state.isError) return state
		const {index, target} = state

		const rowMetaData = Parser.getRowStructure(state.target)
		const numRows = rowMetaData.length

		const rowData = rowMetaData.at(rowMetaDataIndex)
		const baseIndex = (rowNumber > numRows) ? null : rowData.rowStartIndex
		if (baseIndex === null) return Parser.updateError(state, `[${pname}]: supplied row number is out of bounds`, pname)

		const indexWithColumn = (colNumber > rowData.rowLength) ?  null  : baseIndex + colNumber - 1	// subtract 1 to account for zero-based offset of parser index
		if (indexWithColumn === null) return Parser.updateError(state, `[${pname}]: supplied column number is out of bounds`, pname)

		return Parser.updateIndex(state, indexWithColumn, pname)
	}).named(pname).setAsPositionalParser(true)
}



//const gotoEndOfIndentLevel = new Parser( function gotoEndOfIndentLevel$(state) {
//	const pname = `gotoEndOfIndentLevel`
//	if (state.isError) return state
//	const { index, target } = state
//	if (index >= target.length) return Parser.updateError(state, `[${pname}]: reached end of input`, pname)
//	// get current row/indent information as well as next row with same or lesser indent from metadata, based on current cursor location
//	const [ currentRowData, nextIndentedSection=null ] = Parser.getIndentationRange(target, index)
//	const endOfIndentLevelIndex = nextIndentedSection?.rowStartIndex ?? target.length
//	return Parser.updateIndex(
//		state,
//		endOfIndentLevelIndex,
//		pname,
//	)
//}).named(`gotoEndOfIndentLevel`)


//const endOfIndentLevel = gotoEndOfIndentLevel.named('endOfIndentLevel')

// utility parser - indented to supply as a termination parser into 'until'
const endOfIndentLevel_old2 = new Parser(function endOfIndentLevel$(state) {
	const pname = 'endOfIndentLevel'
	if (state.isError) return state
	const { index, target } = state
	if (index >= target.length) return Parser.updateError(state, `[${pname}]: reached end of input`, pname)
	const [ currentRowData, nextIndentedSection=null ] = Parser.getIndentationRange(target, index)
	const endOfIndentLevelIndex = nextIndentedSection?.rowStartIndex ?? target.length

	return Parser.updateData(Parser.updateIndex(state, endOfIndentLevelIndex, pname), {currentRowData, nextIndentedSection}, `Parser_getIndentationRange(target, index(${index}))`, pname )
}).named('endOfIndentLevel')


const endOfIndentLevel_old = new Parser(function endOfIndentLevel$(state) {
	const pname = 'endOfIndentLevel'
	if (state.isError) return state
	const { index, target } = state
	if (target.length === index) return Parser.updateError(state, `[${pname}]: reached end of input`, pname)
	const [ currentRowData, nextIndentedSection=null ] = Parser.getIndentationRange(target, index)
	const endOfIndentLevelIndex = nextIndentedSection?.rowStartIndex ?? target.length
	return Parser.updateIndex(state, endOfIndentLevelIndex, pname)
}).named('endOfIndentLevel')


const endOfIndentLevel = new Parser(function endOfIndentLevel$(state) {
	const pname = 'endOfIndentLevel'
	if (state.isError) return state
	const { index, target } = state
	if (index >= target.length) return Parser.updateError(state, `[${pname}]: reached end of input`, pname)
	const [ currentRowData, nextIndentedSection=null ] = Parser.searchIndentationRange(target, index, (findIndentLevel, currentIndentLevel) => findIndentLevel <= currentIndentLevel )

	if (nextIndentedSection == null) {
		const {indentChar='unk', indentCount=-99,row=-99} = currentRowData
		return Parser.updateError(state, `[${pname}]: (at index ${index}/row:${row}/current indent level:${indentCount}): No further indented levels found with an indentation less than or equal to that of the current row`, pname)
	}

	const endOfIndentLevelIndex = nextIndentedSection?.rowStartIndex ?? target.length

	return Parser.updateIndex(state, endOfIndentLevelIndex, pname)
}).named('endOfIndentLevel').setAsPositionalParser(true)



// changeOfIndentLevel
// utility parser - indented to supply as a termination parser into 'until'
// Like endOfIndentLevel, but whwereas endOfIndentLevel stops only the start of a line with and indent level less than or equal to,
// changeOfIndentLevel will stop at the next line that has an indent level of less then, or greater than,
// but will keep going past all lines in the same indent level
const changeOfIndentLevel = new Parser(function changeOfIndentLevel$(state) {
	const pname = 'changeOfIndentLevel'
	if (state.isError) return state
	const { index, target } = state

	if (index >= target.length) return Parser.updateError(state, `[${pname}]: reached end of input`, pname)
	const [ currentRowData, nextIndentedSection=null ] = Parser.searchIndentationRange(target, index, (findIndentLevel, currentIndentLevel) => findIndentLevel !== currentIndentLevel )
	if (nextIndentedSection == null) {
		const {indentChar='unk', indentCount=-99,row=-99} = currentRowData
		return Parser.updateError(state, `[${pname}]: (at index ${index}/row:${row}/current indent level:${indentCount}): No further indented levels found with an indentation level differing form the that of the current row`, pname)
	}

	const endOfIndentLevelIndex = nextIndentedSection?.rowStartIndex ?? target.length

	return Parser.updateIndex(state, endOfIndentLevelIndex, pname)
}).named('changeOfIndentLevel').setAsPositionalParser(true)



// indentLevelWhere(user-supplied comparater fn of the form (currentLevel, findLevel) => boolean )
// like changeOfIndentLevel, but with user-supplied comparison function to compare two numbers (currentIndentLevel, nextIndentLevel)
// utility parser - indented to supply as a termination parser into 'until'
//
// example usage: until(indentLevelWhere( (findLevel, currentLevel) => findLevel == (currentLevel+2)  )
// This example will advance the cursor until it finds a level that is 2 more than the current level
const indentLevelWhere = (indentComparisonFn) => new Parser(function indentLevelWhere$(state) {
	const pname = `indentLevelWhere(${indentComparisonFn})`
	if (state.isError) return state
	const { index, target } = state
	if (index >= target.length) return Parser.updateError(state, `[${pname}]: already at end of input`, pname)
	const [ currentRowData, nextIndentedSection=null ] = Parser.searchIndentationRange(target, index, indentComparisonFn )
	if (nextIndentedSection == null) {
		const {indentChar='unk', indentCount=-99,row=-99} = currentRowData
		return Parser.updateError(state, `[${pname}]: (at index ${index}/row:${row}/current indent level:${indentCount}): No further indented levels found with indentation criteria matching the supplied function`, pname)
	}
	const endOfIndentLevelIndex = nextIndentedSection?.rowStartIndex ?? target.length

	return Parser.updateIndex(state, endOfIndentLevelIndex, pname)
}).named(`indentLevelWhere(supplied_indentComparisonFn)`).setAsPositionalParser(true)



/** A note about the { data } (or maybe renamed to { tmpData }) property
 * 
 * When using any parser (let's call it 'someparser') that writes to tmpData, there are several utility functions that can help you do something with it
 *  - someparser.mapData(console.log)
 *  - someparser.map_fromData(toDataLog)
 *  - someparser.map_fromData(toResult)
 * (can be written to a console, written to dataLog, or added to result) 
 *     with someparser.mapData(data=>...) or someparser.map_fromData({	result,	data }=>...) methods
 * 
 * 
 */



// until (tParser, sParser) => run sParser from (current - tParser)
//   result: from sParser
//   index:  from tParser
//   tmp:    {sectionText, missedText}
//   error:  from tParser or sParser
// use case: bounded parser for searching

/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////


/** untilStr(terminationString:string, substringParser:Parser) 
 * 
 * Description: 
 *   Collect all text from the current position (the returned text is the 'substring')
 *   Run the substringParser parser against the substring & return the results
 * 
 * Succeeds on the following conditions:
 *   1. the terminationString is found
 *   2. the substring is not an empty string
 *   3. the substringParser does not fail when run against the substring
 *   Otherwise, returns Parser with isError=true with error message
 * 
 * Behavior (upon success):
 *   result: the results of the substringParser
 *   tmp:    substring  
 *   cursor: advances to 
 * 
 * Notes: 
 *   1. the entire substring does not need to be parsed.  However, there is risk of missing text, so save the substring (returned in tmp)
  */ 
 
 /** @type {(terminationString: string, substringParser:Parser|null) => Parser} */
function untilStr(terminationString, substringParser=null) {
	const pname = `untilStr('${terminationString}',${substringParser?.p?.pname ?? ''})`

	if (!(typeof (terminationString) == 'string' || terminationString.constructor.name == 'String'))
		throw new TypeError(`[untilStr] must be called with a string or String object.}`)

	return new Parser(function untilStr$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ''

		const { target, index } = state
		if (terminationString.length === 0) return Parser.updateError(
			state,
			`[${pname}]: ParseError (at index ${index}): String size cannot be zero\n\n}\nRemaining string:\n ${target.slice(index, index+30)}...(+${target.length-index} more chars)`, 
			pname
		)

		const foundAt = target.slice(index).indexOf(terminationString)			/// relative position of found string to current index
		if (foundAt === -1) {
			return Parser.updateError(
				state, 
				`[${pname}]: ParseError (at index ${index}): No match found for supplied string.\nRemaining string:\n ${target.slice(index, index+30)}...(+${target.length-index} more chars)`, 
				pname
			)
		}
		const newIndex = index + foundAt										// calculate new absolute position: current position + relative position
		const substringToParse = target.slice(index, newIndex)				// return all text between current position and new position

		// handle empty substringParser, which is optional

		if ( substringParser === null) return Parser.updateParserState(state, substringToParse, newIndex, pname)
		
		const substringParserState = substringParser.run(substringToParse)
		const substringLength = substringToParse.length
		const substringParserIndex = substringParserState.index


		if (substringParserState.isError) {
			return Parser.updateError(
				state,
				`[${pname}]: ParseError from substringParser '${substringParser}': ${substringParserState.error}.`,
				pname
			)
		}

		return Parser.updateParserState(
			Parser.updateDataLog(state, substringParserState.dataLog), 
			substringParserState.result, 
			newIndex, 
			pname,
		)
	}).named(pname)
}



// an optimized form of 'everythingUntil', using a string instead of a parser - much faster if you know the exact string
// Note that unlike the 'regex' parser, the pattern is not anchored with a '^', to allow for searching to actually happen
/** @type {(pattern: RegExp, substringParser:Parser|null) => Parser} */
function untilRegExp(pattern, substringParser=null) {
	const pname = `untilRegExp('${pattern}',${substringParser?.p?.pname ?? ''})`

	if (pattern.constructor.name !== 'RegExp' && pattern.constructor.name !== 'String') throw new TypeError(`${pname} must be a string or RegExp object}`)
	if (`${pattern}`[1] == '^') throw new Error(`[${pname}]: Anchoring the supplied pattern with a with '^' defeats the 'lookahead' nature of this parser.`)

	return new Parser(function untilRegExp$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ''
		const { target, index } = state

		const remainingText = target.slice(index)

		if (remainingText.length == 0) return Parser.updateError(
			state, 
			`[${pname}]: ParseError (at index ${index}): *2* Expecting text matching '${pattern}', but got end of input.`,
			pname,
		)

		const regexMatch = remainingText.match(pattern) ?? false	
		
		if (!regexMatch) return Parser.updateError(
			state, 
			`[${pname}]: ParseError (at index ${index}): No match found inside pattern '${pattern.toString()}' for the entire remaining string`, 
			pname
		)

		const foundAt = index + regexMatch.index								// calculate new absolute position: current position + relative position
		const substringToParse = target.slice(index, foundAt)				// return all text between current position and new position

		// handle empty substringParser, which is optional
		if ( substringParser === null) return Parser.updateParserState(state, substringToParse, foundAt, pname)

		const substringParserState = substringParser.run(substringToParse)
		const substringLength = substringToParse.length
		const substringParserIndex = substringParserState.index

		if (substringParserState.isError) {
			return Parser.updateError(
				state,
				`[${pname}]: ParseError from substringParser '${substringParser}': ${substringParserState.error}.`,
				pname
			)
		}

		return Parser.updateParserState(
			Parser.updateDataLog(state, substringParserState.dataLog),		// this gets the dataLog from the substring parser into the main parsers state
			substringParserState.result, 
			foundAt, 
			pname,
		)
	}).named(pname)
}



function untilEndOfIndentLevel(substringParser) {
	const pname = `untilEndOfIndentLevel(${substringParser})`
	return new Parser(function untilEndOfIndentLevel$(state) {
		if (state.isError) return state
		const { index, target } = state
		if (target.length === index) return Parser.updateError(state, `[${pname}]: reached end of input`, pname)

		const [ currentRowData, nextIndentedSection=null ] = Parser.getIndentationRange(target, index)
		const endOfIndentLevelIndex = nextIndentedSection?.rowStartIndex ?? target.length

		// now that we found the end, run the substring parser on the text. 
		const substringToParse = target.slice(index, endOfIndentLevelIndex)

		const substringParserState = substringParser.run(substringToParse, state)
		const substringLength = substringToParse.length
		const substringParserIndex = substringParserState.index

		if (substringParserState.isError) {
			return Parser.updateError(
				state,
				`[${pname}]: Parse Error (index ${state.index+substringParserState.index}) from supplied substringParser : '${substringParserState.error}'`,
				pname,
			)
		}
		return Parser.updateParserState(
			Parser.updateDataLog(state, substringParserState.dataLog), 
			substringParserState.result, 
			endOfIndentLevelIndex, 
			pname, 
		)
	}).named(pname).setAsPositionalParser(true)
}



/** 
 * until (terminationParser, subStringParser) - advance upto (but not including) the results provided by the termination parser, 
 * and on the text passed over, run the subString parser
 * 
 * ** IMPORTANT IMPLEMENTATION NOTE (note copied from Parser_Core.mjs module in class Parser ***
 * The 'until' Parser employs the 'isPositionalParser' attribute to determine how to handle the optimized parser.  
 * 
 * This is a design area with this parser that may not stick, but is part of a less-than-elegant solution for a small handfull of parsers
 * (particularly, but maybe not exclusively the  'until(terminationParser, sectionParser)' parser.  In this parser, the termination
 * parser can be a string, RegExp,or a Parser.  If it's a Parser, it can be any parser that updates an index.  If a non-Parser is supplied,
 * 'until' selects an optimized parser ('untilStr' for a string-terminated parser, or untilRegExp for a regex-terminated parser).  If the 
 * termination parser is neither of these, it only has the ability to use the constructor name, which is always 'Parser', and therefore,
 * without any additional information, can only use everythingUntil(userParser) as the termination parser, which is notoriously slow (almost unusable).
 * If the same code is to be used for until (as opposed to a separate function), a way needs to be found to further inspect into the Parser
 * to determine if it can be used as an alternative to everythingUntil, as they are optimized to use underlying data (#rowCacheStructure, .e.g)
 * to select the next index.
 * 
 * This is why we have a 'isPositional' attribut here.
 * 
 * 
 * Further local note #1: 
 *
 * Since the 'until' parser tries to be so flexible to accept any type of parser for terminating 
 * the section,differences in performance and behavior of the terminaton parsers need to be 
 * accounted for, hence the 'terminationParserOptimized' value.
 *  * The 'catch-all' parser is 'everythingUntil'.  The problem with 'everythingUntil' is that 
 * it relies on a character-by-character failure to advance the cursor, which has severe performance 
 * implications, and is also incompatible with parsers that do not fail when expected.
 * Thus, exceptions must be made to identify all parsers that should not be used with  an everythingUntil,
 * and call them specifically.  
 * So far, these parsers are:
 *   raw strings or String values, 
 *   raw RegExp
 *   endOfIndentLevel
 *   gotoRow/Col/RowCol/Index
 * 
 * Important note #2:  This parser has been updated, such that the substringParser runs with an inherited environmental variable called 'parent', 
 * which is the terminationParser's entire env structure, as well as the parent's startIndex (before terminationParser) and endIndex (after terminationParser)
 * 
 * Usage: until(terminationPatter:<string|RegExp|Parser>, substringParser:<null|Parser>)
 * 
 */


/** @type {(terminationPattern: Parser|RegExp|string, substringParser:Parser|null) => Parser} */
function until (terminationPattern, substringParser = null) {
	const terminationParserName = (terminationPattern?.constructor?.name === 'Parser') ? terminationPattern.p.pname  
		: (terminationPattern?.constructor?.name === 'String') ? `'${terminationPattern}'`
		: terminationPattern

	const substringParserName = (substringParser==null) ? 'null'
		: (substringParser?.constructor?.name === 'Parser') ? substringParser?.p?.pname  ?? 'unnamed'
		: (substringParser?.constructor?.name === 'String') ? `'${substringParser}'`
		: substringParser

	const pname = `until(${terminationParserName},${substringParserName??''})`

	/** Here is where the isPositionaParser check is used for the terminationParser optimization hack: */
	const terminationParserOptimized = 
		(terminationPattern?.constructor?.name === 'String')   ? gotoStr(terminationPattern).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (terminationPattern?.constructor?.name === 'RegExp') ?	gotoRegExp(terminationPattern).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (terminationPattern?.constructor?.name === 'Parser') ? (terminationPattern.isPositionalParser()) ?     // /** Positional Parser optimization case */
			terminationPattern.mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
			:	everythingUntil(terminationPattern).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)		/** Non-positional parser default case - uses very slow everythingUntil parser instead */
		: null
	
	return new Parser(function until$(state) {
		if (state.isError) return state

		if ((terminationPattern?.constructor?.name === 'Parser') && terminationPattern.isPositionalParser() == false) {
			isVerbose && console.log(`[until]: Warning - planning to use everythingUntil(${terminationParserName})!!! - will be slow!! `)
		}
	
		/** SECTION 1 - run termination parser & get section text - 'substringToParse', and the termination index, which is where our until will end up **/
		const terminationParserState = terminationParserOptimized.p(state)
		if (terminationParserState.isError) return Parser.updateError( {...state, index:state.index}, `[${pname}]: ParseError from supplied termination parser: '${terminationParserState.error}'`,pname)
		const substringToParse = terminationParserState.target.slice(state.index, terminationParserState.index)

		// if we have no substring parser, simply return the entire substring as a result, so another parser can handle the rest.
		if ( substringParser === null) return Parser.updateParserState(state, substringToParse, terminationParserState.index, pname)


		/** SECTION 2: run section parser on 'substringToParse'  **
		 *  since we're running the subparser, we're passing in the parent's environment (called 'parent'), to provide it with parents's env context as well as startIndex & endIndex of parent.
	 	 */
		const substringParserState = substringParser.runLite(substringToParse, { parent: {startIndex: state.index, endIndex: terminationParserState.index, ...terminationParserState.env}})
		substringParserState.env.parent = undefined   // remove the parent when done.
		if (substringParserState.isError) return Parser.updateError(substringParserState,	`[${pname}]: ParseError (at baseIndex: ${state.index}, errorIndex: ${state.index + substringParserState.index}).  Error from supplied substringParser: '${substringParserState.error}`, pname)


		/**** SECTION 3: getting useful data out of the subparser *****
		 * Now that we called the substring parser (with parent context), now that we're returned, let's get data out from it
		 */

		// first - how far did we go into the substring? 
		const substringParserIndex = substringParserState.index
		const substringParserIndex_normalized = substringParserState.index + state.index

		// next - if there are any dataLogs from the substring parser, add a context message prior, and extract any dataLogs from substring parser, and add context to each message
		// const dataLog = (substringParserState.dataLog.length > 0) ? 
		// 	[
		// 		`[${pname}]: Section parser log entries below. Indices below are relative to section text (range ${state.index}-${state.index + substringParserIndex})`,
		// 		...substringParserState.dataLog.map( (substringLogEntry) => ` ${substringLogEntry}`)	
		// 	]	: []

		// this will be fed into the environment of any parser that calls 'until'.  Such parser can then use .logEnv to log results, or other methods to use the env data.
		const subParserData = {
			section_index_start: 					state.index,
			section_index_parseduntil: 		substringParserIndex_normalized,
			section_index_termination:		terminationParserState.index,
			section_text: 								substringToParse,
			section_text_parsed: 					substringToParse.slice(0,substringParserIndex),
			section_text_unparsed:				substringToParse.slice(substringParserIndex),
			section_parser_dataLog:				substringParserState.dataLog,
		}

		const returnState = Parser.mergeParserState({
			fromState: terminationParserState,
			index: terminationParserState.index,
			result: substringParserState.result,
			env: {...subParserData },
			// env: subParserData_v2,								// if needed for flatter namespace
			//dataLog, // if needed - we already have this in env.  Can we process after this function with env data for subparser datalog?
			pname,
		})
		// console.log(`[until]: return state is`, {returnState})
		return returnState
	}).named(pname).setAsPositionalParser(true)
}



///// 'next' type parsers - for advancing ahead (like goto), but also consuming the supplied token/pattern/parser
// will advance the cursor upto, and including the supplied pattern, and return the result of the supplied pattern

/** nextStr( stringToFind: string ) 
 * error:  string not found
 */ 
function nextStr(str) {
	const pname = `nextStr('${str}')`
	if (typeof (str) !== 'string' && str.constructor.name != 'String') throw new TypeError(`${pname} must be called with a string or String object`)

	return new Parser(function nextStr$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ''

		const foundAt = state.target.indexOf( str, state.index )			/// the 'index' parameter finds the absolute position of str within the target, starting from the index
		if (foundAt == -1) return Parser.updateError(
			state, 
			`[${pname}]: ParseError (at index ${state.index}): No match found for supplied string '${str}'.`, 
			pname
		)
		return Parser.updateParserState(state, str, foundAt + str.length, pname)
	}).named(pname).setAsPositionalParser(true)
}


/** nextRegExp( pattern: stringPattern or RegExp ) 
 * error:  pattern not found
 */
const nextRegExp = (pattern) => {
	const pname = `nextRegExp(${pattern})`
	if (pattern.constructor.name !== 'RegExp' && pattern.constructor.name !== 'String')
		throw new TypeError(`[${pname}] must be called with a RegExp object or string-based pattern, but got ${pattern?.constructor?.name ?? pattern}`)

	return new Parser( function nextRegExp$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ''

		const regexMatch = state.target.slice(state.index).match(pattern) ?? false
		if (regexMatch == false) return Parser.updateError(
			state, 
			`[${pname}] ParseError (position ${state.index}): did not find supplied pattern '${pattern}'`, 
			pname
		)
		const result = regexMatch[0]
		return Parser.updateParserState(
			state,
			result,			
			state.index + regexMatch.index + result.length, 
			pname
		)
	}).named(pname).setAsPositionalParser(true)
}



function next(nextParser) {
	const nextParserName = (nextParser?.constructor?.name === 'Parser') ? nextParser.p.pname  
	: (nextParser?.constructor?.name === 'String') ? `'${nextParser}'`
	: nextParser
	const pname = `next(${nextParserName})`

	const nextParser_optimized = (nextParser.constructor.name === 'String')	?	nextStr(nextParser).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (nextParser.constructor.name === 'RegExp')	?	nextRegExp(nextParser).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (nextParser.constructor.name === 'Parser')	?	sequenceOf(
			everythingUntil(nextParser),
			nextParser
		).map( (result)=>result[1]).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: null
	if (nextParser_optimized === null) throw new Error(`[${pname}]: supplied parser is not a string, RegExp, nor Parser object`)

	return new Parser( function next$(state) {
		if (state.isError) return state
		const nextParserState = nextParser_optimized.p(state)

		if (nextParserState.isError) return Parser.updateError(state, nextParserState.error, pname)
		return Parser.updateResult(nextParserState, nextParserState.result, pname)
	}).named(pname).setAsPositionalParser(true)
}


/**  find - 
 * Like 'next' type parsers, but will not advance the cursor.  A general-purpose lookahead and see
 *  what's out there for uncertain text in an uncertain order.
 * 
 * Best used in the context of a section parser.  For example:
 * 
 *   until(endOfsection, sequenceOf(
 * 			find(ipAddress),
 * 			find(intDescription),
 *      find(ipAcl),
  *   ))
 * 
 */
// find (string/pattern/Parser) => (string/pattern/pParser) => scan ahead from current position to the next 
//  occurence of the supplied string / pattern / patternParser
// 
//   result: the text matching the string / pattern / parser
//   index:  never advances - this is just a lookhead
//   tmp:    { row, col, index, indentationLevel } of found pattern
//   error:  message when string / pattern / parser not found
//   NOTE:   there may be an alternate version of next that would return an error, but would be a 'best effort'
//
// Use case: within a bounded parser (i.e. - 'until...') to search possible patterns, or to search for
// the existence of certain keywords to determine the type of text file being parsed

/////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////


/** findStr(string)
 * Description: a string-optimized lookAhead-type parser for searching for the existence of a string
 * 
 * Succeeds:
 *   Only if finding the string starting from the current cursor position
 *   Otherwise, returns error (with message)
 * 
 * Behavior (upon success):
 *   result:  the string
 *   tmp:    { row, col, index, indentationLevel } of found string
 *   cursor:  does not advance  (thus used for searching only).
 * 
 * Notes: 
 */ 
function findStr(str) {
	const pname = `findStr('${str}')`
	if (typeof (str) !== 'string' && str.constructor.name != 'String') throw new TypeError(`${pname} must be called with a string or String object`)

	return new Parser(function findStr$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ''

		const foundAt = state.target.indexOf( str, state.index )			/// the 'index' parameter finds the absolute position of str within the target, starting from the index
		if (foundAt == -1) return Parser.updateError(
			state, 
			`[${pname}]: ParseError (at index ${state.index}): No match found for supplied string '${str}'.`, 
			pname
		)
		const positionData = Parser.getPositionData(state.target, foundAt)
		return Parser.updateParserState(
			Parser.updateData(state, positionData, 'find_position', pname), 
			str, 
			state.index, 
			pname
		)
	}).named(pname).setAsPositionalParser(true)
}


/** findRegx(pattern: RegExp or string pattern)
 * 
 * Description: a regex-optimized parser for searching for the existence of a supplied regex pattern
 * 
 * Succeeds:
 *   Only upon finding a string which matches the supplied pattern, starting from the current cursor position.  
 *   Otherwise, returns error with message
 * 
 * Behavior (upon success):
 *   result:  the first string matching the pattern
 *   tmp:    { row, col, index, indentationLevel } of found pattern
 *   cursor:  does not advance  (thus used for searching only).
 * 
 * Notes: 
 */ 
const findRegExp = (pattern) => {
	const pname = `findRegExp(${pattern})`
	if (pattern.constructor.name !== 'RegExp' && pattern.constructor.name !== 'String')
		throw new TypeError(`[${pname}] must be called with a RegExp object or string-based pattern, but got ${pattern?.constructor?.name ?? pattern}`)

	return new Parser( function findRegExp$(state) {
		if (state.isError) return state
		const fromParser = state?.pname || ''

		const regexMatch = state.target.slice(state.index).match(pattern) ?? false
		if (regexMatch == false) return Parser.updateError(
			state, 
			`[${pname}] ParseError (position ${state.index}): did not find supplied pattern '${pattern}'`, 
			pname
		)
		const result = regexMatch[0]
		const foundAtPosition = state.index + regexMatch.index

		const positionData = Parser.getPositionData(state.target, foundAtPosition)
		return Parser.updateParserState(
			Parser.updateData(state, positionData, 'find_position', pname), 
			result, 
			state.index, 
			pname
		)
	}).named(pname)
}


/** find(parser) 
 * 
 * Description: Searches ahead until finding a pattern that matches the supplied string, regex, or parser
 * 
 * Succeeds:
 *   Only upon finding a string which matches the supplied pattern, starting from the current cursor position.  
 *   Otherwise, returns Parser with isError=true with error message
 * 
 * Behavior (upon success):
 *   result:  the first string matching the pattern
 *   tmp:    { row, col, index, indentationLevel } of found pattern
 *   cursor:  does not advance  (thus used for searching only).
 * 
 * Notes: 
 */ 
/** @type {(findParser: Parser|RegExp|string) => Parser} */
function find(findParser) {
	const findParserName = (findParser?.constructor?.name === 'Parser') ? findParser.p.pname  
	: (findParser?.constructor?.name === 'String') ? `'${findParser}'`
	: findParser
	const pname = `find(${findParserName})`

	const findParser_optimized = (findParser.constructor.name === 'String')	?	findStr(findParser).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (findParser.constructor.name === 'RegExp')	?	findRegExp(findParser).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
		: (findParser.constructor.name === 'Parser')	?	everythingUntil(findParser).mapError(({error})=>`[${pname}]: Error from optimized parser: ${error}`)
	: null

	if (findParser_optimized === null) {
		throw new Error(`[${pname}]: supplied parser is not a string, RegExp, nor Parser object`)
	}

	return new Parser( function find$(state) {
		if (state.isError) return state
		const findParserState = findParser_optimized.p(state)
		if (findParserState.isError) return Parser.updateError(state, findParserState.error, pname)

		const positionData = Parser.getPositionData(state.target, findParserState.index)

		// if we are using a Parser instead of string or RegExp, we still have to get the result
		const result = (findParser.constructor.name === 'Parser') ? (findParser.p(findParserState)).result : findParserState.result

		return Parser.updateParserState(
			Parser.updateData(state, positionData, 'find_position', pname), 
			result, 
			state.index, 
			pname
		)
	}).named(pname).setAsPositionalParser(true)
}



//////////   LEGACY PARSERS - REVIEW AND MIGRATE OR DELETE //////////////////////////////
//////////   LEGACY PARSERS - REVIEW AND MIGRATE OR DELETE //////////////////////////////
//////////   LEGACY PARSERS - REVIEW AND MIGRATE OR DELETE //////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////



/** moveBy
*		simple parser to advance the cursor by a number of characters & returns no not results 
		(warning: does not handle error of index overflow!)
*/
const moveBy = (relativePosition) => new Parser((state) => {
	return Parser.updateIndex(state, state.index + parseInt(relativePosition), `moveBy(${relativePosition})` )
})


const gotoLine = (str) => seqOf(untilStr('\n' + str), '\n').named(`gotoLine(${str})`)


const gotoRow_v2 = (rowNumber) => {
	const pname = `gotoRow(${rowNumber})`
	return new Parser( function gotoCol$(state) {
		if (state.isError) return state

		const { target, index } = state
		const rowRecord = Parser.getRowRecord(target, index)
		const maxColumn = rowRecord.lineLength + 1

		if ( (rowNumber) > maxColumn ) {
			return Parser.updateError(
				state, 
				`[${pname}]: The supplied column number ${rowNumber} exeeds line length/max column (${rowRecord.lineLength}/${maxColumn}) at row ${rowRecord.row}, index ${index}`, 
				pname 
			)
		}
		return Parser.updateIndex(state, rowRecord.index + rowNumber - 1, pname )
	}).named(pname).setAsPositionalParser(true)
}


// string-optimized search that should be used inside a 'lookAhead', or 'until',
// since a missing string wil advance to the end of the parser
const findValueOf = (s, p) => seqOf(gotoStr(s), p).map((result) => result[1])

// be careful inside of many(), this could advance the parser to the end of the entire dataset
const getNext = (p) => seqOf(everythingUntil(p), p).map((result) => result[1])

// like next() but won't advance parser
const searchFor = (p) => lookAhead(getNext(p))


export {
	// get absolute cursor positions (returns no results)
	getIndex,
	getRow,
	getCol,
	getRowAndCol,
	getPosition,
	getPosition_asResult,
	getIndentation,

	indentLevelWhere,
	changeOfIndentLevel,

	// 'goto' parsers - advance the cursor for various use cases
	gotoStr,
	gotoRegExp,
	gotoIndex,
	gotoRow,
	gotoCol,
	gotoRowCol,
	endOfIndentLevel,
	goto,										// general-purpose

	// parser/subparser
	untilStr,
	untilRegExp,
	//untilEndOfIndentLevel,
	until,

	// next... advance from current position to the next occurence of the supplied string / pattern / patternParser
	nextStr,
	nextRegExp,
	next,

	// find... search (but don't advance) from current position to the next occurence of the supplied string / pattern / patternParser
	findStr,
	findRegExp,
	find,

	/******** LEGACY PARSERS - REVIEW & REPLACE or COMMIT **********/
	moveBy,
	gotoLine,	
	gotoRow_v2,
	findValueOf,			// used by arista_cfg_nat_dynamic
	getNext,
	searchFor,
}



