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
	flatMapArray,
} from '../parser_modules.mjs'



/** SECTION 1: module metadata ****/
const pmodule = {
	name: 'get_eoscfg_vlans',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
	ver: 1.0,									  // future capability
	usage: '',							  	// future capability to provide help (may not be used)
}




/****************************************************************************
* module: 			get_eoscfg_vlans
*	description:	a single Arista switch's entire set of globally-defined vlans
*	output:				table containing the following (one line per vlan ID):
*
*      	vlandID:						the numeric ID of the VLAN
*				name:								the name assigned to the VLAN	
*/
const get_eoscfg_vlans = (deviceName) => {

	const vlanHeader1 = parseLine('vlan', digits.tag('vlan_id'), at_eol)
	const vlanHeader3 = parseLine('vlan', sepBy(strng(','))(digits)).map(res=>res[1]) // will return an array of vlan IDs (to be )
	

	const vlanHeader2 = parseLine('vlan', digits, "-", digits).map(([_, _from, __, _to]) => {
		const from = parseInt(_from)
		const to = parseInt(_to)
		const result = []
		let c;
		for (c=from; c<=to; c++) {
			result.push(c)
		}
		return result
	})
	

	// per-line parsers 
	const vlanName = parseLine('name', hword.tag('vlan_name'))
	const trunkGroup = parseLine('trunk group', hword.tag('vlan_trunk_group'))
	const floodSet = parseLine('floodset expanded vlan', digits.tag('vlanId'))
	const vlanOther = parseLine(rol).map(res=>res[0]).tag('vlan_UNK')

	const vlanConfigLine = oneOf(
		vlanName,
		trunkGroup,
		floodSet,
		vlanOther,
	)

	const vlanRecSingle = seqOf(
		vlanHeader1,
		until('!', many(vlanConfigLine)),
		parseLine('!')
	).getTaggedR()


	const vlanRecMulti = seqOf(
		oneOf(vlanHeader2, vlanHeader3).tagList('vlan_ids'),
		until('!', many(vlanConfigLine)),
		parseLine('!'),
		succeedWith(true).tag('fromRange')
	).getTaggedR()
	//.map(multiplyBy('vlan_ids')).tagList('multi_vlan_recs')
	//.getTaggedR()


	const vlanRec = oneOf(
		vlanRecSingle,
		vlanRecMulti
	)


	const formatColumns = ({
		vlan_id,
		vlan_ids,
		...vlanRec
	}) => ({
		deviceName,
		vlan_id: vlan_ids ?? vlan_id,
		...vlanRec
	})


	return seqOf(
		gotoSection('vlan'),
		many(vlanRec)	.tagList('vlanRecs'),
	).getTaggedR()
	.map(res=>res.vlanRecs)
	.map(flatMapArray(multiplyBy('vlan_ids')))
	.map(mapArray(formatColumns))

}

// comment this out when using in production
//	get_eoscfg_vlan('test_device_name')
 
 
// comment this out when using in-browser IDE

export { 
	get_eoscfg_vlans,
}


 
 
 
 