// uncomment the import below for production, as well as the export at the bottom


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
	eol,
	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,

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

	// from ClassIPv4.mjs
	IPv4,

} from '../parser_modules.mjs'

/****************************************************************************
* module: 			nxos_cfg_route_map
*	description:	parses a single NXOS configuration file for route-maps
*	output:				table of route-map entries per switch
*/


const get_nxcfg_route_maps = (deviceName) => {
	const pmodule = {
		name: 'get_eoscfg_route_maps',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: {
			'deviceName': 				``,
			'routeMapName': 			``,
			'seqNo': 							``,
			'action': 						``,
			'desc': 							``,
			'subRouteMap': 				``,
			'matchPrefixList': 		``,
			'matchTag': 					``,
			'matchCommunity': 		``,
			'matchExtCommunity': 	``,
			'matchLrgCommunity': 	``,
			'matchRest': 					``,
			'setCommunityList': 	``,
			'setCommunity': 			``,
			'setExtCommunityList':``,
			'setExtCommunity': 		``,
			'setLrgCommunityList':``,
			'setLrgCommunity': 		``,
			'setPrepend': 				``,
			'setPrepend_lastAS': 	``,
			'setLocalPref': 			``,
			'setRest': 						``,
			'continues': 					``,
			"skippedCols": 		'Lists the parser module that neglected to include previously parse column names.  Ideally equal to "", but provides insight to where lost data went',
		},
	}
	
	

	const hostname  = hword
	const vlanName = hword
	const vlanID = digits
	const routeMapName = regex(/^[a-zA-Z0-9-_\.]+/)
	
	const action = oneOf('permit', 'deny')
	const seqNo = digits
	const asn = digits
	const leftComm = digits
	const rightComm = digits

  
	// raw per-line parsers
	const routeMapHeader 	= parseLine('route-map', routeMapName.tag('routeMapName'), action.tag('action'), seqNo.tag('seqNo'))//.map(([,name,action,seqNo])=>({name,action,seqNo}))
	const	matchMcastAddr	=	parseLine('match ip multicast group', ipNetwork).map((res)=>res[1])
	const	matchMcastRange	=	parseLine('match ip multicast group-range', ipAddress, 'to', ipAddress).map( ([_0, startIP, _2, endIP]) => IPv4.createPrefixesBetween(startIP, endIP, {inclusive:true}).toString())
	const matchPrefixList = parseLine('match ip address prefix-list', hword).map((result)=>result[1])
	const matchPrefixList_pbr = parseLine('match ip address', hword).map((result)=>result[1]).map(addTag('type:PBR'))
	const matchTag 				= parseLine('match tag', digits).map((result)=>result[1])
	const matchCommunity	= parseLine('match community', hword).map((result)=>result[1])
	const setCommunity		= parseLine('set community', leftComm, ":", rightComm).map((result)=>`${result[1]}:${result[3]}`)
	const setLocalPref		= parseLine('set local-preference', digits).map((result)=>result[1])
	const setPrepend			= parseLine('set as-path prepend', asn, many(tok(asn))).map((result)=>`${result[1]}(x${result[2].length+1})`)
	const desc						= parseLine('description', everythingUntil(eol) ).map((result)=>result[1])
	const unmatched				= parseLine(rol).map((result)=>result[0])
	const newLine					= parseLine('route-map')

	const routeMapEntry =	oneOf(
		matchMcastAddr.tag('matchMCAddr'),
		matchMcastRange.tag('matchMCRange'),
		matchPrefixList.tag('matchPrefixList'),
		setCommunity.tag('setCommunity'),
		matchCommunity.tag('matchCommunity'),
		matchTag.tag('matchTag'),
		desc.tag('desc'),
		setPrepend.tag('setPrepend'),
		setLocalPref.tag('setLocalPref'),
		matchPrefixList_pbr.tag('matchPrefixList_PBR'),
		//unmatched					.tag('unmatched'),
	).map(flattenItem)
	
	const parseRouteMap = seqOf(
		routeMapHeader,
		many(routeMapEntry).tag('routeMapEntries'),
	).getTaggedR()
		.map(flattenItem)

	const recordDelimiter = oneOf(strng('\nroute-map'), strng('\nvrf'))

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
		...skipped
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
		_key_: `${deviceName}:${routeMapName}`,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})
	





	return seqOf(
		gotoStr('route-map'),
		many(parseRouteMap)
	).map((res)=>res[1])
}




// get_nxcfg_route_maps('testdeviceanme)')



export { get_nxcfg_route_maps }

