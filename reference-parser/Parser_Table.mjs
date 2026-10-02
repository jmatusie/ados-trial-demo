const isVerbose = true

import {
	many, tok, fail, sequenceOf, oneOf
} from './Parser_Core.mjs'


import {
	digits,
	// possible whitespace
	_, any, // may replace untilDelimiterString for end of line
	// line parsers
	parseLine
} from "./Parser_Text.mjs"


import {
	interfaceName,
	ipNetwork
} from './Parser_Network.mjs'


import {
	getRowAndCol, // same as endOfIndentLevel, but has better semantics when using generally-named flex-parsers like 'goto' and 'until' 
	goto,
	gotoStr,
} from './Parser_FlexParser.mjs'






const flexTable_old = () => {

	const col_intName = tok(interfaceName)
	const col_ipNetwork = oneOf(ipNetwork, 'unassigned')
	const col_intStatus = oneOf( 'up', 'admin down', 'down' ) 
	const col_protStatus = oneOf('up', 'down', 'lowerlayerdown', 'notpresent' ) 
	const col_intMTU = digits
	
	const sampleTable1 = [
		{ headerString: 'Interface', 	colParser: col_intName,			tagAs: 'Interface1'	},
		{ headerString: 'IP Address', colParser: col_ipNetwork,		tagAs: 'ipAddr1'		},
		{ headerString: 'Status', 		colParser: col_intStatus,		tagAs: 'Status1' 		},
		{ headerString: 'Protocol',		colParser: col_protStatus,	tagAs: 'Protocol1'	},
		{ headerString: 'MTU', 				colParser: col_intMTU,  		tagAs: 'MTU1'    		},
	]
	
	const sampleTable2 = [
		col_intName.tagAs('Interface1'),
		col_ipNetwork.tagAs('ipAddr1'),
		col_intStatus.tagAs('Status1'),
		col_protStatus.tagAs('Protocol1'),
		col_intMTU.tagAs(	'MTU1'),
	]
	
	// parses table header - extract column data
	const headerRecord = (tableDef) => sequenceOf(
		tableDef.map( (columnP) => {
			const col = tok(columnP).chain( getRowAndCol ).map_fromData( ({result,data}) => ({...result, ...data}) )
			return col
		})
	)
	
	// takes table def array and returns a parser that parses each item in tableDef inside a [sequenceOf] parser
	const lineOfData = (tableDef) => parseLine(
		...tableDef.map((column)=>column.colParser.tagAs(column?.tag ?? column.header)),
	)
	
	// parse all the rows
	const tableData = (tableDef) => sequenceOf(
		goto(lineOfData(tableDef)),
		many(lineOfData(tableDef)),
	).map((result)=>result[1])
	

	// main table parsing routine
	const parseTable = (tableDef) => sequenceOf(
		goto(headerRecord(tableDef)),
		headerRecord(tableDef).tagAs('header'),
		tableData (tableDef).tagList('entries'),
	).getTaggedR()
		.map( ({header, entries}) => ([header, ...entries]) )
	
	return parseTable
}
	

// original (don't touch)
const strictTable = (tableDef) => {
	// parses table header
	const headerRecord = (tableDef) => sequenceOf(
		tableDef.map( (column) => tok(column.headerString).tagAs(column.tagAs) )
	)
	
	// takes table def array and returns a parser that parses each item in tableDef inside a [sequenceOf] parser
	const lineOfData = (tableDef) => parseLine(
		...tableDef.map((column)=>column.colParser.tagAs(column.tagAs)),
	)
	
	// parse all the rows
	const tableData = (tableDef) => sequenceOf(
		goto(lineOfData(tableDef)),
		many(lineOfData(tableDef)),
	).map((result)=>result[1])
	
	// main table parsing routine
	const parseTable = (tableDef) => sequenceOf(
		goto(headerRecord(tableDef)),
		headerRecord(tableDef).tagAs('header'),
		tableData (tableDef).tagList('entries'),
	).getTaggedR()
		.map( ({header, entries}) => ([header, ...entries]) )
	
	return parseTable(tableDef)
}
	

