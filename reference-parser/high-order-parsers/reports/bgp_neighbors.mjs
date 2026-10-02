import { is } from '../../Pattern_Matching.mjs'

import { 
	possibly,
	seqOf,
	coroutine,
	lookAhead,
	hword,
	nullToArray,	
	groupByPropName,
	bifurcateArray,
	many,
	oneOf,
	gotoStr,
	untilStr,
	consolidate,
	consolidateBy,
	groupBy,
	importSwitchData,
	exportSwitchData,
	strng,
	digits,
	sequenceOf,
	ipUC,
	eol,
	everythingUntil,
	parseLine,
	ipAddress,
	rol,
	interfaceName,
	ipNetwork,
	flattenItem,
	until,
	nullToStr,
	parseSection,
	multiplyBy_v2_lossy,
	flattenArray,
	gotoSection,
	mapArray,
} from '../parser_modules.mjs'

import { colon } from '../../Parser_Text.mjs'
import { endOfInput } from '../../Parser_Core.mjs'
import { getTagged, mapFn_resolvePeers } from '../../Parser_Result_Helpers.mjs'
import { eos_cfg_prefix_lists } from '../eos-cfg/get_eoscfg_prefix_lists.mjs'
import { eos_cfg_route_map } from '../eos-cfg/get_eoscfg_route_maps.mjs'
import { IPv4, RoutingTable } from '../../ClassIPv4.mjs'



const nullTo_v2 = (result) => result===null ? {} : result

// normalized results when expecting a dataLog
const nullToArray_v3 = ({result=[], dataLog=[]}) => {result, dataLog}

// temp fake functions because these were in the main browser code (as self.postMessage{}) routines to call the Worker thread.
// these are just stubs

// allow the worker to update the result text as a status update, appending output in results window
const logStatus = (updateText) => self.postMessage({ cmd: 'logStatus', id: 100, data: { updateText } })

// allow the worker to update the results, appending outout in the popout window
const logResults = (name, results) => self.postMessage({ cmd: 'logResults', id: 103, data: { name, results } })

// allow the worker to update the results, appending outout in the popout window
const clearLog = () => self.postMessage({ cmd: 'clearLog', id: 104, data: {} })

const nameResult = (name) => (result) => {
	self.postMessage({ cmd: 'nameResult', id: 117, data: { name, result } })
}


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
const eos_cfg_bgpPeers = ( () => {
// legacy support...
const str = strng

/****** BGP intra-line parser helpers  ******/

const peerGroup = hword
const routeMapName = hword
const maxRoutes = digits
const asplain = digits
const asdot	=	sequenceOf([digits, str('.'), digits]).map( ([left, , right]) => `${left}.${right}` )
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
	str('vpn-ipv4'),
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
const bgpNeigh_localAS = parseLine( neighbor, 'local-as', asn, possibly(str('no-prepend')), possibly(str('replace-as')), rol)
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
const bgpNeigh_explicit_noshut		= parseLine( 'no', neighbor, 'shutdown').map((result)=>true)
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
	bgpGlobal_asDot.tagAs('usesAsDot'),
	bgpGlobal_asPlain.tagAs('usesAsPlain'),
	bgpGlobal_routerID.tagAs('routerID'),
	bgpGlobal_distance.tagAs('distance'),
	bgpGlobal_maxPath.tagAs('maxPath'),
	bgpGlobal_update_wait_install.tagAs('update_wait_install'),
	bgpGlobal_additional_paths_policy.tagAs('bgp_additional_paths_policy'),
	bgpGlobal_missing_policy_direction_in.tagAs('bgp_missing_policy_IN'),
	bgpGlobal_missing_policy_direction_out.tagAs('bgp_missing_policy_OUT'),
	unknown.log('UNK_bgpGlobal_param').tagAs('UNK_bgpGlobal_param')
)

// tagging for global config lines
const bgpVRF_param = oneOf(
	bgpGlobal_routerID.tagAs('routerID'),
	bgpGlobal_distance.tagAs('distance'),
	bgpGlobal_maxPath.tagAs('maxPath'),
	bgpGlobal_update_wait_install.tagAs('update_wait_install'),
	bgpGlobal_additional_paths_policy.tagAs('bgp_additional_paths_policy'),
	bgpGlobal_missing_policy_direction_in.tagAs('bgp_missing_policy_IN'),
	bgpGlobal_missing_policy_direction_out.tagAs('bgp_missing_policy_OUT'),
	unknown.log('UNK_bgpVRF_param').tagAs('UNK_bgpVRF_param')
)

// tagging for neighbor lines
const bgpPeer_param = oneOf(
	bgpNeigh_maxRoutes.tagAs('maximum_routes'),
	bgpNeigh_nhs.tagAs('uses_nhs'),
	bgpNeigh_remove_private_as.tagAs('uses_remove_private_as'),
	bgpNeigh_allowAS_in.tagAs('allowAs_in'),
	bgpNeigh_allowAS_in_disabled.tagAs('disabled'),
	bgpNeigh_passwd.tagAs('uses_passwd'),
	bgpNeigh_sendCommunity.tagAs('uses_send_community'),
	bgpNeigh_fallover.tagAs('uses_fallover'),
	bgpNeigh_timers.tagAs('timers'),			
	bgpNeigh_nhs.tagAs('nextHopSelf'),
	bgpNeigh_localAS.tagAs('localAs'),
	bgpNeigh_bfd.tagAs('uses_bfd'),
	bgpNeigh_desc.tagAs('description'),
	bgpNeigh_routeMap_in.tagAs('routeMap_in'),
	bgpNeigh_routeMap_out.tagAs('routeMap_out'),
	bgpNeigh_shutdown.tagAs('isShutDown'),
	bgpNeigh_idleRestartTimer.tagAs('idleRestartTimer'),
	bgpNeigh_enforce_first_as.tagAs('enforce_first_as'),
	bgpNeigh_enforce_first_as_disabled.tagAs('enforce_first_as'),	
	bgpNeigh_gr_disabled.tagAs('graceful_restart'),
	bgpNeigh_default_originate.tagAs('default_originate'),
	bgpNeigh_metric_out.tagAs('metric_out'),
	bgpNeigh_ebgp_multihop.tagAs('ebgp_multihop'),
	bgpNeigh_explicit_noshut.tagAs('explicit_no_shutdown'),
	bgpPeerGroup_remoteAS.tagAs('bgpPeerGroup_remoteAS'),
	bgpNeigh_update_source.tagAs('update_source'),
	bgpNeigh_additional_paths_disabled.tagAs('additional_paths'),
	unknown.log('UNK_bgpPeer_param').tagAs('UNK_bgpPeer_param')
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
	bgpVRF_header.tagAs('vrfName'),
	possibly(bgpVRF_rd).map(nullToStr).tagAs('rd'),
	many (bgpVRF_routeTarget_in_types).map( (rts)=>rts.join(', ') ).tagAs('routeTargets_in')	,
	many (bgpVRF_routeTarget_out_types).map( (rts)=>rts.join(', ') ).tagAs('routeTargets_out'),
).map(getTagged)

// parses all remaining lines in a VRF 
const vrfParams = seqOf(
	vrfConfig,
	until(bgpPeerIP_delimiters, 
		many(bgpVRF_param).map(getTagged)
	)
).map(flattenItem)


/**** BGP peer-group parser ****/

// parses all lines relevent to a single BGP peer group, and merges results into a single bgp peer template record
const bgpPeerGroup = seqOf(
	bgpPeerGroup_header,															//  'neighbor', peerGroup, 'peer group'
	until( bgpPeerGroup_delimiters, 
		many( bgpPeer_param).map(getTagged),
	).map(flattenItem)
).map(flattenItem)


/**** BGP peer-IP parser ****/

// parses all lines relevent to a single BGP neighbor, and merges results into a single bgp peer record
const bgpPeerIP =	seqOf(
	bgpPeerIP_header,
	until(bgpPeerIP_delimiters,
		many(bgpPeer_param).map(getTagged)
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
		).map(flattenItem)		
			.tagAs('bgpGlobals'),

		// 2) bgp peer-group items
		many(bgpPeerGroup)
			.tagAs('peerTemplates'),

		// 3) bgp peer IP items
		many(bgpPeerIP)
			.tagAs('globalPeers'),

	).map(getTagged)
		.map( ({ bgpGlobals, peerTemplates, globalPeers }) => ({ 
			peerTemplates, 
			globalPeers: globalPeers.map( (item) => ({				// global peers need a vrfName and global parameters inserted...
				vrfName:'global', 
				...bgpGlobals, 
				...item, 
			}) ) 		// array map
		}))
)

