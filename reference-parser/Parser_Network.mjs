/********** MODULE-START: Parser *******
 * @module NetworkParser
 * @version 22-Mar-23
 * @requires Parser
 * 
 * @description A monoidal, parser combinator library for parsing semi-structured text files
 * and optimized for network automation purposes
 */

import {
	Parser,
	regex,
	lookAhead,
	many, fail, succeedWith, possibly,
	sequenceOf,
	choice,
	seqOf,
	oneOf, char
} from './Parser_Core.mjs'


import {
	nbsp,					// matches 1 or more non-breaking space (space or tab)
	digits, 
	hword, 
	hexDigits,

	// line parsers
	parseLine
} from "./Parser_Text.mjs"


import {
	goto, 
	until,
	endOfIndentLevel,
} from "./Parser_FlexParser.mjs"


// import {} from "./DataSet_Transformers.mjs"






///////////////////////////////////////////////////////////////////////
// IPv4 Module
// (local) lookup tables for subnet mask calculations:
///////////////////////////////////////////////////////////////////////

// (local) lookup tables for subnet mask calculations
const mask_from_maskStr_Map = new Map([
	["0.0.0.0", 0],
	["128.0.0.0", 2147483648],
	["192.0.0.0", 3221225472],
	["224.0.0.0", 3758096384],
	["240.0.0.0", 4026531840],
	["248.0.0.0", 4160749568],
	["252.0.0.0", 4227858432],
	["254.0.0.0", 4261412864],
	["255.0.0.0", 4278190080],
	["255.128.0.0", 4286578688],
	["255.192.0.0", 4290772992],
	["255.224.0.0", 4292870144],
	["255.240.0.0", 4293918720],
	["255.248.0.0", 4294443008],
	["255.252.0.0", 4294705152],
	["255.254.0.0", 4294836224],
	["255.255.0.0", 4294901760],
	["255.255.128.0", 4294934528],
	["255.255.192.0", 4294950912],
	["255.255.224.0", 4294959104],
	["255.255.240.0", 4294963200],
	["255.255.248.0", 4294965248],
	["255.255.252.0", 4294966272],
	["255.255.254.0", 4294966784],
	["255.255.255.0", 4294967040],
	["255.255.255.128", 4294967168],
	["255.255.255.192", 4294967232],
	["255.255.255.224", 4294967264],
	["255.255.255.240", 4294967280],
	["255.255.255.248", 4294967288],
	["255.255.255.252", 4294967292],
	["255.255.255.254", 4294967294],
	["255.255.255.255", 4294967295],
])

// (local) lookup tables for inverse mask calculations
const mask_from_invertedMaskStr_Map = new Map([
	["255.255.255.255", 0],
	["127.255.255.255", 2147483648],
	["63.255.255.255", 3221225472],
	["31.255.255.255", 3758096384],
	["15.255.255.255", 4026531840],
	["7.255.255.255", 4160749568],
	["3.255.255.255", 4227858432],
	["1.255.255.255", 4261412864],
	["0.255.255.255", 4278190080],
	["0.127.255.255", 4286578688],
	["0.63.255.255", 4290772992],
	["0.31.255.255", 4292870144],
	["0.15.255.255", 4293918720],
	["0.7.255.255", 4294443008],
	["0.3.255.255", 4294705152],
	["0.1.255.255", 4294836224],
	["0.0.255.255", 4294901760],
	["0.0.127.255", 4294934528],
	["0.0.63.255", 4294950912],
	["0.0.31.255", 4294959104],
	["0.0.15.255", 4294963200],
	["0.0.7.255", 4294965248],
	["0.0.3.255", 4294966272],
	["0.0.1.255", 4294966784],
	["0.0.0.255", 4294967040],
	["0.0.0.127", 4294967168],
	["0.0.0.63", 4294967232],
	["0.0.0.31", 4294967264],
	["0.0.0.15", 4294967280],
	["0.0.0.7", 4294967288],
	["0.0.0.3", 4294967292],
	["0.0.0.1", 4294967294],
	["0.0.0.0", 4294967295],
])


const validMasks = [
	0,
	2147483648,
	3221225472,
	3758096384,
	4026531840,
	4160749568,
	4227858432,
	4261412864,
	4278190080,
	4286578688,
	4290772992,
	4292870144,
	4293918720,
	4294443008,
	4294705152,
	4294836224,
	4294901760,
	4294934528,
	4294950912,
	4294959104,
	4294963200,
	4294965248,
	4294966272,
	4294966784,
	4294967040,
	4294967168,
	4294967232,
	4294967264,
	4294967280,
	4294967288,
	4294967292,
	4294967294,
	4294967295,
]


