/**  Comment out this import and export at bottom when using in browser sandbox     */
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


/*   Where am I?

// TO DO
Flatten out the communities a bit - they are overly structured...

// Done
Refining the output of the .logEnv() method (see bgpMain_record below).  The current output
is verbose, and the idea is, when using a subParser (anything with 'until'), to have the 
user explicitly use logEnv to bring the log entries from the subParser into the main log,
using only somethign like subparser.logEnv( ({blah, blah2, log}) => log )

// Fixed
Also, there is 'unparsed text' in the dataLog, but the unparsed text appears to be empty.  Why are we reporting it?

// Done
Need to update  parseSection in module to ensure we're using unti', not untilStr.
Why?  'until' is the experimental version that adds ENV data, which we rely on to detect skipped text & stuff.

*/

/*********************************************************************************
 * Module:      eos_cfg_bgp_all
 * Version:     3.0
 * Parameters:  deviceName: string
 * Description: Parses all BGP content for a single EOS device
 * Caveats:     ?
 * Output:      normalized dictionary: 
 * 	{
 * 		"deviceName",  // supplied through parser as parameter
 * 		"asn",
 * 		"has_asdot",
 *		"router-id,
 *		"peer-groups": [],
 *		"peers": [ bgpPeer, ... ],    						// **WIP** - this will be a set of all peers fully-resolved against peers & route-map configurations
 *		"networks": [ ipPrefix_asString, ... ],
 *		"aggregates": [ ipPrefix_asString, ... ],
 *		"redistribute-connected"		// **DAY 1** - use 
 *		"redistribute-static: []"
 *		"imported: []",							//  **WIP** - this will be a set of all networks, aggregates, redistributeConnected, and redistributeStatics, resolved with their route-maps
 *  	"vrfs": [ bgpVrfRecord, bgpVrfRecord, ... ],
 *  }
 *
 *	bgpVrfRecord:	{
 *		"vrf-name":,
 *		"rd",
 *		"router-id",
 *		"route-target-imports": [],
  *		"route-target-exports": [],
 *		"peers": [ bgpPeerResolved, ... ],
 *		"networks": ['10.10.10.0/24', ...],
 *		"aggregates": ['10.10.10.0/16', ...],
 *		"redistribute-connected": 'route-map-name' | _NO_ROUTE_MAP_ | null,
 *		"redistribute-static":  'route-map-name' | _NO_ROUTE_MAP_ | null,
 *		"imported: ['10.10.10.0/16', ...], adding all networks, aggregates, redistribute-connecteds, & redistribute-static, & processing filters
 *	}
 *
 *	bgpPeerResolved: {
 *		"source-ip",
 *		"peer-ip",
 *		"peer-as",
 *		"local-as",
 *		"local-as-flags,"
 *		"description",
 *		"timers",
 *		"route-map-in",
 *		"route-map-out",
 *		"has-bfd",
 *		"has-send-community",
 *		"has-next-hop-self",
 *		"is-admindown",
 *		"member-of",
 * 		"assoc-interface": { interfaceRecord },
 * 		"transit_subnet",
 *	}
 */