const vrfSection = 	parseSection(
	seqOf(
		vrfParams.tagAs('vrfConfig'),
		many(bgpPeerIP).tagAs('vrfPeers'),
	).map(getTagged).map(flattenItem)
).map(multiplyBy_v2_lossy('vrfPeers'))
	.map(flattenArray)


// this maps each bgpPeer record so that the fields displayed in the right order
const mapFn_structuredPeers = ({
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
	UNK_bgpPeer_param,
	...rest
}) => ({
	peerIP,
	peerType: (thisAS == peerAS ) ? 'iBGP' : 'eBGP',
	peerGroup,
	vrfName,
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
	...rest
})


/**** Main parser ****/

return seqOf(
	// advance through config up to (but not including) the 'router bgp' section
	gotoSection ('router bgp'),
	globalSection.tagAs('globals'),
	many(vrfSection).map(flattenArray).tagAs('vrfPeers'),
).map(getTagged)

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
	.map(mapFn_resolvePeers)

	// refine the column output  as defined by the above function mapFn_structuredPeers
	.map(mapArray(mapFn_structuredPeers))
	
}) ()



// end of v2 module: arista_cfg_bgpPeers





/**********************************************************************************************************************/
// per-switch config parser 
// NOTE: could be implemented without using coroutine, but coroutine at this level allows us
// to store data in variables & run console.log() / debugging commands
const switchCfgParser = ( () => coroutine( function* () {

	// helper parse to extract the hostname from the configuration
	const fastHostname = seqOf(
		gotoStr('hostname'),
		'hostname',
		hword,
	).map((result)=>result[2])				
  
	const switchName = yield fastHostname
	logStatus(`...parsing configuration for ${switchName}`)

	// each of these parser modules run through the entire config 
	//   the 'lookAhead' prevents the parser from advancing when the previous is finished,
	// 	 allowing more than one parser module to be used in any order(at the cost of some performance, but worth it
  
  
	/** v2 parsers */
	logStatus(`...${switchName}: parsing with 'arista_cfg_interface'... `)
	const {result:interfaces=[], dataLog:interfaces_dataLog=[]}	= yield possibly(lookAhead(get_eoscfg_interfaces(switchName)))
	// logStatus(`...${switchName}: parser 'arista_cfg_interface' completed`)

	logStatus(`...${switchName}: parsing with 'arista_cfg_ip_prefix_list'... `)
	const {result:prefixLists=[], dataLog:prefixLists_dataLog=[]} = yield possibly(lookAhead(get_eocscfg_prefix_list(switchName)))
	// logStatus(`...${switchName}:found ${prefixLists.length} records.`)
  
	logStatus(`...${switchName}: parsing with 'arista_cfg_route_map'...`)
	const {result:routeMaps=[], dataLog:routeMaps_dataLog=[]}	= yield possibly(lookAhead(get_eocscfg_route_map(switchName)))
	// logStatus(`...${switchName}:found ${routeMaps.length} records.`)
  
	logStatus(`...${switchName}: parsing parsing 'arista_cfg_ip_community_list'...`)
	const bgpCommunities = yield possibly(lookAhead(get_eocscfg_community_list(switchName))).map(nullToArray)
	// logStatus(`...${switchName}:found ${bgpCommunities.length} records.`)
  
	logStatus(`...${switchName}: parsing with 'arista_cfg_bgpPeers'...`)
	const bgpPeers = yield possibly(lookAhead(get_eocscfg_bgpPeers)).map(nullToArray)
	// logStatus(`...${switchName}:found ${bgpPeers.length} records.`)


  
	/***********************************************************************************
   * post-processing section 
   *   	take the datasets of the various parsers, and create useful data structures on 
   * 		a local (per device) basis.
   * 
   * 		note that these data structures must themselves be dsArrays (which are arrays 
   * 		of objects in which all objects (records) share the same property, and whose
   * 		values are all primitive (i.e. no sub-arrays or sub-objects).  Ideally, every
   * 		property is a string value at this stage, even if a value is an empty string.
   */
  
  
	/** Section 1 - route-Map local post-processing
   *	Goal:  For all configured route-maps on a given switch:
   * 		1) resolve all "match ip address prefix-list <pfxname>" entries, and 
   *		2) resolve all "match community <value>", and "set community" entries, with values configured only on the switch
   *  It should be noted that global community processing is done in the main routine (coroutine), 
   */ 
  
	/** first, work on bgp community resolution (matched names to values, and set values to names) */
  
	// community-list getter by name
	const commName_to_values_DB = groupByPropName('communityListName') (bgpCommunities)
	const has_communityValueDefined = (communityName) => commName_to_values_DB[communityName] ? true : false
	const get_commName_to_values_locally = (communityName) => {
		const matchingEntries = commName_to_values_DB[communityName]
		if (!matchingEntries) return `\nCONFIG_ERROR: community-list '${communityName}' does not exist\n`
  
		return (matchingEntries.length == 1) 	
			? matchingEntries.map( ({ format, value }) => `${format}=${value}` ).join(',')
			:	`multiple values: ${matchingEntries.map( ({ format, value }) => `${format}=${value}` ).join(',')}`
	}
  
  
	const commName_to_values_locally = (communityName) => {
		const matchingEntries = bgpCommunities
			.filter( (rec)=>rec.communityListName === communityName )
			.map( ({ format, value }) => `${format}=${value}` )
		return (matchingEntries.length == 0) ? `\nCONFIG_ERROR: no community value configured\n`
			: (matchingEntries.length == 1) ? `${matchingEntries[0]} (local)` 
			: `${matchingEntries.join(', ')} (ERROR: multiple values for ${communityName} configured locally on ${switchName})`
	}
  
	// community-list getter by value
	const commVal_to_names_locally = (communityValue) => {
		const matchingEntries = bgpCommunities
			.filter( (rec) => rec.value === communityValue)
			.map( (rec)=>rec.communityListName )
		return (matchingEntries.length == 0) ? `(no local CLs found)`
			: (matchingEntries.length == 1) ? `${matchingEntries[0]} (local)` 
			: `${matchingEntries[0]} (locally, multiple)`
	}
  
	/** next, work on prefix-list resolution (match names to  lists of networks ) */
  
	// prefix-list getter  (will be used to resolve routeMaps in a later step)
	const prefixListDB = groupByPropName('pfxName') (prefixLists)     // prefixListDB is just a single object lookup table, keyed by the prefix-list name
  
	// prefix-list output helper: per-entry (helper to pfxList_toString)
	const pfxEntry_toString = ({ pfxName, seqNo, action, prefix, range }) => (range)	? ` ${prefix} (${range})`	: ` ${prefix}`
  
	// create the 'getter' for prefixLists used in route-map resolution - per prefix-list
  
	const getPrefixListEntries = (pfxName) => prefixListDB[pfxName] 	// may return 'undefined' if referencing a prefix-list that does not exist
  
	// prefix-list output: per-prefix-list string output 
	// 	NOTE: use of '|\n' as a lineDelimiter looks like it produces nice output
	const pfxList_toString  = (pfxName) => {
		const lineDelimiter = '\n'
		const prefixListEntries = prefixListDB[pfxName]
		if (!prefixListEntries) return `CONFIG_ERROR: prefix-list ${pfxName} does not exist`
		if (prefixListEntries.length == 0) return `CONFIG_ERROR: prefix-list ${pfxName} contains no entries!`
		const [permittedEntries, otherEntries ] = bifurcateArray ( ({action})=>action=='permit' ) (prefixListEntries)
		const [deniedEntries, emptyEntries ] = bifurcateArray ( ({action})=>action=='deny' ) (otherEntries)
		// Note: all vars starting with 'rpt_' are components of the string build
		const rpt_pfxHeader = `${pfxName}`
		const rpt_permittedEntries = (permittedEntries.length > 0) 
			? permittedEntries.map(pfxEntry_toString).join(lineDelimiter) 
			: ``
		const rpt_deniedEntries = (deniedEntries.length > 0) 
			? `Denied Entries:${lineDelimiter}${deniedEntries.map(pfxEntry_toString).join(lineDelimiter)}`
			: ``
		const rpt_empty = (emptyEntries.length > 0) 
			? `CONFIG_ERR: empty prefix-list`
			: ``
  
		const rpt_permitted	= `${rpt_pfxHeader}${lineDelimiter}${rpt_permittedEntries}`
		const rpt_denied 		= `${lineDelimiter}${rpt_deniedEntries}`
  
		return `${rpt_permitted}${lineDelimiter}${rpt_denied}${lineDelimiter}${rpt_empty}${lineDelimiter}`
	}	
  
	/** finally, transform the routeMap output */
  
	const routeMaps_locallyResolved = routeMaps.map( ({ matchPrefixList, matchCommunity, setCommunity, ...routeMap }) => ({
		...routeMap,
		matchPrefixList: (matchPrefixList) ? `${pfxList_toString(matchPrefixList)}` : '',
		matchCommunity,
  
		matchCommunity_local: (matchCommunity) ? `${matchCommunity} (${ get_commName_to_values_locally(matchCommunity) })` : '',
  
		setCommunity,
		setCommunity_local: (setCommunity) ? `${setCommunity} ${commVal_to_names_locally(setCommunity)}` : '',
	}))
  
  
	/** Section 1 - interface post-processing
   *	Goal: find ip-enabled interfaces & add metadata
   * 		1) 
   *		2) 
   */ 
  
  
	// helper function - eliminate columns not needed for ip-interfaces w/regards to bgp peering, & re-order the rest
	const ipIntf_reduceRows = ({
		name,
		ip_addr,
		ip_masklen,
		vrf	= 'global',
		ipType,
		type,
		portMode,
		cfgState,
		desc,
		ip_has_nat_cfg,
		ip_has_igmpStaticGrp_cfg,
		ip_acl_in,
		ip_acl_out,
		ip_mc_acl_out,
		ip_mc_acl,
		ip_pim_sparsemode,
		ip_pim_border,
		ip_pim_dr_priority,
		ip_pim_bsr_border,
		ptpEnable,
		ptpDelayMechanism,
		ptpRole,
		varp_IP,
		flowControlRec,
		lldpNoTx,
		loadInterval,
		enabled,
		stp_bpduflter,
		ip_has_dhcp_helper_cfg,
		dot1q,
		speed,
		bfdCfg,
		queueMonitor,
		vrrp_priority,
		vrrp,
		l2_trunk,
		switchPortMode,
		UNK_arista_cfg_interface,
		...rest
	}) => ({
		$key: 							`${switchName}:${vrf}:${ip_addr}`,						// used to help match peer IPs on other switches (bgp, mlag, etc)
		name								,
		ip_addr							,
		ip_masklen					,
		ip_subnet						:	IPv4.of(`${ip_addr}/${ip_masklen}`)?.getNetwork()?.toString() ?? console.log('[ipIntf_reduceRows]: invalid_ip_address on interface ${name}', ip_addr) ?? `255.255.255.255`,
		vrf 								,
		cfgState 						,
		ipType							,
		type								,
		desc								,
		ip_acl_in						,
		ip_acl_out					,
		ip_has_nat_cfg			,
		ip_mc_acl						,
		ip_mc_acl_out				,
		ip_has_igmpStaticGrp_cfg,
		varp_IP							,
		ip_pim_sparsemode		,
		ip_pim_dr_priority	,
		ip_pim_border				,
		ip_pim_bsr_border		,
		lldpNoTx,
		dot1q,
		UNK_arista_cfg_interface,
		...rest 
	})


	// ip interfaces here are defined as any having an IP address (i.e. non-empty ipType)
	const ipInterfaces = interfaces
		.filter( (intf) => intf.ipType !== '')
		.map(ipIntf_reduceRows)



	/****************************************
   * Section 3 - bgpPeer local processing 
   *  - augments bgpPeers with local interface information, based on a lookup of the peer IP, and mapping
   *		the peer IP to a local interface
   * Note: Does not yet handle VRFs, where IP addresses may duplicate on same devices
   ***************************************/
  
	// converts "|" in strings to a newline & indent
	const makePretty = (descriptionString) => descriptionString.replaceAll('|','\n  ')
  
	// create a lookup cache for this switch's ip interface records by name
	const ipInterfaces_lookup_byName = groupByPropName ('name') (ipInterfaces)
  
	// create a RoutingTable object of this switch's ipInterface routes, so we can resolve bgpPeer IPs to local interface names by doing
	//	a route lookup (i.e. if bgpPeer IP is a subnet of the routing table, get the matchign routing table's data entry (containing the interface name)
	//	then use the name to look up the ipInterface record.
	const ipInterfaces_asLookup = ipInterfaces.map( ({ip_addr, ip_masklen, name, vrf}) => new IPv4(`${ip_addr}/${ip_masklen}`)?.getNetwork()?.setData({name, vrf}) ) ?? `[ipInterfaces_asLookup]:invalid_ip_address on interface ${name}`
	const localRt = new RoutingTable(ipInterfaces_asLookup)
  


	const resolveLocalIntf1 = (bgpPeerIP) => {
		const interfaceName = localRt.longestMatch(bgpPeerIP)?.data?.name ?? null
		if (!interfaceName) {						// if this happens, there
			console.error(`[resolveLocalIntf]: no local interface on switch ${switchName} found relating to peer IP ${bgpPeerIP} - likely the result of a switch misconfiguration`, {switchName, bgpPeerIP, localRt, ipInterfaces} )
			return {
				localIntf_name: 	`ERROR (see desc)`,
				localIntf_ip:			``,
				localIntf_desc: 	`ERROR - cannot resolve local interface switch ${switchName} for the bgp peer IP ${bgpPeerIP}\nLikely the result of an incomplete configuration.  See error console for details`,
				localIntf_ipType: ``,
				localIntf_type: 	``,
			}		// end of failure object
		}	// end of early return due to failure
		const { name, ip_addr, desc, ip_masklen, ipType, type } = ipInterfaces_lookup_byName[interfaceName][0]
		return {
			localIntf_name: 	name,
			localIntf_ip:			`${ip_addr}/${ip_masklen}`,
			localIntf_desc:		desc ?? '',     // was: 	makePretty(ipInterface.desc ?? ''),
			localIntf_ipType: ipType,
			localIntf_type: 	type,
		}		// end of success object
	}		// end of function
  
  
  
	const resolveLocalIntf2 = (bgpPeerIP, bgpPeerVRF) => {
		console.log(`[resolveLocalIntf2]: ${bgpPeerIP}, ${bgpPeerVRF}`)
		const matchingInterface = ipInterfaces.filter( (ipInterface) => IPv4.of(ipInterface.ip_subnet).isSupernetOf(bgpPeerIP) && ipInterface.vrf == bgpPeerVRF ) 
		// no matches found
		if (matchingInterface.length == 0) {
			console.error(`[resolveLocalIntf]: no local interface on switch ${switchName} found relating to peer IP ${bgpPeerIP} in vrf ${bgpPeerVRF}.  It is likely the result of a switch misconfiguration`, {switchName, bgpPeerIP, bgpPeerVRF, localRt, ipInterfaces} )
			return {
				localIntf_name: 	`ERROR_1`,
				localIntf_ip:			``,
				localIntf_desc: 	`ERROR - cannot resolve local interface on switch ${switchName} for the bgp peer IP ${bgpPeerIP}.  Likely the result of an incomplete configuration.  See error console for details`,
				localIntf_ipType: ``,
				localIntf_type: 	``,
			}		// end of failure object
		}	// end of early return due to failure
		if (matchingInterface.length > 1) {
			console.error(`[resolveLocalIntf]: multiple local interface on switch ${switchName} found relating to peer IP ${bgpPeerIP} in vrf ${bgpPeerVRF}.  This is likely a scripting bug`, {switchName, bgpPeerIP, bgpPeerVRF, localRt, ipInterfaces} )
			return {
				localIntf_name: 	`ERROR_2`,
				localIntf_ip:			``,
				localIntf_desc: 	`ERROR - multiple local interface on switch ${switchName} found relating to peer IP ${bgpPeerIP} in vrf ${bgpPeerVRF}.  This is likely a scripting bug.  See error console for details`,
				localIntf_ipType: ``,
				localIntf_type: 	``,
			}		// end of failure object
		}	// end of early return due to failure
  
		const { name, ip_addr, desc, ip_masklen, ipType, type } = matchingInterface[0]
		return {
			localIntf_name: 	name,
			localIntf_desc:		desc ?? '',
			//			localIntf_ip:			`${ip_addr}/${ip_masklen}`,
		}		// end of success object
	}		// end of function
  
  
	const resolveLocalIntf = 	resolveLocalIntf1
  
	const mapFn_bgpPeers_locallyResolved = ({
		peerIP,
		vrfName = 'global',
		...restOf_bgpPeer 
	}) => ({
		peerIP,
		vrfName,
		...restOf_bgpPeer,
		...resolveLocalIntf(peerIP, vrfName),
		//    localInterfaceData: resolveLocalIntf(peerIP, vrfName)
	})
  
  
	const bgpPeers_locallyResolved = bgpPeers.map(mapFn_bgpPeers_locallyResolved)						//  add local interface data to the peer for additional context
  
  
  
	/***********************************************************************************
   * data-export section
   * goal: 
   * 		each of the parsers above & resulting data only proccess data per device.
   * 		When the various dsArrays below (dataSets) are exported, they can be imported
   * 		in the final function (coroutine function below).
   * 
   * 		When data sets are imported below via 'importSwitchData', the structure of 
   * 		the dataSets is identical to how they are here, with two differences:
   * 			1) the 'switchName' property is added to each record
   * 			2) all the devices from many parser results are collected as a single, larger dsArray
   */ 
  
	const exported = exportSwitchData (switchName, {
		interfaces,
		interfaces_dataLog,
		ipInterfaces,
		bgpPeers,
		bgpPeers_locallyResolved,
		routeMaps,
		routeMaps_dataLog,
		routeMaps_locallyResolved,
		bgpCommunities,
		prefixLists,
		prefixLists_dataLog,
	})

	console.log(`exported for ${switchName}:`, {exported})
	
	return exported
})) ()
  
  
const fileImportDelimiter = `\n----@#@ delimiter #@#@----\n`
  
