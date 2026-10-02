import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	pipe,
	asString,
	groupByPropName,

	// from Parser_Core.mjs
	seqOf,
	sequenceOf,
	regex,
	oneOf,
	many,
	possibly,
	lookAhead,
	setOf,
	succeedWith,
	everythingUntil,
	except,
	strng,
	many1,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	word,
	eol,
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	interfaceName,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
} from '../parser_modules.mjs'


const get_nxcfg_prefix_lists = (deviceName) => {

	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_nxcfg_prefix_lists',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.1,									    // 
		usage: '',								    // future capability to provide help (may not be used)
		desc: ``,
		returnSchema:       {
			"pfxName":"the name of the prefix-list",
			"seqNo"  :"prefix-list sequence number",
			"action" :"'permit' or 'deny",
			"prefix" :"ipv4_prefix",
			"range"  :"'', le:31, 'le:31,ge:24', etc",
		},
	}


	/** SECTION 2: local result helpers to make code more readable (arguably).  ****
 *  These are candidates for possibly moving into an external module 
 */
	const _0 = (arr) => arr[0]		// these get values out of arrays at the supplied index
	const _1 = (arr) => arr[1]
	const _2 = (arr) => arr[2]
	const _3 = (arr) => arr[3]
	const isTrue = (res) => true  // tags the existence of a result as 'true' - for flags (i.e. if xyz is parsed, xyz is true)


	//	intra-line parsers...
	const prefixListName = regex(/^[a-zA-Z0-9-_\.]+/)
	const pfxAction = oneOf('permit', 'deny')
	const pfxSeqNo = digits

	const entryDetail = seqOf(oneOf(
		seqOf('le', digits).map(joinWith(':')),
		seqOf('lt', digits).map(joinWith(':')),
		seqOf('gt', digits).map(joinWith(':')),
		seqOf('ge', digits).map(joinWith(':')),
	))
	const entryDetails = many(entryDetail).map(joinWith(','))


	/** line-level parsers...  */ 

	const prefixListHeader= parseLine('ip prefix-list', prefixListName).map((result)=>result[1]) 

	const prefixListEntry =	parseLine( 
		'seq', 
		pfxSeqNo.tag('seqNo'), 
		pfxAction.tag('action'), 
		ipNetwork.tag('prefix'),
		possibly(entryDetails).map(asString).tag('range'),
	)

	const prefixListEntry_comment = parseLine(
		many1(strng('!')),
		rol.tag('comment'),
	)

	const prefixListEntry_UNK = parseLine(rol)

	const prefixListEntries = oneOf(
		prefixListEntry.map(addTag('type', 'pfx')),
		prefixListEntry_comment.map(addTag('type', 'comment')),
		prefixListEntry_UNK.logResult( (res) => `${deviceName} [${pmodule.name}:prefixListEntries]: Unrecognized text encountered: '${res}'`),
	)

	// Parser: 'prefixListRecord_type1' the main EOS format 
	//	- a distinct section header on first line, followed by entries on the following lines
	// 	- This is the common case.  
	// **PLEASE NOTE** EOS can accept prefix-lists all in one line, handled by prefixListRecord_type2 below
	const prefixListRecord_type1 = parseSection(
		seqOf(
			prefixListHeader.tag('pfxName'),
			// many(prefixListEntry).tagList('pfxEntries'),
			many(prefixListEntries).tagList('pfxEntries'),
		).getTaggedR()
			.map(multiplyBy('pfxEntries'))
	)	
		.logEnv( ({
			section_index_start,
			section_index_parseduntil, 
			section_index_termination,
			section_text_unparsed,
			section_parser_dataLog,
		// section_text,          // unused here, but available if needed
		// section_text_parsed,   // unused here, but available if needed
		}) => ([
		// if the section parser has logs, make sure we pull them from the environment, but return empty if not
			(section_parser_dataLog?.length > 0) ? [
				`[prefixListRecord]: the parser function '[parsePrefixList]' generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
				section_parser_dataLog.map( (entry) => `  ${entry}` ),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`[prefixListRecord]: the parser function '[parsePrefixList]' did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				`  '${section_text_unparsed}'`,
			] : [],
		]))


	// Alternate format - NXOS-style - header repeats for every line (not common as EOS will reformat it sometimes automatically)
	// for when pfx entries when all on one line: 'ip prefix-list CONNECTED-TO-BGP-LOOPBACKS seq 10 permit 10.117.38.0/24 le 32'
	const prefixListRecord =	parseLine(
		seqOf(
			'ip prefix-list', 
			prefixListName.tag('pfxName')),
			'seq', 
			pfxSeqNo.tag('seqNo'), 
			pfxAction.tag('action'), 
			ipNetwork.tag('prefix'), 
			possibly(entryDetails).map(asString).tag('range'),
	).getTaggedR()



	/*** Output formatting functions for the results... */
	const pfxEntry_toStr = ({ pfxName, seqNo, action, prefix, range}) => 
		`${seqNo}:${action}:${prefix}${ (range) ? `(${range})` : ''}` 

	const pfxsToStrings = (delimiter) => (prefixLists) => pipe(
		groupByPropName('pfxName'),							// now we have an object, with each key bring its own prefixList
		(groupObj) => Object.entries(groupObj)	// now we have an array, each containing [ pfxName, pfxEntries ]
			.map( ([pfxName,pfxEntries]) => `${pfxName}${delimiter}${pfxEntries.map(pfxEntry_toStr).join(delimiter)}` ),
	) (prefixLists)



	const formatColumns = ({
		pfxName,
		seqNo,
		action,
		prefix,
		range,
		comment,
		type,
		...skipped
	}) => ({
		deviceName,
		pfxName,
		seqNo,
		action,
		prefix,
		range,
		comment,
		type,
		_key_: `${deviceName}:${pfxName}`,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})
	



	/*** Main function */

	/** NOTE:
	 * The structure of this is a bit strange, but it needs to handle two completely formats of prefix-lists.  The good news is that the formats dont' co-exist on the same switch at the same
	 * time. Hence the oneOf(many(),many()) format. However, in attempting to use anything other than the below, it would work on one switch with type1, but not type2, and vice versa.  This one works interchangably
	 * mainly due to the lookAhead. 
	 */

	const prefixLists = seqOf(
		gotoSection( 'ip prefix-list'),
		many(prefixListRecord),

		
		//oneOf(lookAhead(many1(prefixListRecord_type2)))
	).map((res)=>res[1])
		.map(flattenArray)
		.map(mapArray(formatColumns))
	//	.dataLog_toResult()			// <<-- this changes the return format to { result, dataLog } instead of a result


	return prefixLists
}

// run for in-browser IDE
// get_nxcfg_prefix_lists('sampledevicename')


// uncomment for production
export { get_nxcfg_prefix_lists }



//gotoSection('ip prefix-lists').ifError()