const eos_cfg_bgp_all = (deviceName) => {

	/** SECTION 0.5: external modules (can be replaced by real modules in node, but not in HTML **
   * 
   *  Note: This is more of a 'pseudo-import' of what should be a real import of an actual model.  
   *  It's just code that is shamelessly copy/pasted from another module and inlined here because 
   *  there are no modules (yet) in the HTML-based version of the parser
   */


	// parses bgp community values
	const module_bgp_community = () => {
		const pmodule = {
			name: 'bgp_community',	
			ver: 1.0,
			usage: '',
		}

		/**************************************************************
   *  General/shared sub-line parsers / helpers
   */

		// for extended communities
		const leftValue_asASN = digits				// extended community - 32-bit ASN for left left side (route-target, site-of-origin)
		const leftValue_asIP = ipAddress			// extended community - 32-bit ip address for left side (route-target, site-of-origin)
		const rightValue	= digits						// all communities - right value (16 bits for standard, 32 bits for ext/large)
		const colon 			= ':'								// all communities - delimiter between fields
		const asplain		= digits							// large communities - the left field as as-plain ASN (32bit)
		const asdot	=	sequenceOf(digits, '.', digits).map( ([left, _, right]) => `${left}.${right}` )

		const digits_as32bit = regex( /^\d{1,10}/ )// 1 to 10 digits number - needs improvement

		const leftValueParser = oneOf(
			leftValue_asASN.map(addTag('format', 'asn')),
			leftValue_asIP.map(addTag('format', 'ip'))
		)

		const stdCommunityValue = regex( /^\d{1,5}:\d{1,5}/ ).named('stdCommunityValue')
		const extCommunityValue = sequenceOf(leftValueParser.tag('left'), ':', rightValue.tag('right')).named('extCommunityValue')
		const lrgCommunityValue = sequenceOf(digits_as32bit, ':', digits_as32bit, ':', digits_as32bit, ':' ).named('lrgCommunityValue')

		return {
			stdCommunityValue,
			extCommunityValue,
			lrgCommunityValue,
		}
	}  // end of module module_community
	const { extCommunityValue }= module_bgp_community()



	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'eos_cfg_bgp_all',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
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
	const routeMapName = eosName.named('routeMapName')
	const timerSeconds = digits.named('timerSeconds')

	const asplain = digits
	const asdot	=	sequenceOf([digits, strng('.'), digits]).map( ([left, , right]) => `${left}.${right}` )
	const asn = oneOf(asdot, asplain).named('asn')

	const route_distinguisher_plain = sequenceOf( digits, ':', digits ).map( ([left, _, right]) => `${left}:${right}`)
	const route_distinguisher_asIP = sequenceOf( ipAddress, ':', digits ).map( ([left, _, right]) => `${left}:${right}`)
	const route_distinguisher = oneOf(
		route_distinguisher_plain,
		route_distinguisher_asIP,
	).named('route_distinguisher')

	// NOTE: for peerGroupName, the use of this regex is important...
	// the 'getPeer_asTemplate' uses this to determines whether the peer after a 'neighbor' is a peer-group instead of a peer-IP
	const peerGroupName = regex(/^[a-zA-Z]+[a-zA-Z0-9_-]+/).named('peerGroupName')



	/** SECTION 4: per-line parsers related to BGP ****/

	// top-level bgp and/or vrf (bgpMain_record / bgpVrf_record) attributes
	const asnNotation					= parseLine( 'bgp asn notation asdot' ).map( isTrue ).named('asnNotation')
	const routerID						= parseLine( 'router-id', ipUC ).map( _1 ).named('routerID')
	const clusterID						= parseLine( 'bgp cluster-id', ipUC ).map( _1 ).named('clusterID')
	const distance 						= parseLine( 'distance bgp', digits, digits, digits ).map( ([_,d1,d2,d3])=>`${d1}/${d2}/${d3}` ).named('distance')
	const maxPaths 						= parseLine( 'maximum-paths', digits.tag('limit'), 'ecmp', digits.tag('maxECMP')).named('maxPaths')
	const defaultTimers				= parseLine( 'timers bgp', rol).map( _1 ).map( (res)=>res.split(' ')).map(joinWith(':')).named('default_timers')
	const bgpMissingPolicy 		= parseLine( 'bgp missing-policy', rol).map(joinWith(' ')).named('bgpMissingPolicy')
	const bgpUpdatePolicy 		= parseLine( 'update', rol).map(joinWith(' ')).named('bgpUpdatePolicy')
	const bgpAddlPathsPolicy	= parseLine( 'bgp additional-paths', rol).map(joinWith(' ')).named('bgpAddlPathsPolicy') 

	// bgp networking attributes (address-family ipv4 stuff)
	const network							= parseLine( 'network', ipNetwork, at_eol).map( _1 )
	const network_obj					= parseLine( 'network', ipNetwork_asObject, at_eol).map( _1 ).named('network')
	const aggregate						= parseLine( 'aggregate-address', ipNetwork_asObject, at_eol).map( _1 ).named('aggregate')
	const aggregate_plus			= parseLine( 'aggregate-address', ipNetwork_asObject, 'attribute-map', routeMapName, rol).map( ([_, prefixObj, __, attributeMap, flags]) => ({...prefixObj, attributeMap, flags}) ) 
	const redist_connected 		= parseLine( 'redistribute connected route-map', routeMapName).map( _1).named('redist_connected')
	const redist_static 			= parseLine( 'redistribute static route-map', routeMapName).map( _1).named('redist_static')
	const redist_unknown			= parseLine( 'redistribute', rol).map( _1).named('redist_unknown')
	// Not used in eos_cgf_bgp_all, but to be used with compliance parsers to scan for trouble
	const redist_static_noRM 	= parseLine( 'redistribute static', at_eol).map( _1).named('redist_static_noRouteMap')
	const redist_connected_noRM = parseLine( 'redistribute connected', at_eol).map( _1).named('redist_connected_noRouteMap')

	// vrf list entries
	const rd 					= parseLine('rd', route_distinguisher ).map( _1).named('rd')
	const rt_import 	= parseLine(`route-target import vpn-ipv4`, extCommunityValue).map( _1).named('rt_import')
	const rt_export 	= parseLine(`route-target export vpn-ipv4`, extCommunityValue).map( _1).named('rt_export')
	const rt_import_routeMap = parseLine(`route-target import vpn-ipv4 route-map`, routeMapName).map( _1).named('rt_import_routeMap')
	const rt_export_routeMap = parseLine(`route-target export vpn-ipv4 route-map`, routeMapName).map( _1).named('rt_export_routeMap')

	// **parameterized** bgpPeer record entries, which handle both neighbor IP and neighbor template (peer-group) parsing
	// the parameter is fed as a parameter as a result of parsing the peer header and using .chain( (result_as_peer) => {...} )
	const peerIP_peerGroup 			= (peer) => parseLine('neighbor', ipUC, 'peer group', hword ).map( _3 ).named('peerIP_peerGroup')
	const peerIP_peerGroup2			= (peer) => parseLine('neighbor', ipUC, 'peer-group', hword ).map( _3 ).named('peerIP_peerGroup2')
	const peer_group 						= (peer) => parseLine('neighbor', peer, 'peer group').named('peer_group')
	const peer_group2 					= (peer) => parseLine('neighbor', peer, 'peer-group').map( _3 ).named('peer_group2')
	const peer_remoteAs 				= (peer) => parseLine('neighbor', peer, 'remote-as', asn).map( _3 ).named('peer_remoteAs')
	const peer_localAs 					= (peer) => parseLine('neighbor', peer, 'local-as', asn.tag('asn'), rol.tag('flags')).named('peer_localAs')
	const peer_removePrivateAS 	= (peer) => parseLine('neighbor', peer, 'remove-private-as', rol ).map( _3 ).named('peer_removePrivateAS')
	const peer_nextHopSelf 			= (peer) => parseLine('neighbor', peer, 'next-hop-self').map( isTrue ).named('peer_removePrivateAS')
	const peer_bfd 							= (peer) => parseLine('neighbor', peer, 'bfd').map( isTrue ).named('peer_bfd')
	const peer_desc 						= (peer) => parseLine('neighbor', peer, 'description', rol).map(_3,).named('desc')
	const peer_timers 					= (peer) => parseLine('neighbor', peer, 'timers', rol).map( _3 ).map( (res)=>res.split(' ')).map(joinWith(':')).named('peer_timers')
	const peer_routeMap_in 			= (peer) => parseLine('neighbor', peer, 'route-map', routeMapName, 'in').map( _3 ).named('peer_routeMap_in')
	const peer_routeMap_out 		= (peer) => parseLine('neighbor', peer, 'route-map', routeMapName, 'out').map( _3 ).named('peer_routeMap_out')
	const peer_password 				= (peer) => parseLine('neighbor', peer, `password`, digits, rol).map( isTrue ).named('peer_password')
	const peer_sendCommunity 		= (peer) => parseLine('neighbor', peer, 'send-community').map( isTrue ).named('peer_sendCommunity')
	const peer_sendExtCommunity = (peer) => parseLine('neighbor', peer, 'send-extcommunity').map( isTrue ).named('peer_sendExtCommunity')
	const peer_sendLrgCommunity = (peer) => parseLine('neighbor', peer, 'send-large-community').map( isTrue ).named('peer_sendLrgCommunity')
	const peer_maxRoutes 				= (peer) => parseLine('neighbor', peer, 'maximum-routes', digits.tag('limit'), rol.tag('policy')).named('peer_maxRoutes')
	const peer_fallover				  = (peer) => parseLine('neighbor', peer, 'fall-over', rol).map( _3 ).named('peer_fallover')
	const peer_isShut						= (peer) => parseLine('neighbor', peer, 'shutdown').map( isTrue ).named('peer_isShut')
	const enabled_peer_enforce_first_as = (peer) => parseLine('neighbor', peer, 'enforce-first-as').map( isTrue )
	const disabled_peer_enforce_first_as = (peer) => parseLine('no neighbor', peer, 'enforce-first-as').map( isTrue )

	// wildcard catch-alls, should be used in a .logResult() instead of mapping a return value
	const peer_unknown					= (peer) => parseLine('neighbor', peer, rol).map( _2 ).named('peer_unknown')
	const peer_noCommand				= (peer) => parseLine('no neighbor', peer, rol).map( _2 ).named('peer_disabled_flag')

	// wildcard line-items to match anything not explicitly matched otherwise.  Should be used with a .logResult() instead of returning a value
	const unknown 							= parseLine(rol).map( _0 ).named('unknown')



	/** SECTION 5: Intermediate combinators needed prior to record-level parsing **/

	// aggregate & redistirbutes are used in eosBGP
	const aggregateAddress = parseLine( 
		'aggregate-address', 
		ipNetwork_asObject.tag('aggAddr'), 
		possibly(strng('as-set')).map(addTag('has_asSet', true)),
		possibly(
			seqOf(
				strng('attribute-map'), 
				routeMapName,
			).map((res)=>res[1]).tag('attribute-map'),
		),
		rol.logResult( (res) => `[module:${pmodule.name}, parser:aggregateAddress]: unrecognized text after 'attribute-map': '${res}'`),
	)
		.getTagged()
		.map(flattenItemWith('->'))
		.named('aggregateAddress')


	// get lists of vrf route-targets
	const routeTarget = oneOf(
		rt_import.tag('rt-i'),
		rt_export.tag('rt-ex'),
		rt_import_routeMap.tag('rt-i'),
		rt_export_routeMap.tag('rt-ex'),
	).named('routeTarget')



	/** SECTION 6: BGP record-level parsers ***/

	/** bgpPeerTemplate_record - complete record parser for a bgpPeer peer-group (aka peer template)
 *  Parses the peer group name with the _header parser and chains the rest via the entries parser.
 * 
 *  Components:
 *   - bgpPeerTemplate_header  - starts the record-level parser, and supplies context for the follow parsers, 
 *                               which in this case, must match the peer-group name
 *   - bgpPeerTemplate_entries - parses all remaining entries for a single peer group
 *                               Note this is a *parameterized function* taking 'peerGroup' as a parameter, 
 *                               from bgpPeerTemplate_header.chain(...) for proper context, ensuring we stay on 
 *                                the same neighbor
 */
	const bgpPeerTemplate_header = lookAhead(parseLine('neighbor', peerGroupName)).map( _1 ).named('bgpPeerTemplate_header')

	const bgpPeerTemplate_entries = (peerGroup) => seqOf(
		succeedWith(peerGroup).tag('templateName'),
		setOf(
			peer_group 						 (peerGroup).tag('peerGroup'),
			peer_group2						 (peerGroup).tag('peerGroup'),
			peer_remoteAs					 (peerGroup).tag('remoteAs'),
			peer_localAs 				   (peerGroup).tag('localAs'),
			peer_desc 					   (peerGroup).tag('desc'),
			peer_routeMap_in 		   (peerGroup).tag('routeMap_in'),
			peer_routeMap_out 	   (peerGroup).tag('routeMap_out'),
			peer_removePrivateAS   (peerGroup).tag('removePrivateAs'),
			peer_timers 				   (peerGroup).tag('timers'),
			peer_bfd 						   (peerGroup).tag('hasBFD'),
			peer_maxRoutes 			   (peerGroup).tag('maxRoutes'),
			peer_fallover 			   (peerGroup).tag('fallover'),
			peer_nextHopSelf 		   (peerGroup).tag('nextHopSelf'),
			peer_password 			   (peerGroup).tag('passwd'),
			peer_sendCommunity 	   (peerGroup).tag('has_sendCommunnity'),
			peer_sendExtCommunity  (peerGroup).tag('has_sendExtCommunnity'),
			peer_sendLrgCommunity  (peerGroup).tag('has_sendLrgCommunnity'),
			peer_isShut						 (peerGroup).tag('peer_isShut'),
			enabled_peer_enforce_first_as(peerGroup).tag('enable_peer_enforce_first_as'),
			disabled_peer_enforce_first_as(peerGroup).tag('disabled_peer_enforce_first_as'),
			peer_unknown					 (peerGroup).logResult( (res) => `[module:${pmodule.name}, parser:bgpPeerTemplate_entries]: unrecognized text in neighbor ${peerGroup} statement: '${res}'`),
		)).named('bgpPeerTemplate_entries') 

	const bgpPeerTemplate_record = bgpPeerTemplate_header.chain( bgpPeerTemplate_entries )
		.getTaggedR()
		.map(flattenItemWith('->'))
		.named('bgpPeerTemplate_record')


	/** bgpPeerIP_record - complete record parser for a bgpPeer.  
  *  Parses the peerIP with the _header parser and chains the rest via the entries parser.
  * 
  *  Components:
  *   - bgpPeerIP_header  - starts the record-level parser, and supplies context for the follow parsers,
  *                         which in this case, must match the peerIP
  *   - bgpPeerIP_entries - parses all remaining entries for a single peer IP
  *                         Note this is a *parameterized function* taking 'peerIP' as a parameter, 
  *                         from bgpPeerIP_header.chain(...) for proper context, ensuring we stay on 
  *                         the same neighbor
  */
	const bgpPeerIP_header = lookAhead(parseLine('neighbor', ipAddress)).map( _1 ).named('bgpPeerIP_header')

	const bgpPeerIP_entries = (peerIP) => seqOf(
		succeedWith(peerIP).tag('peerIP'),
		setOf(
			peer_remoteAs					 (peerIP).tag('remoteAs').named('ra'),
			peer_localAs 				   (peerIP).tag('localAs'),
			peer_desc 					   (peerIP).tag('desc'),
			peer_routeMap_in 		   (peerIP).tag('routeMap_in'),
			peer_routeMap_out 	   (peerIP).tag('routeMap_out'),
			peer_removePrivateAS   (peerIP).tag('removePrivateAs'),
			peerIP_peerGroup			 (peerIP).tag('template'),
			peerIP_peerGroup2			 (peerIP).tag('template'),
			peer_timers 				   (peerIP).tag('timers'),
			peer_bfd 						   (peerIP).tag('hasBFD'),
			peer_maxRoutes 			   (peerIP).tag('maxRoutes'),
			peer_nextHopSelf 		   (peerIP).tag('nextHopSelf'),
			peer_password 			   (peerIP).tag('passwd'),
			peer_sendCommunity 	   (peerIP).tag('has_sendCommunnity'),
			peer_sendExtCommunity  (peerIP).tag('has_sendExtCommunnity'),
			peer_sendLrgCommunity  (peerIP).tag('has_sendLrgCommunnity'),
			peer_isShut						 (peerIP).tag('peer_isShut'),
			enabled_peer_enforce_first_as(peerIP).tag('enable_peer_enforce_first_as'),
			disabled_peer_enforce_first_as(peerIP).tag('disabled_peer_enforce_first_as'),
			peer_noCommand				 (peerIP).logResult((res) => `[module:${pmodule.name}, parser:bgpPeerIP_entries]: unrecognized 'no' command for peer ${peerIP}: '${res}'`),
			peer_unknown					 (peerIP).logResult( (res) => `[module:${pmodule.name}, parser:bgpPeerIP_entries]: unrecognized text in neighbor ${peerIP} statement: '${res}'`),
		) 
	).named('bgpPeerIP_entries') 

	const bgpPeerIP_record = bgpPeerIP_header.chain( bgpPeerIP_entries )
		.getTaggedR()
		.map(flattenItemWith('->'))
		.named('bgpPeerIP_record')



	/** bgpMain_record - complete record parser for the bgp process
 * 
 *  Components:
 *    bgpMain_header  - starts the record-level parser for the bgp main process
 *    bgpMain_entries - parses all bgpMain (i.e. non-vrf) attributes/properties
 */
	const bgpMain_header 	= parseLine( 'router bgp', asn ).map( _1 ).named('bgpMain_header')

	const bgpMain_entries = many( 
		except(oneOf(
		// these are how we know to stop processing bgpMainProps - when we hit one of these.
			regex(/^\s*neighbor /),
			regex(/^\s*network /),
			regex(/^\s*redistribute /),
			regex(/^\s*aggregate /),
			parseLine('!'),
		).named('bgpMain_entries_terminators'), oneOf(
			asnNotation.tag('has_asNotation'),
			routerID.tag('routerid'),
			distance.tag('distance'),
			maxPaths.tag('max-paths'),
			clusterID.tag('cluster-id'),
			defaultTimers.tag('default-timers'),
			bgpMissingPolicy.tag('bgpMissingPolicy'),
			bgpUpdatePolicy.tag('bgpUpdatePolicy'),
			bgpAddlPathsPolicy.tag('bgpAddlPathsPolicy'),
			unknown.logResult((res) => `[module:${pmodule.name}, parser:bgpMain_entries]: unrecognized or non-compliant text: '${res}'`)
		).named('bgpMainProps_list')  // oneOf
		)
	).named('bgpMain_entries')

	const bgpMain_record =  parseSection(sequenceOf(
		bgpMain_header.tag('asn'),
		bgpMain_entries,
		many(bgpPeerTemplate_record).tagList('bgpPeerTemplates'),
		many(bgpPeerIP_record).tagList('bgpPeerIPs'),
		many(network).tagList('networks'),
		many(aggregateAddress).tagList('aggregateAddresses'),
		possibly(redist_connected).tag('redistributeConnected'),
		possibly(redist_static).tag('redistributeStatic'),
		possibly(redist_unknown.logResult((res) => `[module:${pmodule.name}, parser:bgpMain_record]: unrecognized or non-compliant redistribution statement: '${res}'`)),
	)).named('bgpMain_record')
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
				`[module:${pmodule.name}, parser:bgpMain_record]: The section parser generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
				section_parser_dataLog.map( (entry) => `  ${entry}` ),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`[module:${pmodule.name}, parser:bgpMain_record]: The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				`  '${section_text_unparsed}'`,
			] : [],
		]))
		.getTaggedR()



	/** bgpVrf_record - complete record parser for the bgp process
 * 
 *  Components:
 *    bgpVrf_header  - starts the record-level parser for the bgp Vrf process
 *    bgpVrf_entries - parses all bgpVrf attributes/properties for a single VRF
 */
	const bgpVrf_header		= parseLine( 'vrf', vrfName ).map( _1 ).named('bgpVrf_header')

	const bgpVrf_entries = many(
		except(oneOf(
			regex(/^\s*neighbor /),
			regex(/^\s*network /),
			regex(/^\s*redistribute /),
			regex(/^\s*aggregate /),
			parseLine('!'),
		).named('bgpVrf_entries_terminators'), oneOf(
			rd.tag('route_distinguisher'),
			many1(routeTarget).tagList('route_targets'),
			routerID.tag('routerid'),
			distance.tag('distance'),
			maxPaths.tag('max-paths'),
			clusterID.tag('cluster-id'),
			defaultTimers.tag('default-timers'),
			bgpMissingPolicy.tag('bgpMissingPolicy'),
			bgpUpdatePolicy.tag('bgpUpdatePolicy'),
			bgpAddlPathsPolicy.tag('bgpAddlPathsPolicy'),
			unknown.logResult((res) => `[module:${pmodule.name}, parser:bgpVrf_entries]: unrecognized or non-compliant text '${res}'`),
		))
	).named('bgpVrfProps')


	const bgpVrf_record = parseSection(sequenceOf(
		bgpVrf_header.tag('vrf'),
		bgpVrf_entries.tag('bgpVrfProps'),
		many(bgpPeerIP_record).tagList('bgpPeers'),
		possibly(many1(aggregateAddress).tagList('aggregateAddresses')),
		possibly(redist_connected.tag('redistributeConnected')),
		possibly(redist_static.tag('redistributeStatic')),
		possibly(redist_unknown.logResult((res) => `[module:${pmodule.name}, parser:bgpVrf_record]: unrecognized or non-compliant redistribution statement '${res}'`)),
	).named('bgpVrf_record_sectionParser'))
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
				`[module:${pmodule.name}, parser:bgpVrf_record]: The section parser generated the following logs (note that indices below are relative to the parent index ${section_index_start}:`,
				section_parser_dataLog.map( (entry) => `  ${entry}` ),
			] : [],
			// if the section parser skips text for any reason, report it...
			(section_text_unparsed?.length > 0) ? [
				`[module:${pmodule.name}, parser:bgpVrf_record]: The section parser did not parse entire section, starting from index ${section_index_termination}, and stopping at ${section_index_parseduntil}.  Skipped text is below:`,
				`  '${section_text_unparsed}'`,
			] : [],
		]))
		.getTaggedR()
		.map(flattenItemRecursively)


	/** SECTION 7: Final processing & module return value ***/

	return sequenceOf(
		gotoSection('router bgp'),	
		bgpMain_record.tag('globalBGP'),
		many(bgpVrf_record).tagList('vrfs'),
	).getTaggedR()

}


// comment this out when using in production
// eos_cfg_bgp_all('test_device_name')

// comment this out when using in-browser
export { eos_cfg_bgp_all }