const fastParseConfig = seqOf(
	untilStr(fileImportDelimiter, switchCfgParser),
	fileImportDelimiter,
).map((result)=>result[0])


  
  
/****************************************************************************
  * Main function - this is where all the work should be done to mix data between tables
  *	The very first call - yield(many(...parsers)) is the final parsing task to iterate through
  * 	all the switch config.  
  *
  *	The .map(importSwitchData) is a helper function to aggregate the data imported 
  * 	a single table (per parserType).
  *
  *	everything afterwards is traditional data-manipulation
  *
  */
coroutine(function* () {
	clearLog()
  
	/****************************************************************************
  * Parse ALL data and return results in an object, one table per object entry
  *	returns results object:  imported
  */
	const imported = yield many(
		oneOf(
			fastParseConfig,
		)
	).map(importSwitchData)		// note: 'importSwitchData' will aggregate per-switch tables passed from the switch parser
  
	logStatus(`...rollup process started...`)
  
	// pull out the individual tables from 'imported', and if non-existent, initialize to empty table for consistency
	const {
		acls_per_remark		=	[],
		bgpCommunities 		= [],
		stdAclCfg 				= [],
		interfaces				= [],
		interfaces_dataLog = [],
		ipInterfaces			= [],
		natEntries				=	[],
		switchCfgResults 	= [],
		routeMaps 				= [],
		routeMaps_dataLog = [],
		routeMaps_locallyResolved = [],
		bgpSummary 				= [],
		bgpPeers					= [],
		bgpPeers_locallyResolved = [],
		bgpAggregates 		= [],
		bgpNetworks 			= [],
		bgpRedistributions= [],
		bgpVRFs 					= [],
		bgpVRFPeers 			= [],	
		prefixLists				= [],
		prefixLists_dataLog=[],
		prefixListDB			=	[],
	} = imported
  
	console.log('imported: ', imported)
  
  
	/********************************
   * Global IP-interface processing
   * Goal: Build data structures for ip address-to-host/interface lookup, and ipNetwork-to-switch/interface lookup for integration into other data structures
   */
  
	// converts "|" in strings to a newline & indent
	const makePretty = (descriptionString) => descriptionString.replaceAll('|','\n  ')
  
	// create dataset keyed by ipNetwork.  Will group interface records essentially into subnets
	// const ipInterfaces_reduced = ipInterfaces.filter( rec=>rec.ip_masklen<32).map( ipIntf_reduceRows )
  
	const global_IP_networks = groupByPropName ('ipNetwork_asStr') (ipInterfaces)
	const global_IP_interfaces = groupByPropName ('ip_addr') (ipInterfaces)
	const IP_interfaces_by_switch = groupByPropName ('switchName') (ipInterfaces)
  
	const duplicate_IP_interfaces = Object.fromEntries(Object.entries(global_IP_interfaces).filter( ([k,v])=>v.length > 1))
	const clean_IP_interfaces = Object.fromEntries(Object.entries(global_IP_interfaces).filter( ([k,v])=>v.length == 1))
  
	const findLocalIntf = (switchName, peerIP) => IP_interfaces_by_switch[switchName].filter( (intf) => new IPv4(peerIP).isSubnetOf(intf.ipNetwork) )[0]
  
  
  
  
	/***********************************************************************************
   * Global BGP Community processing
   *
   *	NOTE: community processing needs to be processed globally (i.e. after all switches have been parsed), because:
   *	1) communities matched or set by value on one switch without a community-list, 
   *     but defined on a community-list elsewhere , will never be resolved
   *  2) communities values to community-list mappings may be inconsistent across switches, but should be globally consistent
   *	
   */
	const bgpCommunity_global_consistency_byName_report = (bgpCommunities) => {
		const bgpComm_byName = {}
  
		//  Step 1: group all records by the communityList name (a lossless operation)
		bgpComm_byName.step1 = Object.values( groupByPropName('communityListName') (bgpCommunities) )
  
		//  Step 2: for each group of communityListNames, consolidate by 'value'.  This will deduplicate all records within 
		//	each per-communityListName grouping, while preserving the set of switchNames in a list also called 'switchName'
		bgpComm_byName.step2 = bgpComm_byName.step1.map(consolidate('value', 'switchName'))
  
		//	Step 3: separate each consolidated record into globally inconsistent vs globally consistent records,
		//	according to the following logic:
		//   - each step2 record with a lenth > 1 array means multiple values globally for that communityListName
		//   - each step2 record with a length = 1 array means there is a single value globally for that communityListName
		const [bad, good] = bifurcateArray( (obj) => Object.keys(obj).length > 1 ) (bgpComm_byName.step2) 


		/***** Now we're just formatting the output for easier string display */
  
		// For the inconsistently deployed communityListNames, since each name has multiple values, we need to group each into a single object (per name), hence the 'reduce'
		const inconsistentlyDeployedNames = bad.map( (badObj) => 
			Object.values(badObj).reduce( (combinedObj, {switchName, communityListName, format, value, ...rest} ) => ({
				communityListName,
				format,
				deviceCount: switchName.length,
				deployedAs: `'${value}${format=="value" ? '' : `(${format})`}' on ${switchName.join(', ')}\n${combinedObj?.deployedAs ?? ''}`,
				...rest
			}),
			Object.create(null)			// initial value of reducer
			))

		// convert the good results (which have one record, but each with an array of switchNames) into flat object per record,
		const consistentlyDeployedNames = good.map( (goodObj) => 
			Object.values(goodObj).map( ({switchName, communityListName, ...rest }) =>  ({
				communityListName,
				...rest,
				deviceCount: switchName.length,			// note that switchName is an array at this point because of the 'consolidate' operation
				deployedOn: switchName.join(','),
			})
			)).flat()
  
		return [
			inconsistentlyDeployedNames,
			consistentlyDeployedNames,
			bad,
		]
  
	}		// end of function bgpCommunity_global_consistency_report
  
  
  
  
	const bgpCommunity_global_consistency_byValue_report = (bgpCommunities) => {
		const bgpComm_byVal = {}
  
		//  Step 1: group all records by the community value (a lossless operation)
		bgpComm_byVal.step1 = Object.values(groupByPropName('value')(bgpCommunities))
  
		//  Step 2: for each group of community values, consolidate by 'communityListName'.  This will deduplicate all records within each value group
		//		 which have the same communityListName, but will collect the switchNames in a list also called 'switchName'
		//  Step 2: for each group of community values, consolidate by 'communityListName'.  This will deduplicate all records within 
		//	each per-value grouping, while preserving the set of switchNames in a list, also called 'switchName'
		bgpComm_byVal.step2	= bgpComm_byVal.step1.map( consolidate('communityListName', 'switchName') )
  
		//	Step 3: separate each consolidated record into globally inconsistent vs globally consistent records,
		//	according to the following logic:
		//   - each step2 record with a lenth > 1 array means multiple communityListNames globally for tha value
		//   - each step2 record with a length = 1 array means there is a single communityListName globally for that value
		const [ bad, good ] = bifurcateArray( (obj) => Object.keys(obj).length > 1 ) (bgpComm_byVal.step2) 
  
  
		/***** Now we're just formatting the output for easier string display */
  
		// For the inconsistently deployed community values, since each value has multiple names, we need to group each into a single object (per name), hence the 'reduce'
		const inconsistentlyDeployedValues = bad.map( (badObj) => 
			Object.values(badObj).reduce( (combinedObj, {switchName, value, communityListName, ...rest} ) => ({
				value,
				deviceCount: switchName.length,
				deployedAs: `'${communityListName}' on ${switchName.join(', ')}\n${combinedObj?.deployedAs ?? ''}`,
				...rest
			}),
			Object.create(null)			// initial value of reducer
			)) 
  
		// convert the good results (which have one record, but each with an array of switchNames) into flat object per record,
		const consistentlyDeployedValues = good.map( (goodObj) => 
			Object.values(goodObj).map( ({switchName, value, ...rest }) =>  ({
				value,
				...rest,
				deviceCount: switchName.length,			// note that switchName is an array at this point because of the 'consolidate' operation
				deployedOn: switchName.join(','),
			})
			)).flat()
  
		return [
			inconsistentlyDeployedValues,
			consistentlyDeployedValues,
			bad,
		]
  
	}		// end of function bgpCommunity_global_consistency_report
  
  
	// execute against our global bgpCommunity raw data
	const [inconsistentCommunities_byName, consistentCommunities_byName, badNames] = bgpCommunity_global_consistency_byName_report(bgpCommunities)
	const [inconsistentCommunities_byVal, consistentCommunities_byVal, badVals] = bgpCommunity_global_consistency_byValue_report(bgpCommunities)
  
	// build lookup caches for processed global communities
	const consistentCommunityDB_byName 		= groupByPropName ('communityListName') (consistentCommunities_byName)
	const inconsistentCommunityDB_byName	= groupByPropName ('communityListName')	(inconsistentCommunities_byName)
	const consistentCommunityDB_byVal 		= groupByPropName ('value')             (consistentCommunities_byName)
	const inconsistentCommunityDB_byVal		= groupByPropName ('value')							(inconsistentCommunities_byVal)
  
	// predicates to symantically help with checking the community caches 
	const commName_isInconsistent = (communityName)  	=> inconsistentCommunityDB_byName[communityName] 	? true : false
	const commName_isConsistent 	= (communityName)  	=> consistentCommunityDB_byName[communityName] 		? true : false
	const commVal_isInconsistent 	= (communityValue)  => inconsistentCommunityDB_byVal[communityValue] 	? true : false
	const commVal_isConsistent 		= (communityValue)  => consistentCommunityDB_byVal[communityValue] 		? true : false
  
	// used in the display of a route-map entry for any inconsistent communitiy
	const globallyInconsistentCommunityReport_byName = (communityName) =>`${inconsistentCommunityDB_byName[communityName][0].deployedAs}` 
	const globallyInconsistentCommunityReport_byVal = (communityValue) =>`${inconsistentCommunityDB_byVal[communityValue][0].deployedAs}` 
  
  
	// create lookup functions against consistentCommunities to mape names to values, and vice versa.  
	//  NOTE: these are the same lookup functions as per-switch community processing, but uses the 
	//  globally-resolved community database as a source
  
	const commName_to_values_globally = (communityName) => {
		return is.empty(communityName)							? `[commName_to_values_globally] ERR 1: Community name cannot be empty`
			: commName_isInconsistent(communityName)	? `${inconsistentCommunityDB_byName[communityName][0].deployedAs}` 
			: commName_isConsistent(communityName) 		? `${consistentCommunityDB_byName[communityName][0].deployedOn}`
			:																							`[commName_to_values_globally] ERR 2: Community name ${communityName} not found in cache`
	}
  
	// given a community value, find a global mappting
	const commVal_to_names_globally = (communityVal) => {
		return is.empty(communityVal) 							? undefined
			:	commVal_isConsistent(communityVal)			? `on ${consistentCommunityDB_byVal[communityVal][0].deployedOn}`
			:	commVal_isInconsistent(communityVal)		?	`(inconsistently) on ${inconsistentCommunityDB_byVal[communityVal][0].deployedAs}`
			:																							`${communityVal} (no matching community-lists, globally)`
	}
  
	// community-list getter by value
  
  
	/***********************************************************************************
   * Global route-map processing
   ***********************************************************************************/
  
	const routeMaps_globallyResolved = routeMaps_locallyResolved
		.map( ({
			matchCommunity,
			matchCommunity_local,
			setCommunity,
			setCommunity_local,
			...rest
		}) => ({
			matchCommunity: 									matchCommunity_local,
			setCommunity: 										setCommunity_local,
			matchCommunity_is_inconsistent:		commName_isInconsistent(matchCommunity) ? `${globallyInconsistentCommunityReport_byName(matchCommunity)}` : undefined,
			//		setCommunity_is_inconsistent: 		commVal_isInconsistent(setCommunity) 	? `${globallyInconsistentCommunityReport_byVal(setCommunity)}` 		: undefined,
			//		setCommunity_matchingNames:				commVal_to_names_globally(setCommunity),
			...rest
		}))
  
  
	// create a cache of routeMaps, using the switchName and route-map name combine as a database key (for performance)
	const rmCache = groupByPropName('key') (routeMaps_globallyResolved.map( ({switchName, name, entry, ...rest}) => ({key: `${switchName}:${name}`, switchName, name, entry, ...rest}) )) 
  
  
	// bgpPeer helpers

	const getRouteMapAsString_v2 = (switchName, routeMapName) => {
		const key = `${switchName}:${routeMapName}`
		const rm = (rmCache[key] ?? [])			// if already processes because of it's use in another peer, re-use the same results for performance...
			.map( (rmEntry) => {
				let returnVal = ``
				for (const k in rmEntry) {
					if (k==='entry') { returnVal += `${rmEntry[k]}:\n`; continue }
					if (!rmEntry[k]) continue
					if (k==='matchPrefixList') { returnVal += ` ${k}: ${rmEntry[k]}`; continue }
					if ( k.startsWith('match') || k.startsWith('set') || k.startsWith('flagged') ) { returnVal +=  ` ${k}: ${rmEntry[k]}\n` ; continue }
				}	// done w/iteration thru rmEntry object
				return returnVal
			})
		const routeMap_stringified = rm.join('\n')
		return (routeMap_stringified.length > 32000) 				// crappy thing do have to do due to MS Excel not liking large text values
			? `[getRouteMapAsString]: ***Output too large for MS EXCEL - truncating to 32000 bytes***\n${routeMap_stringified.slice(0,32000)}\n\n(...truncated ${routeMap_stringified.length-32000} bytes of remaining output...)` 
			: routeMap_stringified
	}
  
	
	const getRouteMapAsString_v1 = (switchName, routeMapName) => {
		const key = `${switchName}:${routeMapName}`
		const rm = (rmCache[key] ?? [])
			.map( (rmEntry) => {
				let returnVal = ``
				for (const k in rmEntry) {
					if (k==='entry') { returnVal += `${rmEntry[k]}:\n`; continue }
					if (!rmEntry[k]) continue
					if (k==='matchPrefixList') { returnVal += ` ${k}: ${rmEntry[k]}`; continue }
					if ( k.startsWith('match') || k.startsWith('set') || k.startsWith('flagged') ) { returnVal +=  ` ${k}: ${rmEntry[k]}\n` ; continue }
				}	// done w/iteration thru rmEntry object
				return returnVal
			})
		const routeMap_stringified = rm.join('\n')
		return (routeMap_stringified.length > 32000) 				// crappy thing do have to do due to MS Excel not liking large text values
			? `[getRouteMapAsString]: ***Output too large for MS EXCEL - truncating to 32000 bytes***\n${routeMap_stringified.slice(0,32000)}\n\n(...truncated ${routeMap_stringified.length-32000} bytes of remaining output...)` 
			: routeMap_stringified
	}
  


	// bgpPeer helpers
	const getRouteMapAsString_saved = (switchName, routeMapName) => {
		const rm = routeMaps_globallyResolved
			.filter( (rm)=>rm.switchName === switchName && rm.name === routeMapName)
			.map( (entry) => {
				let returnVal = ``
				for (const k in entry) {
					if (entry[k] && k !== 'switchName') returnVal += `${k}: ${entry[k]}\n`
				}
				return returnVal
			})
		return rm.join('\n')
	} 

	const getRouteMapAsString = getRouteMapAsString_v2
  
	/***********************************************************************************
   * Global bgpPeer processing
   ***********************************************************************************/
  
  
	const resolvePeerIntf = (bgpPeerIP) => {
		const peerInterfaceRec = global_IP_interfaces[bgpPeerIP]
		// fast failure cases
		if (!peerInterfaceRec) return {}									// peer IP not found - a common event if it's a 3rd party or the device was not processed by this script
		if (peerInterfaceRec.length > 1) return {					// peer IP had duplicate records globally
			peerIntf_name: 	`ERROR (see desc)`,
			peerIntf_ip:			``,
			//			peerIntf_desc: 	makePretty(`Error | The bgp peer IP ${bgpPeerIP} is not unique. | The address exists on the following devices: ${peerInterfaceRec.map(({switchName})=>switchName) .join(',')}`),
		}		// end of failure object
  
		const ipInterface = peerInterfaceRec[0]
		return {
			peerIntf_device: 	ipInterface.switchName,
			peerIntf_name: 		ipInterface.name,
			peerIntf_ip:			`${ipInterface.ip_addr}/${ipInterface.ip_masklen}`,
			//			peerIntf_desc: 		makePretty(ipInterface.desc ?? ''),
		}		// end of success object
	}
  
  
	const bgpPeers_resolved = bgpPeers_locallyResolved.map( ({ 
		switchName,
		peerIP,
		routeMap_in,
		routeMap_out,
		localInterfaceData,
		...restOf_bgpPeerRec
	}) => ({
		switchName,
		peerIP,
		routeMap_in,
		routeMap_out,
		routeMap_in_detail:  `${routeMap_in}:\n\n${getRouteMapAsString(switchName, routeMap_in)}`,
		routeMap_out_detail: `${routeMap_out}:\n\n${getRouteMapAsString(switchName, routeMap_out)}`,
		...restOf_bgpPeerRec,
		...localInterfaceData,
		...resolvePeerIntf(peerIP),
	}))
  
  
	logStatus(`...rollup process completed...`)
  
  
	// interface helpers
	const intf_searchDesc = (str_or_regx) => interfaces.filter( (intf) => intf.desc.match(str_or_regx) )
  
	// const interfaceDesc_searchResults = intf_searchDesc('flexa')
  
	const devicePOP 			= (deviceName) => deviceName.split('-')[0].toUpperCase()
  
	const device_A_or_B 	= (_deviceName) => {
		if (_deviceName==='') return ''
		const deviceName = _deviceName.toUpperCase()
		const suffix = deviceName.split('-').at(-1)
		const nxpSuffix = deviceName.slice(-6)
		// if NY4 spine, return as appropriate since it goes by different rules for odd/even
		if (deviceName.includes('8440-101-S')) return 'A'
		if (deviceName.includes('8440-102-S')) return 'B'
		if (suffix.startsWith('S')) return 'AB'		// spine case
  
		if (
			(suffix.startsWith('E')) 				|| // 'EDGE'
     (suffix.startsWith('A')) 				|| // 'ACCESS'
    (suffix.startsWith('CPE'))			|| // 'CPE'
    (suffix.startsWith('R')) 				|| // 'ROUTER'
    (nxpSuffix.startsWith('TORA')) 	|| // 'TORA'
    (nxpSuffix.startsWith('TORC')) 	|| // 'TORC'
    (nxpSuffix.startsWith('BBJR')) 	 	 // 'BBJR'
		) {
			return (parseInt(deviceName.slice(-2)) % 2 == 1)  ? 'A' : 'B' 
		}
		// no matches, return neutral 
		return ''
	}
	const deviceType 			= (deviceName) => {
		if (deviceName==='') return ''
		const suffix = deviceName.split('-').at(-1).toUpperCase()
		const nxpSuffix = deviceName.slice(-6).toUpperCase()
		return (suffix.startsWith('E')) 		? 'EDGE'
			: (suffix.startsWith('A')) 				? 'ACCESS'
			: (suffix.startsWith('CPE')) 			? 'CPE'
			: (suffix.startsWith('SS')) 			? 'SUPERSPINE'
			: (suffix.startsWith('S')) 				? 'SPINE'
			: (suffix.startsWith('R')) 				? 'ROUTER'
			: (suffix.startsWith('OOB')) 			? 'OOB'
			: (nxpSuffix.startsWith('TORA')) 	? 'TORA'
			: (nxpSuffix.startsWith('TORC')) 	? 'TORC'
			: (nxpSuffix.startsWith('BBJR')) 	? 'BBJR'
			: (nxpSuffix.startsWith('INET')) 	? 'INET'
			: `[deviceType]:UNKNOWN CLASS: ${deviceName}, suffix: ${suffix}, nxpSuffix:: ${nxpSuffix}`
	}
  
  
	const munge_bgpPeers = ({
		switchName,
		peerIP,
		routeMap_in,
		routeMap_out,
		routeMap_in_detail,
		routeMap_out_detail,
		peerType,
		peerGroup,
		vrfName,
		description,
		thisAS,
		peerAS,
		localAS,
		UNK_bgpPeer_param,
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
		uses_nhs,
		localAs2,
		UNK_bgpGlobal_param,
		uses_passwd,
		UNK_bgpVRF_param,
		idleRestartTimer,
		update_wait_install,
		bgp_missing_policy_IN,
		bgp_missing_policy_OUT,
		bgp_additional_paths_policy,
		uses_remove_private_as,
		graceful_restart,
		default_originate,
		enforce_first_as,
		disabled,
		allowAs_in,
		metric_out,
		explicit_no_shutdown,
		ebgp_multihop,
		uses_fallover,
		update_source,
		additional_paths,
		localIntf_name,
		localIntf_ip,
		localIntf_desc,
		localIntf_ipType,
		localIntf_type,
		peerIntf_device='',
		peerIntf_name,
		peerIntf_ip,
		peerIntf_desc,
		...rest
	}) => ({
		switchName,
		localDeviceType: deviceType(switchName),
		peerIntf_device,
		isHandoff: peerIntf_device=='',
		peerDeviceType: deviceType(peerIntf_device),
		localPOP: devicePOP(switchName),
		peerDevicePOP: devicePOP(peerIntf_device),
		localDevice_A_B: device_A_or_B(switchName),
		peerDevice_A_B: device_A_or_B(peerIntf_device),
		description,
		localIntf_desc,
		peerIntf_desc,
		vrfName,
		peerIP,
		thisAS,
		peerAS,
		localAS,
		localAs2,
		localIntf_name,
		peerIntf_name,
		localIntf_ip,
		peerIntf_ip,
		localIntf_ipType,
		localIntf_type,
		routeMap_in_detail,
		routeMap_out_detail,
		peerType,
		peerGroup,
		uses_send_community,
		rd,
		routeTargets_in,
		routeTargets_out,
		vrfPeers,
		bgp_additional_paths_policy,
		uses_remove_private_as,
		default_originate,
		enforce_first_as,
		allowAs_in,
		metric_out,
		explicit_no_shutdown,
		ebgp_multihop,
		update_source,
		additional_paths,
		UNK_bgpPeer_param,
		UNK_bgpGlobal_param,
		UNK_bgpVRF_param,
		disabled,
		...rest
	})
  
	const bgpPeers_globallyResolved = bgpPeers_resolved.map(munge_bgpPeers).map( ({
		switchName,
		peerIntf_device,
		isHandoff,
		localPOP,
		peerDevicePOP,
		localDevice_A_B,
		peerDevice_A_B,
		localDeviceType,
		peerDeviceType,
		...rest
	}) => ({
		switchName,
		localDeviceType,
		peerDeviceType,
		peerIntf_device,
		isHandoff,
		isPartnerPeer: ((localDevice_A_B == 'A') && (peerDevice_A_B == 'B')) || ((localDevice_A_B == 'B') && (peerDevice_A_B == 'A')),
		isWAN: localDeviceType == 'ROUTER' && peerDeviceType == 'ROUTER',
		localPOP,
		peerDevicePOP,
		localDevice_A_B,
		peerDevice_A_B,
		...rest
	}))
  
  
	nameResult ('ipInterfaces')                   (ipInterfaces)
	nameResult ('bgpCommunities')                 (bgpCommunities)
	nameResult ('prefixLists')                    (prefixLists)
	nameResult ('routeMaps')                      (routeMaps)
	nameResult ('bgpPeers_locallyResolved')       (bgpPeers_locallyResolved)
	nameResult ('bgpPeers_globallyResolved')      (bgpPeers_globallyResolved)
	nameResult ('routeMaps_locallyResolved')      (routeMaps_locallyResolved)
	nameResult ('routeMaps_globallyResolved')     (routeMaps_globallyResolved)
	nameResult ('consistentCommunities_byName')   (consistentCommunities_byName)
	nameResult ('consistentCommunities_byVal')    (consistentCommunities_byVal)
	nameResult ('inconsistentCommunities_byName') (inconsistentCommunities_byName)
	nameResult ('inconsistentCommunities_byVal')  (inconsistentCommunities_byVal)
	nameResult ('natEntries')  										(natEntries)
  
  
  
  
	return {
  
		// Not working:
		//  bgpSummary
		//  bgpAggregates 		
		//  bgpNetworks 			
		//  bgpRedistributions
		//  bgpVRFs 					
		//  bgpVRFPeers 
  
		// Working:
		// interfaceDesc_searchResults,
		bgpCommunities,
		inconsistentCommunities_byName,
		inconsistentCommunities_byVal,

		//	interfaces,
		//	interfaces_dataLog,
		//	bgpCommunities: (bgpCommunityErrors.length > 0) ? bgpCommunityErrors : bgpCommunities,
		//  consistentCommunities,
		//  inconsistentCommunities,
		prefixLists,
		prefixLists_dataLog,
		routeMaps,
		//routeMaps_dataLog,
		//routeMaps_globallyResolved,
		//routeMaps_locallyResolved,
		//	globalCommunityNames: consistentCommunities_byName,
		//	globalCommunitiesValues: consistentCommunities_byVal,
		ipInterfaces,
		bgpPeers_resolved,
		bgpPeers_globallyResolved,
		//routeMaps_globallyResolved,
		//	natEntries,
	}
})//.mapState(removeDataLog)
// end of coroutine (main function)
  
  
  
  
  
