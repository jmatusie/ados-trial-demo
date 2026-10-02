/**  WHERE I"M AT:
I may have gotten this working, without re-using old stuff.  Refine and test more scenarios.

The main routine at the bottom is only hanlding a single ACL right now on purpose, so I can test 
every ACL line format for the extended parser.

The only problem is figuring out how to handle this extended acl line:

110 deny any log  (here, the 'any' is in the protocol position, not src or dst.  Thus src and dst
are actually optional).

The parser has been re-written to hanlde the fact that the src & test portionl are within a
"possibly" parser, but it doesn't seem to work.
 */


/**	Comment out this import and export at bottom when using in browser sandbox		 */

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
	groupByPropName,
	normalizedDataSet,
	nullToStr,
	pipe,
	asBoolean,

	// from Parser_Core.mjs
	endOfInput,
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
	letters,
	word,
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
	ipNetworkOrAddress,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
	multiplyBy_v2_lossy,
	interfaceName,

	// Parser_Result_Helpers.mjs

} from '../parser_modules.mjs'



/****************************************************************************
* module: 			arista_cfg_bgpPeers (v2 output)
*	description:	parses the output of a single Arista switches BGP section (specifically the peers)
*	output:				table containing the following:
*
*      thisASN: 					the ASN of the switch
*      peerIP: 						BGP neighbor IP
*      peerASN: 					the neighbors ASN,
*      description: 			neighbor description ,
*      bgpNeighLocalAs: 	local AS of this peer, along with any local-as flags (no-prepend, replace-as, etc),
*      timers: 						BGP timers <hello:holddown>,
*      routeMap_in: 				inbound route-map name,
*      routeMap_out: 			outbound route-map name 
*/
const get_eoscfg_bgp_peers  = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_bgp_peers',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
		desc: ``,
		returnSchema: null,
	}


	/****** BGP intra-line parser helpers  ******/
	const peerGroup = hword
	const routeMapName = hword
	const maxRoutes = digits
	const asplain = digits
	const asdot	=	sequenceOf([digits, strng('.'), digits]).map( ([left, , right]) => `${left}.${right}` )
	const asn = oneOf( asdot, asplain )
	const vrfName = hword
	
	// intra-line 
	const neighbor = oneOf(
		seqOf('neighbor', ipUC),
		seqOf('neighbor', hword)
	)
	
	// capture all possible options after the 'network' statement (more refinement is needed - route maps?)
	const networkOpts = oneOf(
		everythingUntil (eol),
	)
	
	// capture all possible options after the 'aggregate-address' statement
	const aggregateOptions = oneOf(
		seqOf ('attribute-map', routeMapName).map( ([_, routeMap]) => `attributeMap=${routeMap}` ),
		'advertise-only',
		everythingUntil (eol),
	)
	
	// route-target types go here, evpn is another one not listed yet...
	const routeTargetType = oneOf(
		strng('vpn-ipv4'),
	)
	
	// route target formats - not that there are other formats - expand when needed
	const routeTarget = sequenceOf([digits, colon, digits ]).map( ([left, _, right])=>`${left}:${right}` )
	
	
	/****** BGP line parsers  ******/
	
	// global BGP line parsers
	const bgpGlobal_header 						= parseLine ( 'router bgp', asn ).map( ([$1, thisAS]) => ({thisAS}) )
	const bgpGlobal_asDot 						= parseLine ( 'bgp', 'asn', 'notation', 'asdot' ).map( (result) => true ) 
	const bgpGlobal_asPlain 					= parseLine ( 'bgp', 'asn', 'notation', 'asplain' ).map( (result) => true )
	const bgpGlobal_routerID 					= parseLine ( 'router-id', 	ipAddress ).map( (result) => result[1] )
	const bgpGlobal_distance 					= parseLine ( 'distance bgp', digits, digits, digits ).map( ([ $1, d1, d2, d3 ]) => `${d1}:${d2}:${d3}` )
	const bgpGlobal_maxPath 					= parseLine ( 'maximum-paths', digits, 'ecmp', 	digits ).map( ([ $1, maxPaths, $3, maxPathsECMP ]) => `${maxPaths} / ECMP:${maxPathsECMP}` )
	const bgpGlobal_update_wait_install					= parseLine ( 'update wait-install' ).map( (result) => true )
	const bgpGlobal_additional_paths_policy 		= parseLine ( 'bgp additional-paths', hword).map( ([$1, policy]) => policy )
	const bgpGlobal_missing_policy_direction_in	= parseLine ( 'bgp missing-policy direction in action', hword ).map( ([$1, action]) => action )
	const bgpGlobal_missing_policy_direction_out= parseLine ( 'bgp missing-policy direction out action', hword ).map( ([$1, action]) => action )
	
	const bgpPeerGroup_remoteAS = parseLine( 'neighbor', peerGroup, 'remote-as', asn ).map( ([$1, peerGroup, $3, peerAS]) => ({peerGroup, peerAS}) )
	
	// neighbor line parsers
	const bgpNeigh_localAS = parseLine( neighbor, 'local-as', asn, possibly(strng('no-prepend')), possibly(strng('replace-as')), rol)
		.map( ([$1, $2, localAS, noPrepend, replaceAS, rest_of_line]) => `${localAS} (${[noPrepend, replaceAS, rest_of_line].filter((x)=>x).join(',')})` )
	const bgpNeigh_desc 							= parseLine( neighbor, 'description', rol ).map((result)=>result[2])
	const bgpNeigh_timers 						= parseLine( neighbor, 'timers', digits, digits ).map( ([$1, $2, keepAlive, holdDown ]) => `${keepAlive}:${holdDown}` )
	const bgpNeigh_routeMap_in 				= parseLine( neighbor, 'route-map', routeMapName, 'in'	).map((result)=>result[2])
	const bgpNeigh_routeMap_out 			= parseLine( neighbor, 'route-map', routeMapName, 'out' ).map((result)=>result[2])
	const bgpNeigh_shutdown 					= parseLine( neighbor, 'shutdown' ).map((result)=>true)
	const bgpNeigh_nhs 								= parseLine( neighbor, 'next-hop-self' ).map((result)=>true)
	const bgpNeigh_remove_private_as 	= parseLine( neighbor, 'remove-private-as'	).map((result)=>true)
	const bgpNeigh_passwd 						= parseLine( neighbor, 'password' ).map((result)=>true)
	const bgpNeigh_sendCommunity			= parseLine( neighbor, 'send-community' ).map((result)=>true)
	const bgpNeigh_bfd 								=	parseLine( neighbor, 'bfd').map((result)=>true)
	const bgpNeigh_fallover 					=	parseLine( neighbor, 'fall-over bfd' ).map((result)=>true)
	const bgpNeigh_unhandled					= parseLine( neighbor, everythingUntil(eol) ).map((result)=>result[1])
	const bgpNeigh_maxRoutes 					= parseLine( neighbor, 'maximum-routes', rol ).map((result)=>result[2])
	const bgpNeigh_idleRestartTimer 	= parseLine( neighbor, 'idle-restart-timer', digits ).map( ([$1, $2, seconds]) => seconds )
	
	const bgpNeigh_default_originate 	= parseLine( neighbor, 'default-originate').map((result)=>'enabled')
	const bgpNeigh_metric_out					= parseLine( neighbor, 'metric-out', digits).map((result)=>result[2])
	const bgpNeigh_ebgp_multihop			=	parseLine( neighbor, 'ebgp-multihop', digits).map((result)=>result[2])
	const bgpNeigh_gr_disabled				= parseLine( 'no', neighbor, 'graceful-restart'	).map((result)=>'disabled')
	const bgpNeigh_no_shutdown		= parseLine( 'no', neighbor, 'shutdown').map((result)=>true)
	const bgpNeigh_enforce_first_as_disabled 	= parseLine( 'no', neighbor, 'enforce-first-as'	).map((result)=>'disabled')	
	const bgpNeigh_enforce_first_as						= parseLine( neighbor, 'enforce-first-as'	).map((result)=>'enabled')
	
	const bgpNeigh_update_source 			= parseLine( neighbor, 'update-source', interfaceName).map((result)=>result[2])
	const bgpNeigh_additional_paths_disabled = parseLine( 'no', neighbor , 'additional-paths receive').map((result)=>'disabled')	
	
	const bgpNeigh_allowAS_in			 		= parseLine( neighbor, 'allowas-in', digits	).map( ([$1, $2, asnCount]) => asnCount )
	const bgpNeigh_allowAS_in_disabled= parseLine( 'no', neighbor, 'allowas-in'	).map( (result) => 'disabled' )
	
	// bgp network
	const bgpNetwork 									= parseLine ('network', ipNetwork, everythingUntil(eol) ).map( ([_, bgpNetwork, opt1, opt2 ]) => ({bgpNetwork, opt1, opt2 }) )
	
	// aggregate line parser(s)
	const bgpAggregateAddress 				= parseLine ('aggregate-address', ipNetwork, aggregateOptions, aggregateOptions ).map( ([_, aggregate, opt1, opt2 ]) => ({aggregate, opt1, opt2 }) )
	// redistribution line parsers
	const redistConnected_standard 		= parseLine ('redistribute connected route-map CONNECTED-TO-BGP').map( (res) => `CONNECTED-TO-BGP_exists` )
	const redistConnected_violation 	= parseLine ('redistribute connected', everythingUntil(eol) ).map( (res) => `VIOLATION(redistribute_connected): ${res[1]}`)
	const redistStatic_standard 			= parseLine ('redistribute static route-map STATIC-TO-BGP').map( (res) => `STATIC-TO-BGP_exists`)
	const redistStatic_violation 			= parseLine ('redistribute static',	everythingUntil(eol)).map( (res) => `VIOLATION(redistribute_static): ${res[1]}`)
	const redistViolation							 = parseLine ('redistribute', everythingUntil(eol) ).map( (res) => `VIOLATION(other): redistribute ${res[1]} is used`)
	// vrf line parsers
	const bgpVRF_header 							= parseLine ('vrf', vrfName).map( ([_, vrfName]) => vrfName  )
	const bgpVRF_rd_type1 						= parseLine ('rd', sequenceOf([ digits, colon, digits ]) ).map( ([_, [left, __, right ] ]) => `${left}:${right}`)
	const bgpVRF_rd_type2 						= parseLine ('rd', sequenceOf([ ipAddress, colon, digits ]) ).map( ([_, [left, __, right ] ]) => `${left}:${right}`)
	const bgpVRF_routeTarget_in 			= parseLine ('route-target import', routeTargetType, routeTarget).map( ([_, rt_type, rt_toImport ]) => `${rt_toImport}(${rt_type})`)
	const bgpVRF_routeTarget_out 			= parseLine ('route-target export', routeTargetType, routeTarget).map( ([_, rt_type, rt_toExport ]) => `${rt_toExport}(${rt_type})`)
	const bgpVRF_routeTarget_out_RM 	= parseLine ('route-target export', routeTargetType, 'route-map', routeMapName).map( ([$1, rt_type, $3, exportRouteMap ]) => `${exportRouteMap}(route-map)`)
	const bgpVRF_routeTarget_in_RM	  = parseLine ('route-target import', routeTargetType, 'route-map', routeMapName).map( ([$1, rt_type, $3, importRouteMap ]) => `${importRouteMap}(route-map)`)
	
	// default line parser / unrecognized
	const unknown 									=	parseLine (everythingUntil(eol)).map((res) => res[0])
	
	
	/*** BGP line parsers data tagging ****/
	
	// tagging for global config lines
	const bgpGlobal_param = oneOf(
		bgpGlobal_asDot.tag('usesAsDot'),
		bgpGlobal_asPlain.tag('usesAsPlain'),
		bgpGlobal_routerID.tag('routerID'),
		bgpGlobal_distance.tag('distance'),
		bgpGlobal_maxPath.tag('maxPath'),
		bgpGlobal_update_wait_install.tag('update_wait_install'),
		bgpGlobal_additional_paths_policy.tag('bgp_additional_paths_policy'),
		bgpGlobal_missing_policy_direction_in.tag('bgp_missing_policy_IN'),
		bgpGlobal_missing_policy_direction_out.tag('bgp_missing_policy_OUT'),
		unknown.log('UNK_bgpGlobal_param').tag('UNK_bgpGlobal_param')
	)
	
	// tagging for global config lines
	const bgpVRF_param = oneOf(
		bgpGlobal_routerID.tag('routerID'),
		bgpGlobal_distance.tag('distance'),
		bgpGlobal_maxPath.tag('maxPath'),
		bgpGlobal_update_wait_install.tag('update_wait_install'),
		bgpGlobal_additional_paths_policy.tag('bgp_additional_paths_policy'),
		bgpGlobal_missing_policy_direction_in.tag('bgp_missing_policy_IN'),
		bgpGlobal_missing_policy_direction_out.tag('bgp_missing_policy_OUT'),
		unknown.log('UNK_bgpVRF_param').tag('UNK_bgpVRF_param')
	)
	
	// tagging for neighbor lines
	const bgpPeer_param = oneOf(
		bgpNeigh_maxRoutes.tag('maximum_routes'),
		bgpNeigh_nhs.tag('uses_nhs'),
		bgpNeigh_remove_private_as.tag('uses_remove_private_as'),
		bgpNeigh_allowAS_in.tag('allowAs_in'),
		bgpNeigh_allowAS_in_disabled.tag('disabled'),
		bgpNeigh_passwd.tag('uses_passwd'),
		bgpNeigh_sendCommunity.tag('uses_send_community'),
		bgpNeigh_fallover.tag('uses_fallover'),
		bgpNeigh_timers.tag('timers'),			
		bgpNeigh_nhs.tag('nextHopSelf'),
		bgpNeigh_localAS.tag('localAs'),
		bgpNeigh_bfd.tag('uses_bfd'),
		bgpNeigh_desc.tag('description'),
		bgpNeigh_routeMap_in.tag('routeMap_in'),
		bgpNeigh_routeMap_out.tag('routeMap_out'),
		bgpNeigh_shutdown.tag('shutdown'),
		bgpNeigh_idleRestartTimer.tag('idleRestartTimer'),
		bgpNeigh_enforce_first_as.tag('enforce_first_as'),
		bgpNeigh_enforce_first_as_disabled.tag('enforce_first_as'),	
		bgpNeigh_gr_disabled.tag('graceful_restart'),
		bgpNeigh_default_originate.tag('default_originate'),
		bgpNeigh_metric_out.tag('metric_out'),
		bgpNeigh_ebgp_multihop.tag('ebgp_multihop'),
		bgpNeigh_no_shutdown.tag('no_shutdown'),
		bgpPeerGroup_remoteAS.tag('bgpPeerGroup_remoteAS'),
		bgpNeigh_update_source.tag('update_source'),
		bgpNeigh_additional_paths_disabled.tag('additional_paths'),
		unknown.log('UNK_bgpPeer_param').tag('UNK_bgpPeer_param')
	)
		
	
	/**** BGP redistribution statement types ****/
	const redistributionStatement = oneOf(
		redistConnected_standard,
		redistStatic_standard,
		redistConnected_violation,
		redistStatic_violation,
		redistViolation,
	)
	
	// route-distinguisher text formats:  
	const bgpVRF_rd = oneOf(
		bgpVRF_rd_type1,						//	<ipv4>:<16bit>
		bgpVRF_rd_type2,						//	<16bit>:<16bit>
	)

	
	// the start of a peer template (peer group) configuration
	const bgpPeerGroup_header = parseLine ( 'neighbor', peerGroup, 'peer group')
		.map( ([$1, peerIP, $3, peerAS]) 	=>	({peerIP, peerAS }) )
		
	// the start of a peer IP (neighbor) configuration, **** WITH references to a peer-group *** , so it's assumed to need further resolution with peer-group parameters
	const bgpPeerIP_header_unresolved = parseLine ( 'neighbor', ipAddress, oneOf('peer group', 'peer-group'), peerGroup )
		.map( ([ $1, peerIP, $3, peerGroup]) => ({peerType: 'unresolved',	peerIP,	peerGroup	}))
	
	// the start of a peer IP (neighbor) configuration, **** WITHOUT references to a peer-group *** 
	const bgpPeerIP_header_resolved = parseLine ( 'neighbor', ipAddress, 'remote-as', asn )
		.map( ([$1, peerIP, $3, peerAS]) 	=>	({ peerType: 'resolved', peerIP, peerAS }))
	
	const bgpPeerIP_header = oneOf(
		bgpPeerIP_header_unresolved,
		bgpPeerIP_header_resolved,
	)
	
	
	/**** BGP neighbor parser (works for global & VRFs ) ****/
	
	// this is how we know we're done parsing multiple lines for a single neighbor  (there is no simple delimiter separating neighbors)
	// **key assumption** : befcause we're matching 'endOfInput', this should only be used within a sub-parser such as 'parseSection'
	const bgpPeerIP_delimiters = oneOf(
		bgpPeerIP_header,
		bgpNetwork,										// neighbor ends when next line is like 'network' statement
		bgpAggregateAddress,					// neighbor ends when next line is like 'aggregate-address' statement
		redistributionStatement,			// neighbor ends when next line is like 'redistribute ...' statement
		endOfInput,										// neighbor ends when we're at the end of a section input 
	)
	
	// used with bgpPeerGroup to help delimit bgpPeerGroups.
	const bgpPeerGroup_delimiters = oneOf(
		bgpPeerGroup_header,										// another peer-group terminates the previous one
		parseLine( 'neighbor', ipAddress ),			// also, any neighbor <ipAddress> statement terminates the a bgp peer-group
	)
	
	
	/**** BGP per-vrf parser ****/
	
	const bgpVRF_routeTarget_in_types = oneOf(
		bgpVRF_routeTarget_in,
		bgpVRF_routeTarget_in_RM,
	)
	
	const bgpVRF_routeTarget_out_types = oneOf(
		bgpVRF_routeTarget_out,
		bgpVRF_routeTarget_out_RM,
	)
	
	const vrfConfig = seqOf(
		bgpVRF_header.tag('vrfName'),
		possibly(bgpVRF_rd).map(nullToStr).tag('rd'),
		many (bgpVRF_routeTarget_in_types).map( (rts)=>rts.join(', ') ).tag('routeTargets_in')	,
		many (bgpVRF_routeTarget_out_types).map( (rts)=>rts.join(', ') ).tag('routeTargets_out'),
	).getTaggedR()
	
	// parses all remaining lines in a VRF 
	const vrfParams = seqOf(
		vrfConfig,
		until(bgpPeerIP_delimiters, 
			many(bgpVRF_param).getTaggedR()
		)
	).map(flattenItem)
	
	
	/**** BGP peer-group parser ****/
	
	// parses all lines relevent to a single BGP peer group, and merges results into a single bgp peer template record
	const bgpPeerGroup = seqOf(
		bgpPeerGroup_header,															//  'neighbor', peerGroup, 'peer group'
		until( bgpPeerGroup_delimiters, 
			many( bgpPeer_param).getTaggedR(),
		).map(flattenItem)
	).map(flattenItem)
	
	
	/**** BGP peer-IP parser ****/
	
	// parses all lines relevent to a single BGP neighbor, and merges results into a single bgp peer record
	const bgpPeerIP =	seqOf(
		bgpPeerIP_header,
		until(bgpPeerIP_delimiters,
			many(bgpPeer_param).getTaggedR()
		)
	).map(flattenItem)
	
	
	
	/**** BGP Section Parsers ****/
	
	/**	globalSection - parses the entire BGP global section (up to, but not including, VRFs), and returns the following:
			Returns: {
				peerTemplates,
				globalPeers
			}
		*/
	const globalSection = parseSection(
		seqOf(
	
			// 1) bgp global, non-peer items
			seqOf(
				bgpGlobal_header,
				until(bgpPeerGroup_delimiters, 
					many(bgpGlobal_param).getTagged()
				)
			).map(flattenItem).tag('bgpGlobals'),
	
			// 2) bgp peer-group items
			many(bgpPeerGroup).tagList('peerTemplates'),
	
			// 3) bgp peer IP items
			many(bgpPeerIP).tagList('globalPeers'),
	
		).getTaggedR()
			.map( ({ bgpGlobals, peerTemplates, globalPeers }) => ({ 
				peerTemplates, 
				globalPeers: globalPeers.map( (item) => ({				// global peers need a vrfName and global parameters inserted...
					//
					vrfName:'', 
					...bgpGlobals, 
					...item, 
				}) ) 		// array map
			}))
	)
	
	const vrfSection = 	parseSection(
		seqOf(
			vrfParams.tag('vrfConfig'),
			many(bgpPeerIP).tagList('vrfPeers'),
		).getTaggedR().map(flattenItem)
	).map(multiplyBy_v2_lossy('vrfPeers'))
		.map(flattenArray)
	
	
	// this maps each bgpPeer record so that the fields displayed in the right order
	const formatColumns = ({
		peerIP,
		peerType,
		peerGroup,
		vrfName,
		description,
		thisAS,
		peerAS,
		localAS,
		routeMap_in,
		routeMap_out,
		uses_send_community,
		maximum_routes,
		rd,
		routeTargets_in,
		routeTargets_out,
		usesAsDot,
		routerID,
		distance,
		maxPath,
		uses_bfd,
		timers,
		vrfPeers,
		no_shutdown = false,
		shutdown = false,
		UNK_bgpPeer_param,
		...skipped
	}) => ({
		deviceName,
		peerIP,
		peerType: (thisAS == peerAS ) ? 'iBGP' : 'eBGP',
		is_disabled: (shutdown) ? true : (no_shutdown) ? false : false,
		peerGroup,
		vrfName: (vrfName=="") ? 'default' : vrfName,
		description,
		thisAS,
		peerAS,
		localAS,
		UNK_bgpPeer_param,
		routeMap_in,
		routeMap_out,
		uses_send_community,
		maximum_routes,
		rd,
		routeTargets_in,
		routeTargets_out,
		usesAsDot,
		routerID,
		distance,
		maxPath,
		uses_bfd,
		timers,
		vrfPeers,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})
	
	
	/**** Main parser ****/
	
	return seqOf(
		// advance through config up to (but not including) the 'router bgp' section
		gotoSection ('router bgp'),
		globalSection.tag('globals'),
		many(vrfSection).map(flattenArray).tagList('vrfPeers'),
	).getTaggedR()
	
		// pull peerTemplates out from under global, and then combine global and vrf peers for a final list of peers
		.map( ({ 
			globals: { 
				peerTemplates, 
				globalPeers 
			}, 
			vrfPeers 
		}) => ({
			peerTemplates, 
			bgpPeers: [...globalPeers, ...vrfPeers]
		}))

		// now the data is structured into bgpPeerTemplates and bgpPeers, resolve template data into peers
	//		.map(mapFn_resolvePeers)
		.map(mapArray(formatColumns))
		// .dataLog_toResult()
}


// end of v2 module: arista_cfg_bgpPeers
	
	
	
	
// comment this out when using in production
// get_eoscfg_bgp_peers ('test_device_name')
	
	

// comment this out when using in-browser IDE
export { get_eoscfg_bgp_peers }