const flexTable = (..._tableDef) => {
	const columnSpacingParser = _		// space

	// parses table header
	// handle two different formats for 
	const tableDef = _tableDef.flat()

	// classify the user-supplied table definition parameter, so we know how to handle it.  Handling different table def formats is what makes it 'flexible'
	const tableDefType = 
		(tableDef[0]?.header) ? 'full' 
		: (tableDef[0]?.constructor?.name == 'String') ? 'terse' 
		: 'invalid'

	if (tableDefType == 'invalid') return fail(`[flexTable]: invalid table definition format`)

	// parses the table header
	const tableHeaderParser = 
		(tableDefType=='full') ? sequenceOf(
			//gotoStr(tableHeaderAnchor),
			tableDef.map( (col_def) => tok(col_def.header).tagAs(col_def.tag) ) 
		)
		: 
		(tableDefType=='terse') ? sequenceOf( 
			tableDef.map( (col_str) => tok(col_str) ) 
		)
		: fail(`[flexTable]: invalid table definition format`)

	const lineParser1 = tableDef.map( (col_def) => (col_def?.colParser ?? any).tagAs(col_def?.tag ?? col_def.header) )
	const lineParser2 = tableDef.flatMap( (col_str) => [_, any.tagAs(col_str)] )  // interleave the 'space' parser between the 'any' parsers

	// parses one row of data
	const lineOfData = 
		(tableDefType=='full') ? parseLine([...lineParser1]).named('lineParser1')
		: (tableDefType=='terse') ? parseLine([...lineParser2]).named('lineParser2')
		: fail(`[flexTable]: fatal error`)

	// parses all the rows
	const tableData = (tableDef) => sequenceOf(
		goto(lineOfData),
		many(lineOfData),
	).map((result)=>result[1])

	// main table parsing routine
	return sequenceOf(
		tableHeaderParser,
		tableData (tableDef).tagList('entries'),
	).getTaggedR()
		.map( ({header, entries}) => (entries) )									// use this only if we want entries only
		//.map( ({header, entries}) => ([header, ...entries]) )		// use this only if we want header and entries
}


/** 
 * @param {{ header: string, colParser: col_socket, tag: 'srcIP' }} tableDef
 * @param {{ string | RegExp | Parser}} jumpTo   - advances after the header, 
 */
const createTableParser = (tableDef, jumpTo) => {
	const columnSpacingParser = _		// space

	// classify the user-supplied table definition parameter, so we know how to handle it.  Handling different table def formats is what makes it 'flexible'
	const tableDefType = 
		(tableDef[0]?.header) ? 'full' 
		: (tableDef[0]?.constructor?.name == 'String') ? 'terse' 
		: 'invalid'

	if (tableDefType == 'invalid') return fail(`[flexTable]: invalid table definition format`)

	// parses the table header
	const header = 
		(tableDefType=='full') 			? sequenceOf(tableDef.map( (col_def) => tok(col_def.header).tagAs(col_def.tag) ) ).named('createTableParser().header')
		: (tableDefType=='terse') 	? sequenceOf( tableDef.map( (col_str) => tok(col_str) ) ).named('createTableParser().header')
		: 													fail(`[createTableParser]: invalid table definition format`)

	const cols = 
		(tableDefType=='full')		? parseLine(tableDef.map( (col_def) => (col_def?.colParser ?? any).tagAs(col_def?.tag ?? col_def.header) )).named('createTableParser().row')
		: (tableDefType=='terse') ?	parseLine(tableDef.flatMap( (col_str) => [_, any.tagAs(col_str)] )).named('createTableParser().row')
		: 												fail(`[createTableParser]: fatal error`)

	// extract columns from the tableDef
	const row = parseLine(cols).named('row')

	// parses all the rows
	const rows = many(cols)

	const table = sequenceOf(
		header.tag('header'),
		goto(jumpTo),
		rows.tagList('rows'),
	).getTaggedR()
	//	.map( ({header, rows}) => (rows) )

	return {
		header,
		cols,
		row,
		rows,
		table,
	}


	// main table parsing routine
	
		//.map( ({header, entries}) => ([header, ...entries]) )		// use this only if we want header and entries
}




////////////////////////////////////////////////////////////////////
// EXAMPLE / TEST
////////////////////////////////////////////////////////////////////
	
	

