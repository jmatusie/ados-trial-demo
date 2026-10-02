/**  Comment out this import and export at bottom when using in browser sandbox     */

import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	normalizedDataSet,
	nullToStr,

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
	tok,
	maybe,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	eol,
	colon,

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
} from '../parser_modules.mjs'


import {
	std_community_value,
	lrg_community_value,
	ext_community_value_as_asn,
	ext_community_value_as_ipaddr,
	ext_community_value_as_asdot,
	ext_community_value_other,
	ext_community_value,
} from './v2module(final)--eos_cfg_community_lists.mjs'


/** TO DO:
 * 
 * 1. find out why logging of unknowns is not working (this example has an unknown value for 'route-map BGP-SFTI-PTP-IN deny 9000' )
 * 1.1 - UPDATE: may be fixed.  Test.
 * 
 * // TODO: 
 * 2. modernize module-level documentation
 * 3. incorporate community parsers
 * 4. consider structuring output as one-entry per route-map, instead of one entry per seqNo.  This will mean the output is hierarchical, but may be more flexible
 * 5. Align the schema with nxos_cfg_route_map
 * 
 */



/*********************************************************************************
 * Module:      eos_cfg_route_map
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: Parses a single arista configuration file for route-maps
 * Caveats:     ?
 * Output:      table of route-map entries per switch:
 * 		{
 * 		
 * 		}
 */