/**
  
  
  // Data for all devices:
  allDevices = ["717-c06-101-e01","717-c06-101-e02","ar-a-ct","ar-b-ct","arista 7150-a","arista 7150-b","asb-spd-arista01","aur-07-124-a01","aur-07-124-a02","aur-07-125-a01","aur-07-125-a02","aur-07-126-e01","aur-07-126-e02","aur-07-127-a01","aur-07-127-a02","aur-07-127-oob01","aur-07-128-a01","aur-07-128-a02","aur-07-128-oob01","aur-08-088-a01","aur-08-088-a02","aur-08-088-oob01","bas-h1p14s-e01","bas-h1p14s-e02","bas-h1p14s-oob01","bas-h1p15s-a01","bas-h1p15s-a02","bas-h1p15s-oob01","bas-h1p16s-a01","bas-h1p16s-a02","bas-h1p16s-oob01","bas-h1p18s-a01","bas-h1p18s-a02","bas-h1p18s-oob01","bme-a8-e01","bme-a8-e02","bme-a8-oob01","bme-a8-r01","bme-a8-r02","bme-a9-a01","bme-a9-a02","bme-a9-oob01","cc1-9a07-1-e01","cc1-9a07-1-e02","cc2-6e-4-1303-e01","cc2-6e-4-1303-e02","cc2-6e-4-1303-oob01","cc2-6e-4-1303-r01","cc2-6e-4-1303-r02","cc2-6e-4-1304-a01","cc2-6e-4-1304-a02","cc2-6e-4-1304-oob01","ch4-8900-314-e01","ch4-8900-314-e02","ch4-8900-314-e05","ch4-8900-314-e06","ch4-8900-314-r01","ch4-8900-314-r02","crt-533-47-a01","crt-533-47-a02","crt-533-48-e01","crt-533-48-e02","crt-533-48-e03","crt-533-48-e04","crt-533-48-r01","crt-533-48-r02","crt-533-53-a01","crt-533-53-a02","crt-541-49-a01","crt-541-49-a02","crt-541-51-a01","crt-541-51-a02","crt-541-51-oob01","crt-541-52-oob01","crt-541-53-oob01","drt-255-c1-06-a01","drt-255-c1-06-a02","drt-255-c1-06-oob01","ehk-13-706-e01","ehk-13-706-e02","ehk-13-706-r01","ehk-13-706-r02","eqt-10-403-e01","eqt-10-403-e02","eqt-10-403-r01","eqt-10-403-r02","fr2-050900-1207-cpe01","fr2-050900-1207-cpe02","fr2-51100-912-a01","fr2-51100-912-a02","fr2-51100-913-a01","fr2-51100-913-a02","fr2-51100-913-oob01","fr2-51100-917-oob01","frc255tlxoob01","frclhrinxoob01","frcmiaflroob01","h8tordtlxswa01","hkx-a0312-a01","hkx-a0312-a02","hkx-a0312-oob01","hkx-a0403-a01","hkx-a0403-a02","hkx-a0404-e01","hkx-a0404-e02","hkx-a0404-e03","hkx-a0404-e04","hkx-a0404-e05","hkx-a0404-e06","hkx-a0404-oob01","hkx-a0404-oob02","hkx-a0404-r01","hkx-a0404-r02","it3-dh4-i12-e01","it3-dh4-i12-e02","it3-dh4-i12-oob01","it3-dh4-i12-r01","it3-dh4-i12-r02","it3-dh4-i13-a01","it3-dh4-i13-a02","it3-dh4-i13-oob01","jpx-jx12-1-08-e01","jpx-jx12-1-08-e02","jpx-jx12-1-08-oob01","jse-hu-57-e01","jse-hu-57-e02","jse-hu-57-oob01","jse-hu-57-r01","jse-hu-57-r02","jse-hu-58-a01","jse-hu-58-a02","jse-hu-58-oob01","ld4-0010-0121-cpe01","ld4-0010-0121-cpe02","ld4-0010-0122-cpe01","ld4-0010-0122-cpe02","ld4-002200-101-cpe01","ld4-002200-101-cpe02","ld4-002200-101-cpe03","ld4-002200-102-cpe01","ld4-002200-102-cpe02","ld4-002200-102-cpe03","ld4-3350-0202-a01","ld4-3350-0202-a02","ld4-3350-0202-oob01","ld4-3350-0203-oob1","ld4-3350-0204-oob2","ld4-efx5-0303-cpe01","ld4-efx5-0303-cpe02","lxh-103k-r52b02-a01","lxh-103k-r52b02-a02","lxh-104-r52b10-a01","lxh-104-r52b10-a02","lxh-104-r56b08-e01","lxh-104-r56b08-e02","mah-h4z47-c28-a01","mah-h4z47-c28-a02","mah-h4z47-c28-oob01","mah-h4z47-c29-a01","mah-h4z47-c29-a02","mah-h4z47-c29-oob01","mah-h4z47-c30-a01","mah-h4z47-c30-a02","mah-h4z47-c30-oob01","mah-h4z47-c31-a01","mah-h4z47-c31-a02","mah-h4z47-c31-oob01","mah-h4z47-c32-e02","mah-h4z47-c32-e04","mah-h4z47-c32-e06","mah-h4z47-c32-e08","mah-h4z47-c32-e10","mah-h4z47-c32-oob01","mah-h4z47-c32-r02","mah-h4z47-c32-t02","mah-h4z47-c33-cpe01","mah-h4z47-c33-e01","mah-h4z47-c33-e03","mah-h4z47-c33-e05","mah-h4z47-c33-e07","mah-h4z47-c33-e09","mah-h4z47-c33-oob01","mah-h4z47-c33-r01","mah-h4z47-c33-s01","mah-h4z47-c33-s02","mah-h4z47-c33-s03","mah-h4z47-c33-s04","mah-h4z47-c33-t01","mah-h4z47-d26-a01","mah-h4z47-d26-a02","mah-h4z47-d26-oob01","nxpaurcmetora05","nxpaurcmetora06","nxpfraeq2tora05","nxpfraeq2tora06","ny2-prod-ptp-7150s-01","ny4-09080-111-cpe01","ny4-09080-111-cpe02","ny4-09080-111-cpe03","ny4-09080-111-cpe04","ny4-09080-111-cpe05","ny4-09080-111-cpe06","ny4-6395-107-a01","ny4-6395-107-a02","ny4-6395-108-cpe01","ny4-6395-108-cpe02","ny4-6395-109-cpe01","ny4-6395-109-cpe02","ny4-6395-112-oob01","ny4-6395-113-oob01","ny4-6395-114-a01","ny4-6395-114-a02","ny4-6395-114-cpe01","ny4-6395-114-cpe02","ny4-6395-114-oob01","ny4-6395-115-a01","ny4-6395-115-a02","ny4-6395-115-cpe01","ny4-6395-115-oob01","ny4-6395-116-a01","ny4-6395-116-a02","ny4-6395-117-a01","ny4-6395-117-a02","ny4-6395-118-a01","ny4-6395-118-a02","ny4-6395-118-oob01","ny4-6395-119-a01","ny4-6395-119-a02","ny4-6395-119-oob01","ny4-6395-120-a01","ny4-6395-120-a02","ny4-6395-121-oob01","ny4-6395-121-oob02","ny4-7440-101-e01","ny4-7440-101-e02","ny4-7440-101-e03","ny4-7440-101-e04","ny4-7440-101-e05","ny4-7440-101-e06","ny4-7440-101-e07","ny4-7440-101-e08","ny4-7440-101-e09","ny4-7440-101-e10","ny4-7440-101-e11","ny4-7440-101-e12","ny4-7440-101-e13","ny4-7440-101-e14","ny4-7440-101-e15","ny4-7440-101-e16","ny4-7440-101-e17","ny4-7440-101-e18","ny4-7440-101-r01","ny4-7440-101-r02","ny4-7440-102-cpe01","ny4-7440-102-cpe02","ny4-7440-103-a01","ny4-7440-103-a02","ny4-7440-104-a01","ny4-7440-104-a02","ny4-7440-104-cpe01","ny4-7440-104-oob01","ny4-7440-105-a01","ny4-7440-105-a02","ny4-8440-101-a01","ny4-8440-101-a02","ny4-8440-101-oob01","ny4-8440-101-r01","ny4-8440-101-r03","ny4-8440-101-s01","ny4-8440-101-s02","ny4-8440-101-s03","ny4-8440-101-s04","ny4-8440-101-ss01","ny4-8440-102-oob01","ny4-8440-102-r02","ny4-8440-102-r04","ny4-8440-102-s01","ny4-8440-102-s02","ny4-8440-102-s03","ny4-8440-102-s04","ny4-8440-102-ss02","ny4-8440-105-a01","ny4-8440-105-a02","ny4-8440-107-a01","ny4-8440-107-a02","ny4-8440-108-a01","ny4-8440-108-a02","ny4-8440-108-cpe01","ny4-8440-108-cpe02","ny4-8440-108-cpe03","ny4-8440-108-cpe04","ny4-8440-110-cpe01","ny4-8440-110-cpe02","ny4-8440-110-cpe03","ny4-8440-110-cpe04","ny4-8440-110-cpe05","ny4-8440-110-cpe06","ny4-8440-110-cpe07","ny4-8440-113-cpe01","ny4-8440-113-cpe02","ny4-8440-113-cpe03","ny4-8440-113-cpe04","ny4-8440-113-cpe05","ny4-8440-113-cpe06","ny4-8440-113-cpe07","ny4-8440-s-ei01","ny4-8440-s-ei02","ny4-8830-323-cpe01","ny4-8830-323-cpe02","ny5-524155-102-a01","ny5-524155-102-a02","ny5-524155-102-cpe01","ny5-524155-102-cpe02","ny5-524155-103-a01","ny5-524155-103-a02","ny5-524155-104-a01","ny5-524155-104-a02","skd-o23-e01","skd-o23-e02","skd-o23-e03","skd-o23-e04","skd-o23-oob01","skd-o23-r01","skd-o23-r02","sng-5-304-r01","sng-5-304-r02","tex-colo2-q50-e01","tex-colo2-q50-e02","tex-colo2-q50-oob01","tex-colo2-q50-r01","tex-colo2-q50-r02","tex-colo2-q51-a01","tex-colo2-q51-a02","tex-colo2-q51-oob01","tfxlhrld4tora01","tfxlhrld4tora02","tlx-400-003-a01","tlx-400-003-a02","tlx-400-003-oob01","tnsmartmxtora03","tnsmartmxtora04","tr2-24425-203-e01","tr2-24425-203-e02","tr2-24425-203-oob01","tr2-24425-203-r01","tr2-24425-203-r02","tr2-24425-204-a01","tr2-24425-204-a02","tr2-24425-204-oob01"]
  
  // uncomment below anytime
  // importDataFromMongo(allDevices)
  
  // sample 
  importDataFromMongo([
  'ny4-7440-101-r01',
  'ny4-7440-101-r02',
  'ny4-7440-101-e01',
  'ny4-7440-101-e02',
  'ny4-7440-101-e11',
  'ny4-7440-101-e12',
  'crt-533-48-e01',
  'crt-533-48-e02',
  'crt-533-48-e03',
  'crt-533-48-e04',
  'crt-533-48-r01',
  'crt-533-48-r02',
  "mah-h4z47-c33-e01",
  "mah-h4z47-c32-e02",
  "mah-h4z47-c33-e03",
  "mah-h4z47-c32-e04",
  "mah-h4z47-c33-e05",
  "mah-h4z47-c32-e06",
  "mah-h4z47-c33-e07",
  "mah-h4z47-c32-e08",
  "mah-h4z47-c33-e09",
  "mah-h4z47-c32-e10",
  'mah-h4z47-c33-r01',
  'mah-h4z47-c32-r02',
  ])
  
  
  
  // download results
  //   Execute the below in a console window - not the code box at the bottom of ipTools
  //   NOTE: only 10 at a time seem to work.
  //
  //   Object.keys(parseResults).map( (dataSetName) => { 
  //     saveAs_csv  (dataSetName) ( parseResults[dataSetName] ) 
  //   })
  
  */
  
  