///////////////////////////////////////////////////////////////////////
// IPv4 Module
// (local) regex(s) to validate dotted decimal (IP address format):
///////////////////////////////////////////////////////////////////////

// match dotted decimal notation - basic version (does not handle invalid octets linke this: 172.16.334.257)
const ipv4_regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9]?[0-9])\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/
// may be slower, but handles invalid octets as well (i.e. 10.355.1.2)
const ipv4_regex_strict = /^(?<!\d)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?!\d)/


///////////////////////////////////////////////////////////////////////
// IPv4 Module
// (local) functions to validate / clean IP address input:
///////////////////////////////////////////////////////////////////////

// cleans badly-formatted IP address strings (gets rid of leading zeros)
function normalized_ipString(ipString) {
	return ipString ? ipString.split('.').map((/** @type {string} */ octet) => parseInt(octet)).join('.') : null
}

// returns the prefix length, given a normal subnet mask string
/**
 * @param {string} ipMaskString
 */
function maskLength_fromMaskString(ipMaskString) {
	const mask = mask_from_maskStr_Map.get(ipMaskString)
	const returnVal = validMasks.indexOf(mask)
	return (returnVal == -1) ? null : returnVal
}

// returns the prefix length, given an inverted mask string
function maskLength_fromInverseMaskString(ipInverseMaskString) {
	const mask = mask_from_invertedMaskStr_Map.get(ipInverseMaskString)
	const returnVal = validMasks.indexOf(mask)
	return (returnVal == -1) ? null : returnVal
}

// returns true if the IP address is in the multicast range.
function is_ipv4_multicast(ipString) {
	const octets = ipString.split('.').map((octet) => parseInt(octet))
	return ((octets[0] >> 4 === 14) &&    // 1st octet between 224-239
		(octets[1] >> 8 === 0) &&
		(octets[2] >> 8 === 0) &&
		(octets[3] >> 8 === 0))
		?? false
}

// returns true if the IP address is NOT a multicast address.  Does not validate further than this logic
function isnot_ipv4_multicast(ipString) {
	const octets = ipString.split('.').map((octet) => parseInt(octet))
	return ((octets[0] >> 4 !== 14) &&    // 1st octet not between 224-239
		(octets[0] >> 8 === 0) && 		// all octets between 0 and 255
		(octets[1] >> 8 === 0) &&
		(octets[2] >> 8 === 0) &&
		(octets[3] >> 8 === 0))
		?? false
}

// helps ensures a we don't see any '192.168.1.1/33' addresses...
const is_valid_maskLength = (parsedNumber_asString) => {
	const integer = parseInt(parsedNumber_asString)
	return (integer >= 0 && integer <= 32)
}


///////////////////////////////////////////////////////////////////////
// IPv4 Module
// public parsers
///////////////////////////////////////////////////////////////////////

// parses a single IP address, does not parse any '/' or subnet mask.  
// returns: a normalized IPv4 string.
const ipAddress = regex(ipv4_regex_strict).map((ipString) => ipString.split('.').map((octet) => parseInt(octet)).join('.'))
	.named('ipAddress')
	.mapError( ({error,index,data,pname}) => `[ipAddress]: failed at index ${index}.  Underlying error message is ${error}`)

// parses strings from '0' to '32', but does not consume the '/'
// returns: a string number '0' to '32'
const ipMaskLength = regex(/^\d{1,2}/).chain( (res) => is_valid_maskLength(res) 
	? succeedWith(res).named('ipMaskLength(p)')
	: fail(`[ipMaskLength]: not a valid mask length`)
)

