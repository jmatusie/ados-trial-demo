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
	parseSection,
	hostnameFromConfig,
	interfaceName,

	// unclassified - it would help if the imports listed below were moved up the the proper section to the original file can be idenfified...
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
} from '../parser_modules.mjs'



/*********************************************************************************
 * Module:      eos_cfg_rp_mappings
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: parses a single arista configuration file for pim rp-to-ACL-mappings, including vrf context
 * Caveats:     ?
 * Output:      normalized dictionary: 
 *   {
 *     vrfName,
 *     rpAddress:	ip address of RP,
 *     rpAcl:			access-list name,
 *     mcRange:    multicast subnet,
 *     priority:   number (defaults to 0),
 *     override:  true | false,
 *     rest: Object.keys(rest).length > 0 ? JSON.stringify(rest) : ''
 *   }
 *
 */
const eos_cfg_rp_mappings = (deviceName) => {

	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_rp_mappings',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: ``,								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}


	/** SECTION 2: local result helpers to make code more readable (arguably).  ****
 	 *  These are candidates for possibly moving into an external module 
 	 */
	const _0 = (arr) => arr[0]		// these get values out of arrays at the supplied index
	const _1 = (arr) => arr[1]
	const _2 = (arr) => arr[2]
	const _3 = (arr) => arr[3]
	const isTrue = (res) => true  // tags the existence of a result as 'true' - for flags (i.e. if xyz is parsed, xyz is true)



	/** SECTION 3: local token-level parsers ****
   *  Some of these are existing very general parsers, but renamed for semantics only
   *  If they need to be changed to more restrictive parsers, they can be done using the local name instead of replacing references
   *  througout the code
   */
	const eosName = regex(/^[a-zA-Z0-9_-]+/)   // generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const vrfName = eosName.named('vrfName')
	const aclName = eosName.named('aclname')

	const priority = seqOf('priority', digits).map(_1)
	const override = tok('override')

	
	//this format has been retired - doesnt' exist (apparently) on the Xpress configs recently
	const rpMapping_record_legacy =	parseLine('ip pim rp-address', ipUC.tagAs('RP'), 'access-list', aclName.tagAs('RPACL'))

	// parsed when entering vrf mode under sections like 'router pim sparse-mode'
	const vrf                 = parseLine('vrf', vrfName).map( _1 ).named('vrf')


	// handle RP mappings statements of various formats
	const rpMapping_record_ACL =	parseLine(
		'rp address', ipUC.tag('rpAddress'), 
		'access-list', aclName.tag('rpAcl'), 
		possibly(priority).map(asNumber).tag('priority'), 
		possibly(override).map(asBoolean).tag('override') 
	)

	const rpMapping_record_IP = parseLine(
		'rp address', ipUC.tag('rpAddress'), 
		ipNetwork.tag('mcRange'),
		possibly(priority).map(asNumber).tag('priority'), 
		possibly(override).map(asBoolean).tag('override')
	)

	const rpMapping_record_default = parseLine(
		'rp address', ipUC.tag('rpAddress'), 
		possibly(priority).map(asNumber).tag('priority'), 
		possibly(override).map(asBoolean).tag('override') 
	)

	const rpMapping_UNK = parseLine(
		'rp address', ipUC.tag('rpAddress'),
		rol.tag('rpMapping_UNK')
	).map(_1)

	const pimRegisterLocalIntf = parseLine('register local-interface', interfaceName)

	const unknown = parseLine(rol)

	const rpLines = oneOf(
		rpMapping_record_IP,
		rpMapping_record_ACL,
		rpMapping_record_default,
		pimRegisterLocalIntf,
		rpMapping_UNK.logResult( (res) => `${deviceName} [${pmodule.name}::rpLines]: Unrecognized rp address text: '${res}'`),
		unknown.logResult( (res) => `${deviceName} [${pmodule.name}::rpLines]: Unrecognized text in pim config: '${res}'`),
	)


	/** rpMappings_global - complete set of records for rpMappings in the global VRF
  * 
  *  Components:
  *   - bgpPeerIP_header  - starts the record-level parser, and supplies context for the follow parsers,
  *                         which in this case, must match the peerIP
  *   - bgpPeerIP_entries - parses all remaining entries for a single peer IP
  *                         Note this is a *parameterized function* taking 'peerIP' as a parameter, 
  *                         from bgpPeerIP_header.chain(...) for proper context, ensuring we stay on 
  *                         the same neighbor
  */
	const rpMapping_global = parseSection(
		seqOf(
			parseLine('ipv4'),
			many(rpLines).tagList('rp_mapping_global'),
			//			succeedWith('global').tagAs('vrfName'),
		).getTaggedR()
	).map(multiplyBy('rp_mapping_global'))
		.logEnv( ({
			section_index_start,
			section_index_parseduntil, 
			section_index_termination,
			section_text_unparsed,
			section_parser_dataLog,
			// section_text,          // unused here, but available if needed
			// section_text_parsed,   // unused here, but available if needed
		}) => ([
			(section_parser_dataLog?.length > 0) ? [  // if the section parser has logs, make sure we pull them from the environment, but return empty if not
				`${deviceName} [${pmodule.name}::rpMapping_global]: The section parser generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
				section_parser_dataLog.map( (entry) => `  ${entry}` ),
			] : [],
			(section_text_unparsed?.length > 0) ? [  // if the section parser skips text for any reason, report it...
				`${deviceName} [${pmodule.name}::rpMapping_global]: The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				`  '${section_text_unparsed}'`,
			] : [],
		]) ).named('rpMapping_global')


	const rpMapping_vrfs = parseSection(
		seqOf(
			vrf.tag('vrfName'),
			parseLine('ipv4'),
			many(rpLines).tagList('rp_mapping_vrf')
		).getTaggedR()
	).map(multiplyBy('rp_mapping_vrf'))
		.logEnv( ({
			section_index_start,
			section_index_parseduntil, 
			section_index_termination,
			section_text_unparsed,
			section_parser_dataLog,
			// section_text,          // unused here, but available if needed
			// section_text_parsed,   // unused here, but available if needed
		}) => ([
			(section_parser_dataLog?.length > 0) ? [  // if the section parser has logs, make sure we pull them from the environment, but return empty if not
				`${deviceName} [${pmodule.name}::rpMapping_vrfs]: The section parser generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
				section_parser_dataLog.map( (entry) => `  ${entry}` ),
			] : [],
			(section_text_unparsed?.length > 0) ? [  // if the section parser skips text for any reason, report it...
				`${deviceName} [${pmodule.name}::rpMapping_vrfs]: The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				`  '${section_text_unparsed}'`,
			] : [],
		])).named('rpMapping_vrfs')


	const rpMappings_all = seqOf(
		possibly(rpMapping_global).map(nullToArray),//.tagAs('global_rpMappings'),
		many(rpMapping_vrfs),//.tagAs('vrf_rpMappings')
	).map(flattenArrayN(2))



	const formatColumns = ({
		vrfName = 'default',
		rpAddress,
		rpAcl,
		mcRange,
		priority,
		override,
		...rest
	}) => ({
		vrfName,
		rpAddress,
		rpAcl,
		mcRange,
		priority,
		override,
		rest: Object.keys(rest).length > 0 ? JSON.stringify(rest) : ''  // include any parameters that were skipped in output to aid with oversights
	})


	return seqOf(
		gotoSection('router pim sparse-mode'),
		parseLine('router pim sparse-mode'),
		rpMappings_all
	).map((res)=>res[2])
		.map(mapArray(formatColumns))
		// .dataLog_toResult()
}


// comment this out when using in production
// eos_cfg_rp_mappings ('somedevice')

// comment this out when using in-browser IDE
export { eos_cfg_rp_mappings  }


