/**
 * ToDo:
 * 
 * 1. This works, but uses legacy .map(getTagged).  When this gets converted to .getTaggedR(), it fails.  Why?
 * 
 * 2. Get rid of 'jumpToLine' below
 * 
 * 3. Convert to prooper logging - logResult, logEnv, etc.
 * 
 * 4. Also the BGP community parser is used inside of other parsers.  Make sure these align.
 * 
 * 5. This is still very dated.  Update it.  See if 'addTag' can be eliminated using .chain()
 * 
 * 6. Documentation needs to be modernized.
 * 
 * 
 */



/**  Comment out this import and export at bottom when using in browser sandbox     */
import { sp } from '../../Parser_Text.mjs'
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
	multiplyBy_v2,
	nullToArray,

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
	eol,
	tok,

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

/****************************************************************************
 * module: 			${pmodule.name}
 *	description:	parses a single arista configuration file for the following:
 *		'ip community-list' statements
 *		'ip extcommunity-list' statements
 *		'ip large-community-list' statements
 *
 *	Note: does not handle multiple-communities in a single CL very well. 
 *		Multi-value community-lists are tagged with a 'format' property of value 'multi',
 *		But this is just for identifying community-lists which would otherwise be problematic.
 *		Until his is fixed in 'Future wor" not below, any community-list entries with a format of
 *		'multi' should ignore the "left" and "right" values, and parse the 'value', which contains multiple
 *		values, into separate steps.
 *
 *	Future work: parse multi-values appropriately, and return two community-list entries (same name)
 *		with a 'multi' property set to 'true', and each entry in the array is a proper community-list record,
 *		each with it's 'format' properly set.  Will need some refactoring.
 *
 *	output:	Table of extended-community-list names to values & other descriptive metadata
 *  version:			2  
 *
 *  related links: 
 *   //  Link below has information on 'asn mode' regular expressions, which are different than normal regex.
 *   https://www.arista.com/en/support/toi/eos-4-21-1f/14079-asn-mode-regular-expressions-for-bgp-as-path-attributes
 *		// extended community format
 *		https://www.arista.com/en/um-eos/eos-border-gateway-protocol-bgp#xx1116839
 */


/**************************************************************
 * General/shared sub-line parsers / helpers - 
 */
const std_left 						= digits				// standard community - 16-bit ASN left side

const ext_routeTarget_left_asn 			= digits				// extended community - 32-bit ASN for left left side (route-target, site-of-origin)
const ext_routeTarget_left_ipaddr 	= ipAddress			// extended community - 32-bit ip address for left side (route-target, site-of-origin)
const ext_link_bandwidth						= digits				// extended community - link bandwidth (bits/sec)

const lrg_left_asplain		= digits				// large communities - the left field as as-plain ASN (32bit)
const lrg_left_asdot			= sequenceOf([	// large communities - the left field as as-dot ASN (16bit.16bit)
	digits, 
	strng('.'), 
	digits
]).map( ([as_dot_left, , as_dot_right]) => `${as_dot_left}.${as_dot_right}` )

const lrg_left 			= oneOf( 			// large communities - as_plain or as_dot
	lrg_left_asdot, 
	lrg_left_asplain
)
const lrg_mid 				= digits				// large communities - the middle field (16 or 32-bit number)

const right 					= digits				// all communities - right value (16 bits for standard, 32 bits for ext/large)


const std_community_value = sequenceOf(
	std_left.tagAs('left'),	
	':', 
	right.tagAs('right')
).map( ({left, right}) => ({
	left,
	right,
	value: 	`${left}:${right}`,
}))

const ext_community_route_target = sequenceOf(
	'rt ',
	ext_routeTarget_left_asn.tagAs('left'),
	':',
	right.tagAs('right'),
).map( ({left, right }) => ({
	left,
	right,
	value: 	`${left}:${right}`,
	format: 'rt-asn',
}))


const ext_community_value_rt_ip_addr = sequenceOf(
	'rt ',
	ipAddress.tagAs('left'),
	':',
	right.tagAs('right'),
).map( ({left, right }) => ({
	left,
	right,
	value: 	`${left}:${right}`,
	format: 'rt-ip',
}))
	

const ext_community_value_linkbw = sequenceOf(
	'lbw ',
	ext_link_bandwidth.tagAs('value'),
).getTagged()
	.map(addTag('format', 'lbw')) 			


const lrg_community_value = sequenceOf(
	lrg_left.tagAs('left'),
	':',
	lrg_mid.tagAs('mid'),
	':',
	right.tagAs('right'),
).getTaggedR()
	.map( ({left, mid, right }) => ({
		left,
		mid,
		right,
		value: 	`${left}:${mid}:${right}`,
		format: 'value',
	}))


 