// parser that consumes a subnet mask  (does not work for inverse masks)
const ipMask = new Parser(function ipMask(state) {
	const pname = 'ipMask'
	const { target, index } = state
	const ipv4_regex_match = target.slice(index).match(ipv4_regex_strict)
	if (!ipv4_regex_match) {					// make sure it's formatted in dotted decimal first
		return Parser.updateError(state, `[ipMask]: ParseError (at index ${index}): No IP mask at location.\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const foundIP = normalized_ipString(ipv4_regex_match[0])
	const ipv4_mask_length = maskLength_fromMaskString(foundIP)
	if (ipv4_mask_length === null) {
		return Parser.updateError(state, `[ipMask]: ParseError (at index ${index}): IP mask ${ipv4_regex_match[0]} is not a valid subnet mask\n\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const foundAt = ipv4_regex_match.index
	const foundLen = foundIP.length
	const newIndex = index + foundAt + foundLen
	return Parser.updateParserState(state, ipv4_mask_length.toString(), newIndex, pname)
}).named('ipMask')


// parser that consumes an inverted subnet mask (ala IOS ACLs)
const ipMaskInverted = new Parser(function ipMaskInverted(state) {
	const pname = 'ipMaskInverted'
	const { target, index } = state
	const ipv4_regex_match = target.slice(index).match(ipv4_regex_strict)
	if (!ipv4_regex_match) {					// make sure it's formatted in dotted decimal first
		return Parser.updateError(state, `[ipMaskInverted]: ParseError (at index ${index}): No inverted IP mask at location.\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const foundIP = normalized_ipString(ipv4_regex_match[0])
	const ipv4_mask_length = maskLength_fromInverseMaskString(foundIP)
	if (ipv4_mask_length === null) {
		return Parser.updateError(state, `[ipMaskInverted]: ParseError (at index ${index}): IP mask ${foundIP} is not a valid inverse mask\n\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const foundAt = ipv4_regex_match.index
	const foundLen = foundIP.length
	const newIndex = index + foundAt + foundLen
	return Parser.updateParserState(state, ipv4_mask_length.toString(), newIndex,pname)
}).named('ipMaskInverted')



// parses an ip address + mask.  **WILL FAIL**if not followed by a mask.  
// If a mask might not be there, use the 'ipAddressOrNetwork' parser
// returns: normalized IP address string + mask length in slash notation
// NOTE: This version fixes a bug due to the order of the oneOf below ()
// namely, '1.2.3.4/0.0.0.255' was being parsed as '1.2.3.4/0'...
const ipNetwork = seqOf(
	ipAddress,
	oneOf(
		ipMask,
		sequenceOf('/', ipMask).map( (result)=>result[1]),
		sequenceOf('/', ipMaskInverted).map( (result)=>result[1]),
		sequenceOf('/', ipMaskLength).map( (result)=>result[1]),
	)
).map((result) => result.join('/'))


// parses an ip address + mask.  **WILL FAIL**if not followed by a mask.  
// If a mask might not be there, use the 'ipAddressOrNetwork' parser
// returns: normalized IP address string + mask length in slash notation
const ipNetwork_prev = seqOf(
	ipAddress,
	oneOf(
		// Problem: '1.2.3.4/0.0.0.255' is being parsed as '1.2.3.4/0'...
		seqOf('/', ipMaskLength).map((result) => result[1]),
		seqOf( nbsp, ipMask).map((result) => result[1]),
		seqOf('/', ipMask).map((result) => result[1]),
		seqOf( nbsp, ipMaskInverted).map((result) => result[1]),
		seqOf('/', ipMaskInverted).map((result) => result[1]),
	)
).map((result) => result.join('/'))
	.named('ipNetwork')


// just like ipNetwork, but returns an object {prefix, mask} instead of a string
const ipNetwork_asObject = seqOf(
	ipAddress,
	oneOf(
		seqOf('/', ipMaskLength).map((result) => result[1]),
		seqOf( nbsp, ipMask).map((result) => result[1]),
		seqOf('/', ipMask).map((result) => result[1]),
		seqOf( nbsp, ipMaskInverted).map((result) => result[1]),
		seqOf('/', ipMaskInverted).map((result) => result[1]),
	)
).map((result) => ({prefix: result[0], mask: result[1]}))
	.named('ipNetwork')

// parses ip address + maybe a mask
// returns: a normalized IP address or network.  IP addresses have a '/32' appended.
const ipNetworkOrAddress = choice([
	ipNetwork,
	ipAddress.map((result) => result + '/32'),
]).named('ipNetworkOrAddress')

// parser that consumes an IP multicast address
const ipMC = new Parser(function ipMC(state) {
	const pname = 'ipMC'
	const { target, index } = state
	const ipv4_regex_match = target.slice(index).match(ipv4_regex_strict)
	if (!ipv4_regex_match) {					// make sure it's formatted in dotted decimal first
		return Parser.updateError(state, `[${pname}]: ParseError (at index ${index}): No IPv4 address at location.\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const foundIP = normalized_ipString(ipv4_regex_match[0])
	const foundAt = ipv4_regex_match.index
	const foundLen = foundIP.length
	if (isnot_ipv4_multicast(foundIP)) {
		return Parser.updateError(state, `[${pname}]: : ParseError (at index ${index}): IP address ${ipv4_regex_match[0]} is not a valid multicast address\n\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const newIndex = index + foundAt + foundLen
	return Parser.updateParserState(state, foundIP, newIndex, pname)
}).named('ipMC')


// parser that consumes an non-IP multicast address
const ipUC = new Parser(function ipUC$(state) {
	const pname = 'ipUC'
	const { target, index } = state
	const ipv4_regex_match = target.slice(index).match(ipv4_regex_strict)
	if (!ipv4_regex_match) {						// make sure it's formatted in dotted decimal first
		return Parser.updateError(state, `[ipUC]: ParseError (at index ${index}): No unicast IPv4 address at location.\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const foundIP = normalized_ipString(ipv4_regex_match[0])
	const foundAt = ipv4_regex_match.index
	const foundLen = foundIP.length
	if (is_ipv4_multicast(foundIP)) {
		return Parser.updateError(state, `[ipUC]: ParseError (at index ${index}): IP address ${ipv4_regex_match[0]} is a multicast address\n\nRemaining string:\n ${target.slice(index)}`, pname)
	}
	const newIndex = index + foundAt + foundLen
	return Parser.updateParserState(state, foundIP, newIndex, pname)
}).named('ipUC')



///////////////////////////////////////////////////////////////////////
// common network-related parsers
///////////////////////////////////////////////////////////////////////



// needs some refinement.  Maybe a MAC class can assist like IPv4??
const macAddress = sequenceOf([
	hexDigits,
	oneOf(':', '.', '-'),
	hexDigits,
	oneOf(':', '.', '-'),
	hexDigits,
]).map((result) => result.join(''))
	.named('macAddress')
	.mapError( ({error,index,data}) => `[macAddress] (index ${index}).  Failed to find a valid MAC address`)


const dnsName = seqOf(
	hword, 
	many(
		seqOf('.', hword)
	))
	.map((res) => res.flat(2))
	.map((result) => result.join(''))
	.named('dnsName')
	.mapError( ({error,index,data}) => `[dnsName]: failed to find a valid DNS name`)

const hostname = hword.named(`hostname`)
// advances parser to find the string '\n!hostname <hostname>' and returns <hostname>



///////////////////////////////////////////////////////////////////////
// interface name parser (handles EOS, NXOS, & IOS-specific for now)
///////////////////////////////////////////////////////////////////////


// Helper - associates shortcut names common in IOS & Arista output to real names
const getNormalizedInterfaceName = {
	Vl: "Vlan",
	Et: "Ethernet",
	Eth: "Ethernet",
	Gi: "GigabitEthernet",
	Lo: "Loopback",
	lo: "loopback",
	Po: "Port-channel",
	po: "port-channel",
	Ma: "Management",
	mgmt: "management"
}


// given an interface 'short name' realInt returns the formal name per the interfaceNameMap above
// Used to normalize output from CLIs when shortname is often used in "show" commands
const realInterfaceName = (intNameString) => getNormalizedInterfaceName[intNameString] ?? intNameString


// returns 'sequenceOf' parser from a user-supplied array of interface prefixes (strings) to match any interface name.  
// Matches:   <prefix><number><optional '/'><optional '.'> 
// NOTE: the strings in prefix array are first match, so should be in most-specific to least-specific order when one is a shortened version 
// of a longer name (i.e - 'Ethernet' before 'Eth')
const interfaceNameParserFrom = (interfaceNamePrefixes) => sequenceOf([
	oneOf(interfaceNamePrefixes).map(realInterfaceName),
	digits,
	many(
		sequenceOf([char('/'), hword]).map((result) => result.join(''))
	).map((result) => result.join('')),
	possibly(sequenceOf([char('.'), digits]).map((result) => result.join('')))
])


// pre-loaded interface names for most IOS & Arista interface names
// NOTE: the strings the supplied array first match, so should be in most-specific to least-specific order when one is a shortened version of a longer name (i.e - 'Ethernet' before 'Eth')
const interfaceName = interfaceNameParserFrom([
	'Ethernet', 'Eth', 'Et',
	'Vlan', 'Vl',
	'GigabitEthernet', 'Gi',
	'Port-Channel', 'Port-channel', 'Po',
	'Loopback', 'Lo',
	'MgmtEth', 'Mgmt', 'Management', 'Ma',
	'Null', 'null',
	'TenGigabitEthernet', 'TenGigE', 'Te',
	'HundredGigE', 'Hu',
	'Bundle-Ether',
	'Recirc-Channel', 'Re,',
	'Tunnel', 'Tu',
	'Vxlan', 'Vx',
].flatMap((entry) => ([entry, entry.toLowerCase()]))
).map((result) => result.join(''))
	.named('interfaceName')


// Arista section Parser



// end of section delimiter as string (doesn't handle \r\n)
const aristaSectionDelimiterStr = '\n!\n'
// or as regex for unix vs. windows handling automatically
const aristaSectionDelimiterRx = regex(/^[\n\r]+![\n\r]+/)

// // jump ahead to the Arista config section starting with supplied sectionString
// // This version uses regex to make it easier to work with configs that use line terminations of \r\n or \n
// const gotoSection = (sectionString) => {
// 	const sectionTerminatorRegExpSource = `\n!\n`
// 	const sectionTerminationRegx = new RegExp(sectionTerminatorRegExpSource + sectionString)
// 	return seqOf(
// 		goto(sectionTerminationRegx),
// 		regex(new RegExp('^' + sectionTerminatorRegExpSource))
// 	)
// }


// jump ahead to the text section marked by the sectionString
// as with other goto, 
// This version uses regex to make it easier to work with configs that use line terminations of \r\n or \n
const gotoSection = (sectionString) => {
	const newLine_regxSource = `((\r\n)|\r|\n)`       // matches one of (in order): CRLF, CR, or LF
	const sectionTerminationRegx = new RegExp(newLine_regxSource + sectionString)  // builds a RegExp without the preceding '^' anchor for goto
	return seqOf(
		goto(sectionTerminationRegx),
		regex(new RegExp('^' + newLine_regxSource))     // rebuilds regex
	).named(`gotoSection('${sectionString}')`)
		.ifError(`[gotoSection]: No '${sectionString}' statement found on device`)
}



//	// interface record examples...  all these produce equivalent results
//	{
//		// example of record parser using indentation levels to terminate the record
//		const interfaceRecord_v1 = seqOf(
//			until(endOfIndentLevel, seqOf(
//				parseLine('interface', interfaceName.tagAs('name')),
//				many(interfaceConfigLines)
//			)),
//			parseLine('!'),					// <-- note that there is a '!' on a line by itself after we return to the same indentation level.  We need to explicitly consume it
//		).getTaggedR()
//		// example of record parser using an explicit string to terminate the record
//		const interfaceRecord_v2 = seqOf(
//			until(aristaSectionDelimiterStr, seqOf(									// <-- note that '\n!\n' is the termination string at teh end of every interface section
//				parseLine('interface', interfaceName.tagAs('name')),
//				many(interfaceConfigLines)
//			)),
//			aristaSectionDelimiterStr,															// <-- note that the until parser does not consume the termination string, so remember to explicitly terminate it here
//		).getTaggedR()
//		// example of record parser using an explicit RegExp to terminate the record
//		const interfaceRecord_v3 = seqOf(
//			until(aristaSectionDelimiterRx, seqOf(						// 	recall that aristaSectionDelimiterRx = regex(/^\n!\n/)
//				parseLine('interface', interfaceName.tagAs('name')),
//				many(interfaceConfigLines)
//			)),
//			aristaSectionDelimiterRx
//		).getTaggedR()
//	}



const subParseTo = (sectionDelimiter) => (sectionParser) => seqOf(
	until(sectionDelimiter, sectionParser),
	parseLine('!'),		
).map((res)=>res[0])



/** parseSectionEOS
	 *   EOS-specific parser that runs 'sectionParser' on all text from the current position, and the next line that begins with '!'
	 *
	 * Example of text this parser works on:
	 * 
	 * ...
	 * 100  router pim sparse-mode
   * 101    ipv4
   * 102     rp address 74.115.128.129 access-list RPACL-BATS-CERT
   * 103     rp address 74.115.128.129 access-list RPACL-CERT-CBOE-C2-OPTIONS-TOP override
   * 104     rp address 74.115.128.130 access-list RPACL-CBOE-CFE-
	 * 105  !
	 * ...
	 * 
	 * The parser, if started on line 100, will run the sectionParser on text from lines 100 through 104, then then runs a
	 * "parseLine('!')" to parse through line 105.  The results of the sectionParser are returned.
	 * 
	 * If sectionParser does not parse all sectionText, an environmental record of the missed text is generated by the 'until' parser,
	 * which can be extracted using the .logEnv() method.
	 * 
	 */

const parseSectionEOS = (sectionParser) => seqOf(
	until('!\n', sectionParser),
	parseLine('!'),
).map((res)=>res[0])
	.named('parseSectionEOS')



/** parseIndentedSectionEOS
	 *   Similar to parseSectionEOS, this parser runs 'sectionParser' on all text from the current position, but instead of parsing
	 *   until the next line with a '!', it will parse all lines until the end of the current indent level. Then it will parse
	 *   the final line after the indent level.
	 *
	 * Example of section text this parser handles below. NOte that line 106 has a "!", which the parseSectionEOS would end at.
	 * parseIndentedSectionEOS will run 'sectionParser' from lines 100 through the end of line 113, then, as with parseSectionEOS,
	 * will then finally consume the '!' on line 114.
	 * 
	 * ...
	 * 100  router pim sparse-mode
   * 101    ipv4
   * 102      rp address 74.115.128.129 access-list RPACL-BATS-CERT
   * 103      rp address 74.115.128.129 access-list RPACL-CERT-CBOE-C2-OPTIONS-TOP override
   * 104      rp address 74.115.128.130 access-list RPACL-CBOE-CFE-A
   * 105      rp address 74.115.128.130 access-list RPACL-CBOE-CFE-A
   * 106    !
   * 107    vrf VRF-CBOE-BATS-L1-A
   * 109     ipv4
   * 110        rp address 74.115.128.129 access-list RPACL-BATS-CERT
   * 111        rp address 74.115.128.132 access-list RPACL-BATS-EDGA-A
   * 112        rp address 74.115.128.136 access-list RPACL-BATS-EDGX-A
	 * 113      ...
	 * 114  !
	 * 
	 * Also, as with parseSectionEOS, if the 'sectionParser' does not parse all sectionText, an environmental record of the missed text 
	 * is generated by the 'until' parser, which can be extracted using the .logEnv() method.
	 * 
	 */
const parseIndentedSectionEOS = (sectionParser) => sequenceOf(
	until(endOfIndentLevel, sectionParser),
	possibly(parseLine('!'))
).map((res)=>res[0])




const hostnameFromConfig = lookAhead(seqOf(
	gotoSection('hostname'),
	'hostname',
	regex(/^[a-zA-Z]+[a-zA-Z0-9-_]+/)
).map( (result) => result[2] )
).named('hostnameFromConfig')
	
	
// const hostnameFromConfig_old = lookAhead(seqOf(
// 	gotoSection('hostname'),
// 	'hostname',
// 	parseLine('hostname', regex(/^[a-zA-Z]+[a-zA-Z0-9-_]+/).tag('hostname)'))
// ).map( (result) => result['hostname'] )
// ).named('hostnameFromConfig')


const prompt = regex(/^[a-zA-Z0-9-].*#\s*/)

// these three compose together to discover the hostname from a prompt instead of a config...
const rePrompt = /(?<=^|\n)[\w][-_\w]*[+[#|>|:]\s*/
//const nextPrompt = nextRegx(rePrompt)
// const findHostnameFromPrompt = lookAhead(nextPrompt.map(result => result.trim().slice(0, -1)))


/* parts of user-entered commands - tokens */
// 'sh', 'sho ', or 'show '
const cmdShow = regex(/^sho(w){0,1}\s*/)

// 'int ' or anything full word until next word, but not including the next word
const cmdInterface = regex(/^int[a-z]{0,7}\s*/)

// 'stat ' or up to 2 more characters and spaces until next word, but not including the next word
const cmdStatus = regex(/^stat[a-z]{0,2}\s*/)

// 'stat ' or up to 2 more characters and spaces until next word, but not including the next word
const cmdDescription = regex(/^desc[a-z]{0,7}\s*/)

const parseSection = parseIndentedSectionEOS

// start exporting parsers only as needed and remove unused ones
export {
	// ipAddress
	ipAddress,
	ipMaskLength,
	ipMask,
	ipMaskInverted,
	ipNetwork,
	ipNetwork_asObject,
	ipNetworkOrAddress,
	ipMC,
	ipUC,

	// common tokens
	macAddress,
	dnsName,
	hostname,

	// network-specialized section parsers
	gotoSection,
	parseSection,
	parseSectionEOS,
	parseIndentedSectionEOS,

	// interface names 
	// Arista, EOS, IOS (not XR nor JunOS yet)
	interfaceName,

	// misc
	hostnameFromConfig,
}

