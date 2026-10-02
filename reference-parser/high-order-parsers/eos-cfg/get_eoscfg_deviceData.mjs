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
	nullToArray,
	flattenArrayN,
	asNumber,
	asBoolean,

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

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	gotoSection,
	parseSectionEOS,
	parseIndentedSectionEOS,
	hostnameFromConfig,
	interfaceName,

	// unclassified - it would help if the imports listed below were moved up the the proper section to the original file can be idenfified...
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
} from '../parser_modules.mjs'


/*********************************************************************************
 * Module:      get_eoscfg_deviceData
 * Version:     3.1
 * Parameters:  deviceName: string
 * Description: parses a single arista configuration file for pim rp-to-ACL-mappings, including vrf context
 * Caveats:     ?
 * Output:      normalized dictionary: 
 *   {
 *     userNames,
 *     loggingHosts,
 *     loggingSourceIntf,
 *   }
 *
 */
const get_eoscfg_deviceData = (deviceName) => {

	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_deviceData',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: ``,								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}

	const _0 = (arry) => arry[0]
	const _1 = (arry) => arry[1]
	const _2 = (arry) => arry[2]
	const _3 = (arry) => arry[3]


	/** SECTION 3: local token-level parsers ****
	 *  Some of these are existing very general parsers, but renamed for semantics only
	 *  If they need to be changed to more restrictive parsers, they can be done using the local name instead of replacing references
	 *  througout the code
	 */
	const eosName = regex(/^[a-zA-Z0-9_-]+/)   // generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const vrfName = eosName.named('vrfName')
	const aclName = eosName.named('aclname')

	const userName = parseLine('username', eosName).map(_1).named('userName')
	const loggingHost = parseLine('logging host', ipAddress).map(_1).named('loggingHost')
	const loggingSourceIntf = parseLine('logging source-interface', interfaceName).map(_1).named('loggingSourceIntf')
	const sflowDestination = parseLine('sflow destination', ipAddress).map(_1).named('sflowDest')
	const sflowRun = parseLine('sflow run').map(()=>true).named('sflowEnabled')

	const vlan = parseSection(sequenceOf(
		parseLine('vlan', digits).map(_1),
		parseLine('name', eosName).map(_1),
	)).map(joinWith(':'))
	.named('vlan')

	const vrf = parseSection(sequenceOf(
		parseLine('vrf instance', eosName).map(_1),
		possibly(parseLine('description', rol).map(_1)).map(nullToStr),
	)).map(joinWith(':'))
	.named('vrf')

	const routerBgp = parseLine('router bgp', sequenceOf(digits, '.', digits).map(joinWith('')) ) .map(_1).named('routerBGP')
	
	


	const getX = (sectionStr, parserX) => lookAhead(possibly(sequenceOf(
		gotoSection(sectionStr),
		parserX
	)).map( (res)=>res==null ? 'isnull' : res)
	).map(_1).tag(parserX.pname)

	const getXs = (sectionStr, parserX) => lookAhead(possibly(sequenceOf(
		gotoSection(sectionStr),
		many(parserX).map( (xs)=>xs.join(', ') )
	)).map(nullToArray)
	).map(_1).tag(`${parserX.pname}s`)



	return seqOf(
		getXs('username', userName),
		getXs('logging host', loggingHost),
		getX('logging source-interface', loggingSourceIntf),
		getXs('sflow destination', sflowDestination),
		getX('sflow run', sflowRun),
		getXs('vlan', vlan),
		getXs('vrf', vrf),
		getX('router bgp', routerBgp)
		//getLoggingInfo.tag('loggingHosts'),
	).getTaggedR()
}




/* comment this out when using in production: */
//	get_eoscfg_deviceData ('somedevice')


/* comment this out when using in-browser IDE: */
export {
	get_eoscfg_deviceData
}