const eos_cfg_community_list = (deviceName) => {
	
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_community_list',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,													// future capability
		usage: ``,												// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}
	
	
	/**************************************************************
	 * Standard (16-bit) Community Section
	 **************************************************************/

	// 16-bit community value for current EOS versions
	const std_community_value = parseLine(
		'ip community-list',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		std_left.tagAs('left'),		
		':',
		right.tagAs('right'),
		everythingUntil(eol).tagAs('more'),
	).getTagged()
		.map( ({left, right, value, more, ...rest }) => ({
			left,
			right,
			value: 	more ? `${left}:${right} ${more}` : `${left}:${right}`,
			format: more ? 'multi' : 'value',
			...rest,
			more,
		}))

	// 16-bit community value for older EOS versions
	const std_community_value_legacy = parseLine(
		'ip community-list standard',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		std_left.tagAs('left'),
		':',
		right.tagAs('right'),
		everythingUntil(eol).tagAs('more'),
	).getTagged()
		.map( ({left, right, value, more, ...rest }) => ({
			left,
			right,
			value: more ? `${left}:${right} ${more}` : `${left}:${right}`,
			format: more ? 'multi' : 'value',
			...rest,
			more,
		}))

	// 16-bit community regex (asn mode regex - see note above) for current EOS versions
	const std_community_regex = parseLine(
		tok('ip community-list regexp'),
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		everythingUntil(eol).tagAs('value'),
	).getTagged()
		.map(addTag('format', 'regexp'))

	// 16-bit community regex (asn mode regex - see note above) for older EOS versions
	const std_community_regexp_legacy = parseLine(
		'ip community-list expanded',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		everythingUntil(eol).tagAs('value'),
	).getTagged()
		.map(addTag('format', 'regexp'))

	// 16-bit catch-all parser for unrecognized patterns
	const std_community_UNK = parseLine(
		'ip community-list', 
		rol.map( (res)=> `UNKNOWN line: ip community-list ${res}` ).tagAs('communityListName')
	).getTagged()
		.map(addTag('format', 'PARSE_ERROR'))

	// remember that order is important here - more specific first!
	const std_community_list_entry = oneOf(
		std_community_value_legacy,
		std_community_regexp_legacy,
		std_community_regex,
		std_community_value,
		std_community_UNK.log(`[${pmodule.name}]: UNKNOWN std_community_list_entry`),
	).map(addTag('type', 'standard'))
 


	/**************************************************************
	 * Extended Community Section
	 **************************************************************/

	// 	rt asn:nn 			Route Target, as specified by autonomous system:number.	
	const ext_community_value_rt_asn =  parseLine (
		'ip extcommunity-list',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		'rt',
		ext_routeTarget_left_asn.tagAs('left'),
		':',
		right.tagAs('right'),
		everythingUntil(eol).tagAs('more'),
	).getTagged()
		.map( ({left, right, value, more, ...rest }) => ({
			left,
			right,
			value: 	more ? `rt ${left}:${right} ${more}` : `${left}:${right}`,
			format: more ? 'multi' : 'rt-asn',
			...rest
		}))
		.map(addTag('type', 'extended'))

	//	rt ip_addr:nn 	Route Target, as specified by ip address:number.
	const ext_community_value_rt_ip_addr 	=  parseLine(
		'ip extcommunity-list',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		'rt',
		ipAddress.tagAs('left'),
		':',
		right.tagAs('right'),
		everythingUntil(eol).tagAs('more'),
	).getTagged()
		.map( ({left, right, value, more, ...rest }) => ({
			left,
			right,
			value: 	more ? `rt ${left}:${right} ${more}` : `${left}:${right}`,
			format: more ? 'multi' : 'rt-ip',
			...rest,
			more,
		}))

	//	soo aa:nn 			Site of Origin, as specified by autonomous system:number.
	const ext_community_value_soo_asn 		=  parseLine(
		'ip extcommunity-list',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		'soo',
		ext_routeTarget_left_asn.tagAs('left'),
		':',
		right.tagAs('right'),
		everythingUntil(eol).tagAs('more'),
	).getTagged()
		.map( ({left, right, value, more, ...rest }) => ({
			left,
			right,
			value: 	more ? `soo ${left}:${right} ${more}` : `${left}:${right}`,
			format: more ? 'multi' : 'soo-asn',
			...rest,
			more,
		}))

	//	soo ip_addr:nn 	Site of origin, as specified by ip address:number.
	const ext_community_value_soo_ip_addr	=  parseLine(
		'ip extcommunity-list',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		'soo',
		ipAddress.tagAs('left'),
		':',
		right.tagAs('right'),
		everythingUntil(eol).tagAs('more'),
	).getTagged()
		.map( ({left, right, value, more, ...rest }) => ({
			left,
			right,
			value: 	more ? `soo ${left}:${right} ${more}` : `${left}:${right}`,
			format: more ? 'multi' : 'soo-ip',
			...rest,
			more,
		}))

	//	lbw 						Link Bandwidth - in bits per second.
	// NOTE: does not handle 'multi' 
	const ext_community_value_lbw = parseLine(
		'ip extcommunity-list', 
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		'lbw',
		ext_link_bandwidth.tagAs('value'),
	).getTagged()
		.map(addTag('format', 'lbw')) 			

	//	regex						
	const ext_community_regexp = parseLine (
		tok('ip extcommunity-list regexp'),
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		everythingUntil(eol).tagAs('value'),
	).getTagged()
		.map(addTag('format', 'regexp'))

	// unmatched
	const ext_community_UNK = parseLine(
		'ip extcommunity-list', 
		rol.map( (res)=> `UNKNOWN line: ip extcommunity-list ${res}` ).tagAs('communityListName')
	).getTagged()
		.map(addTag('format', 'PARSE_ERROR'))

	const ext_community_list_entry = oneOf(
		ext_community_value_rt_ip_addr,
		ext_community_value_rt_asn,
		ext_community_value_soo_ip_addr,
		ext_community_value_soo_asn,
		ext_community_value_lbw,
		ext_community_regexp,
		ext_community_UNK.log(`[${pmodule.name}]: UNKNOWN ext_community_list_entry`),
	).map(addTag('type', 'extended'))
		

	/**************************************************************
	 * Large BGP Community Section
	 **************************************************************/

	const lrg_community_value = parseLine(
		'ip large-community-list',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		lrg_left.tagAs('left'),
		':',
		lrg_mid.tagAs('mid'),
		':',
		right.tagAs('right'),
		everythingUntil(eol).tagAs('more'),
	).getTagged()
		.map( ({left, mid, right, more, ...rest }) => ({
			left,
			mid,
			right,
			value: 	more ? `${left}:${mid}:${right} ${more}` : `${left}:${mid}:${right}`,
			format: more ? 'multi' : 'value',
			...rest,
			more,
		}))


	const lrg_community_regexp = parseLine (
		'ip large-community-list regexp',
		hword.tagAs('communityListName'),
		oneOf('permit', 'deny').tagAs('action'),
		everythingUntil(eol).tagAs('value'),
	).getTagged()
		.map(addTag('format', 'regexp'))

	const lrg_community_UNK = parseLine(
		'ip large-community-list', 
		rol.map(  (res)=> `UNKNOWN line: ip large-community-list ${res}` ).tagAs('communityListName')
	).getTagged()
		.map(addTag('format', 'PARSE_ERROR'))

	const lrg_community_list_entry = oneOf(
		lrg_community_regexp,
		lrg_community_value,
		lrg_community_UNK.log(`[${pmodule.name}]: UNKNOWN lrg_community_list_entry`),
	).map(addTag('type', 'large'))


	/**************************************************************
	 * Final Processing Section
	 **************************************************************/

	const jumptoline = (_string) => seqOf(
		goto (_string),			// up to, but not including this line
		strng('\n'),							// grab that final newline before strng
	)	// now the parser is at the line starting at supplied string

	const jumpto_ip_community_list = jumptoline('\nip community-list')

	const get_std_community_list_entries = possibly(lookAhead(
		seqOf(
			jumptoline('\nip community-list'),
			many(std_community_list_entry).tagAs('std_community_list_entries')
		).getTagged()
			.map(multiplyBy_v2('std_community_list_entries'))
	)).map(nullToArray)

	const get_ext_community_list_entries = possibly(lookAhead(
		seqOf(
			jumptoline('\nip extcommunity-list'),
			many(ext_community_list_entry).tagAs('ext_community_list_entries')
		).getTagged()
			.map(multiplyBy_v2('ext_community_list_entries'))
	)).map(nullToArray)
	
	const get_lrg_community_list_entries = possibly(lookAhead(
		seqOf(
			jumptoline('\nip large-community-list'),
			many(lrg_community_list_entry).tagAs('lrg_community_list_entries')
		).getTagged()
			.map(multiplyBy_v2('lrg_community_list_entries'))
	)).map(nullToArray)

	// identity function for now
	const formatResults = ({
		communityListName,
		action,
		type,
		format,
		value,
		left,
		mid,
		right,
		more,
		...rest
	}) => {
		const returnVal = {
			communityListName,
			action,
			type,
			format,
			value,
			left:		more ? '' : left,
			mid:		more ? '' : mid,
			right: 	more ? '' : right,
			...rest
		}
		return returnVal
	}

	
	return seqOf(
		get_std_community_list_entries.tagAs('std_entries'),
		get_ext_community_list_entries.tagAs('ext_entries'),
		get_lrg_community_list_entries.tagAs('lrg_entries'),
	).getTagged()

	// this part below maps individual lists to a single list
		.map( ({
			std_entries,
			ext_entries,
			lrg_entries
		}) => ([
			...std_entries,
			...ext_entries,
			...lrg_entries
		]))

	// refine the column output  as defined by the above function formatResults
		.map(mapArray(formatResults))
		.dataLog_toResult()
}
		
// end of v2 module ${pmodule.name}



// comment this out when using in production
// eos_cfg_community_list('test_device_name')

// comment this out when using in-browser
export {
	// community-list parser for EOS 
	eos_cfg_community_list,

	// community value parsers (used by community-list as well as other parsers)
	std_community_value,
	ext_community_route_target,
	ext_community_value_linkbw,
	ext_community_value_rt_ip_addr,
	ext_link_bandwidth,
	lrg_community_value,
}