const eos_cfg_route_maps = (deviceName) => {

	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_route_maps',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}


	/** SECTION 3: local token-level parsers ****
   *  Some of these are existing very general parsers, but renamed for semantics only
   *  If they need to be changed to more restrictive parsers, they can be done using the local name instead of replacing references
   *  througout the code
   */
	const action 				= oneOf('permit', 'deny')
	const seqNo					= digits

	const eosName = regex(/^[a-zA-Z0-9_-]+/)   // generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const vrfName = eosName.named('vrfName')
	const routeMapName = eosName.named('routeMapName')


	const asdot	=	sequenceOf([digits, strng('.'), digits]).map( ([left, , right]) => `${left}.${right}` )
	const asplain = digits
	const asn = oneOf(asdot, asplain).named('asn')


	/** SECTION 4: per-line parsers related to BGP ****/
	const routeMapHeader 		= parseLine('route-map', routeMapName, action, seqNo).map(([,routeMapName,action,seqNo])=>({routeMapName, seqNo, action})).named('routeMapHeader')
	const desc							= parseLine('description', everythingUntil(eol) ).map((result)=>result[1])

	const subRouteMap				= parseLine('sub-route-map', routeMapName).map((result)=>result[1])

	const matchPrefixList 	= parseLine('match ip address prefix-list', hword).map((result)=>result[1])
	const matchTag 					= parseLine('match tag', digits).map((result)=>result[1])
	const matchRest					= parseLine('match', everythingUntil(eol)).map((result)=>result[1])

	const setLocalPref			= parseLine('set local-preference', digits).map((result)=>result[1])
	const setPrepend				= parseLine('set as-path prepend', asn, many(tok(asn))).map((result)=>`${result[1]}(x${result[2].length+1})`)
	const setPrepend_lastAS	= parseLine('set as-path prepend last-as', asn, many(tok(asn))).map((result)=>`${result[1]}(x${result[2].length+1})`)
	const setRest						= parseLine('set', everythingUntil(eol)).map((result)=>result[1])

	// const continueTo				= parseLine('continue', maybe(digits).map(nullToStr)).map((result)=>result[1])
	const continueTo2				= parseLine('continue', maybe(digits).map(nullToStr)).map(()=>"yes")//.map((result)=>result[1])
	const continues					= parseLine('continue', maybe(digits).map((x)=>x?`${x}`:`next_sequence`)).map((result)=>result[1])


	/** BGP community parser section
	 * NOTE: The community matching / setting parsers have more complexity than the other route-map statements
	 * and are thus grouped into the section below
	 */
	
	// parses a set of community values and returns them as a list delimited by a comma
	const communityList = hword
	const communityValues 		= many(tok(std_community_value)).map(mapArray((res)=>res.value)).map(joinWith(', '))
	const extCommunityValues 	= many(tok(ext_community_value)).map(mapArray((res)=>res.value)).map(joinWith(', '))
	const lrgCommunityValues 	= many(tok(lrg_community_value)).map(mapArray((res)=>res.valu)).map(joinWith(', '))

	// because a communityList is just an hword, stop before hitting these keywords below
	const communityLists 			= until(oneOf('additive', 'delete', at_eol), many(tok(communityList))).map(joinWith(', '))

	const setCommunityClear = parseLine('set community none').map((res)=>`clear`)
	const setCommunityAdd   = parseLine('set community', communityValues, 'additive').map((res)=>`ADD ${res[1]}`)
	const setCommunityDelete= parseLine('set community', communityValues, 'delete').map((res)=>`DELETE ${res[1]}`)
	const setCommunity   		= parseLine('set community', communityValues, at_eol).map((res)=>`SET ${res[1]}`)
	const setCommunityUNK		= parseLine('set community', rol ).map((res)=>`UNKNOWN_ACTION: ${res[1]}`)

	const setExtCommunityClear 	= parseLine('set extcommunity none').map((res)=>`clear`)
	const setExtCommunityAdd		= parseLine('set extcommunity', extCommunityValues, 'additive').map((res)=>`ADD ${res[1]}`)
	const setExtCommunityDelete	= parseLine('set extcommunity', extCommunityValues, 'delete').map((res)=>`DELETE ${res[1]}`)
	const setExtCommunity				= parseLine('set extcommunity', extCommunityValues, at_eol).map((res)=>`SET ${res[1]}`)
	const setExtCommunityUNK		= parseLine('set extcommunity', rol ).map((res)=>`UNKNOWN_ACTION: ${res[1]}`)

	const setLrgCommunityClear	= parseLine('set large-community none').map((res)=>`clear`)
	const setLrgCommunityAdd		= parseLine('set large-community', lrgCommunityValues, 'additive').map((res)=>`ADD ${res[1]}`)
	const setLrgCommunityDelete	= parseLine('set large-community', lrgCommunityValues, 'delete').map((res)=>`DELETE ${res[1]}`)
	const setLrgCommunity				= parseLine('set large-community', lrgCommunityValues, at_eol).map((res)=>`SET ${res[1]}`)
	const setLrgCommunityUNK		= parseLine('set large-community', rol ).map((res)=>`UNKNOWN_ACTION: ${res[1]}`)

	const setCommunityListAdd				= parseLine('set community community-list', communityLists, 'additive').map((res)=>`ADD ${res[1]}`)
	const setCommunityListDelete		= parseLine('set community community-list', communityLists, 'delete').map((res)=>`DELETE ${res[1]}`)
	const setCommunityList					= parseLine('set community community-list', communityLists, at_eol).map((res)=>`SET ${res[1]}`)
	const setCommunityListUNK				= parseLine('set community community-list', rol ).map((res)=>`UNKNOWN_ACTION: ${res[1]}`)

	const setExtCommunityListAdd		= parseLine('set extcommunity extcommunity-list', communityLists, 'additive').map((res)=>`ADD ${res[1]}`)
	const setExtCommunityListDelete	= parseLine('set extcommunity extcommunity-list', communityLists, 'delete').map((res)=>`DELETE ${res[1]}`)
	const setExtCommunityList				= parseLine('set extcommunity extcommunity-list', communityLists, at_eol).map((res)=>`SET ${res[1]}`)
	const setExtCommunityListUNK		= parseLine('set extcommunity extcommunity-list', rol ).map((res)=>`UNKNOWN_ACTION: ${res[1]}`)

	const setLrgCommunityListAdd		= parseLine('set large-community large-community-list', communityLists, 'additive').map((res)=>`ADD ${res[1]}`)
	const setLrgCommunityListDelete	= parseLine('set large-community large-community-list', communityLists, 'delete').map((res)=>`DELETE ${res[1]}`)
	const setLrgCommunityList				= parseLine('set large-community large-community-list', communityLists, at_eol).map((res)=>`SET ${res[1]}`)
	const setLrgCommunityListUNK		= parseLine('set large-community large-community-list', rol ).map((res)=>`UNKNOWN_ACTION: ${res[1]}`)


	// match community... (in EOS, all match community statements use community-lists - there is no matching values directly)
	//const matchCommunityListValue = tok(hword)
	const matchCommunityListValues = many1(tok(hword)).map(joinWith(' & '))
	const matchCommunityListValuesOr = many1(tok(hword)).map(joinWith(' | '))

	const matchCommunity		= parseLine('match community', matchCommunityListValues).map((result)=>result[1])
	const matchCommunityOr	= parseLine('match community or-results ', matchCommunityListValuesOr).map((result)=>result[1])

	const matchExtCommunity = parseLine('match extcommunity', matchCommunityListValues).map((result)=>result[1])
	const matchExtCommunityOr	= parseLine('match extcommunity or-results ', matchCommunityListValuesOr).map((result)=>result[1])
	
	const matchLrgCommunity		= parseLine('match large-community', matchCommunityListValues).map((result)=>result[1])
	const matchLrgCommunityOr	= parseLine('match large-community or-results ', matchCommunityListValuesOr).map((result)=>result[1])


	const unknown					= parseLine(everythingUntil(eol)).map((result)=>result[0])

	const routeMapEntry =	oneOf(
		desc.tag('desc'),
		subRouteMap.tag('subRouteMap'),

		matchPrefixList.tag('matchPrefixList'),
		matchTag.tag('matchTag'),

		matchCommunityOr.tag('matchCommunity'),
		matchCommunity.tag('matchCommunity'),

		matchExtCommunityOr.tag('matchExtCommunity'),
		matchExtCommunity.tag('matchExtCommunity'),

		matchLrgCommunityOr.tag('matchLrgCommunity'),
		matchLrgCommunity.tag('matchLrgCommunity'),

		matchRest.tag('matchRest'),

		setCommunityListAdd.tag('setCommunityList'),
		setCommunityListDelete.tag('setCommunityList'),
		setCommunityList.tag('setCommunityList'),
		setCommunityListUNK.logResult((res) => `[arista_cfg_route_map]: unrecognized set community-list statement: '${res}'`).tag('setCommunity').tag('setCommunityList'),

		setCommunityClear.tag('setCommunity'),
		setCommunityAdd.tag('setCommunity'),
		setCommunityDelete.tag('setCommunity'),
		setCommunity.tag('setCommunity'),
		setCommunityUNK.logResult((res) => `[arista_cfg_route_map]: unrecognized set community statement: '${res}'`).tag('setCommunity'),

		setExtCommunityListAdd.tag('setExtCommunityList'),
		setExtCommunityListDelete.tag('setExtCommunityList'),
		setExtCommunityList.tag('setExtCommunityList'),
		setExtCommunityListUNK.logResult((res) => `[arista_cfg_route_map]: unrecognized set extcommunity-list statement: '${res}'`).tag('setCommunity').tag('setExtCommunityList'),

		setExtCommunityClear.tag('setExtCommunity'),
		setExtCommunityAdd.tag('setExtCommunity'),
		setExtCommunityDelete.tag('setExtCommunity'),
		setExtCommunity.tag('setExtCommunity'),
		setExtCommunityUNK.logResult((res) => `[arista_cfg_route_map]: unrecognized set -extcommunity statement: '${res}'`).tag('setExtCommunity'),

		setLrgCommunityListAdd.tag('setLrgCommunityList'),
		setLrgCommunityListDelete.tag('setLrgCommunityList'),
		setLrgCommunityList.tag('setLrgCommunityList'),
		setLrgCommunityListUNK.logResult((res) => `[arista_cfg_route_map]: unrecognized set large-community-list statement: '${res}'`).tag('setCommunity').tag('setLrgCommunityList'),

		setLrgCommunityClear.tag('setLrgCommunity'),
		setLrgCommunityAdd.tag('setLrgCommunity'),
		setLrgCommunityDelete.tag('setLrgCommunity'),
		setLrgCommunity.tag('setLrgCommunity'),
		setLrgCommunityUNK.logResult((res) => `[arista_cfg_route_map]: unrecognized set large-community statement: '${res}'`).tag('setLrgCommunity'),

		setPrepend.tag('setPrepend'),
		setPrepend_lastAS.tag('setPrepend_lastAS'),
		setLocalPref.tag('setLocalPref'),
		setRest.tag('setRest'),

		continues.tag('continues'),
		unknown.logResult( (res)=> `[module:${pmodule.name}, parser:routeMapEntry] unrecognized text: '${res}'`)
	).named('routeMapEntry')


	// helper for routeMapRecord
	const appendValues = (prevVal,newVal) => `${prevVal}\n,${newVal}`

	const routeMapRecord = parseSection(
		seqOf(
			routeMapHeader.tag('routeMapName'),
			// NOTE: collectTagged is used when you use 'many' to gather attributes of a single record.  You do not use tagList() for this.  The item must also be flattened manually at the end.
			many(routeMapEntry),
		).getTaggedR()
	).logEnv( ({
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
			`[routeMapRecord] (${deviceName}): The section parser generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
			section_parser_dataLog.map( (entry) => `  ${entry}` ),
		] : [],
		// if the section parser skips text for any reason, report it...
		(section_text_unparsed?.length > 0) ? [
			`[routeMapRecord] (${deviceName}): The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
			`  '${section_text_unparsed}'`,
		] : [],

	])).named('routeMapRecord')
		.map(flattenItem)


	const formatColumns = ({
		routeMapName,
		seqNo,
		action,
		desc,
		subRouteMap,
		matchPrefixList,
		matchTag,
		matchCommunity,
		matchExtCommunity,
		matchLrgCommunity,
		matchRest,
		setCommunityList,
		setCommunity,
		setExtCommunityList,
		setExtCommunity,
		setLrgCommunityList,
		setLrgCommunity,
		setPrepend,
		setPrepend_lastAS,
		setLocalPref,
		setRest,
		continues,
		...rest
	}) => ({
		deviceName,
		routeMapName,
		seqNo,
		action,
		desc,
		subRouteMap,
		matchPrefixList,
		matchTag,
		matchCommunity,
		matchExtCommunity,
		matchLrgCommunity,
		matchRest,
		setCommunityList,
		setCommunity,
		setExtCommunityList,
		setExtCommunity,
		setLrgCommunityList,
		setLrgCommunity,
		setPrepend,
		setPrepend_lastAS,
		setLocalPref,
		setRest,
		continues,
		rest: `(${pmodule.name}): ${(Object?.keys(rest ?? {}) ?? '').join(',')}`,
	})
	

	return seqOf(
		gotoSection('route-map'),
		many(routeMapRecord),
	).map((res)=>res[1])
		.map(mapArray(formatColumns))
		// .dataLog_toResult()
}



// comment this out when using in production.  Uncomment when running in ipTools IDE
// eos_cfg_route_maps('somedevice')



// comment this out when using in-browser IDE
export { eos_cfg_route_maps }