////////////////////////////////////////////////////////////////
// individual column data parsers
//

const hideThisCode = () => {
	const col_intName = tok(interfaceName).named('col_intName')
	const col_ipNetwork = oneOf(ipNetwork, 'unassigned').named('col_ipNetwork')
	const col_intStatus = oneOf( 'up', 'admin down', 'down' ).named('col_intStatus') 
	const col_protStatus = oneOf('up', 'down', 'lowerlayerdown', 'notpresent' ).named('col_protStatus') 
	const col_intMTU = digits//.named('col_intMTU')


	sequenceOf(
		goto('Interface'),
		flexTable([
			{ header: 'Interface', 	colParser: col_intName,		tag: 'Interface'},
			{ header: 'IP Address', colParser: col_ipNetwork,	tag: 'ipAddr'		},
			{ header: 'Status', 		colParser: col_intStatus,	tag: 'Status' 	},
			{ header: 'Protocol',		colParser: col_protStatus,tag: 'Protocol'	},
			{ header: 'MTU', 				colParser: col_intMTU,       },
		])
	)

	sequenceOf(
		goto('Interface'),
		flexTable([
			{ header: 'Interface', 	colParser: col_intName,		tag: 'Interface2'},
			{ header: 'IP Address', colParser: col_ipNetwork,	tag: 'ipAddr2'		},
			{ header: 'Status', 		colParser: col_intStatus,	tag: 'Status2' 	},
			{ header: 'Protocol',		colParser: col_protStatus,tag: 'Protocol2'	},
			{ header: 'MTU', 				colParser: col_intMTU,       },
		])
	)

	sequenceOf(
		goto('Interface'),
		flexTable([
			{ header: 'Interface', 	colParser: col_intName		},
			{ header: 'IP Address', colParser: col_ipNetwork,	tag: 'ip_addr'},
			{ header: 'Status', 		colParser: col_intStatus 	},
			{ header: 'Protocol',		colParser: col_protStatus	},
			{ header: 'MTU', 				colParser: col_intMTU     },
		])
	)

	sequenceOf(
		goto('Interface'),
		flexTable([
			{ header: 'Interface', 	colParser: col_intName, 					tag:'intf'										},
			{ header: 'IP Address', colParser: col_ipNetwork,					tag: 'ip_addr'								},
			{ header: 'Status', 		colParser: col_intStatus, 				/* tag: defaults to header */	},
			{ header: 'Protocol',		/*colParser: defaults to hword*/  tag: 'prot'									  },
			{ header: 'MTU' }
		])
	)

	sequenceOf(
		goto('Interface'),
		flexTable([
			{ header: 'Interface', 	colParser: col_intName, 					tag:'intf'										},
			{ header: 'IP Address', colParser: col_ipNetwork,					tag: 'ip_addr'								},
			{ header: 'Status', 		colParser: col_intStatus, 				/* tag: defaults to header */	},
			{ header: 'Protocol',		/*colParser: defaults to hword*/  tag: 'prot'									  },
			{ header: 'MTU' }
		])
	)

	sequenceOf(
		goto('Interface'),
		flexTable([
			{ header: 'Interface', 	colParser: col_intName, 					tag:'intf'										},
			{ header: 'IP Address', colParser: col_ipNetwork,					tag: 'ip_addr'								},
			{ header: 'Status', 		colParser: col_intStatus, 				/* tag: defaults to header */	},
			{ header: 'Protocol',		/*colParser: defaults to hword*/  tag: 'prot'									  },
			{ header: 'MTU' }
		])
	)

	sequenceOf(
		goto('Interface'),
		flexTable([
			{ header: 'Interface', 	 					tag:'intf'										},
			{ header: 'IP Address', 					tag: 'ip_addr'								},
			{ header: 'Status', 	 				/* tag: defaults to header */	},
			{ header: 'Protocol',		/*colParser: defaults to hword*/  tag: 'prot'									  },
			{ header: 'MTU' }
		])
	).map((res)=>res[1])


	sequenceOf(	
		goto('Interface'), 	
		flexTable(['Interface', 'IP Address', 'Status', 'Protocol', 'MTU']) 
	).map((res)=>res[1])

}

export {
	flexTable,
	strictTable,
	createTableParser
}	
