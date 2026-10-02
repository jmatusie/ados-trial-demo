/**	Comment out this import and export at bottom when using in browser sandbox		*/

import {
	// from Parser_Result_helpers.mjs
	filterArray,
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	groupByPropName,
	normalizedDataSet,
	nullToStr,
	pipe,
	asBoolean,
	match,


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
	ifNotFound,
	sepBy,

	// from Parser_Text.mjs
	parseLine,
	letters,
	word,
	digits,
	rol,
	hword,
	at_eol,
	eol,

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	ipNetworkOrAddress,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
} from '../parser_modules.mjs'


/****************************************************************************
* module: 			get_nxcfg_vlans
*	description:	a single Nexus switch's entire set of globally-defined vlans
*	output:				table containing the following (one line per vlan ID):
*
*      	vlandID:						the numeric ID of the VLAN
*				name:								the name assigned to the VLAN	
*/
const get_nxcfg_vlans = (deviceName) => {
	const vlanName = regex(/^[A-Za-z0-9{}:\-_]+/)
	const vlanId = digits

	const vlanRec = seqOf(
		parseLine('vlan', vlanId).map(result=>result[1])		.tag('vlan_id'),
		possibly(parseLine('name', vlanName).map(result=>result[1])).map(ifNotFound('')).tag('vlan_name'),
	).getTaggedR()


	const formatColumns = ({
		...vlanRec
	}) => ({
		deviceName,
		...vlanRec
	})


	return seqOf(
		gotoStr('\nvlan'),
		'\n',
		many(vlanRec).tagList('vlanRecs'),
	).getTaggedR()
	.map(res=>res['vlanRecs'])
	.map(mapArray(formatColumns))

	//.map(flattenItem)
	//.map(multiplyBy('vlanRecs'))
}


// comment this out when using in production
//	get_nxcfg_vlans('test_device_name')
 
 
// comment this out when using in-browser IDE
export { 
	get_nxcfg_vlans,
}


 
 
 
 